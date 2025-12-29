// ============================================
// FICHIER: src/modules/reapprovisionnement/reapprovisionnement.service.ts
// Service de réapprovisionnement automatique
// ============================================

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PrevisionsService } from '../previsions/previsions.service';
import {
  SuggererReapprovisionnementDto,
  CommanderAutoDto,
  SuggestionsReapprovisionnementResponseDto,
  SuggestionProduitDto,
  SuggestionFournisseurDto,
  ResultatCommandeAutoDto,
  StrategieReapprovisionnement,
  PrioriteSuggestion,
} from './dto/reapprovisionnement.dto';
import { MethodePrevision } from '../previsions/dto/previsions.dto';

@Injectable()
export class ReapprovisionnementService {
  private readonly logger = new Logger(ReapprovisionnementService.name);

  constructor(
    private prisma: PrismaService,
    private previsionsService: PrevisionsService,
  ) {}

  // ============================================
  // SUGGÉRER LES RÉAPPROVISIONNEMENTS
  // ============================================

  async suggerer(
    dto: SuggererReapprovisionnementDto,
  ): Promise<SuggestionsReapprovisionnementResponseDto> {
    const {
      entrepotId,
      categorieId,
      fournisseursIds,
      strategie = StrategieReapprovisionnement.POINT_COMMANDE,
      horizonJours = 30,
      alertesUniquement = false,
      grouperParFournisseur = true,
      budgetMax,
    } = dto;

    this.logger.log(
      `Génération des suggestions - Stratégie: ${strategie}, Horizon: ${horizonJours}j`,
    );

    // Récupérer les produits avec leurs fournisseurs
    const whereClause: any = { estActif: true };
    if (categorieId) whereClause.categorieId = categorieId;

    const produits = await this.prisma.produit.findMany({
      where: whereClause,
      include: {
        categorie: { select: { nom: true } },
        inventaire: entrepotId ? { where: { entrepotId } } : true,
        produitsFournisseurs: {
          where: fournisseursIds
            ? { fournisseurId: { in: fournisseursIds } }
            : undefined,
          include: {
            fournisseur: {
              select: {
                id: true,
                nom: true,
                email: true,
                conditionsPaiement: true,
                estActif: true,
              },
            },
          },
          orderBy: { estPrefere: 'desc' },
        },
      },
    });

    const suggestions: SuggestionProduitDto[] = [];
    const produitsSansFournisseur: any[] = [];
    const parFournisseurMap = new Map<number, SuggestionFournisseurDto>();

    let produitsEnAlerte = 0;
    let produitsEnRupture = 0;

    for (const produit of produits) {
      // Calculer le stock actuel
      const stockActuel = entrepotId
        ? produit.inventaire.reduce((sum, inv) => sum + inv.quantite, 0)
        : produit.quantiteStock;

      // Obtenir les prévisions
      const prevision = await this.previsionsService.getPrevisionStock(
        produit.id,
        { entrepotId, joursPrevisison: horizonJours, methode: MethodePrevision.MOYENNE_MOBILE },
      );

      // Déterminer la priorité
      const priorite = this.determinerPriorite(prevision.recommandation.niveauUrgence);

      if (priorite === PrioriteSuggestion.CRITIQUE) produitsEnRupture++;
      if (['CRITIQUE', 'HAUTE'].includes(priorite)) produitsEnAlerte++;

      // Appliquer le filtre alertes uniquement
      if (alertesUniquement && priorite === PrioriteSuggestion.BASSE) {
        continue;
      }

      // Calculer la quantité à commander selon la stratégie
      const quantiteSuggere = this.calculerQuantiteSelonStrategie(
        strategie,
        produit,
        stockActuel,
        prevision,
        horizonJours,
      );

      if (quantiteSuggere <= 0) continue;

      // Trouver le fournisseur préféré
      const fournisseurPrefere = produit.produitsFournisseurs.find(
        (pf) => pf.fournisseur.estActif,
      );

      if (!fournisseurPrefere) {
        produitsSansFournisseur.push({
          produitId: produit.id,
          reference: produit.reference,
          nom: produit.nom,
          quantiteSuggere,
        });
        continue;
      }

      const prixUnitaire = Number(fournisseurPrefere.prixUnitaire || produit.coutUnitaire || 0);
      const coutEstime = quantiteSuggere * prixUnitaire;

      const suggestion: SuggestionProduitDto = {
        produitId: produit.id,
        reference: produit.reference,
        nom: produit.nom,
        categorie: produit.categorie?.nom,
        stockActuel,
        stockMinimum: produit.niveauStockMin,
        pointCommande: produit.pointCommande,
        quantiteSuggere,
        consommationMoyenneJour: prevision.analyse.consommationMoyenneJour,
        joursAvantRupture: prevision.prevision.joursAvantRupture,
        priorite,
        fournisseurPrefere: {
          id: fournisseurPrefere.fournisseur.id,
          nom: fournisseurPrefere.fournisseur.nom,
          prixUnitaire,
          delaiLivraison: fournisseurPrefere.delaiLivraisonJours || 7,
        },
        coutEstime,
        justification: this.genererJustification(priorite, prevision, quantiteSuggere),
      };

      suggestions.push(suggestion);

      // Grouper par fournisseur
      if (grouperParFournisseur) {
        const fournisseurId = fournisseurPrefere.fournisseur.id;
        
        if (!parFournisseurMap.has(fournisseurId)) {
          parFournisseurMap.set(fournisseurId, {
            fournisseur: {
              id: fournisseurPrefere.fournisseur.id,
              nom: fournisseurPrefere.fournisseur.nom,
              email: fournisseurPrefere.fournisseur.email || undefined,
              conditionsPaiement: fournisseurPrefere.fournisseur.conditionsPaiement || undefined,
            },
            nombreProduits: 0,
            montantTotal: 0,
            delaiLivraisonMoyen: 0,
            produits: [],
          });
        }

        const groupe = parFournisseurMap.get(fournisseurId)!;
        groupe.produits.push(suggestion);
        groupe.nombreProduits++;
        groupe.montantTotal += coutEstime;
      }
    }

    // Calculer le délai moyen par fournisseur
    parFournisseurMap.forEach((groupe) => {
      const totalDelai = groupe.produits.reduce(
        (sum, p) => sum + (p.fournisseurPrefere?.delaiLivraison || 0),
        0,
      );
      groupe.delaiLivraisonMoyen = Math.round(totalDelai / groupe.produits.length);
    });

    // Appliquer le budget max si spécifié
    let parFournisseur = Array.from(parFournisseurMap.values());
    if (budgetMax) {
      parFournisseur = this.appliquerBudgetMax(parFournisseur, budgetMax);
    }

    // Trier par priorité
    suggestions.sort((a, b) => {
      const ordrePriorite = {
        CRITIQUE: 0,
        HAUTE: 1,
        MOYENNE: 2,
        BASSE: 3,
      };
      return ordrePriorite[a.priorite] - ordrePriorite[b.priorite];
    });

    // Calculer le montant total
    const montantTotalSuggere = suggestions.reduce((sum, s) => sum + s.coutEstime, 0);

    return {
      parametres: {
        strategie,
        horizonJours,
        entrepotId,
        categorieId,
      },
      resume: {
        totalProduits: suggestions.length,
        produitsEnAlerte,
        produitsEnRupture,
        montantTotalSuggere: Math.round(montantTotalSuggere),
        nombreFournisseurs: parFournisseurMap.size,
      },
      parFournisseur: parFournisseur.sort((a, b) => b.montantTotal - a.montantTotal),
      toutesLesSuggestions: suggestions,
      produitsSansFournisseur,
      dateGeneration: new Date(),
    };
  }

  // ============================================
  // CRÉER UN BON DE COMMANDE AUTOMATIQUE
  // ============================================

  async commander(
    dto: CommanderAutoDto,
    userId: number,
  ): Promise<ResultatCommandeAutoDto> {
    const {
      fournisseurId,
      entrepotId,
      lignes,
      utiliserSuggestions = true,
      notes,
      dateLivraisonSouhaitee,
    } = dto;

    // Vérifier le fournisseur
    const fournisseur = await this.prisma.fournisseur.findUnique({
      where: { id: fournisseurId },
    });

    if (!fournisseur || !fournisseur.estActif) {
      throw new NotFoundException(`Fournisseur #${fournisseurId} non trouvé ou inactif`);
    }

    // Vérifier l'entrepôt
    const entrepot = await this.prisma.entrepot.findUnique({
      where: { id: entrepotId },
    });

    if (!entrepot) {
      throw new NotFoundException(`Entrepôt #${entrepotId} non trouvé`);
    }

    // Déterminer les lignes de commande
    let lignesCommande: { produitId: number; quantite: number; prixUnitaire: number }[];

    if (lignes && lignes.length > 0) {
      // Utiliser les lignes fournies
      lignesCommande = await this.preparerLignesManuelles(lignes, fournisseurId);
    } else if (utiliserSuggestions) {
      // Générer les lignes depuis les suggestions
      lignesCommande = await this.preparerLignesFromSuggestions(fournisseurId, entrepotId);
    } else {
      throw new BadRequestException(
        'Aucune ligne de commande fournie et suggestions désactivées',
      );
    }

    if (lignesCommande.length === 0) {
      throw new BadRequestException(
        'Aucun produit à commander pour ce fournisseur',
      );
    }

    // Générer le numéro de commande
    const numeroCommande = await this.genererNumeroCommande();

    // Calculer les montants
    let montantTotal = 0;
    const lignesAvecMontant = lignesCommande.map((l) => {
      const montantLigne = l.quantite * l.prixUnitaire;
      montantTotal += montantLigne;
      return { ...l, montantLigne };
    });

    // Créer le bon de commande
    const bonCommande = await this.prisma.$transaction(async (tx) => {
      // Créer le bon
      const bon = await tx.bonCommandeAchat.create({
        data: {
          numeroCommande,
          fournisseurId,
          entrepotId,
          dateCommande: new Date(),
          dateLivraisonPrevue: dateLivraisonSouhaitee
            ? new Date(dateLivraisonSouhaitee)
            : await this.calculerDateLivraisonPrevue(fournisseurId),
          statut: 'EN_ATTENTE',
          montantTotal,
          notes: notes || `Commande automatique générée le ${new Date().toLocaleDateString('fr-FR')}`,
          creePar: userId,
        },
      });

      // Créer les lignes
      for (const ligne of lignesAvecMontant) {
        await tx.ligneBonCommandeAchat.create({
          data: {
            bonCommandeId: bon.id,
            produitId: ligne.produitId,
            quantite: ligne.quantite,
            prixUnitaire: ligne.prixUnitaire,
            tauxTaxe: 0,
          },
        });
      }

      return bon;
    });

    // Récupérer les infos des produits pour la réponse
    const produitsIds = lignesCommande.map((l) => l.produitId);
    const produits = await this.prisma.produit.findMany({
      where: { id: { in: produitsIds } },
      select: { id: true, reference: true },
    });

    const produitsMap = new Map(produits.map((p) => [p.id, p.reference]));

    this.logger.log(
      `Bon de commande ${numeroCommande} créé - ${lignesCommande.length} lignes - ${montantTotal} FCFA`,
    );

    return {
      success: true,
      bonCommande: {
        id: bonCommande.id,
        numeroCommande: bonCommande.numeroCommande,
        fournisseur: fournisseur.nom,
        entrepot: entrepot.nom,
        montantTotal: Number(bonCommande.montantTotal),
        nombreLignes: lignesCommande.length,
        dateLivraisonPrevue: bonCommande.dateLivraisonPrevue || undefined,
      },
      lignesCreees: lignesAvecMontant.map((l) => ({
        produitId: l.produitId,
        reference: produitsMap.get(l.produitId) || '',
        quantite: l.quantite,
        prixUnitaire: l.prixUnitaire,
        montantLigne: l.montantLigne,
      })),
      message: `Bon de commande ${numeroCommande} créé avec succès`,
    };
  }

  // ============================================
  // MÉTHODES PRIVÉES
  // ============================================

  /**
   * Déterminer la priorité depuis le niveau d'urgence
   */
  private determinerPriorite(niveauUrgence: string): PrioriteSuggestion {
    switch (niveauUrgence) {
      case 'CRITIQUE':
        return PrioriteSuggestion.CRITIQUE;
      case 'URGENT':
        return PrioriteSuggestion.HAUTE;
      case 'ATTENTION':
        return PrioriteSuggestion.MOYENNE;
      default:
        return PrioriteSuggestion.BASSE;
    }
  }

  /**
   * Calculer la quantité selon la stratégie
   */
  private calculerQuantiteSelonStrategie(
    strategie: StrategieReapprovisionnement,
    produit: any,
    stockActuel: number,
    prevision: any,
    horizonJours: number,
  ): number {
    const consommationPrevue = prevision.analyse.consommationMoyenneJour * horizonJours;
    const stockSecurite = prevision.analyse.ecartType * 1.5 * Math.sqrt(horizonJours);

    switch (strategie) {
      case StrategieReapprovisionnement.POINT_COMMANDE:
        // Commander pour atteindre le stock max ou couvrir l'horizon
        if (stockActuel <= (produit.pointCommande || produit.niveauStockMin)) {
          const cible = produit.niveauStockMax || consommationPrevue + stockSecurite;
          return Math.ceil(cible - stockActuel);
        }
        return 0;

      case StrategieReapprovisionnement.PERIODICITE_FIXE:
        // Commander pour couvrir exactement la période
        return Math.ceil(consommationPrevue + stockSecurite - stockActuel);

      case StrategieReapprovisionnement.JUSTE_A_TEMPS:
        // Commander le minimum nécessaire
        if (stockActuel <= produit.niveauStockMin) {
          return Math.ceil(consommationPrevue * 0.5);
        }
        return 0;

      case StrategieReapprovisionnement.STOCK_SECURITE:
        // Commander pour maximiser la sécurité
        const cibleSecurite = produit.niveauStockMax || (consommationPrevue * 2 + stockSecurite * 2);
        if (stockActuel < cibleSecurite * 0.5) {
          return Math.ceil(cibleSecurite - stockActuel);
        }
        return 0;

      default:
        return prevision.recommandation.quantiteSuggereCommande;
    }
  }

  /**
   * Générer la justification de la suggestion
   */
  private genererJustification(
    priorite: PrioriteSuggestion,
    prevision: any,
    quantite: number,
  ): string {
    const joursRestants = prevision.prevision.joursAvantRupture;

    switch (priorite) {
      case PrioriteSuggestion.CRITIQUE:
        return `⚠️ Rupture imminente! Stock épuisé dans ${joursRestants || 0} jours. Commander ${quantite} unités immédiatement.`;
      case PrioriteSuggestion.HAUTE:
        return `Stock faible. Rupture prévue dans ${joursRestants} jours. Recommandation: ${quantite} unités.`;
      case PrioriteSuggestion.MOYENNE:
        return `Stock en baisse. Prévoir commande de ${quantite} unités pour maintenir le niveau de service.`;
      default:
        return `Réapprovisionnement préventif suggéré: ${quantite} unités.`;
    }
  }

  /**
   * Appliquer le budget maximum
   */
  private appliquerBudgetMax(
    parFournisseur: SuggestionFournisseurDto[],
    budgetMax: number,
  ): SuggestionFournisseurDto[] {
    let budgetRestant = budgetMax;
    const resultat: SuggestionFournisseurDto[] = [];

    // Trier par priorité (fournisseurs avec produits critiques d'abord)
    parFournisseur.sort((a, b) => {
      const prioriteA = Math.min(
        ...a.produits.map((p) =>
          p.priorite === 'CRITIQUE' ? 0 : p.priorite === 'HAUTE' ? 1 : 2,
        ),
      );
      const prioriteB = Math.min(
        ...b.produits.map((p) =>
          p.priorite === 'CRITIQUE' ? 0 : p.priorite === 'HAUTE' ? 1 : 2,
        ),
      );
      return prioriteA - prioriteB;
    });

    for (const groupe of parFournisseur) {
      if (groupe.montantTotal <= budgetRestant) {
        resultat.push(groupe);
        budgetRestant -= groupe.montantTotal;
      } else {
        // Inclure partiellement
        const produitsInclus: SuggestionProduitDto[] = [];
        let montantGroupe = 0;

        // Trier les produits par priorité
        const produitsTries = [...groupe.produits].sort((a, b) => {
          const ordre = { CRITIQUE: 0, HAUTE: 1, MOYENNE: 2, BASSE: 3 };
          return ordre[a.priorite] - ordre[b.priorite];
        });

        for (const produit of produitsTries) {
          if (produit.coutEstime <= budgetRestant) {
            produitsInclus.push(produit);
            montantGroupe += produit.coutEstime;
            budgetRestant -= produit.coutEstime;
          }
        }

        if (produitsInclus.length > 0) {
          resultat.push({
            ...groupe,
            produits: produitsInclus,
            nombreProduits: produitsInclus.length,
            montantTotal: montantGroupe,
          });
        }
      }

      if (budgetRestant <= 0) break;
    }

    return resultat;
  }

  /**
   * Préparer les lignes manuelles
   */
  private async preparerLignesManuelles(
    lignes: { produitId: number; quantite: number; prixUnitaire?: number }[],
    fournisseurId: number,
  ): Promise<{ produitId: number; quantite: number; prixUnitaire: number }[]> {
    const result: { produitId: number; quantite: number; prixUnitaire: number }[] = [];

    for (const ligne of lignes) {
      // Récupérer le prix fournisseur si non fourni
      let prixUnitaire = ligne.prixUnitaire;

      if (!prixUnitaire) {
        const pf = await this.prisma.produitFournisseur.findFirst({
          where: {
            produitId: ligne.produitId,
            fournisseurId,
          },
        });

        if (pf?.prixUnitaire) {
          prixUnitaire = Number(pf.prixUnitaire);
        } else {
          const produit = await this.prisma.produit.findUnique({
            where: { id: ligne.produitId },
            select: { coutUnitaire: true },
          });
          prixUnitaire = Number(produit?.coutUnitaire || 0);
        }
      }

      result.push({
        produitId: ligne.produitId,
        quantite: ligne.quantite,
        prixUnitaire,
      });
    }

    return result;
  }

  /**
   * Préparer les lignes depuis les suggestions
   */
  private async preparerLignesFromSuggestions(
    fournisseurId: number,
    entrepotId: number,
  ): Promise<{ produitId: number; quantite: number; prixUnitaire: number }[]> {
    // Générer les suggestions pour ce fournisseur
    const suggestions = await this.suggerer({
      entrepotId,
      fournisseursIds: [fournisseurId],
      alertesUniquement: true,
    });

    const fournisseurSuggestions = suggestions.parFournisseur.find(
      (f) => f.fournisseur.id === fournisseurId,
    );

    if (!fournisseurSuggestions) {
      return [];
    }

    return fournisseurSuggestions.produits.map((p) => ({
      produitId: p.produitId,
      quantite: p.quantiteSuggere,
      prixUnitaire: p.fournisseurPrefere?.prixUnitaire || 0,
    }));
  }

  /**
   * Générer un numéro de commande unique
   */
  private async genererNumeroCommande(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const lastBon = await this.prisma.bonCommandeAchat.findFirst({
      where: {
        numeroCommande: { startsWith: `BC-${year}${month}` },
      },
      orderBy: { numeroCommande: 'desc' },
    });

    let sequence = 1;
    if (lastBon) {
      const lastSequence = parseInt(lastBon.numeroCommande.split('-')[2], 10);
      sequence = lastSequence + 1;
    }

    return `BC-${year}${month}-${String(sequence).padStart(4, '0')}`;
  }

  /**
   * Calculer la date de livraison prévue
   */
  private async calculerDateLivraisonPrevue(fournisseurId: number): Promise<Date> {
    // Récupérer le délai moyen du fournisseur
    const pf = await this.prisma.produitFournisseur.findFirst({
      where: { fournisseurId },
      select: { delaiLivraisonJours: true },
    });

    const delai = pf?.delaiLivraisonJours || 7;
    const date = new Date();
    date.setDate(date.getDate() + delai);
    return date;
  }
}