// ============================================
// FICHIER: src/modules/fournisseurs/fournisseurs-avances.service.ts
// Service pour les fonctionnalités avancées fournisseurs
// ============================================

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NoterFournisseurDto,
  FiltresCommandesFournisseurDto,
  FiltresProduitsFournisseurDto,
  SignalerIncidentDto,
  CategorieFournisseur,
} from './dto/fournisseurs-avances.dto';

@Injectable()
export class FournisseursAvancesService {
  private readonly logger = new Logger(FournisseursAvancesService.name);

  constructor(private prisma: PrismaService) {}

  // ============================================
  // ÉVALUATION FOURNISSEUR
  // ============================================

  async getEvaluation(fournisseurId: number) {
    // Vérifier que le fournisseur existe
    const fournisseur = await this.prisma.fournisseur.findUnique({
      where: { id: fournisseurId },
      select: {
        id: true,
        nom: true,
        email: true,
        telephone: true,
        estActif: true,
      },
    });

    if (!fournisseur) {
      throw new NotFoundException(`Fournisseur #${fournisseurId} non trouvé`);
    }

    // Récupérer ou créer les statistiques
    let statistiques = await this.prisma.statistiquesFournisseur.findUnique({
      where: { fournisseurId },
    });

    if (!statistiques) {
      // Calculer les statistiques initiales
      statistiques = await this.calculerEtMettreAJourStatistiques(fournisseurId);
    }

    // Récupérer les dernières évaluations
    const dernieresEvaluations = await this.prisma.evaluationFournisseur.findMany({
      where: { fournisseurId },
      orderBy: { dateEvaluation: 'desc' },
      take: 5,
      include: {
        evaluateur: { select: { id: true, nomComplet: true } },
        bonCommande: { select: { id: true, numeroCommande: true } },
      },
    });

    // Calculer la tendance
    const tendance = await this.calculerTendance(fournisseurId);

    // Calculer le rang
    const classement = await this.calculerClassement(fournisseurId);

    // Taux de recommandation
    const tauxRecommandation = statistiques.nombreEvaluations > 0
      ? (statistiques.nombreRecommandations / statistiques.nombreEvaluations) * 100
      : 0;

    return {
      fournisseurId,
      fournisseur: {
        id: fournisseur.id,
        nom: fournisseur.nom,
        email: fournisseur.email,
        telephone: fournisseur.telephone,
      },
      notes: {
        qualite: Number(statistiques.moyenneQualite),
        delai: Number(statistiques.moyenneDelai),
        prix: Number(statistiques.moyennePrix),
        communication: Number(statistiques.moyenneCommunication),
        conformite: Number(statistiques.moyenneConformite),
        globale: Number(statistiques.moyenneGlobale),
      },
      nombreEvaluations: statistiques.nombreEvaluations,
      tauxRecommandation: Math.round(tauxRecommandation),
      commandes: {
        total: statistiques.nombreCommandesTotal,
        livrees: statistiques.nombreCommandesLivrees,
        enRetard: statistiques.nombreCommandesEnRetard,
        montantTotal: Number(statistiques.montantTotalCommandes),
      },
      performance: {
        delaiMoyen: Number(statistiques.delaiLivraisonMoyen),
        tauxRespectDelai: Number(statistiques.tauxRespectDelai),
        tauxConformite: Number(statistiques.tauxConformite),
        nombreLitiges: statistiques.nombreLitiges,
      },
      classement,
      tendance,
      dernieresEvaluations: dernieresEvaluations.map((e) => ({
        id: e.id,
        fournisseurId: e.fournisseurId,
        bonCommandeId: e.bonCommandeId,
        numeroCommande: e.bonCommande?.numeroCommande,
        notes: {
          qualite: Number(e.noteQualite),
          delai: Number(e.noteDelai),
          prix: Number(e.notePrix),
          communication: Number(e.noteCommunication),
          conformite: Number(e.noteConformite),
          globale: Number(e.noteGlobale),
        },
        commentaire: e.commentaire,
        pointsForts: e.pointsForts,
        pointsAmeliorer: e.pointsAmeliorer,
        recommande: e.recommande,
        evaluateur: e.evaluateur
          ? { id: e.evaluateur.id, nom: e.evaluateur.nomComplet }
          : undefined,
        dateEvaluation: e.dateEvaluation,
      })),
    };
  }

  // ============================================
  // NOTER UN FOURNISSEUR
  // ============================================

  async noterFournisseur(
    fournisseurId: number,
    dto: NoterFournisseurDto,
    userId: number,
  ) {
    // Vérifier le fournisseur
    const fournisseur = await this.prisma.fournisseur.findUnique({
      where: { id: fournisseurId },
    });

    if (!fournisseur) {
      throw new NotFoundException(`Fournisseur #${fournisseurId} non trouvé`);
    }

    // Vérifier le bon de commande si spécifié
    if (dto.bonCommandeId) {
      const bonCommande = await this.prisma.bonCommandeAchat.findFirst({
        where: {
          id: dto.bonCommandeId,
          fournisseurId,
        },
      });

      if (!bonCommande) {
        throw new BadRequestException(
          `Bon de commande #${dto.bonCommandeId} non trouvé pour ce fournisseur`,
        );
      }

      // Vérifier qu'il n'existe pas déjà une évaluation pour ce bon
      const evaluationExistante = await this.prisma.evaluationFournisseur.findFirst({
        where: { bonCommandeId: dto.bonCommandeId },
      });

      if (evaluationExistante) {
        throw new BadRequestException(
          `Ce bon de commande a déjà été évalué`,
        );
      }
    }

    // Calculer la note globale (moyenne pondérée)
    const noteGlobale = this.calculerNoteGlobale(dto);

    // Créer l'évaluation
    const evaluation = await this.prisma.evaluationFournisseur.create({
      data: {
        fournisseurId,
        bonCommandeId: dto.bonCommandeId,
        noteQualite: dto.noteQualite,
        noteDelai: dto.noteDelai,
        notePrix: dto.notePrix,
        noteCommunication: dto.noteCommunication,
        noteConformite: dto.noteConformite,
        noteGlobale,
        commentaire: dto.commentaire,
        pointsForts: dto.pointsForts,
        pointsAmeliorer: dto.pointsAmeliorer,
        recommande: dto.recommande ?? true,
        evaluePar: userId,
      },
      include: {
        evaluateur: { select: { id: true, nomComplet: true } },
      },
    });

    // Mettre à jour les statistiques du fournisseur
    await this.calculerEtMettreAJourStatistiques(fournisseurId);

    this.logger.log(
      `Évaluation créée pour fournisseur #${fournisseurId} - Note: ${noteGlobale}`,
    );

    return {
      success: true,
      evaluation: {
        id: evaluation.id,
        fournisseurId,
        fournisseur: fournisseur.nom,
        notes: {
          qualite: dto.noteQualite,
          delai: dto.noteDelai,
          prix: dto.notePrix,
          communication: dto.noteCommunication,
          conformite: dto.noteConformite,
          globale: noteGlobale,
        },
        recommande: evaluation.recommande,
        dateEvaluation: evaluation.dateEvaluation,
      },
      message: `Évaluation enregistrée avec succès (${noteGlobale}/5)`,
    };
  }

  // ============================================
  // HISTORIQUE DES COMMANDES
  // ============================================

  async getHistoriqueCommandes(
    fournisseurId: number,
    filtres: FiltresCommandesFournisseurDto,
  ) {
    const fournisseur = await this.prisma.fournisseur.findUnique({
      where: { id: fournisseurId },
      select: { id: true, nom: true, email: true },
    });

    if (!fournisseur) {
      throw new NotFoundException(`Fournisseur #${fournisseurId} non trouvé`);
    }

    const { statut, dateDebut, dateFin, page = 1, limit = 20 } = filtres;

    // Construire le where
    const where: any = { fournisseurId };

    if (statut) {
      where.statut = statut;
    }

    if (dateDebut || dateFin) {
      where.dateCommande = {};
      if (dateDebut) where.dateCommande.gte = new Date(dateDebut);
      if (dateFin) where.dateCommande.lte = new Date(dateFin);
    }

    // Compter le total
    const total = await this.prisma.bonCommandeAchat.count({ where });

    // Récupérer les commandes
    const commandes = await this.prisma.bonCommandeAchat.findMany({
      where,
      orderBy: { dateCommande: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        entrepot: { select: { id: true, nom: true } },
        lignes: { select: { id: true } },
        evaluations: { select: { id: true } },
      },
    });

    // Calculer le résumé
    const resume = await this.prisma.bonCommandeAchat.aggregate({
      where: { fournisseurId },
      _count: { id: true },
      _sum: { montantTotal: true },
    });

    const commandesLivrees = await this.prisma.bonCommandeAchat.count({
      where: { fournisseurId, statut: 'LIVREE' },
    });

    const commandesEnCours = await this.prisma.bonCommandeAchat.count({
      where: {
        fournisseurId,
        statut: { in: ['EN_ATTENTE', 'APPROUVE', 'EN_PREPARATION', 'EXPEDIEE'] },
      },
    });

    return {
      fournisseurId,
      fournisseur: {
        nom: fournisseur.nom,
        email: fournisseur.email,
      },
      resume: {
        nombreCommandes: resume._count.id,
        montantTotal: Number(resume._sum.montantTotal || 0),
        commandesLivrees,
        commandesEnCours,
        tauxLivraison: resume._count.id > 0
          ? Math.round((commandesLivrees / resume._count.id) * 100)
          : 0,
      },
      commandes: commandes.map((c) => {
        const retard = this.calculerRetard(c);
        return {
          id: c.id,
          numeroCommande: c.numeroCommande,
          dateCommande: c.dateCommande,
          dateLivraisonPrevue: c.dateLivraisonPrevue,
          dateLivraisonReelle: c.dateLivraisonReelle,
          statut: c.statut,
          montantTotal: Number(c.montantTotal),
          nombreLignes: c.lignes.length,
          entrepot: c.entrepot,
          retard,
          aEteEvalue: c.evaluations.length > 0,
        };
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // CATALOGUE PRODUITS
  // ============================================

  async getCatalogueProduits(
    fournisseurId: number,
    filtres: FiltresProduitsFournisseurDto,
  ) {
    const fournisseur = await this.prisma.fournisseur.findUnique({
      where: { id: fournisseurId },
      select: { id: true, nom: true, email: true, conditionsPaiement: true },
    });

    if (!fournisseur) {
      throw new NotFoundException(`Fournisseur #${fournisseurId} non trouvé`);
    }

    const {
      categorieId,
      recherche,
      preferesUniquement,
      enStockUniquement,
      page = 1,
      limit = 20,
    } = filtres;

    // Construire le where pour ProduitFournisseur
    const where: any = { fournisseurId };

    if (preferesUniquement) {
      where.estPrefere = true;
    }

    // Filtres sur le produit
    const produitWhere: any = { estActif: true };

    if (categorieId) {
      produitWhere.categorieId = categorieId;
    }

    if (recherche) {
      produitWhere.OR = [
        { nom: { contains: recherche, mode: 'insensitive' } },
        { reference: { contains: recherche, mode: 'insensitive' } },
      ];
    }

    if (enStockUniquement) {
      produitWhere.quantiteStock = { gt: 0 };
    }

    where.produit = produitWhere;

    // Compter le total
    const total = await this.prisma.produitFournisseur.count({ where });

    // Récupérer les produits
    const produitsFournisseur = await this.prisma.produitFournisseur.findMany({
      where,
      orderBy: [{ estPrefere: 'desc' }, { produit: { nom: 'asc' } }],
      skip: (page - 1) * limit,
      take: limit,
      include: {
        produit: {
          select: {
            id: true,
            reference: true,
            nom: true,
            description: true,
            quantiteStock: true,
            categorie: { select: { id: true, nom: true } },
          },
        },
      },
    });

    // Récupérer les derniers achats
    const dernierAchatMap = new Map<number, any>();
    for (const pf of produitsFournisseur) {
      const derniereLigne = await this.prisma.ligneBonCommandeAchat.findFirst({
        where: {
          produitId: pf.produitId,
          bonCommande: { fournisseurId, statut: 'LIVREE' },
        },
        orderBy: { bonCommande: { dateLivraisonReelle: 'desc' } },
        include: {
          bonCommande: { select: { dateLivraisonReelle: true } },
        },
      });

      if (derniereLigne) {
        dernierAchatMap.set(pf.produitId, {
          date: derniereLigne.bonCommande.dateLivraisonReelle,
          quantite: derniereLigne.quantite,
          prix: Number(derniereLigne.prixUnitaire),
        });
      }
    }

    // Récupérer les catégories
    const categories = await this.prisma.produitFournisseur.groupBy({
      by: ['produitId'],
      where: { fournisseurId },
      _count: true,
    });

    const categoriesDistinctes = await this.prisma.categorie.findMany({
      where: {
        produits: {
          some: {
            produitsFournisseurs: {
              some: { fournisseurId },
            },
          },
        },
      },
      select: { id: true, nom: true },
    });

    // Compter les produits par catégorie
    const categoriesAvecComptage = await Promise.all(
      categoriesDistinctes.map(async (cat) => {
        const count = await this.prisma.produitFournisseur.count({
          where: {
            fournisseurId,
            produit: { categorieId: cat.id },
          },
        });
        return { id: cat.id, nom: cat.nom, nombreProduits: count };
      }),
    );

    // Compter les préférés
    const produitsPreferés = await this.prisma.produitFournisseur.count({
      where: { fournisseurId, estPrefere: true },
    });

    return {
      fournisseurId,
      fournisseur: {
        nom: fournisseur.nom,
        email: fournisseur.email,
        conditionsPaiement: fournisseur.conditionsPaiement,
      },
      resume: {
        nombreProduits: total,
        nombreCategories: categoriesDistinctes.length,
        produitsPreferés,
      },
      produits: produitsFournisseur.map((pf) => ({
        id: pf.id,
        produit: {
          id: pf.produit.id,
          reference: pf.produit.reference,
          nom: pf.produit.nom,
          description: pf.produit.description,
          categorie: pf.produit.categorie?.nom,
          stockActuel: pf.produit.quantiteStock,
        },
        prixUnitaire: Number(pf.prixUnitaire),
        delaiLivraisonJours: pf.delaiLivraisonJours,
        quantiteMinimale: pf.quantiteMinimumCommande,
        estPrefere: pf.estPrefere,
        referenceExterne: pf.referenceExterne,
        dernierAchat: dernierAchatMap.get(pf.produitId),
      })),
      categories: categoriesAvecComptage.sort((a, b) => b.nombreProduits - a.nombreProduits),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // SIGNALER UN INCIDENT
  // ============================================

  async signalerIncident(
    fournisseurId: number,
    dto: SignalerIncidentDto,
    userId: number,
  ) {
    const fournisseur = await this.prisma.fournisseur.findUnique({
      where: { id: fournisseurId },
    });

    if (!fournisseur) {
      throw new NotFoundException(`Fournisseur #${fournisseurId} non trouvé`);
    }

    if (dto.bonCommandeId) {
      const bonCommande = await this.prisma.bonCommandeAchat.findFirst({
        where: { id: dto.bonCommandeId, fournisseurId },
      });

      if (!bonCommande) {
        throw new BadRequestException(
          `Bon de commande #${dto.bonCommandeId} non trouvé pour ce fournisseur`,
        );
      }
    }

    const incident = await this.prisma.incidentFournisseur.create({
      data: {
        fournisseurId,
        bonCommandeId: dto.bonCommandeId,
        typeIncident: dto.typeIncident,
        description: dto.description,
        impact: dto.impact,
        montantImpact: dto.montantImpact,
        statut: 'OUVERT',
        signalePar: userId,
      },
    });

    // Mettre à jour les statistiques
    await this.calculerEtMettreAJourStatistiques(fournisseurId);

    this.logger.log(
      `Incident signalé pour fournisseur #${fournisseurId} - Type: ${dto.typeIncident}`,
    );

    return {
      success: true,
      incident: {
        id: incident.id,
        fournisseur: fournisseur.nom,
        type: incident.typeIncident,
        impact: incident.impact,
        statut: incident.statut,
        dateSignalement: incident.dateIncident,
      },
      message: `Incident signalé avec succès`,
    };
  }

  // ============================================
  // COMPARAISON FOURNISSEURS POUR UN PRODUIT
  // ============================================

  async comparerFournisseurs(produitId: number) {
    const produit = await this.prisma.produit.findUnique({
      where: { id: produitId },
      select: { id: true, reference: true, nom: true },
    });

    if (!produit) {
      throw new NotFoundException(`Produit #${produitId} non trouvé`);
    }

    const produitsFournisseurs = await this.prisma.produitFournisseur.findMany({
      where: { produitId },
      include: {
        fournisseur: {
          select: { id: true, nom: true, estActif: true },
        },
      },
    });

    // Récupérer les statistiques des fournisseurs
    const fournisseursAvecStats = await Promise.all(
      produitsFournisseurs.map(async (pf) => {
        const stats = await this.prisma.statistiquesFournisseur.findUnique({
          where: { fournisseurId: pf.fournisseurId },
        });

        const dernierAchat = await this.prisma.ligneBonCommandeAchat.findFirst({
          where: {
            produitId,
            bonCommande: { fournisseurId: pf.fournisseurId, statut: 'LIVREE' },
          },
          orderBy: { bonCommande: { dateLivraisonReelle: 'desc' } },
          include: {
            bonCommande: { select: { dateLivraisonReelle: true } },
          },
        });

        return {
          fournisseur: {
            id: pf.fournisseur.id,
            nom: pf.fournisseur.nom,
            noteGlobale: Number(stats?.moyenneGlobale || 0),
            categorie: stats?.categorie || 'N/A',
          },
          prixUnitaire: Number(pf.prixUnitaire),
          delaiLivraison: pf.delaiLivraisonJours || 0,
          estPrefere: pf.estPrefere,
          dernierAchat: dernierAchat?.bonCommande.dateLivraisonReelle,
        };
      }),
    );

    // Trier par prix
    fournisseursAvecStats.sort((a, b) => a.prixUnitaire - b.prixUnitaire);

    return {
      produitId,
      produit: {
        reference: produit.reference,
        nom: produit.nom,
      },
      fournisseurs: fournisseursAvecStats,
      meilleurPrix: fournisseursAvecStats.length > 0
        ? fournisseursAvecStats[0].prixUnitaire
        : 0,
      meilleurDelai: fournisseursAvecStats.length > 0
        ? Math.min(...fournisseursAvecStats.map((f) => f.delaiLivraison))
        : 0,
    };
  }

  // ============================================
  // MÉTHODES PRIVÉES
  // ============================================

  private calculerNoteGlobale(dto: NoterFournisseurDto): number {
    // Pondération : Qualité 25%, Délai 25%, Prix 20%, Communication 15%, Conformité 15%
    const noteGlobale =
      dto.noteQualite * 0.25 +
      dto.noteDelai * 0.25 +
      dto.notePrix * 0.2 +
      dto.noteCommunication * 0.15 +
      dto.noteConformite * 0.15;

    return Math.round(noteGlobale * 10) / 10;
  }

private async calculerEtMettreAJourStatistiques(fournisseurId: number) {
    // 1. Calculer les moyennes des évaluations
    const evaluations = await this.prisma.evaluationFournisseur.aggregate({
      where: { fournisseurId },
      _avg: {
        noteQualite: true,
        noteDelai: true,
        notePrix: true,
        noteCommunication: true,
        noteConformite: true,
        noteGlobale: true,
      },
      _count: { id: true },
    });

    const recommandations = await this.prisma.evaluationFournisseur.count({
      where: { fournisseurId, recommande: true },
    });

    // 2. Statistiques des commandes globales
    const commandes = await this.prisma.bonCommandeAchat.aggregate({
      where: { fournisseurId },
      _count: { id: true },
      _sum: { montantTotal: true },
    });

    // 3. Commandes livrées (Correction : Utilisation de l'Enum)
    const commandesLivrees = await this.prisma.bonCommandeAchat.count({
      where: { 
        fournisseurId, 
        statut: 'LIVREE'
      },
    });

    // 4. Commandes en retard (Correction : Calcul via JavaScript pour éviter l'erreur 'fields')
    // On récupère toutes les commandes terminées avec les deux dates
    const commandesPourRetard = await this.prisma.bonCommandeAchat.findMany({
      where: {
        fournisseurId,
        dateLivraisonReelle: { not: null },
        dateLivraisonPrevue: { not: null },
      },
      select: {
        dateLivraisonReelle: true,
        dateLivraisonPrevue: true,
      },
    });

    // On filtre manuellement : Reelle > Prevue
    const commandesEnRetard = commandesPourRetard.filter(c => 
      c.dateLivraisonReelle! > c.dateLivraisonPrevue!
    ).length;

    // 5. Délai moyen de livraison
    const commandesAvecDelai = await this.prisma.bonCommandeAchat.findMany({
      where: {
        fournisseurId,
        dateLivraisonReelle: { not: null },
        dateCommande: { not: null },
      },
      select: { dateCommande: true, dateLivraisonReelle: true },
    });

    let delaiMoyen = 0;
    if (commandesAvecDelai.length > 0) {
      const totalDelai = commandesAvecDelai.reduce((sum, c) => {
        // CORRECTION DE VOTRE ERREUR ICI :
        // On utilise "!" après dateLivraisonReelle et dateCommande 
        // car le "where" ci-dessus nous garantit qu'ils ne sont pas null.
        const dateReelle = c.dateLivraisonReelle!;
        const dateCmd = c.dateCommande!; // <--- Le "!" résout l'erreur 'possibly null'

        const delai = Math.ceil(
          (dateReelle.getTime() - dateCmd.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        return sum + delai;
      }, 0);
      delaiMoyen = totalDelai / commandesAvecDelai.length;
    }

    // 6. Calculs finaux
    const tauxRespectDelai = commandesLivrees > 0
      ? ((commandesLivrees - commandesEnRetard) / commandesLivrees) * 100
      : 0;

    const nombreLitiges = await this.prisma.incidentFournisseur.count({
      where: { fournisseurId },
    });

    const noteGlobale = Number(evaluations._avg.noteGlobale || 0);
    const categorie = this.determinerCategorie(noteGlobale, tauxRespectDelai);

    // 7. Mise à jour en base
    const statistiques = await this.prisma.statistiquesFournisseur.upsert({
      where: { fournisseurId },
      create: {
        fournisseurId,
        moyenneQualite: evaluations._avg.noteQualite || 0,
        moyenneDelai: evaluations._avg.noteDelai || 0,
        moyennePrix: evaluations._avg.notePrix || 0,
        moyenneCommunication: evaluations._avg.noteCommunication || 0,
        moyenneConformite: evaluations._avg.noteConformite || 0,
        moyenneGlobale: evaluations._avg.noteGlobale || 0,
        nombreEvaluations: evaluations._count.id,
        nombreRecommandations: recommandations,
        nombreCommandesTotal: commandes._count.id,
        nombreCommandesLivrees: commandesLivrees,
        nombreCommandesEnRetard: commandesEnRetard,
        montantTotalCommandes: commandes._sum.montantTotal || 0,
        delaiLivraisonMoyen: delaiMoyen,
        tauxRespectDelai,
        tauxConformite: 100 - (nombreLitiges * 2),
        nombreLitiges,
        categorie,
      },
      update: {
        moyenneQualite: evaluations._avg.noteQualite || 0,
        moyenneDelai: evaluations._avg.noteDelai || 0,
        moyennePrix: evaluations._avg.notePrix || 0,
        moyenneCommunication: evaluations._avg.noteCommunication || 0,
        moyenneConformite: evaluations._avg.noteConformite || 0,
        moyenneGlobale: evaluations._avg.noteGlobale || 0,
        nombreEvaluations: evaluations._count.id,
        nombreRecommandations: recommandations,
        nombreCommandesTotal: commandes._count.id,
        nombreCommandesLivrees: commandesLivrees,
        nombreCommandesEnRetard: commandesEnRetard,
        montantTotalCommandes: commandes._sum.montantTotal || 0,
        delaiLivraisonMoyen: delaiMoyen,
        tauxRespectDelai,
        tauxConformite: Math.max(0, 100 - (nombreLitiges * 2)),
        nombreLitiges,
        categorie,
      },
    });

    return statistiques;
  }

  private determinerCategorie(
    noteGlobale: number,
    tauxRespectDelai: number,
  ): CategorieFournisseur {
    const score = noteGlobale * 0.6 + (tauxRespectDelai / 100) * 5 * 0.4;

    if (score >= 4.5) return CategorieFournisseur.A;
    if (score >= 3.5) return CategorieFournisseur.B;
    if (score >= 2.5) return CategorieFournisseur.C;
    return CategorieFournisseur.D;
  }

  private async calculerTendance(fournisseurId: number): Promise<'HAUSSE' | 'STABLE' | 'BAISSE'> {
    const evaluations = await this.prisma.evaluationFournisseur.findMany({
      where: { fournisseurId },
      orderBy: { dateEvaluation: 'desc' },
      take: 10,
      select: { noteGlobale: true, dateEvaluation: true },
    });

    if (evaluations.length < 4) return 'STABLE';

    const moitie = Math.floor(evaluations.length / 2);
    const recentes = evaluations.slice(0, moitie);
    const anciennes = evaluations.slice(moitie);

    const moyenneRecentes = recentes.reduce((s, e) => s + Number(e.noteGlobale), 0) / recentes.length;
    const moyenneAnciennes = anciennes.reduce((s, e) => s + Number(e.noteGlobale), 0) / anciennes.length;

    const difference = moyenneRecentes - moyenneAnciennes;

    if (difference > 0.3) return 'HAUSSE';
    if (difference < -0.3) return 'BAISSE';
    return 'STABLE';
  }

  private async calculerClassement(fournisseurId: number) {
    const stats = await this.prisma.statistiquesFournisseur.findUnique({
      where: { fournisseurId },
    });

    if (!stats) {
      return { rang: undefined, categorie: CategorieFournisseur.C, totalFournisseurs: 0 };
    }

    // Compter les fournisseurs avec une meilleure note
    const meilleursRang = await this.prisma.statistiquesFournisseur.count({
      where: {
        moyenneGlobale: { gt: stats.moyenneGlobale },
      },
    });

    const totalFournisseurs = await this.prisma.statistiquesFournisseur.count();

    return {
      rang: meilleursRang + 1,
      categorie: (stats.categorie as CategorieFournisseur) || CategorieFournisseur.C,
      totalFournisseurs,
    };
  }

  private calculerRetard(commande: any): number | undefined {
    if (!commande.dateLivraisonPrevue) return undefined;

    const dateReference = commande.dateLivraisonReelle || new Date();
    const diffMs = dateReference.getTime() - commande.dateLivraisonPrevue.getTime();
    const diffJours = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    return diffJours > 0 ? diffJours : undefined;
  }
}