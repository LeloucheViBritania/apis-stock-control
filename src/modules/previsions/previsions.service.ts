// ============================================
// FICHIER: src/modules/previsions/previsions.service.ts
// Service de prévisions de stock et commandes
// ============================================

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  PrevisionStockQueryDto,
  PrevisionsCommandesQueryDto,
  PrevisionStockResponseDto,
  PrevisionCommandesResponseDto,
  PrevisionRuptureDto,
  MethodePrevision,
  PeriodeAnalyse,
} from './dto/previsions.dto';

interface MouvementAggrege {
  date: Date;
  entrees: number;
  sorties: number;
}

interface DonneesPrevision {
  consommationMoyenneJour: number;
  ecartType: number;
  tendance: 'HAUSSE' | 'STABLE' | 'BAISSE';
  coefficientTendance: number;
  historique: MouvementAggrege[];
}

@Injectable()
export class PrevisionsService {
  private readonly logger = new Logger(PrevisionsService.name);

  // Paramètres de configuration
  private readonly JOURS_HISTORIQUE_DEFAUT = 90;
  private readonly SEUIL_TENDANCE = 0.05; // 5% de variation pour détecter une tendance
  private readonly COEFFICIENT_SECURITE = 1.5; // Marge de sécurité pour les commandes

  constructor(private prisma: PrismaService) {}

  // ============================================
  // PRÉVISION STOCK D'UN PRODUIT
  // ============================================

  async getPrevisionStock(
    produitId: number,
    query: PrevisionStockQueryDto,
  ): Promise<PrevisionStockResponseDto> {
    const {
      entrepotId,
      joursPrevisison = 30,
      methode = MethodePrevision.MOYENNE_MOBILE,
    } = query;

    // Récupérer le produit
    const produit = await this.prisma.produit.findUnique({
      where: { id: produitId },
      include: {
        categorie: { select: { nom: true } },
        inventaire: entrepotId
          ? { where: { entrepotId } }
          : true,
      },
    });

    if (!produit) {
      throw new NotFoundException(`Produit #${produitId} non trouvé`);
    }

    // Calculer le stock actuel
    const stockActuel = entrepotId
      ? produit.inventaire.reduce((sum, inv) => sum + inv.quantite, 0)
      : produit.quantiteStock;

    // Récupérer l'historique des mouvements
    const historique = await this.getHistoriqueMouvements(
      produitId,
      this.JOURS_HISTORIQUE_DEFAUT,
      entrepotId,
    );

    // Calculer les données de prévision
    const donneesPrevision = this.calculerDonneesPrevision(historique, methode);

    // Calculer les prévisions
    const joursAvantRupture = this.calculerJoursAvantRupture(
      stockActuel,
      donneesPrevision.consommationMoyenneJour,
    );

    const dateRupturePrevue = joursAvantRupture
      ? new Date(Date.now() + joursAvantRupture * 24 * 60 * 60 * 1000)
      : null;

    // Calculer les stocks prévisionnels
    const stockPrevuJ7 = Math.max(
      0,
      stockActuel - donneesPrevision.consommationMoyenneJour * 7,
    );
    const stockPrevuJ14 = Math.max(
      0,
      stockActuel - donneesPrevision.consommationMoyenneJour * 14,
    );
    const stockPrevuJ30 = Math.max(
      0,
      stockActuel - donneesPrevision.consommationMoyenneJour * 30,
    );

    // Déterminer le niveau d'urgence
    const niveauUrgence = this.determinerNiveauUrgence(
      stockActuel,
      produit.niveauStockMin,
      joursAvantRupture,
    );

    // Calculer la quantité suggérée de commande
    const quantiteSuggereCommande = this.calculerQuantiteSuggereCommande(
      produit,
      donneesPrevision,
      joursPrevisison,
    );

    // Date de commande suggérée (point de commande)
    const dateCommandeSuggeree = this.calculerDateCommandeSuggeree(
      stockActuel,
      produit.pointCommande || produit.niveauStockMin,
      donneesPrevision.consommationMoyenneJour,
    );

    // Message de recommandation
    const message = this.genererMessageRecommandation(
      niveauUrgence,
      joursAvantRupture,
      quantiteSuggereCommande,
    );

    // Calculer la fiabilité
    const fiabilite = this.calculerFiabilite(donneesPrevision, historique.length);

    return {
      produitId,
      produit: {
        reference: produit.reference,
        nom: produit.nom,
        categorie: produit.categorie?.nom,
      },
      stockActuel,
      stockMinimum: produit.niveauStockMin,
      pointCommande: produit.pointCommande,
      analyse: {
        consommationMoyenneJour: Math.round(donneesPrevision.consommationMoyenneJour * 100) / 100,
        consommationMoyenneSemaine: Math.round(donneesPrevision.consommationMoyenneJour * 7 * 100) / 100,
        consommationMoyenneMois: Math.round(donneesPrevision.consommationMoyenneJour * 30 * 100) / 100,
        ecartType: Math.round(donneesPrevision.ecartType * 100) / 100,
        tendance: donneesPrevision.tendance,
        coefficientVariation: donneesPrevision.consommationMoyenneJour > 0
          ? Math.round((donneesPrevision.ecartType / donneesPrevision.consommationMoyenneJour) * 100)
          : 0,
      },
      prevision: {
        joursAvantRupture,
        dateRupturePrevue,
        stockPrevuJ7: Math.round(stockPrevuJ7),
        stockPrevuJ14: Math.round(stockPrevuJ14),
        stockPrevuJ30: Math.round(stockPrevuJ30),
      },
      recommandation: {
        niveauUrgence,
        quantiteSuggereCommande,
        dateCommandeSuggeree,
        message,
      },
      historique: historique.slice(-30).map((h) => ({
        date: h.date.toISOString().split('T')[0],
        quantite: h.sorties,
      })),
      fiabilite,
    };
  }

  // ============================================
  // PRÉVISIONS GLOBALES DES COMMANDES
  // ============================================

  async getPrevisionsCommandes(
    query: PrevisionsCommandesQueryDto,
  ): Promise<PrevisionCommandesResponseDto> {
    const {
      periodeAnalyse = PeriodeAnalyse.TRIMESTRE,
      entrepotId,
      categorieId,
      joursPrevision = 30,
    } = query;

    const joursHistorique = this.getJoursFromPeriode(periodeAnalyse);
    const dateDebut = new Date();
    dateDebut.setDate(dateDebut.getDate() - joursHistorique);

    // Récupérer tous les produits actifs
    const whereClause: any = { estActif: true };
    if (categorieId) whereClause.categorieId = categorieId;

    const produits = await this.prisma.produit.findMany({
      where: whereClause,
      include: {
        categorie: { select: { id: true, nom: true } },
        inventaire: entrepotId ? { where: { entrepotId } } : true,
      },
    });

    const previsions: PrevisionRuptureDto[] = [];
    const alertes: any[] = [];
    const categoriesStats = new Map<string, {
      tendances: number[];
      produitsEnAlerte: number;
    }>();

    let valeurStockActuel = 0;
    let valeurCommandesSuggeres = 0;
    let produitsEnRupture = 0;
    let produitsEnAlerte = 0;

    for (const produit of produits) {
      const stockActuel = entrepotId
        ? produit.inventaire.reduce((sum, inv) => sum + inv.quantite, 0)
        : produit.quantiteStock;

      valeurStockActuel += stockActuel * Number(produit.coutUnitaire || 0);

      // Récupérer l'historique
      const historique = await this.getHistoriqueMouvements(
        produit.id,
        joursHistorique,
        entrepotId,
      );

      const donneesPrevision = this.calculerDonneesPrevision(
        historique,
        MethodePrevision.MOYENNE_MOBILE,
      );

      const joursAvantRupture = this.calculerJoursAvantRupture(
        stockActuel,
        donneesPrevision.consommationMoyenneJour,
      );

      const niveauUrgence = this.determinerNiveauUrgence(
        stockActuel,
        produit.niveauStockMin,
        joursAvantRupture,
      );

      const quantiteSuggereCommande = this.calculerQuantiteSuggereCommande(
        produit,
        donneesPrevision,
        joursPrevision,
      );

      if (niveauUrgence === 'CRITIQUE') produitsEnRupture++;
      if (['CRITIQUE', 'URGENT'].includes(niveauUrgence)) produitsEnAlerte++;

      valeurCommandesSuggeres += quantiteSuggereCommande * Number(produit.coutUnitaire || 0);

      const prevision: PrevisionRuptureDto = {
        produitId: produit.id,
        reference: produit.reference,
        nom: produit.nom,
        stockActuel,
        stockMinimum: produit.niveauStockMin,
        consommationMoyenneJour: Math.round(donneesPrevision.consommationMoyenneJour * 100) / 100,
        joursAvantRupture,
        dateRupturePrevue: joursAvantRupture
          ? new Date(Date.now() + joursAvantRupture * 24 * 60 * 60 * 1000)
          : null,
        niveauUrgence,
        quantiteSuggereCommande,
        tendance: donneesPrevision.tendance,
        fiabilite: this.calculerFiabilite(donneesPrevision, historique.length),
      };

      previsions.push(prevision);

      // Stats par catégorie
      const categorie = produit.categorie?.nom || 'Non catégorisé';
      if (!categoriesStats.has(categorie)) {
        categoriesStats.set(categorie, { tendances: [], produitsEnAlerte: 0 });
      }
      const catStats = categoriesStats.get(categorie)!;
      catStats.tendances.push(donneesPrevision.coefficientTendance);
      if (['CRITIQUE', 'URGENT'].includes(niveauUrgence)) {
        catStats.produitsEnAlerte++;
      }

      // Générer les alertes
      if (niveauUrgence === 'CRITIQUE') {
        alertes.push({
          type: 'RUPTURE_IMMINENTE',
          produitId: produit.id,
          message: `${produit.nom}: Rupture imminente dans ${joursAvantRupture || 0} jours`,
          priorite: 1,
        });
      } else if (niveauUrgence === 'URGENT') {
        alertes.push({
          type: 'STOCK_FAIBLE',
          produitId: produit.id,
          message: `${produit.nom}: Stock faible (${stockActuel} unités)`,
          priorite: 2,
        });
      }

      // Alerte surconsommation
      if (donneesPrevision.tendance === 'HAUSSE' && donneesPrevision.coefficientTendance > 0.2) {
        alertes.push({
          type: 'SURCONSOMMATION',
          produitId: produit.id,
          message: `${produit.nom}: Consommation en hausse de ${Math.round(donneesPrevision.coefficientTendance * 100)}%`,
          priorite: 3,
        });
      }
    }

    // Tendances par catégorie
    const tendancesCategories = Array.from(categoriesStats.entries()).map(
      ([categorie, stats]) => {
        const moyenneTendance =
          stats.tendances.reduce((a, b) => a + b, 0) / stats.tendances.length;
        return {
          categorie,
          tendance: this.getTendanceFromCoefficient(moyenneTendance),
          variationPourcentage: Math.round(moyenneTendance * 100),
          produitsEnAlerte: stats.produitsEnAlerte,
        };
      },
    );

    // Trier les prévisions par urgence
    previsions.sort((a, b) => {
      const ordreUrgence = { CRITIQUE: 0, URGENT: 1, ATTENTION: 2, OK: 3 };
      return ordreUrgence[a.niveauUrgence] - ordreUrgence[b.niveauUrgence];
    });

    // Trier les alertes par priorité
    alertes.sort((a, b) => a.priorite - b.priorite);

    return {
      periode: {
        debut: dateDebut,
        fin: new Date(),
        joursAnalyses: joursHistorique,
      },
      resume: {
        totalProduitsAnalyses: produits.length,
        produitsEnRupture,
        produitsEnAlerte,
        valeurStockActuel: Math.round(valeurStockActuel),
        valeurCommandesSuggeres: Math.round(valeurCommandesSuggeres),
      },
      previsions: previsions.slice(0, 50), // Limiter à 50 produits
      tendancesCategories,
      alertes: alertes.slice(0, 20), // Limiter à 20 alertes
    };
  }

  // ============================================
  // MÉTHODES PRIVÉES - CALCULS
  // ============================================

  /**
   * Récupérer l'historique des mouvements agrégés par jour
   */
  private async getHistoriqueMouvements(
    produitId: number,
    jours: number,
    entrepotId?: number,
  ): Promise<MouvementAggrege[]> {
    const dateDebut = new Date();
    dateDebut.setDate(dateDebut.getDate() - jours);

    const whereClause: any = {
      produitId,
      dateMouvement: { gte: dateDebut },
    };
    if (entrepotId) whereClause.entrepotId = entrepotId;

    const mouvements = await this.prisma.mouvementStock.findMany({
      where: whereClause,
      orderBy: { dateMouvement: 'asc' },
    });

    // Agréger par jour
    const parJour = new Map<string, MouvementAggrege>();

    for (const mvt of mouvements) {
      const dateKey = mvt.dateMouvement.toISOString().split('T')[0];
      
      if (!parJour.has(dateKey)) {
        parJour.set(dateKey, {
          date: new Date(dateKey),
          entrees: 0,
          sorties: 0,
        });
      }

      const jour = parJour.get(dateKey)!;
      if (['ENTREE', 'RETOUR'].includes(mvt.typeMouvement)) {
        jour.entrees += mvt.quantite;
      } else if (['SORTIE', 'TRANSFERT'].includes(mvt.typeMouvement)) {
        jour.sorties += mvt.quantite;
      }
    }

    // Remplir les jours manquants avec des zéros
    const result: MouvementAggrege[] = [];
    const current = new Date(dateDebut);
    const aujourdhui = new Date();

    while (current <= aujourdhui) {
      const dateKey = current.toISOString().split('T')[0];
      result.push(
        parJour.get(dateKey) || {
          date: new Date(dateKey),
          entrees: 0,
          sorties: 0,
        },
      );
      current.setDate(current.getDate() + 1);
    }

    return result;
  }

  /**
   * Calculer les données de prévision selon la méthode choisie
   */
  private calculerDonneesPrevision(
    historique: MouvementAggrege[],
    methode: MethodePrevision,
  ): DonneesPrevision {
    const sorties = historique.map((h) => h.sorties);

    let consommationMoyenneJour: number;

    switch (methode) {
      case MethodePrevision.MOYENNE_PONDEREE:
        consommationMoyenneJour = this.moyennePonderee(sorties);
        break;
      case MethodePrevision.LISSAGE_EXPONENTIEL:
        consommationMoyenneJour = this.lissageExponentiel(sorties);
        break;
      case MethodePrevision.TENDANCE_LINEAIRE:
        consommationMoyenneJour = this.tendanceLineaire(sorties);
        break;
      case MethodePrevision.MOYENNE_MOBILE:
      default:
        consommationMoyenneJour = this.moyenneMobile(sorties, 7);
    }

    const ecartType = this.calculerEcartType(sorties);
    const { tendance, coefficient } = this.calculerTendance(sorties);

    return {
      consommationMoyenneJour,
      ecartType,
      tendance,
      coefficientTendance: coefficient,
      historique,
    };
  }

  /**
   * Moyenne mobile simple
   */
  private moyenneMobile(valeurs: number[], periode: number): number {
    if (valeurs.length === 0) return 0;
    const dernieresValeurs = valeurs.slice(-periode);
    return dernieresValeurs.reduce((a, b) => a + b, 0) / dernieresValeurs.length;
  }

  /**
   * Moyenne pondérée (poids croissants pour les valeurs récentes)
   */
  private moyennePonderee(valeurs: number[]): number {
    if (valeurs.length === 0) return 0;
    
    let somme = 0;
    let sommePoids = 0;
    
    for (let i = 0; i < valeurs.length; i++) {
      const poids = i + 1; // Poids croissant
      somme += valeurs[i] * poids;
      sommePoids += poids;
    }
    
    return somme / sommePoids;
  }

  /**
   * Lissage exponentiel simple
   */
  private lissageExponentiel(valeurs: number[], alpha: number = 0.3): number {
    if (valeurs.length === 0) return 0;
    
    let prevision = valeurs[0];
    
    for (let i = 1; i < valeurs.length; i++) {
      prevision = alpha * valeurs[i] + (1 - alpha) * prevision;
    }
    
    return prevision;
  }

  /**
   * Tendance linéaire (régression)
   */
  private tendanceLineaire(valeurs: number[]): number {
    if (valeurs.length < 2) return valeurs[0] || 0;
    
    const n = valeurs.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += valeurs[i];
      sumXY += i * valeurs[i];
      sumX2 += i * i;
    }
    
    const pente = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - pente * sumX) / n;
    
    // Prévision pour le prochain jour
    return Math.max(0, intercept + pente * n);
  }

  /**
   * Calculer l'écart-type
   */
  private calculerEcartType(valeurs: number[]): number {
    if (valeurs.length === 0) return 0;
    
    const moyenne = valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
    const variance =
      valeurs.reduce((sum, val) => sum + Math.pow(val - moyenne, 2), 0) /
      valeurs.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Calculer la tendance
   */
  private calculerTendance(valeurs: number[]): {
    tendance: 'HAUSSE' | 'STABLE' | 'BAISSE';
    coefficient: number;
  } {
    if (valeurs.length < 14) {
      return { tendance: 'STABLE', coefficient: 0 };
    }

    const moitie = Math.floor(valeurs.length / 2);
    const premiereMoitie = valeurs.slice(0, moitie);
    const secondeMoitie = valeurs.slice(moitie);

    const moyennePremiere =
      premiereMoitie.reduce((a, b) => a + b, 0) / premiereMoitie.length;
    const moyenneSeconde =
      secondeMoitie.reduce((a, b) => a + b, 0) / secondeMoitie.length;

    if (moyennePremiere === 0) {
      return { tendance: 'STABLE', coefficient: 0 };
    }

    const coefficient = (moyenneSeconde - moyennePremiere) / moyennePremiere;

    let tendance: 'HAUSSE' | 'STABLE' | 'BAISSE';
    if (coefficient > this.SEUIL_TENDANCE) {
      tendance = 'HAUSSE';
    } else if (coefficient < -this.SEUIL_TENDANCE) {
      tendance = 'BAISSE';
    } else {
      tendance = 'STABLE';
    }

    return { tendance, coefficient };
  }

  /**
   * Calculer les jours avant rupture
   */
  private calculerJoursAvantRupture(
    stockActuel: number,
    consommationMoyenneJour: number,
  ): number | null {
    if (consommationMoyenneJour <= 0) return null;
    if (stockActuel <= 0) return 0;
    
    return Math.floor(stockActuel / consommationMoyenneJour);
  }

  /**
   * Déterminer le niveau d'urgence
   */
  private determinerNiveauUrgence(
    stockActuel: number,
    stockMinimum: number,
    joursAvantRupture: number | null,
  ): 'CRITIQUE' | 'URGENT' | 'ATTENTION' | 'OK' {
    if (stockActuel <= 0 || (joursAvantRupture !== null && joursAvantRupture <= 3)) {
      return 'CRITIQUE';
    }
    if (stockActuel <= stockMinimum || (joursAvantRupture !== null && joursAvantRupture <= 7)) {
      return 'URGENT';
    }
    if (stockActuel <= stockMinimum * 1.5 || (joursAvantRupture !== null && joursAvantRupture <= 14)) {
      return 'ATTENTION';
    }
    return 'OK';
  }

  /**
   * Calculer la quantité suggérée de commande
   */
  private calculerQuantiteSuggereCommande(
    produit: any,
    donneesPrevision: DonneesPrevision,
    joursPrevision: number,
  ): number {
    const consommationPrevue =
      donneesPrevision.consommationMoyenneJour * joursPrevision;
    
    const stockSecurite =
      donneesPrevision.ecartType * this.COEFFICIENT_SECURITE * Math.sqrt(joursPrevision);
    
    let quantiteSuggere = consommationPrevue + stockSecurite;

    // Ajuster selon la tendance
    if (donneesPrevision.tendance === 'HAUSSE') {
      quantiteSuggere *= 1.1; // +10%
    } else if (donneesPrevision.tendance === 'BAISSE') {
      quantiteSuggere *= 0.9; // -10%
    }

    // Respecter les contraintes min/max
    if (produit.niveauStockMax) {
      const stockActuel = produit.quantiteStock;
      quantiteSuggere = Math.min(quantiteSuggere, produit.niveauStockMax - stockActuel);
    }

    return Math.max(0, Math.ceil(quantiteSuggere));
  }

  /**
   * Calculer la date de commande suggérée
   */
  private calculerDateCommandeSuggeree(
    stockActuel: number,
    pointCommande: number,
    consommationMoyenneJour: number,
  ): Date | null {
    if (consommationMoyenneJour <= 0) return null;
    if (stockActuel <= pointCommande) return new Date(); // Commander maintenant

    const joursJusquAuPointCommande = Math.floor(
      (stockActuel - pointCommande) / consommationMoyenneJour,
    );

    const date = new Date();
    date.setDate(date.getDate() + joursJusquAuPointCommande);
    return date;
  }

  /**
   * Calculer la fiabilité de la prévision
   */
  private calculerFiabilite(
    donneesPrevision: DonneesPrevision,
    nombreJoursHistorique: number,
  ): number {
    let fiabilite = 50; // Base

    // Plus d'historique = plus fiable
    if (nombreJoursHistorique >= 90) fiabilite += 20;
    else if (nombreJoursHistorique >= 60) fiabilite += 15;
    else if (nombreJoursHistorique >= 30) fiabilite += 10;

    // Faible variation = plus fiable
    const cv = donneesPrevision.consommationMoyenneJour > 0
      ? donneesPrevision.ecartType / donneesPrevision.consommationMoyenneJour
      : 1;
    
    if (cv < 0.2) fiabilite += 20;
    else if (cv < 0.5) fiabilite += 10;
    else if (cv > 1) fiabilite -= 10;

    // Tendance stable = plus fiable
    if (donneesPrevision.tendance === 'STABLE') fiabilite += 10;

    return Math.min(95, Math.max(20, fiabilite));
  }

  /**
   * Générer un message de recommandation
   */
  private genererMessageRecommandation(
    niveauUrgence: string,
    joursAvantRupture: number | null,
    quantiteSuggere: number,
  ): string {
    switch (niveauUrgence) {
      case 'CRITIQUE':
        return `⚠️ URGENT: Commander immédiatement ${quantiteSuggere} unités. Rupture imminente!`;
      case 'URGENT':
        return `Commander rapidement ${quantiteSuggere} unités. Stock faible (${joursAvantRupture} jours restants).`;
      case 'ATTENTION':
        return `Prévoir une commande de ${quantiteSuggere} unités dans les prochains jours.`;
      default:
        return `Stock suffisant. Prochaine commande suggérée: ${quantiteSuggere} unités.`;
    }
  }

  /**
   * Convertir période en nombre de jours
   */
  private getJoursFromPeriode(periode: PeriodeAnalyse): number {
    switch (periode) {
      case PeriodeAnalyse.SEMAINE:
        return 7;
      case PeriodeAnalyse.MOIS:
        return 30;
      case PeriodeAnalyse.TRIMESTRE:
        return 90;
      case PeriodeAnalyse.ANNEE:
        return 365;
      default:
        return 90;
    }
  }

  /**
   * Obtenir la tendance depuis le coefficient
   */
  private getTendanceFromCoefficient(
    coefficient: number,
  ): 'HAUSSE' | 'STABLE' | 'BAISSE' {
    if (coefficient > this.SEUIL_TENDANCE) return 'HAUSSE';
    if (coefficient < -this.SEUIL_TENDANCE) return 'BAISSE';
    return 'STABLE';
  }
}