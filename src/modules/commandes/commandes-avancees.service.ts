// ============================================
// FICHIER: src/modules/commandes/commandes-avancees.service.ts
// Service pour les fonctionnalités avancées de commandes
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
  DupliquerCommandeDto,
  ModifierLigneCommandeDto,
  AjouterLigneCommandeDto,
  SupprimerLigneCommandeDto,
  CreerSuiviLivraisonDto,
  MettreAJourSuiviDto,
  CreerDevisDto,
  ModifierDevisDto,
  ConvertirDevisDto,
  StatutDevis,
  StatutSuiviLivraison,
} from './dto/commandes-avancees.dto';

@Injectable()
export class CommandesAvanceesService {
  private readonly logger = new Logger(CommandesAvanceesService.name);

  constructor(private prisma: PrismaService) {}

  // ============================================
  // DUPLIQUER UNE COMMANDE
  // ============================================

  async dupliquerCommande(
    commandeId: number,
    dto: DupliquerCommandeDto,
    userId: number,
  ) {
    // Récupérer la commande originale
    const commandeOriginale = await this.prisma.commande.findUnique({
      where: { id: commandeId },
      include: {
        lignes: {
          include: {
            produit: {
              select: { id: true, reference: true, nom: true, prixVente: true },
            },
          },
        },
        client: true,
      },
    });

    if (!commandeOriginale) {
      throw new NotFoundException(`Commande #${commandeId} non trouvée`);
    }

    // Générer le nouveau numéro de commande
    const numeroCommande = await this.genererNumeroCommande();

    // Préparer les lignes
    const multiplicateur = dto.multiplicateurQuantite || 1;
    const produitsExclus = dto.produitsExclus || [];

    const lignesADupliquer = commandeOriginale.lignes.filter(
      (l) => !produitsExclus.includes(l.produitId),
    );

    if (lignesADupliquer.length === 0) {
      throw new BadRequestException(
        'Aucune ligne à dupliquer après exclusions',
      );
    }

    // Récupérer les prix actuels si demandé
    let prixActuels = new Map<number, number>();
    if (dto.mettreAJourPrix) {
      const produits = await this.prisma.produit.findMany({
        where: { id: { in: lignesADupliquer.map((l) => l.produitId) } },
        select: { id: true, prixVente: true },
      });
      prixActuels = new Map(
        produits.map((p) => [p.id, Number(p.prixVente) || 0]),
      );
    }

    // Créer la nouvelle commande
    const nouvelleCommande = await this.prisma.$transaction(async (tx) => {
      // Créer la commande
      const commande = await tx.commande.create({
        data: {
          numeroCommande,
          clientId: dto.clientId || commandeOriginale.clientId,
          entrepotId: dto.entrepotId || commandeOriginale.entrepotId,
          dateCommande: dto.dateCommande
            ? new Date(dto.dateCommande)
            : new Date(),
          statut: 'EN_ATTENTE',
          creePar: userId,
          // Lien vers commande parente (si le champ existe)
          // commandeParenteId: commandeId,
        },
      });

      // Créer les lignes
      let montantTotal = 0;
      for (const ligne of lignesADupliquer) {
        const quantite = Math.ceil(ligne.quantite * multiplicateur);
        const prixUnitaire = dto.mettreAJourPrix
          ? prixActuels.get(ligne.produitId) || Number(ligne.prixUnitaire)
          : Number(ligne.prixUnitaire);

        await tx.ligneCommande.create({
          data: {
            commandeId: commande.id,
            produitId: ligne.produitId,
            quantite,
            prixUnitaire,
          },
        });

        montantTotal += quantite * prixUnitaire;
      }

      // Mettre à jour le montant total
      await tx.commande.update({
        where: { id: commande.id },
        data: { montantTotal },
      });

      // Enregistrer dans l'historique
      await tx.historiqueModificationCommande.create({
        data: {
          commandeId: commande.id,
          typeModification: 'DUPLICATION',
          nouvelleValeur: {
            commandeOrigine: commandeId,
            numeroOrigine: commandeOriginale.numeroCommande,
            multiplicateur,
            prixMisAJour: dto.mettreAJourPrix,
          },
          raison: dto.notes,
          utilisateurId: userId,
        },
      });

      return commande;
    });

    // Récupérer la commande créée avec ses lignes
    const commandeComplete = await this.prisma.commande.findUnique({
      where: { id: nouvelleCommande.id },
      include: {
        lignes: true,
        client: { select: { id: true, nom: true } },
      },
    });

    this.logger.log(
      `Commande ${commandeOriginale.numeroCommande} dupliquée → ${numeroCommande}`,
    );

    return {
      success: true,
      commandeOriginale: {
        id: commandeOriginale.id,
        numeroCommande: commandeOriginale.numeroCommande,
      },
      nouvelleCommande: {
        id: commandeComplete!.id,
        numeroCommande: commandeComplete!.numeroCommande,
        montantTotal: Number(commandeComplete!.montantTotal),
        nombreLignes: commandeComplete!.lignes.length,
      },
      message: `Commande dupliquée avec succès`,
    };
  }

  // ============================================
  // MODIFIER UNE LIGNE DE COMMANDE
  // ============================================

  async modifierLigneCommande(
    commandeId: number,
    dto: ModifierLigneCommandeDto,
    userId: number,
  ) {
    const commande = await this.verifierCommandeModifiable(commandeId);

    // Trouver la ligne
    const ligne = await this.prisma.ligneCommande.findFirst({
      where: { id: dto.ligneId, commandeId },
      include: { produit: true },
    });

    if (!ligne) {
      throw new NotFoundException(
        `Ligne #${dto.ligneId} non trouvée dans cette commande`,
      );
    }

    const ancienneValeur = {
      quantite: ligne.quantite,
      prixUnitaire: Number(ligne.prixUnitaire),
    };

    // Mettre à jour la ligne
    const nouvelleQuantite = dto.quantite ?? ligne.quantite;
    const nouveauPrix = dto.prixUnitaire ?? Number(ligne.prixUnitaire);

    await this.prisma.$transaction(async (tx) => {
      await tx.ligneCommande.update({
        where: { id: dto.ligneId },
        data: {
          quantite: nouvelleQuantite,
          prixUnitaire: nouveauPrix,
        },
      });

      // Recalculer le montant total
      await this.recalculerMontantCommande(tx, commandeId);

      // Historique
      await tx.historiqueModificationCommande.create({
        data: {
          commandeId,
          typeModification: 'LIGNE_MODIFIEE',
          ligneCommandeId: dto.ligneId,
          ancienneValeur,
          nouvelleValeur: {
            quantite: nouvelleQuantite,
            prixUnitaire: nouveauPrix,
          },
          raison: dto.raison,
          utilisateurId: userId,
        },
      });
    });

    return {
      success: true,
      ligne: {
        id: dto.ligneId,
        produit: ligne.produit.nom,
        ancienneQuantite: ancienneValeur.quantite,
        nouvelleQuantite,
        ancienPrix: ancienneValeur.prixUnitaire,
        nouveauPrix,
      },
      message: 'Ligne modifiée avec succès',
    };
  }

  async ajouterLigneCommande(
    commandeId: number,
    dto: AjouterLigneCommandeDto,
    userId: number,
  ) {
    const commande = await this.verifierCommandeModifiable(commandeId);

    // Vérifier le produit
    const produit = await this.prisma.produit.findUnique({
      where: { id: dto.produitId },
    });

    if (!produit) {
      throw new NotFoundException(`Produit #${dto.produitId} non trouvé`);
    }

    // Vérifier si le produit n'est pas déjà dans la commande
    const ligneExistante = await this.prisma.ligneCommande.findFirst({
      where: { commandeId, produitId: dto.produitId },
    });

    if (ligneExistante) {
      throw new ConflictException(
        `Le produit ${produit.reference} est déjà dans cette commande (ligne #${ligneExistante.id})`,
      );
    }

    const prixUnitaire = dto.prixUnitaire ?? Number(produit.prixVente) ?? 0;

    const nouvelleLigne = await this.prisma.$transaction(async (tx) => {
      const ligne = await tx.ligneCommande.create({
        data: {
          commandeId,
          produitId: dto.produitId,
          quantite: dto.quantite,
          prixUnitaire,
        },
      });

      await this.recalculerMontantCommande(tx, commandeId);

      await tx.historiqueModificationCommande.create({
        data: {
          commandeId,
          typeModification: 'LIGNE_AJOUTEE',
          ligneCommandeId: ligne.id,
          nouvelleValeur: {
            produitId: dto.produitId,
            reference: produit.reference,
            quantite: dto.quantite,
            prixUnitaire,
          },
          utilisateurId: userId,
        },
      });

      return ligne;
    });

    return {
      success: true,
      ligne: {
        id: nouvelleLigne.id,
        produit: produit.nom,
        reference: produit.reference,
        quantite: dto.quantite,
        prixUnitaire,
        montant: dto.quantite * prixUnitaire,
      },
      message: 'Ligne ajoutée avec succès',
    };
  }

  async supprimerLigneCommande(
    commandeId: number,
    dto: SupprimerLigneCommandeDto,
    userId: number,
  ) {
    const commande = await this.verifierCommandeModifiable(commandeId);

    const ligne = await this.prisma.ligneCommande.findFirst({
      where: { id: dto.ligneId, commandeId },
      include: { produit: true },
    });

    if (!ligne) {
      throw new NotFoundException(`Ligne #${dto.ligneId} non trouvée`);
    }

    // Vérifier qu'il reste au moins une ligne
    const nombreLignes = await this.prisma.ligneCommande.count({
      where: { commandeId },
    });

    if (nombreLignes <= 1) {
      throw new BadRequestException(
        'Impossible de supprimer la dernière ligne. Annulez la commande à la place.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.ligneCommande.delete({
        where: { id: dto.ligneId },
      });

      await this.recalculerMontantCommande(tx, commandeId);

      await tx.historiqueModificationCommande.create({
        data: {
          commandeId,
          typeModification: 'LIGNE_SUPPRIMEE',
          ancienneValeur: {
            ligneId: dto.ligneId,
            produitId: ligne.produitId,
            reference: ligne.produit.reference,
            quantite: ligne.quantite,
            prixUnitaire: Number(ligne.prixUnitaire),
          },
          raison: dto.raison,
          utilisateurId: userId,
        },
      });
    });

    return {
      success: true,
      ligneSupprimee: {
        id: dto.ligneId,
        produit: ligne.produit.nom,
      },
      message: 'Ligne supprimée avec succès',
    };
  }

  // ============================================
  // SUIVI DE LIVRAISON
  // ============================================

  async getSuiviLivraison(commandeId: number) {
    const commande = await this.prisma.commande.findUnique({
      where: { id: commandeId },
      select: { id: true, numeroCommande: true, statut: true },
    });

    if (!commande) {
      throw new NotFoundException(`Commande #${commandeId} non trouvée`);
    }

    let suivi = await this.prisma.suiviLivraison.findUnique({
      where: { commandeId },
      include: {
        evenements: {
          orderBy: { dateEvenement: 'desc' },
        },
      },
    });

    if (!suivi) {
      // Créer un suivi par défaut
      suivi = await this.prisma.suiviLivraison.create({
        data: {
          commandeId,
          statut: 'EN_PREPARATION',
        },
        include: {
          evenements: true,
        },
      });
    }

    // Calculer la progression
    const progression = this.calculerProgression(suivi.statut);

    return {
      id: suivi.id,
      commandeId,
      numeroCommande: commande.numeroCommande,
      transporteur: suivi.transporteur,
      numeroSuivi: suivi.numeroSuivi,
      urlSuivi: suivi.urlSuivi,
      statut: suivi.statut,
      adresseLivraison: suivi.adresseLivraison,
      villeLivraison: suivi.villeLivraison,
      contactLivraison: suivi.contactLivraison,
      telephoneLivraison: suivi.telephoneLivraison,
      dateLivraisonPrevue: suivi.dateLivraisonPrevue,
      dateLivraisonReelle: suivi.dateLivraisonReelle,
      poidsTotalKg: suivi.poidsTotalKg,
      nombreColis: suivi.nombreColis,
      signatureRequise: suivi.signatureRequise,
      evenements: suivi.evenements.map((e) => ({
        statut: e.statut,
        description: e.description,
        localisation: e.localisation,
        date: e.dateEvenement,
      })),
      progression,
      statutCommande: commande.statut,
    };
  }

  async creerOuMettreAJourSuivi(
    commandeId: number,
    dto: CreerSuiviLivraisonDto,
  ) {
    const commande = await this.prisma.commande.findUnique({
      where: { id: commandeId },
      include: { client: true },
    });

    if (!commande) {
      throw new NotFoundException(`Commande #${commandeId} non trouvée`);
    }

    const suivi = await this.prisma.suiviLivraison.upsert({
      where: { commandeId },
      create: {
        commandeId,
        transporteur: dto.transporteur,
        numeroSuivi: dto.numeroSuivi,
        urlSuivi: dto.urlSuivi,
        adresseLivraison: dto.adresseLivraison || commande.client?.adresse,
        villeLivraison: dto.villeLivraison || commande.client?.ville,
        paysLivraison: dto.paysLivraison || commande.client?.pays || 'Côte d\'Ivoire',
        contactLivraison: dto.contactLivraison || commande.client?.nom,
        telephoneLivraison: dto.telephoneLivraison || commande.client?.telephone,
        dateLivraisonPrevue: dto.dateLivraisonPrevue
          ? new Date(dto.dateLivraisonPrevue)
          : null,
        poidsTotalKg: dto.poidsTotalKg,
        nombreColis: dto.nombreColis || 1,
        instructionsLivraison: dto.instructionsLivraison,
        signatureRequise: dto.signatureRequise || false,
        statut: 'EN_PREPARATION',
      },
      update: {
        transporteur: dto.transporteur,
        numeroSuivi: dto.numeroSuivi,
        urlSuivi: dto.urlSuivi,
        adresseLivraison: dto.adresseLivraison,
        villeLivraison: dto.villeLivraison,
        paysLivraison: dto.paysLivraison,
        contactLivraison: dto.contactLivraison,
        telephoneLivraison: dto.telephoneLivraison,
        dateLivraisonPrevue: dto.dateLivraisonPrevue
          ? new Date(dto.dateLivraisonPrevue)
          : undefined,
        poidsTotalKg: dto.poidsTotalKg,
        nombreColis: dto.nombreColis,
        instructionsLivraison: dto.instructionsLivraison,
        signatureRequise: dto.signatureRequise,
      },
    });

    return this.getSuiviLivraison(commandeId);
  }

  async mettreAJourStatutSuivi(
    commandeId: number,
    dto: MettreAJourSuiviDto,
  ) {
    const suivi = await this.prisma.suiviLivraison.findUnique({
      where: { commandeId },
    });

    if (!suivi) {
      throw new NotFoundException(
        `Aucun suivi de livraison pour la commande #${commandeId}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Mettre à jour le suivi
      const updateData: any = {
        statut: dto.statut,
      };

      if (dto.numeroSuivi) {
        updateData.numeroSuivi = dto.numeroSuivi;
      }

      if (dto.statut === 'EXPEDIE' && !suivi.dateExpedition) {
        updateData.dateExpedition = new Date();
      }

      if (dto.statut === 'LIVRE' && dto.dateLivraisonReelle) {
        updateData.dateLivraisonReelle = new Date(dto.dateLivraisonReelle);
      } else if (dto.statut === 'LIVRE' && !suivi.dateLivraisonReelle) {
        updateData.dateLivraisonReelle = new Date();
      }

      await tx.suiviLivraison.update({
        where: { id: suivi.id },
        data: updateData,
      });

      // Créer l'événement
      await tx.evenementLivraison.create({
        data: {
          suiviId: suivi.id,
          statut: dto.statut,
          description: dto.description || this.getDescriptionStatut(dto.statut),
          localisation: dto.localisation,
        },
      });

      // Mettre à jour le statut de la commande si nécessaire
      if (dto.statut === 'EXPEDIE') {
        await tx.commande.update({
          where: { id: commandeId },
          data: { statut: 'EXPEDIE' },
        });
      } else if (dto.statut === 'LIVRE') {
        await tx.commande.update({
          where: { id: commandeId },
          data: { statut: 'LIVRE' },
        });
      }
    });

    return this.getSuiviLivraison(commandeId);
  }

  // ============================================
  // DEVIS
  // ============================================

  async creerDevis(dto: CreerDevisDto, userId: number) {
    // Vérifier le client si spécifié
    if (dto.clientId) {
      const client = await this.prisma.client.findUnique({
        where: { id: dto.clientId },
      });
      if (!client) {
        throw new NotFoundException(`Client #${dto.clientId} non trouvé`);
      }
    }

    // Vérifier les produits et récupérer les prix
    const produitsIds = dto.lignes.map((l) => l.produitId);
    const produits = await this.prisma.produit.findMany({
      where: { id: { in: produitsIds } },
    });

    if (produits.length !== produitsIds.length) {
      throw new BadRequestException('Un ou plusieurs produits non trouvés');
    }

    const produitsMap = new Map(produits.map((p) => [p.id, p]));

    // Générer le numéro de devis
    const numeroDevis = await this.genererNumeroDevis();

    // Calculer les montants
    let montantHT = 0;
    let montantTaxe = 0;

    const lignesData = dto.lignes.map((ligne, index) => {
      const produit = produitsMap.get(ligne.produitId)!;
      const prixUnitaire = ligne.prixUnitaire ?? Number(produit.prixVente) ?? 0;
      const remise = ligne.remise || 0;
      const tauxTaxe = Number(produit.tauxTaxe) || 0;

      const montantBrut = ligne.quantite * prixUnitaire;
      const montantRemise = montantBrut * (remise / 100);
      const montantLigneHT = montantBrut - montantRemise;
      const montantLigneTaxe = montantLigneHT * (tauxTaxe / 100);
      const montantLigneTTC = montantLigneHT + montantLigneTaxe;

      montantHT += montantLigneHT;
      montantTaxe += montantLigneTaxe;

      return {
        produitId: ligne.produitId,
        description: ligne.description,
        quantite: ligne.quantite,
        prixUnitaire,
        remise,
        tauxTaxe,
        montantHT: montantLigneHT,
        montantTTC: montantLigneTTC,
        ordre: index,
      };
    });

    // Appliquer la remise globale
    const remiseGlobale = dto.remiseGlobale || 0;
    const montantRemiseGlobale = montantHT * (remiseGlobale / 100);
    montantHT -= montantRemiseGlobale;
    montantTaxe -= montantRemiseGlobale * (montantTaxe / (montantHT + montantRemiseGlobale));
    const montantTTC = montantHT + montantTaxe;

    // Créer le devis
    const devis = await this.prisma.$transaction(async (tx) => {
      const nouveauDevis = await tx.devis.create({
        data: {
          numeroDevis,
          clientId: dto.clientId,
          nomClient: dto.nomClient,
          emailClient: dto.emailClient,
          telephoneClient: dto.telephoneClient,
          adresseClient: dto.adresseClient,
          entrepotId: dto.entrepotId,
          dateValidite: new Date(dto.dateValidite),
          remiseGlobale,
          conditionsPaiement: dto.conditionsPaiement,
          delaiLivraison: dto.delaiLivraison,
          notes: dto.notes,
          notesInternes: dto.notesInternes,
          montantHT,
          montantTaxe,
          montantTTC,
          statut: 'BROUILLON',
          creePar: userId,
        },
      });

      // Créer les lignes
      for (const ligneData of lignesData) {
        await tx.ligneDevis.create({
          data: {
            devisId: nouveauDevis.id,
            ...ligneData,
          },
        });
      }

      // Historique
      await tx.historiqueDevis.create({
        data: {
          devisId: nouveauDevis.id,
          action: 'CREATION',
          nouveauStatut: 'BROUILLON',
          details: { nombreLignes: lignesData.length },
          utilisateurId: userId,
        },
      });

      return nouveauDevis;
    });

    this.logger.log(`Devis ${numeroDevis} créé`);

    return this.getDevisDetails(devis.id);
  }

  async getDevisDetails(devisId: number) {
    const devis = await this.prisma.devis.findUnique({
      where: { id: devisId },
      include: {
        client: { select: { id: true, nom: true, email: true } },
        entrepot: { select: { id: true, nom: true } },
        lignes: {
          include: {
            produit: { select: { id: true, reference: true, nom: true } },
          },
          orderBy: { ordre: 'asc' },
        },
        createur: { select: { id: true, nomComplet: true } },
      },
    });

    if (!devis) {
      throw new NotFoundException(`Devis #${devisId} non trouvé`);
    }

    const aujourdhui = new Date();
    const dateValidite = new Date(devis.dateValidite);
    const estExpire = dateValidite < aujourdhui && devis.statut !== 'CONVERTI';
    const joursRestants = Math.ceil(
      (dateValidite.getTime() - aujourdhui.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      id: devis.id,
      numeroDevis: devis.numeroDevis,
      statut: devis.statut,
      client: devis.client || {
        nom: devis.nomClient,
        email: devis.emailClient,
      },
      entrepot: devis.entrepot,
      dateDevis: devis.dateDevis,
      dateValidite: devis.dateValidite,
      montantHT: Number(devis.montantHT),
      montantTaxe: Number(devis.montantTaxe),
      montantTTC: Number(devis.montantTTC),
      remiseGlobale: Number(devis.remiseGlobale),
      conditionsPaiement: devis.conditionsPaiement,
      delaiLivraison: devis.delaiLivraison,
      notes: devis.notes,
      lignes: devis.lignes.map((l) => ({
        id: l.id,
        produit: l.produit,
        description: l.description,
        quantite: l.quantite,
        prixUnitaire: Number(l.prixUnitaire),
        remise: Number(l.remise),
        montantHT: Number(l.montantHT),
        montantTTC: Number(l.montantTTC),
      })),
      estExpire,
      joursRestants: Math.max(0, joursRestants),
      createur: devis.createur,
      commandeId: devis.commandeId,
    };
  }

  async convertirDevisEnCommande(
    devisId: number,
    dto: ConvertirDevisDto,
    userId: number,
  ) {
    const devis = await this.prisma.devis.findUnique({
      where: { id: devisId },
      include: {
        lignes: {
          include: { produit: true },
        },
        client: true,
      },
    });

    if (!devis) {
      throw new NotFoundException(`Devis #${devisId} non trouvé`);
    }

    if (devis.statut === 'CONVERTI') {
      throw new BadRequestException('Ce devis a déjà été converti en commande');
    }

    if (devis.statut === 'REFUSE' || devis.statut === 'EXPIRE') {
      throw new BadRequestException(
        `Impossible de convertir un devis ${devis.statut.toLowerCase()}`,
      );
    }

    // Vérifier le stock si demandé
    const alertesStock: any[] = [];
    if (dto.verifierStock !== false) {
      for (const ligne of devis.lignes) {
        const produit = ligne.produit;
        if (produit.quantiteStock < ligne.quantite) {
          alertesStock.push({
            produitId: produit.id,
            reference: produit.reference,
            stockDisponible: produit.quantiteStock,
            quantiteDemandee: ligne.quantite,
          });
        }
      }
    }

    // Générer le numéro de commande
    const numeroCommande = await this.genererNumeroCommande();

    // Créer la commande
    const commande = await this.prisma.$transaction(async (tx) => {
      // Créer la commande
      const nouvelleCommande = await tx.commande.create({
        data: {
          numeroCommande,
          clientId: devis.clientId,
          entrepotId: devis.entrepotId,
          dateCommande: dto.dateCommande ? new Date(dto.dateCommande) : new Date(),
          dateLivraison: dto.dateLivraison ? new Date(dto.dateLivraison) : null,
          statut: 'EN_ATTENTE',
          montantTotal: devis.montantTTC,
          creePar: userId,
        },
      });

      // Créer les lignes de commande
      for (const ligne of devis.lignes) {
        await tx.ligneCommande.create({
          data: {
            commandeId: nouvelleCommande.id,
            produitId: ligne.produitId,
            quantite: ligne.quantite,
            prixUnitaire: ligne.prixUnitaire,
          },
        });
      }

      // Réserver le stock si demandé
      if (dto.reserverStock && devis.entrepotId) {
        for (const ligne of devis.lignes) {
          await tx.inventaire.updateMany({
            where: {
              produitId: ligne.produitId,
              entrepotId: devis.entrepotId,
            },
            data: {
              quantiteReservee: { increment: ligne.quantite },
            },
          });
        }
      }

      // Mettre à jour le devis
      await tx.devis.update({
        where: { id: devisId },
        data: {
          statut: 'CONVERTI',
          commandeId: nouvelleCommande.id,
          dateConversion: new Date(),
        },
      });

      // Historique devis
      await tx.historiqueDevis.create({
        data: {
          devisId,
          action: 'CONVERSION',
          ancienStatut: devis.statut,
          nouveauStatut: 'CONVERTI',
          details: {
            commandeId: nouvelleCommande.id,
            numeroCommande,
          },
          utilisateurId: userId,
        },
      });

      return nouvelleCommande;
    });

    this.logger.log(
      `Devis ${devis.numeroDevis} converti en commande ${numeroCommande}`,
    );

    return {
      success: true,
      devis: {
        id: devis.id,
        numeroDevis: devis.numeroDevis,
        ancienStatut: devis.statut,
      },
      commande: {
        id: commande.id,
        numeroCommande: commande.numeroCommande,
        montantTotal: Number(commande.montantTotal),
        statut: commande.statut,
      },
      alertesStock: alertesStock.length > 0 ? alertesStock : undefined,
      message: `Devis converti en commande ${numeroCommande}`,
    };
  }

  async changerStatutDevis(
    devisId: number,
    statut: StatutDevis,
    userId: number,
    raison?: string,
  ) {
    const devis = await this.prisma.devis.findUnique({
      where: { id: devisId },
    });

    if (!devis) {
      throw new NotFoundException(`Devis #${devisId} non trouvé`);
    }

    if (devis.statut === 'CONVERTI') {
      throw new BadRequestException(
        'Impossible de modifier le statut d\'un devis converti',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.devis.update({
        where: { id: devisId },
        data: { statut },
      });

      await tx.historiqueDevis.create({
        data: {
          devisId,
          action: 'CHANGEMENT_STATUT',
          ancienStatut: devis.statut,
          nouveauStatut: statut,
          details: { raison },
          utilisateurId: userId,
        },
      });
    });

    return this.getDevisDetails(devisId);
  }

  // ============================================
  // MÉTHODES UTILITAIRES PRIVÉES
  // ============================================

  private async verifierCommandeModifiable(commandeId: number) {
    const commande = await this.prisma.commande.findUnique({
      where: { id: commandeId },
    });

    if (!commande) {
      throw new NotFoundException(`Commande #${commandeId} non trouvée`);
    }

    if (['EXPEDIE', 'LIVRE', 'ANNULE'].includes(commande.statut)) {
      throw new BadRequestException(
        `Impossible de modifier une commande ${commande.statut.toLowerCase()}`,
      );
    }

    return commande;
  }

  private async recalculerMontantCommande(tx: any, commandeId: number) {
    const lignes = await tx.ligneCommande.findMany({
      where: { commandeId },
    });

    const montantTotal = lignes.reduce(
      (sum: number, l: any) => sum + l.quantite * Number(l.prixUnitaire),
      0,
    );

    await tx.commande.update({
      where: { id: commandeId },
      data: { montantTotal },
    });
  }

  private async genererNumeroCommande(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const lastCommande = await this.prisma.commande.findFirst({
      where: { numeroCommande: { startsWith: `CMD-${year}${month}` } },
      orderBy: { numeroCommande: 'desc' },
    });

    let sequence = 1;
    if (lastCommande) {
      const lastSequence = parseInt(lastCommande.numeroCommande.split('-')[2], 10);
      sequence = lastSequence + 1;
    }

    return `CMD-${year}${month}-${String(sequence).padStart(4, '0')}`;
  }

  private async genererNumeroDevis(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const lastDevis = await this.prisma.devis.findFirst({
      where: { numeroDevis: { startsWith: `DEV-${year}${month}` } },
      orderBy: { numeroDevis: 'desc' },
    });

    let sequence = 1;
    if (lastDevis) {
      const lastSequence = parseInt(lastDevis.numeroDevis.split('-')[2], 10);
      sequence = lastSequence + 1;
    }

    return `DEV-${year}${month}-${String(sequence).padStart(4, '0')}`;
  }

  private calculerProgression(statut: string): number {
    const progressions: Record<string, number> = {
      EN_PREPARATION: 10,
      EXPEDIE: 30,
      EN_TRANSIT: 50,
      EN_LIVRAISON: 80,
      LIVRE: 100,
      ECHEC_LIVRAISON: 80,
      RETOURNE: 100,
    };
    return progressions[statut] || 0;
  }

  private getDescriptionStatut(statut: StatutSuiviLivraison): string {
    const descriptions: Record<string, string> = {
      EN_PREPARATION: 'Commande en préparation',
      EXPEDIE: 'Colis expédié',
      EN_TRANSIT: 'Colis en transit',
      EN_LIVRAISON: 'Colis en cours de livraison',
      LIVRE: 'Colis livré',
      ECHEC_LIVRAISON: 'Échec de livraison',
      RETOURNE: 'Colis retourné',
    };
    return descriptions[statut] || statut;
  }
}