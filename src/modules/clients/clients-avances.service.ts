// ============================================
// FICHIER: src/modules/clients/clients-avances.service.ts
// Service pour les fonctionnalités avancées clients
// ============================================

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FiltresHistoriqueAchatsDto,
  BloquerClientDto,
  DebloquerClientDto,
  ModifierLimiteCreditDto,
  FiltresSegmentationDto,
  AjouterNoteClientDto,
  SegmentClient,
  StatutClient,
} from './dto/clients-avances.dto';

import { StatutCommande } from '@prisma/client';

@Injectable()
export class ClientsAvancesService {
  private readonly logger = new Logger(ClientsAvancesService.name);

  constructor(private prisma: PrismaService) {}

  // ============================================
  // HISTORIQUE DES ACHATS
  // ============================================

  async getHistoriqueAchats(
    clientId: number,
    filtres: FiltresHistoriqueAchatsDto,
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, nom: true, email: true },
    });

    if (!client) {
      throw new NotFoundException(`Client #${clientId} non trouvé`);
    }

    const {
      dateDebut,
      dateFin,
      statut,
      entrepotId,
      inclureLignes = false,
      page = 1,
      limit = 20,
    } = filtres;

    // Construire le where
    const where: any = { clientId };

    if (statut) where.statut = statut;
    if (entrepotId) where.entrepotId = entrepotId;

    if (dateDebut || dateFin) {
      where.dateCommande = {};
      if (dateDebut) where.dateCommande.gte = new Date(dateDebut);
      if (dateFin) where.dateCommande.lte = new Date(dateFin);
    }

    // Compter le total
    const total = await this.prisma.commande.count({ where });

    // Récupérer les commandes
    const commandes = await this.prisma.commande.findMany({
      where,
      orderBy: { dateCommande: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        entrepot: { select: { id: true, nom: true } },
        lignes: inclureLignes
          ? {
              include: {
                produit: { select: { id: true, reference: true, nom: true } },
              },
            }
          : { select: { id: true } },
      },
    });

    // Calculer le résumé
    const resume = await this.prisma.commande.aggregate({
      where: { clientId },
      _count: { id: true },
      _sum: { montantTotal: true },
    });

    const derniereCommande = await this.prisma.commande.findFirst({
      where: { clientId },
      orderBy: { dateCommande: 'desc' },
      select: { dateCommande: true },
    });

    // Produits fréquents
    const produitsFrequents = await this.prisma.ligneCommande.groupBy({
      by: ['produitId'],
      where: { commande: { clientId } },
      _sum: { quantite: true },
      _count: { id: true },
      orderBy: { _sum: { quantite: 'desc' } },
      take: 5,
    });

    const produitsIds = produitsFrequents.map((p) => p.produitId);
    const produits = await this.prisma.produit.findMany({
      where: { id: { in: produitsIds } },
      select: { id: true, reference: true, nom: true },
    });

    const produitsMap = new Map(produits.map((p) => [p.id, p]));

    // Récupérer les stats du client
    const stats = await this.prisma.statistiquesClient.findUnique({
      where: { clientId },
    });

    return {
      clientId,
      client: {
        nom: client.nom,
        email: client.email,
        segment: stats?.segment || 'NOUVEAU',
      },
      resume: {
        nombreCommandes: resume._count.id,
        montantTotal: Number(resume._sum.montantTotal || 0),
        panierMoyen: resume._count.id > 0
          ? Number(resume._sum.montantTotal || 0) / resume._count.id
          : 0,
        derniereCommande: derniereCommande?.dateCommande,
      },
      commandes: commandes.map((c) => ({
        id: c.id,
        numeroCommande: c.numeroCommande,
        dateCommande: c.dateCommande,
        dateLivraison: c.dateLivraison,
        statut: c.statut,
        montantHT: Number(c.montantTotal) / 1.18, // Approximation
        montantTTC: Number(c.montantTotal),
        nombreArticles: c.lignes.length,
        entrepot: c.entrepot,
        lignes: inclureLignes
          ? (c.lignes as any[]).map((l) => ({
              produit: l.produit,
              quantite: l.quantite,
              prixUnitaire: Number(l.prixUnitaire),
              montant: l.quantite * Number(l.prixUnitaire),
            }))
          : undefined,
      })),
      produitsFrequents: produitsFrequents.map((pf) => {
        const produit = produitsMap.get(pf.produitId);
        return {
          produitId: pf.produitId,
          reference: produit?.reference || '',
          nom: produit?.nom || '',
          quantiteTotale: pf._sum.quantite || 0,
          nombreCommandes: pf._count.id,
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
  // SOLDE / ENCOURS CLIENT
  // ============================================

async getSoldeClient(clientId: number) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        nom: true,
      },
    });

    if (!client) {
      throw new NotFoundException(`Client #${clientId} non trouvé`);
    }

    // Récupérer ou calculer l'encours
    let encours = await this.prisma.encoursClient.findUnique({
      where: { clientId },
    });

    if (!encours) {
      encours = await this.calculerEtMettreAJourEncours(clientId);
    }

    // CORRECTION ICI : Utilisation de l'Enum StatutCommande
    // On suppose que 'LIVRE' est le statut final. Si vous avez 'EXPEDIEE', ajoutez-le.
    const dernieresCommandes = await this.prisma.commande.findMany({
      where: { 
        clientId, 
        statut: StatutCommande.LIVRE // Utilisation stricte de l'Enum
      },
      orderBy: { dateCommande: 'desc' },
      take: 5,
      select: {
        id: true,
        numeroCommande: true,
        dateCommande: true,
        montantTotal: true,
        statut: true,
      },
    });

    const risque = this.calculerRisque(encours);
    const tendance = await this.calculerTendanceEncours(clientId);
    const limiteCredit = Number(encours.limiteCredit) || 0;

    return {
      clientId,
      client: {
        nom: client.nom,
        statut: 'ACTIF',
        conditionsPaiement: '30_JOURS',
      },
      limiteCredit,
      solde: {
        factureTotal: Number(encours.montantFactureTotal),
        paye: Number(encours.montantPaye),
        soldeActuel: Number(encours.soldeActuel),
        creditDisponible: Number(encours.creditDisponible),
        tauxUtilisation: Number(encours.tauxUtilisationCredit),
      },
      echeancier: {
        nonEchu: Number(encours.montantNonEchu),
        echu0_30: Number(encours.echu0_30Jours),
        echu31_60: Number(encours.echu31_60Jours),
        echu61_90: Number(encours.echu61_90Jours),
        echuPlus90: Number(encours.echuPlus90Jours),
        totalEchu: Number(encours.montantEchu),
      },
      indicateurs: {
        scoreCredit: encours.scoreCredit,
        risque,
        tendance,
      },
      dernieresFactures: dernieresCommandes.map((c) => ({
        id: c.id,
        numero: c.numeroCommande,
        date: c.dateCommande,
        montant: Number(c.montantTotal),
        solde: Number(c.montantTotal),
        echeance: new Date(c.dateCommande.getTime() + 30 * 24 * 60 * 60 * 1000),
        statut: c.statut,
      })),
      derniersPaiements: [],
    };
  }

  // ============================================
  // STATISTIQUES CLIENT
  // ============================================

  async getStatistiquesClient(clientId: number) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        nom: true,
        dateCreation: true,
      },
    });

    if (!client) {
      throw new NotFoundException(`Client #${clientId} non trouvé`);
    }

    // Calculer et mettre à jour les statistiques
    const stats = await this.calculerEtMettreAJourStatistiques(clientId);

    // Évolution mensuelle (12 derniers mois)
    const evolution = await this.getEvolutionMensuelle(clientId, 12);

    // Top produits
    const topProduits = await this.getTopProduits(clientId, 5);

    // Recommandations basées sur le segment
    const recommandations = this.genererRecommandations(stats);

    return {
      clientId,
      client: {
        nom: client.nom,
        dateCreation: client.dateCreation,
        segment: stats.segment,
        statut: 'ACTIF',
      },
      commandes: {
        total: stats.nombreCommandesTotal,
        annee: stats.nombreCommandesAnnee,
        mois: stats.nombreCommandesMois,
        frequence: Number(stats.frequenceAchat),
      },
      chiffreAffaires: {
        total: Number(stats.caTotal),
        annee: Number(stats.caAnnee),
        mois: Number(stats.caMois),
        panierMoyen: Number(stats.panierMoyen),
        valeurClient: Number(stats.valeurClient),
      },
      evolution,
      paiements: {
        delaiMoyen: Number(stats.delaiPaiementMoyen),
        tauxPaiementATemps: Number(stats.tauxPaiementATemps),
        nombreRetards: stats.nombreRetardsPaiement,
      },
      produits: {
        nombreDistincts: stats.nombreProduitsAchetes,
        categoriePreferee: stats.categoriePreferee,
        topProduits,
      },
      segmentation: {
        segment: stats.segment,
        potentielCroissance: stats.potentielCroissance || 'MOYEN',
        recommandations,
      },
    };
  }

  // ============================================
  // BLOQUER UN CLIENT
  // ============================================

  async bloquerClient(
    clientId: number,
    dto: BloquerClientDto,
    userId: number,
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException(`Client #${clientId} non trouvé`);
    }

    // Vérifier si déjà bloqué
    const blocageActif = await this.prisma.blocageClient.findFirst({
      where: { clientId, estActif: true },
    });

    if (blocageActif) {
      throw new ConflictException('Ce client est déjà bloqué');
    }

    // Créer le blocage
    const blocage = await this.prisma.$transaction(async (tx) => {
      const nouveauBlocage = await tx.blocageClient.create({
        data: {
          clientId,
          raison: dto.raison,
          description: dto.description,
          montantImpaye: dto.montantImpaye,
          bloquePar: userId,
        },
      });

      // Mettre à jour le statut du client (si le champ existe)
      // await tx.client.update({
      //   where: { id: clientId },
      //   data: { statut: 'BLOQUE' },
      // });

      // Historique
      await tx.historiqueClient.create({
        data: {
          clientId,
          typeEvenement: 'BLOCAGE',
          description: `Client bloqué: ${dto.raison}`,
          details: {
            raison: dto.raison,
            montantImpaye: dto.montantImpaye,
          },
          utilisateurId: userId,
        },
      });

      return nouveauBlocage;
    });

    this.logger.log(`Client #${clientId} bloqué - Raison: ${dto.raison}`);

    return {
      success: true,
      client: {
        id: clientId,
        nom: client.nom,
        statut: 'BLOQUE',
      },
      blocage: {
        id: blocage.id,
        raison: blocage.raison,
        dateDebut: blocage.dateDebut,
        montantImpaye: dto.montantImpaye,
      },
      message: 'Client bloqué avec succès',
    };
  }

  async debloquerClient(
    clientId: number,
    dto: DebloquerClientDto,
    userId: number,
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException(`Client #${clientId} non trouvé`);
    }

    const blocageActif = await this.prisma.blocageClient.findFirst({
      where: { clientId, estActif: true },
    });

    if (!blocageActif) {
      throw new BadRequestException('Ce client n\'est pas bloqué');
    }

    await this.prisma.$transaction(async (tx) => {
      // Désactiver le blocage
      await tx.blocageClient.update({
        where: { id: blocageActif.id },
        data: {
          estActif: false,
          dateFin: new Date(),
          debloquePar: userId,
          notesDeblocage: dto.raison,
        },
      });

      // Mettre à jour le statut du client
      // await tx.client.update({
      //   where: { id: clientId },
      //   data: { statut: 'ACTIF' },
      // });

      // Historique
      await tx.historiqueClient.create({
        data: {
          clientId,
          typeEvenement: 'DEBLOCAGE',
          description: `Client débloqué: ${dto.raison}`,
          utilisateurId: userId,
        },
      });
    });

    this.logger.log(`Client #${clientId} débloqué`);

    return {
      success: true,
      client: {
        id: clientId,
        nom: client.nom,
        statut: 'ACTIF',
      },
      message: 'Client débloqué avec succès',
    };
  }

  // ============================================
  // SEGMENTATION
  // ============================================

  async getSegmentation(filtres: FiltresSegmentationDto) {
    const { segment, caMin, caMax, inclureBloques = false } = filtres;

    // Récupérer tous les clients avec leurs stats
    const whereStats: any = {};
    if (segment) whereStats.segment = segment;
    if (caMin) whereStats.caTotal = { gte: caMin };
    if (caMax) whereStats.caTotal = { ...whereStats.caTotal, lte: caMax };

    const clientsStats = await this.prisma.statistiquesClient.findMany({
      where: whereStats,
      include: {
        client: {
          select: { id: true, nom: true, ville: true },
        },
      },
    });

    // Filtrer les bloqués si nécessaire
    let clientsFiltres = clientsStats;
    if (!inclureBloques) {
      const blocagesActifs = await this.prisma.blocageClient.findMany({
        where: { estActif: true },
        select: { clientId: true },
      });
      const idsBloques = new Set(blocagesActifs.map((b) => b.clientId));
      clientsFiltres = clientsStats.filter(
        (cs) => !idsBloques.has(cs.clientId),
      );
    }

    // Compter les clients par segment
    const segmentsCount = new Map<string, { count: number; ca: number }>();
    for (const cs of clientsFiltres) {
      const seg = cs.segment;
      const current = segmentsCount.get(seg) || { count: 0, ca: 0 };
      segmentsCount.set(seg, {
        count: current.count + 1,
        ca: current.ca + Number(cs.caTotal),
      });
    }

    // Descriptions des segments
    const descriptionsSegments: Record<string, string> = {
      NOUVEAU: 'Clients de moins de 3 mois',
      OCCASIONNEL: '1-2 commandes par an',
      REGULIER: '3-6 commandes par an',
      FIDELE: '7-12 commandes par an',
      VIP: 'Plus de 12 commandes/an ou CA élevé',
      INACTIF: 'Pas de commande depuis 6 mois',
      A_RISQUE: 'Retards de paiement fréquents',
    };

    const totalClients = clientsFiltres.length;
    const caTotal = clientsFiltres.reduce(
      (sum, cs) => sum + Number(cs.caTotal),
      0,
    );

    // Compter les bloqués
    const clientsBloques = await this.prisma.blocageClient.count({
      where: { estActif: true },
    });

    // Compter par région
    const parRegion = new Map<string, { nombre: number; ca: number }>();
    for (const cs of clientsFiltres) {
      const region = cs.client.ville || 'Non spécifié';
      const current = parRegion.get(region) || { nombre: 0, ca: 0 };
      parRegion.set(region, {
        nombre: current.nombre + 1,
        ca: current.ca + Number(cs.caTotal),
      });
    }

    // Alertes
    const clientsARisque = clientsFiltres.filter(
      (cs) => cs.segment === 'A_RISQUE',
    ).length;
    const clientsInactifs = clientsFiltres.filter(
      (cs) => cs.segment === 'INACTIF',
    ).length;

    // Clients en dépassement de crédit
    const encoursClients = await this.prisma.encoursClient.findMany({
      where: {
        tauxUtilisationCredit: { gt: 100 },
      },
    });

    // Top clients
    const topClients = clientsFiltres
      .sort((a, b) => Number(b.caTotal) - Number(a.caTotal))
      .slice(0, 10)
      .map((cs) => ({
        id: cs.client.id,
        nom: cs.client.nom,
        segment: cs.segment,
        ca: Number(cs.caTotal),
        commandes: cs.nombreCommandesTotal,
      }));

    return {
      resume: {
        totalClients,
        clientsActifs: totalClients - clientsInactifs,
        clientsBloques,
        caTotal,
      },
      segments: Array.from(segmentsCount.entries()).map(([seg, data]) => ({
        segment: seg,
        nombreClients: data.count,
        pourcentage: totalClients > 0
          ? Math.round((data.count / totalClients) * 100)
          : 0,
        caTotal: data.ca,
        caMoyen: data.count > 0 ? Math.round(data.ca / data.count) : 0,
        panierMoyen: 0, // À calculer
        description: descriptionsSegments[seg] || seg,
      })),
      repartition: {
        parStatut: [
          { statut: 'ACTIF', nombre: totalClients - clientsBloques },
          { statut: 'BLOQUE', nombre: clientsBloques },
        ],
        parRegion: Array.from(parRegion.entries())
          .map(([region, data]) => ({
            region,
            nombre: data.nombre,
            ca: data.ca,
          }))
          .sort((a, b) => b.ca - a.ca)
          .slice(0, 10),
      },
      alertes: {
        clientsARisque,
        clientsInactifs,
        clientsDepassementCredit: encoursClients.length,
      },
      topClients,
    };
  }

  // ============================================
  // RECALCULER SEGMENTS
  // ============================================

  async recalculerSegments() {
    const clients = await this.prisma.client.findMany({
      select: { id: true },
    });

    let updated = 0;
    for (const client of clients) {
      await this.calculerEtMettreAJourStatistiques(client.id);
      updated++;
    }

    return {
      success: true,
      clientsTraites: updated,
      message: `Segmentation recalculée pour ${updated} clients`,
    };
  }

  // ============================================
  // AJOUTER UNE NOTE
  // ============================================

  async ajouterNote(
    clientId: number,
    dto: AjouterNoteClientDto,
    userId: number,
  ) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });

    if (!client) {
      throw new NotFoundException(`Client #${clientId} non trouvé`);
    }

    const note = await this.prisma.noteClient.create({
      data: {
        clientId,
        titre: dto.titre,
        contenu: dto.contenu,
        priorite: dto.priorite || 'NORMALE',
        categorie: dto.categorie,
        dateRappel: dto.dateRappel ? new Date(dto.dateRappel) : null,
        creePar: userId,
      },
      include: {
        createur: { select: { id: true, nomComplet: true } },
      },
    });

    // Historique
    await this.prisma.historiqueClient.create({
      data: {
        clientId,
        typeEvenement: 'NOTE_AJOUTEE',
        description: `Note ajoutée: ${dto.titre}`,
        utilisateurId: userId,
      },
    });

    return {
      success: true,
      note: {
        id: note.id,
        titre: note.titre,
        priorite: note.priorite,
        dateRappel: note.dateRappel,
        createur: note.createur,
      },
      message: 'Note ajoutée avec succès',
    };
  }

  // ============================================
  // MÉTHODES PRIVÉES
  // ============================================

  private async calculerEtMettreAJourStatistiques(clientId: number) {
    const now = new Date();
    const debutAnnee = new Date(now.getFullYear(), 0, 1);
    const debutMois = new Date(now.getFullYear(), now.getMonth(), 1);

    // Commandes
    const commandesTotal = await this.prisma.commande.count({
      where: { clientId },
    });

    const commandesAnnee = await this.prisma.commande.count({
      where: { clientId, dateCommande: { gte: debutAnnee } },
    });

    const commandesMois = await this.prisma.commande.count({
      where: { clientId, dateCommande: { gte: debutMois } },
    });

    // CA
    const caTotal = await this.prisma.commande.aggregate({
      where: { clientId },
      _sum: { montantTotal: true },
    });

    const caAnnee = await this.prisma.commande.aggregate({
      where: { clientId, dateCommande: { gte: debutAnnee } },
      _sum: { montantTotal: true },
    });

    const caMois = await this.prisma.commande.aggregate({
      where: { clientId, dateCommande: { gte: debutMois } },
      _sum: { montantTotal: true },
    });

    // Dates des commandes
    const premiereCommande = await this.prisma.commande.findFirst({
      where: { clientId },
      orderBy: { dateCommande: 'asc' },
      select: { dateCommande: true },
    });

    const derniereCommande = await this.prisma.commande.findFirst({
      where: { clientId },
      orderBy: { dateCommande: 'desc' },
      select: { dateCommande: true },
    });

    const joursDepuisDernierAchat = derniereCommande
      ? Math.floor(
          (now.getTime() - derniereCommande.dateCommande.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 999;

    // Nombre de produits distincts
    const produitsDistincts = await this.prisma.ligneCommande.groupBy({
      by: ['produitId'],
      where: { commande: { clientId } },
    });

    // Catégorie préférée
    const categoriePreferee = await this.getCategoriePreferee(clientId);

    // Calcul du segment
    const segment = this.determinerSegment(
      commandesTotal,
      commandesAnnee,
      Number(caTotal._sum.montantTotal || 0),
      joursDepuisDernierAchat,
      premiereCommande?.dateCommande,
    );

    // Fréquence d'achat (commandes par mois sur les 12 derniers mois)
    const frequenceAchat = commandesAnnee / 12;

    // Panier moyen
    const panierMoyen = commandesTotal > 0
      ? Number(caTotal._sum.montantTotal || 0) / commandesTotal
      : 0;

    // Valeur client (simplifiée)
    const valeurClient = Number(caTotal._sum.montantTotal || 0);

    // Potentiel de croissance
    const potentielCroissance = this.determinerPotentiel(
      segment,
      frequenceAchat,
      joursDepuisDernierAchat,
    );

    // Upsert des statistiques
    const stats = await this.prisma.statistiquesClient.upsert({
      where: { clientId },
      create: {
        clientId,
        nombreCommandesTotal: commandesTotal,
        nombreCommandesAnnee: commandesAnnee,
        nombreCommandesMois: commandesMois,
        caTotal: caTotal._sum.montantTotal || 0,
        caAnnee: caAnnee._sum.montantTotal || 0,
        caMois: caMois._sum.montantTotal || 0,
        panierMoyen,
        frequenceAchat,
        datePremiereCommande: premiereCommande?.dateCommande,
        dateDerniereCommande: derniereCommande?.dateCommande,
        joursDepuisDernierAchat,
        segment,
        valeurClient,
        potentielCroissance,
        nombreProduitsAchetes: produitsDistincts.length,
        categoriePreferee,
      },
      update: {
        nombreCommandesTotal: commandesTotal,
        nombreCommandesAnnee: commandesAnnee,
        nombreCommandesMois: commandesMois,
        caTotal: caTotal._sum.montantTotal || 0,
        caAnnee: caAnnee._sum.montantTotal || 0,
        caMois: caMois._sum.montantTotal || 0,
        panierMoyen,
        frequenceAchat,
        datePremiereCommande: premiereCommande?.dateCommande,
        dateDerniereCommande: derniereCommande?.dateCommande,
        joursDepuisDernierAchat,
        segment,
        valeurClient,
        potentielCroissance,
        nombreProduitsAchetes: produitsDistincts.length,
        categoriePreferee,
      },
    });

    return stats;
  }

  private async calculerEtMettreAJourEncours(clientId: number) {
    // Simulé - à adapter selon votre modèle de facturation
    const commandes = await this.prisma.commande.aggregate({
      where: { clientId, statut: { in: ['LIVRE', 'FACTUREE'] } },
      _sum: { montantTotal: true },
    });

    const montantFactureTotal = Number(commandes._sum.montantTotal || 0);

    // Créer l'encours
    const encours = await this.prisma.encoursClient.upsert({
      where: { clientId },
      create: {
        clientId,
        montantFactureTotal,
        soldeActuel: montantFactureTotal, // Simplifié
        scoreCredit: 80,
      },
      update: {
        montantFactureTotal,
        soldeActuel: montantFactureTotal,
      },
    });

    return encours;
  }

  private determinerSegment(
    commandesTotal: number,
    commandesAnnee: number,
    caTotal: number,
    joursDepuisDernierAchat: number,
    datePremiereCommande?: Date,
  ): SegmentClient {
    // Client nouveau (< 3 mois)
    if (datePremiereCommande) {
      const joursDepuisCreation = Math.floor(
        (Date.now() - datePremiereCommande.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (joursDepuisCreation < 90) return SegmentClient.NOUVEAU;
    }

    // Client inactif (> 6 mois sans commande)
    if (joursDepuisDernierAchat > 180) return SegmentClient.INACTIF;

    // VIP (> 12 commandes/an ou CA > 10M)
    if (commandesAnnee > 12 || caTotal > 10000000) return SegmentClient.VIP;

    // Fidèle (7-12 commandes/an)
    if (commandesAnnee >= 7) return SegmentClient.FIDELE;

    // Régulier (3-6 commandes/an)
    if (commandesAnnee >= 3) return SegmentClient.REGULIER;

    // Occasionnel
    return SegmentClient.OCCASIONNEL;
  }

  private determinerPotentiel(
    segment: SegmentClient,
    frequence: number,
    joursInactivite: number,
  ): string {
    if (segment === SegmentClient.VIP) return 'FAIBLE'; // Déjà au max
    if (segment === SegmentClient.INACTIF) return 'FAIBLE';
    if (joursInactivite > 90) return 'MOYEN';
    if (frequence > 0.5 && segment === SegmentClient.REGULIER) return 'ELEVE';
    return 'MOYEN';
  }

  private async getCategoriePreferee(clientId: number): Promise<string | null> {
    const result = await this.prisma.ligneCommande.groupBy({
      by: ['produitId'],
      where: { commande: { clientId } },
      _sum: { quantite: true },
      orderBy: { _sum: { quantite: 'desc' } },
      take: 1,
    });

    if (result.length === 0) return null;

    const produit = await this.prisma.produit.findUnique({
      where: { id: result[0].produitId },
      include: { categorie: { select: { nom: true } } },
    });

    return produit?.categorie?.nom || null;
  }

  private async getEvolutionMensuelle(clientId: number, mois: number) {
    const evolution: { mois: string; ca: number; commandes: number }[] = [];
    const now = new Date();

    for (let i = mois - 1; i >= 0; i--) {
      const debut = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const fin = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

      const stats = await this.prisma.commande.aggregate({
        where: {
          clientId,
          dateCommande: { gte: debut, lte: fin },
        },
        _count: { id: true },
        _sum: { montantTotal: true },
      });

      evolution.push({
        mois: debut.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
        ca: Number(stats._sum.montantTotal || 0),
        commandes: stats._count.id,
      });
    }

    return evolution;
  }

  private async getTopProduits(clientId: number, limit: number) {
    const result = await this.prisma.ligneCommande.groupBy({
      by: ['produitId'],
      where: { commande: { clientId } },
      _sum: { quantite: true },
      orderBy: { _sum: { quantite: 'desc' } },
      take: limit,
    });

    const produitsIds = result.map((r) => r.produitId);
    const produits = await this.prisma.produit.findMany({
      where: { id: { in: produitsIds } },
      select: { id: true, reference: true, nom: true, prixVente: true },
    });

    const produitsMap = new Map(produits.map((p) => [p.id, p]));

    return result.map((r) => {
      const produit = produitsMap.get(r.produitId);
      return {
        reference: produit?.reference || '',
        nom: produit?.nom || '',
        quantite: r._sum.quantite || 0,
        montant: (r._sum.quantite || 0) * Number(produit?.prixVente || 0),
      };
    });
  }

  private calculerRisque(encours: any): 'FAIBLE' | 'MOYEN' | 'ELEVE' | 'CRITIQUE' {
    const score = encours.scoreCredit;
    if (score >= 80) return 'FAIBLE';
    if (score >= 60) return 'MOYEN';
    if (score >= 40) return 'ELEVE';
    return 'CRITIQUE';
  }

  private async calculerTendanceEncours(
    clientId: number,
  ): Promise<'AMELIORATION' | 'STABLE' | 'DEGRADATION'> {
    // Simplifié - à implémenter avec l'historique des paiements
    return 'STABLE';
  }

  private genererRecommandations(stats: any): string[] {
    const recommandations: string[] = [];

    switch (stats.segment) {
      case SegmentClient.NOUVEAU:
        recommandations.push('Envoyer un email de bienvenue personnalisé');
        recommandations.push('Proposer une offre de première commande');
        break;
      case SegmentClient.OCCASIONNEL:
        recommandations.push('Mettre en place un programme de fidélité');
        recommandations.push('Envoyer des rappels périodiques');
        break;
      case SegmentClient.REGULIER:
        recommandations.push('Proposer des remises volume');
        recommandations.push('Anticiper les besoins avec des suggestions');
        break;
      case SegmentClient.FIDELE:
        recommandations.push('Offrir des avantages exclusifs');
        recommandations.push('Inviter aux événements VIP');
        break;
      case SegmentClient.VIP:
        recommandations.push('Assigner un commercial dédié');
        recommandations.push('Négocier un contrat annuel');
        break;
      case SegmentClient.INACTIF:
        recommandations.push('Lancer une campagne de réactivation');
        recommandations.push('Proposer une offre de retour');
        break;
    }

    if (stats.joursDepuisDernierAchat > 60) {
      recommandations.push('Contacter le client pour comprendre ses besoins');
    }

    return recommandations;
  }
}