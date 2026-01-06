// ============================================
// FICHIER: src/modules/inventaire-physique/inventaire-physique.service.ts
// Service pour la gestion des inventaires physiques
// ============================================

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSessionInventaireDto,
  ScannerProduitDto,
  ScannerCodeBarreDto,
  ComptageEnMasseDto,
  RecompterProduitDto,
  ValiderInventaireDto,
  AnnulerInventaireDto,
  FiltresSessionsDto,
  StatutInventairePhysique,
  StatutLigneInventaire,
} from './dto/inventaire-physique.dto';

@Injectable()
export class InventairePhysiqueService {
  private readonly logger = new Logger(InventairePhysiqueService.name);

  // Seuil d'écart (%) pour demander un recomptage
  private readonly SEUIL_RECOMPTAGE = 0.1; // 10%

  constructor(private prisma: PrismaService) {}

  // ============================================
  // CRÉER UNE SESSION D'INVENTAIRE
  // ============================================

  async creerSession(
    dto: CreateSessionInventaireDto,
    userId: number,
  ) {
    // Vérifier que l'entrepôt existe
    const entrepot = await this.prisma.entrepot.findUnique({
      where: { id: dto.entrepotId },
    });

    if (!entrepot) {
      throw new NotFoundException(`Entrepôt #${dto.entrepotId} non trouvé`);
    }

    // Vérifier qu'il n'y a pas de session en cours pour cet entrepôt
    const sessionEnCours = await this.prisma.sessionInventairePhysique.findFirst({
      where: {
        entrepotId: dto.entrepotId,
        statut: { in: ['EN_COURS', 'EN_PAUSE'] },
      },
    });

    if (sessionEnCours) {
      throw new ConflictException(
        `Une session d'inventaire est déjà en cours pour cet entrepôt (Réf: ${sessionEnCours.reference})`,
      );
    }

    // Vérifier la catégorie si spécifiée
    if (dto.categorieId) {
      const categorie = await this.prisma.categorie.findUnique({
        where: { id: dto.categorieId },
      });
      if (!categorie) {
        throw new NotFoundException(`Catégorie #${dto.categorieId} non trouvée`);
      }
    }

    // Générer la référence
    const reference = await this.genererReference();

    // Construire le filtre pour les produits à inventorier
    const whereInventaire: any = {
      entrepotId: dto.entrepotId,
    };

    if (dto.categorieId) {
      whereInventaire.produit = { categorieId: dto.categorieId };
    }

    if (dto.zoneEmplacement) {
      whereInventaire.emplacement = { startsWith: dto.zoneEmplacement };
    }

    // Récupérer les produits à inventorier
    let inventaireItems = await this.prisma.inventaire.findMany({
      where: whereInventaire,
      include: {
        produit: {
          select: {
            id: true,
            reference: true,
            nom: true,
            coutUnitaire: true,
            categorieId: true,
          },
        },
      },
    });

    // Filtrer par IDs de produits si spécifié
    if (dto.produitsIds && dto.produitsIds.length > 0) {
      inventaireItems = inventaireItems.filter((i) =>
        dto.produitsIds!.includes(i.produitId),
      );
    }

    if (inventaireItems.length === 0) {
      throw new BadRequestException(
        'Aucun produit à inventorier avec les critères spécifiés',
      );
    }

    // Créer la session avec ses lignes
    const session = await this.prisma.$transaction(async (tx) => {
      // Créer la session
      const newSession = await tx.sessionInventairePhysique.create({
        data: {
          reference,
          titre: dto.titre,
          description: dto.description,
          entrepotId: dto.entrepotId,
          categorieId: dto.categorieId,
          zoneEmplacement: dto.zoneEmplacement,
          statut: 'EN_COURS',
          totalProduits: inventaireItems.length,
          creePar: userId,
        },
      });

      // Créer les lignes d'inventaire
      const lignesData = inventaireItems.map((item) => ({
        sessionId: newSession.id,
        produitId: item.produitId,
        inventaireId: item.id,
        emplacement: item.emplacement,
        quantiteTheorique: item.quantite,
        coutUnitaire: item.produit.coutUnitaire || 0,
        statut: 'EN_ATTENTE' as const,
      }));

      await tx.ligneInventairePhysique.createMany({
        data: lignesData,
      });

      // Enregistrer dans l'historique
      await tx.historiqueInventairePhysique.create({
        data: {
          sessionId: newSession.id,
          action: 'CREATION',
          details: {
            totalProduits: inventaireItems.length,
            entrepot: entrepot.nom,
            criteres: {
              categorieId: dto.categorieId,
              zoneEmplacement: dto.zoneEmplacement,
            },
          },
          utilisateurId: userId,
        },
      });

      return newSession;
    });

    this.logger.log(
      `Session d'inventaire créée: ${reference} - ${inventaireItems.length} produits`,
    );

    return this.getSessionDetails(session.id);
  }

  // ============================================
  // OBTENIR LES DÉTAILS D'UNE SESSION
  // ============================================

  async getSessionDetails(sessionId: number) {
    const session = await this.prisma.sessionInventairePhysique.findUnique({
      where: { id: sessionId },
      include: {
        entrepot: {
          select: { id: true, nom: true, code: true },
        },
        categorie: {
          select: { id: true, nom: true },
        },
        createur: {
          select: { id: true, nomComplet: true },
        },
        validateur: {
          select: { id: true, nomComplet: true },
        },
        lignes: {
          include: {
            produit: {
              select: {
                id: true,
                reference: true,
                nom: true,
                codeBarre: true,
                categorie: {
                  select: { id: true, nom: true },
                },
              },
            },
            compteur: {
              select: { id: true, nomComplet: true },
            },
          },
          orderBy: [
            { statut: 'asc' },
            { produit: { nom: 'asc' } },
          ],
        },
        _count: {
          select: {
            lignes: true,
            historique: true,
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session d'inventaire #${sessionId} non trouvée`);
    }

    // Calculer les statistiques
    const stats = this.calculerStatistiques(session.lignes);

    return {
      ...session,
      statistiques: stats,
      progression: session.totalProduits > 0
        ? Math.round((session.produitsComptes / session.totalProduits) * 100)
        : 0,
    };
  }

  // ============================================
  // LISTER LES SESSIONS
  // ============================================

  async listerSessions(filtres: FiltresSessionsDto) {
    const { statut, entrepotId, dateDebut, dateFin, page = 1, limit = 20 } = filtres;

    const where: any = {};

    if (statut) {
      where.statut = statut;
    }

    if (entrepotId) {
      where.entrepotId = entrepotId;
    }

    if (dateDebut || dateFin) {
      where.dateDebut = {};
      if (dateDebut) where.dateDebut.gte = new Date(dateDebut);
      if (dateFin) where.dateDebut.lte = new Date(dateFin);
    }

    const [sessions, total] = await Promise.all([
      this.prisma.sessionInventairePhysique.findMany({
        where,
        include: {
          entrepot: {
            select: { id: true, nom: true, code: true },
          },
          categorie: {
            select: { id: true, nom: true },
          },
          createur: {
            select: { id: true, nomComplet: true },
          },
        },
        orderBy: { dateDebut: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.sessionInventairePhysique.count({ where }),
    ]);

    return {
      data: sessions.map((s) => ({
        ...s,
        progression: s.totalProduits > 0
          ? Math.round((s.produitsComptes / s.totalProduits) * 100)
          : 0,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================
  // SCANNER/COMPTER UN PRODUIT
  // ============================================

  async scannerProduit(
    sessionId: number,
    dto: ScannerProduitDto,
    userId: number,
  ) {
    const session = await this.verifierSessionActive(sessionId);

    // Trouver la ligne correspondante
    const ligne = await this.prisma.ligneInventairePhysique.findFirst({
      where: {
        sessionId,
        produitId: dto.produitId,
      },
      include: {
        produit: {
          select: { id: true, reference: true, nom: true },
        },
      },
    });

    if (!ligne) {
      throw new NotFoundException(
        `Le produit #${dto.produitId} ne fait pas partie de cette session d'inventaire`,
      );
    }

    // Calculer l'écart
    const ecart = dto.quantiteComptee - ligne.quantiteTheorique;
    const valeurEcart = ecart * Number(ligne.coutUnitaire);

    // Déterminer si un recomptage est nécessaire
    const pourcentageEcart = ligne.quantiteTheorique > 0
      ? Math.abs(ecart) / ligne.quantiteTheorique
      : (ecart !== 0 ? 1 : 0);
    const necessiteRecomptage = pourcentageEcart > this.SEUIL_RECOMPTAGE;

    // Déterminer le statut
    let statut: StatutLigneInventaire;
    if (ecart === 0) {
      statut = StatutLigneInventaire.VALIDE;
    } else if (necessiteRecomptage) {
      statut = StatutLigneInventaire.ECART;
    } else {
      statut = StatutLigneInventaire.COMPTE;
    }

    // Mettre à jour la ligne
    const ligneUpdated = await this.prisma.ligneInventairePhysique.update({
      where: { id: ligne.id },
      data: {
        quantiteComptee: dto.quantiteComptee,
        ecart,
        valeurEcart,
        emplacement: dto.emplacement || ligne.emplacement,
        notes: dto.notes,
        statut,
        comptePar: userId,
        dateComptage: new Date(),
        necessiteRecomptage,
      },
      include: {
        produit: {
          select: {
            id: true,
            reference: true,
            nom: true,
            codeBarre: true,
          },
        },
      },
    });

    // Mettre à jour les statistiques de la session
    await this.mettreAJourStatistiquesSession(sessionId);

    // Enregistrer dans l'historique
    await this.prisma.historiqueInventairePhysique.create({
      data: {
        sessionId,
        action: 'COMPTAGE',
        details: {
          produitId: dto.produitId,
          produitRef: ligne.produit.reference,
          quantiteTheorique: ligne.quantiteTheorique,
          quantiteComptee: dto.quantiteComptee,
          ecart,
          necessiteRecomptage,
        },
        utilisateurId: userId,
      },
    });

    return {
      ligne: ligneUpdated,
      ecart,
      valeurEcart,
      necessiteRecomptage,
      message: necessiteRecomptage
        ? `Écart important détecté (${ecart}). Un recomptage est recommandé.`
        : ecart === 0
          ? 'Comptage validé - Aucun écart'
          : `Comptage enregistré avec un écart de ${ecart}`,
    };
  }

  // ============================================
  // SCANNER PAR CODE-BARRE
  // ============================================

  async scannerCodeBarre(
    sessionId: number,
    dto: ScannerCodeBarreDto,
    userId: number,
  ) {
    // Trouver le produit par code-barre ou référence
    const produit = await this.prisma.produit.findFirst({
      where: {
        OR: [
          { codeBarre: dto.codeBarre },
          { reference: dto.codeBarre.toUpperCase() },
        ],
      },
    });

    if (!produit) {
      throw new NotFoundException(
        `Aucun produit trouvé avec le code-barre ou la référence: ${dto.codeBarre}`,
      );
    }

    return this.scannerProduit(
      sessionId,
      {
        produitId: produit.id,
        quantiteComptee: dto.quantiteComptee,
        emplacement: dto.emplacement,
        notes: dto.notes,
      },
      userId,
    );
  }

  // ============================================
  // COMPTAGE EN MASSE
  // ============================================

  async comptageEnMasse(
    sessionId: number,
    dto: ComptageEnMasseDto,
    userId: number,
  ) {
    await this.verifierSessionActive(sessionId);

    const resultats = {
      success: 0,
      errors: [] as { produitId: number; message: string }[],
    };

    for (const comptage of dto.comptages) {
      try {
        await this.scannerProduit(sessionId, comptage, userId);
        resultats.success++;
      } catch (error) {
        resultats.errors.push({
          produitId: comptage.produitId,
          message: error.message,
        });
      }
    }

    return {
      total: dto.comptages.length,
      success: resultats.success,
      errors: resultats.errors.length,
      details: resultats.errors,
    };
  }

  // ============================================
  // RECOMPTER UN PRODUIT
  // ============================================

  async recompterProduit(
    sessionId: number,
    dto: RecompterProduitDto,
    userId: number,
  ) {
    const session = await this.verifierSessionActive(sessionId);

    const ligne = await this.prisma.ligneInventairePhysique.findFirst({
      where: {
        sessionId,
        produitId: dto.produitId,
      },
      include: {
        produit: {
          select: { id: true, reference: true, nom: true },
        },
      },
    });

    if (!ligne) {
      throw new NotFoundException(
        `Le produit #${dto.produitId} ne fait pas partie de cette session`,
      );
    }

    if (ligne.statut === 'EN_ATTENTE') {
      throw new BadRequestException(
        'Ce produit n\'a pas encore été compté. Utilisez l\'endpoint de comptage.',
      );
    }

    // Calculer le nouvel écart
    const ecart = dto.quantiteRecomptee - ligne.quantiteTheorique;
    const valeurEcart = ecart * Number(ligne.coutUnitaire);

    // Mettre à jour la ligne
    const ligneUpdated = await this.prisma.ligneInventairePhysique.update({
      where: { id: ligne.id },
      data: {
        quantiteRecomptee: dto.quantiteRecomptee,
        ecart,
        valeurEcart,
        notes: dto.notes ? `${ligne.notes || ''}\nRecomptage: ${dto.notes}` : ligne.notes,
        statut: ecart === 0 ? 'VALIDE' : 'COMPTE',
        recomptePar: userId,
        dateRecomptage: new Date(),
        necessiteRecomptage: false,
      },
      include: {
        produit: true,
      },
    });

    // Mettre à jour les statistiques
    await this.mettreAJourStatistiquesSession(sessionId);

    // Historique
    await this.prisma.historiqueInventairePhysique.create({
      data: {
        sessionId,
        action: 'RECOMPTAGE',
        details: {
          produitId: dto.produitId,
          produitRef: ligne.produit.reference,
          ancienneQuantite: ligne.quantiteComptee,
          nouvelleQuantite: dto.quantiteRecomptee,
          ancienEcart: ligne.ecart,
          nouvelEcart: ecart,
        },
        utilisateurId: userId,
      },
    });

    return {
      ligne: ligneUpdated,
      ecart,
      valeurEcart,
      message: ecart === 0
        ? 'Recomptage validé - Aucun écart'
        : `Recomptage enregistré avec un écart de ${ecart}`,
    };
  }

  // ============================================
  // OBTENIR LES ÉCARTS
  // ============================================

  async getEcarts(sessionId: number) {
    const session = await this.prisma.sessionInventairePhysique.findUnique({
      where: { id: sessionId },
      include: {
        lignes: {
          where: {
            ecart: { not: 0 },
          },
          include: {
            produit: {
              select: {
                id: true,
                reference: true,
                nom: true,
                codeBarre: true,
                categorie: {
                  select: { id: true, nom: true },
                },
              },
            },
          },
          orderBy: [
            { valeurEcart: 'desc' },
          ],
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session #${sessionId} non trouvée`);
    }

    // Calculer les totaux
    let ecartPositifTotal = 0;
    let ecartNegatifTotal = 0;
    let valeurEcartPositif = 0;
    let valeurEcartNegatif = 0;

    const resumeParCategorie: Map<string, {
      categorie: string;
      ecartQuantite: number;
      valeurEcart: number;
      nombreProduits: number;
    }> = new Map();

    for (const ligne of session.lignes) {
      const ecart = ligne.ecart || 0;
      const valeur = Number(ligne.valeurEcart) || 0;
      const categorie = ligne.produit.categorie?.nom || 'Non catégorisé';

      if (ecart > 0) {
        ecartPositifTotal += ecart;
        valeurEcartPositif += valeur;
      } else {
        ecartNegatifTotal += Math.abs(ecart);
        valeurEcartNegatif += Math.abs(valeur);
      }

      // Résumé par catégorie
      if (!resumeParCategorie.has(categorie)) {
        resumeParCategorie.set(categorie, {
          categorie,
          ecartQuantite: 0,
          valeurEcart: 0,
          nombreProduits: 0,
        });
      }
      const cat = resumeParCategorie.get(categorie)!;
      cat.ecartQuantite += ecart;
      cat.valeurEcart += valeur;
      cat.nombreProduits++;
    }

    return {
      sessionId,
      reference: session.reference,
      statut: session.statut,
      totalLignes: session.totalProduits,
      lignesAvecEcart: session.lignes.length,
      ecartPositifTotal,
      ecartNegatifTotal,
      valeurEcartPositif,
      valeurEcartNegatif,
      valeurEcartNet: valeurEcartPositif - valeurEcartNegatif,
      lignes: session.lignes,
      resumeParCategorie: Array.from(resumeParCategorie.values()).sort(
        (a, b) => Math.abs(b.valeurEcart) - Math.abs(a.valeurEcart),
      ),
    };
  }

  // ============================================
  // VALIDER L'INVENTAIRE
  // ============================================

  async validerInventaire(
    sessionId: number,
    dto: ValiderInventaireDto,
    userId: number,
  ) {
    const session = await this.verifierSessionActive(sessionId);

    // Vérifier que tous les produits ont été comptés
    const lignesNonComptees = await this.prisma.ligneInventairePhysique.count({
      where: {
        sessionId,
        statut: 'EN_ATTENTE',
      },
    });

    if (lignesNonComptees > 0) {
      throw new BadRequestException(
        `${lignesNonComptees} produit(s) n'ont pas encore été comptés`,
      );
    }

    // Vérifier les recomptages nécessaires
    const lignesRecomptage = await this.prisma.ligneInventairePhysique.count({
      where: {
        sessionId,
        necessiteRecomptage: true,
      },
    });

    if (lignesRecomptage > 0) {
      throw new BadRequestException(
        `${lignesRecomptage} produit(s) nécessitent un recomptage avant validation`,
      );
    }

    // Récupérer les lignes avec écarts à appliquer
    const lignesAvecEcart = await this.prisma.ligneInventairePhysique.findMany({
      where: {
        sessionId,
        ecart: { not: 0 },
        id: dto.lignesExclues ? { notIn: dto.lignesExclues } : undefined,
      },
      include: {
        produit: true,
        inventaire: true,
      },
    });

    const appliquerAjustements = dto.appliquerAjustements !== false;

    // Transaction pour appliquer les ajustements
    await this.prisma.$transaction(async (tx) => {
      if (appliquerAjustements && lignesAvecEcart.length > 0) {
        for (const ligne of lignesAvecEcart) {
          const quantiteFinale = ligne.quantiteRecomptee ?? ligne.quantiteComptee;

          // Mettre à jour l'inventaire
          if (ligne.inventaireId) {
            await tx.inventaire.update({
              where: { id: ligne.inventaireId },
              data: {
                quantite: quantiteFinale!,
                derniereVerification: new Date(),
              },
            });
          }

          // Mettre à jour le stock global du produit
          await tx.produit.update({
            where: { id: ligne.produitId },
            data: {
              quantiteStock: {
                increment: ligne.ecart!,
              },
            },
          });

          // Créer un mouvement d'ajustement
          await tx.mouvementStock.create({
            data: {
              produitId: ligne.produitId,
              entrepotId: session.entrepotId,
              typeMouvement: 'AJUSTEMENT',
              quantite: Math.abs(ligne.ecart!),
              raison: `Inventaire physique ${session.reference} - ${ligne.ecart! > 0 ? 'Surplus' : 'Manquant'}`,
              coutUnitaire: ligne.coutUnitaire,
              effectuePar: userId,
              notes: dto.raison || 'Validation inventaire physique',
            },
          });
        }
      }

      // Mettre à jour le statut de la session
      await tx.sessionInventairePhysique.update({
        where: { id: sessionId },
        data: {
          statut: 'VALIDE',
          dateFin: new Date(),
          dateValidation: new Date(),
          validePar: userId,
        },
      });

      // Marquer toutes les lignes comme validées
      await tx.ligneInventairePhysique.updateMany({
        where: { sessionId },
        data: { statut: 'VALIDE' },
      });

      // Historique
      await tx.historiqueInventairePhysique.create({
        data: {
          sessionId,
          action: 'VALIDATION',
          details: {
            raison: dto.raison,
            ajustementsAppliques: appliquerAjustements,
            nombreAjustements: lignesAvecEcart.length,
            lignesExclues: dto.lignesExclues,
          },
          utilisateurId: userId,
        },
      });
    });

    this.logger.log(
      `Inventaire ${session.reference} validé - ${lignesAvecEcart.length} ajustements appliqués`,
    );

    return {
      success: true,
      message: `Inventaire validé avec succès`,
      ajustementsAppliques: appliquerAjustements ? lignesAvecEcart.length : 0,
      session: await this.getSessionDetails(sessionId),
    };
  }

  // ============================================
  // ANNULER L'INVENTAIRE
  // ============================================

  async annulerInventaire(
    sessionId: number,
    dto: AnnulerInventaireDto,
    userId: number,
  ) {
    const session = await this.prisma.sessionInventairePhysique.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session #${sessionId} non trouvée`);
    }

    if (session.statut === 'VALIDE') {
      throw new BadRequestException(
        'Impossible d\'annuler une session déjà validée',
      );
    }

    if (session.statut === 'ANNULE') {
      throw new BadRequestException('Cette session est déjà annulée');
    }

    await this.prisma.$transaction(async (tx) => {
      // Mettre à jour le statut
      await tx.sessionInventairePhysique.update({
        where: { id: sessionId },
        data: {
          statut: 'ANNULE',
          dateFin: new Date(),
        },
      });

      // Historique
      await tx.historiqueInventairePhysique.create({
        data: {
          sessionId,
          action: 'ANNULATION',
          details: {
            raison: dto.raison,
            produitsComptes: session.produitsComptes,
          },
          utilisateurId: userId,
        },
      });
    });

    this.logger.log(`Inventaire ${session.reference} annulé: ${dto.raison}`);

    return {
      success: true,
      message: 'Session d\'inventaire annulée',
      reference: session.reference,
    };
  }

  // ============================================
  // METTRE EN PAUSE / REPRENDRE
  // ============================================

  async mettreEnPause(sessionId: number, userId: number) {
    const session = await this.verifierSessionActive(sessionId);

    await this.prisma.$transaction(async (tx) => {
      await tx.sessionInventairePhysique.update({
        where: { id: sessionId },
        data: { statut: 'EN_PAUSE' },
      });

      await tx.historiqueInventairePhysique.create({
        data: {
          sessionId,
          action: 'PAUSE',
          details: { produitsComptes: session.produitsComptes },
          utilisateurId: userId,
        },
      });
    });

    return { success: true, message: 'Session mise en pause' };
  }

  async reprendre(sessionId: number, userId: number) {
    const session = await this.prisma.sessionInventairePhysique.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session #${sessionId} non trouvée`);
    }

    if (session.statut !== 'EN_PAUSE') {
      throw new BadRequestException(
        `La session n'est pas en pause (statut: ${session.statut})`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.sessionInventairePhysique.update({
        where: { id: sessionId },
        data: { statut: 'EN_COURS' },
      });

      await tx.historiqueInventairePhysique.create({
        data: {
          sessionId,
          action: 'REPRISE',
          details: {},
          utilisateurId: userId,
        },
      });
    });

    return { success: true, message: 'Session reprise' };
  }

  // ============================================
  // HISTORIQUE
  // ============================================

  async getHistorique(sessionId: number) {
    const historique = await this.prisma.historiqueInventairePhysique.findMany({
      where: { sessionId },
      include: {
        utilisateur: {
          select: { id: true, nomComplet: true },
        },
      },
      orderBy: { dateAction: 'desc' },
    });

    return historique;
  }

  // ============================================
  // MÉTHODES UTILITAIRES PRIVÉES
  // ============================================

  private async verifierSessionActive(sessionId: number) {
    const session = await this.prisma.sessionInventairePhysique.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session d'inventaire #${sessionId} non trouvée`);
    }

    if (!['EN_COURS', 'EN_PAUSE'].includes(session.statut)) {
      throw new BadRequestException(
        `Cette session n'est plus active (statut: ${session.statut})`,
      );
    }

    if (session.statut === 'EN_PAUSE') {
      throw new BadRequestException(
        'Cette session est en pause. Veuillez la reprendre avant de continuer.',
      );
    }

    return session;
  }

  private async genererReference(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const lastSession = await this.prisma.sessionInventairePhysique.findFirst({
      where: {
        reference: { startsWith: `INV-${year}${month}` },
      },
      orderBy: { reference: 'desc' },
    });

    let sequence = 1;
    if (lastSession) {
      const lastSequence = parseInt(lastSession.reference.split('-')[2], 10);
      sequence = lastSequence + 1;
    }

    return `INV-${year}${month}-${String(sequence).padStart(4, '0')}`;
  }

  private async mettreAJourStatistiquesSession(sessionId: number) {
    const stats = await this.prisma.ligneInventairePhysique.groupBy({
      by: ['sessionId'],
      where: { sessionId },
      _count: { id: true },
      _sum: { valeurEcart: true },
    });

    const lignesComptees = await this.prisma.ligneInventairePhysique.count({
      where: {
        sessionId,
        statut: { not: 'EN_ATTENTE' },
      },
    });

    const lignesAvecEcart = await this.prisma.ligneInventairePhysique.count({
      where: {
        sessionId,
        ecart: { not: 0 },
      },
    });

    await this.prisma.sessionInventairePhysique.update({
      where: { id: sessionId },
      data: {
        produitsComptes: lignesComptees,
        produitsAvecEcart: lignesAvecEcart,
        valeurEcartTotal: stats[0]?._sum?.valeurEcart || 0,
      },
    });
  }

  private calculerStatistiques(lignes: any[]) {
    const stats = {
      totalProduits: lignes.length,
      produitsComptes: 0,
      produitsNonComptes: 0,
      produitsAvecEcart: 0,
      produitsSansEcart: 0,
      ecartPositifQuantite: 0,
      ecartNegatifQuantite: 0,
      valeurEcartPositif: 0,
      valeurEcartNegatif: 0,
      valeurEcartNet: 0,
      produitsNecessitantRecomptage: 0,
      progression: 0,
    };

    for (const ligne of lignes) {
      if (ligne.statut === 'EN_ATTENTE') {
        stats.produitsNonComptes++;
      } else {
        stats.produitsComptes++;

        if (ligne.ecart === 0) {
          stats.produitsSansEcart++;
        } else {
          stats.produitsAvecEcart++;
          const ecart = ligne.ecart || 0;
          const valeur = Number(ligne.valeurEcart) || 0;

          if (ecart > 0) {
            stats.ecartPositifQuantite += ecart;
            stats.valeurEcartPositif += valeur;
          } else {
            stats.ecartNegatifQuantite += Math.abs(ecart);
            stats.valeurEcartNegatif += Math.abs(valeur);
          }
        }
      }

      if (ligne.necessiteRecomptage) {
        stats.produitsNecessitantRecomptage++;
      }
    }

    stats.valeurEcartNet = stats.valeurEcartPositif - stats.valeurEcartNegatif;
    stats.progression = stats.totalProduits > 0
      ? Math.round((stats.produitsComptes / stats.totalProduits) * 100)
      : 0;

    return stats;
  }

  // ============================================
  // MÉTHODES FRONTEND SUPPLÉMENTAIRES
  // ============================================

  /**
   * Obtenir la progression d'une session
   */
  async getProgression(sessionId: number) {
    const session = await this.getSessionDetails(sessionId);
    
    // Calculate stats from session lignes
    const totalProduits = session.lignes?.length || 0;
    const produitsComptes = session.lignes?.filter((l: any) => l.quantiteComptee !== null).length || 0;
    const produitsAvecEcart = session.lignes?.filter((l: any) => l.ecart !== 0).length || 0;
    const progression = totalProduits > 0 ? Math.round((produitsComptes / totalProduits) * 100) : 0;

    return {
      sessionId,
      statut: session.statut,
      progression,
      totalProduits,
      produitsComptes,
      produitsAvecEcart,
    };
  }

  /**
   * Obtenir les sessions actives
   */
  async getActives() {
    return this.prisma.sessionInventairePhysique.findMany({
      where: {
        statut: { in: ['EN_COURS', 'EN_PAUSE'] },
      },
      include: {
        entrepot: { select: { id: true, nom: true, code: true } },
        createur: { select: { id: true, nomComplet: true } },
        _count: { select: { lignes: true } },
      },
      orderBy: { dateDebut: 'desc' },
    });
  }

  /**
   * Obtenir les statistiques globales (toutes sessions)
   */
  async getStatistiquesGlobales(filters?: { dateDebut?: string; dateFin?: string }) {
    const where: any = {};
    
    if (filters?.dateDebut || filters?.dateFin) {
      where.dateDebut = {};
      if (filters.dateDebut) where.dateDebut.gte = new Date(filters.dateDebut);
      if (filters.dateFin) where.dateDebut.lte = new Date(filters.dateFin);
    }

    const [total, enCours, terminees, validees, annulees] = await Promise.all([
      this.prisma.sessionInventairePhysique.count({ where }),
      this.prisma.sessionInventairePhysique.count({ where: { ...where, statut: 'EN_COURS' } }),
      this.prisma.sessionInventairePhysique.count({ where: { ...where, statut: 'TERMINE' } }),
      this.prisma.sessionInventairePhysique.count({ where: { ...where, statut: 'VALIDE' } }),
      this.prisma.sessionInventairePhysique.count({ where: { ...where, statut: 'ANNULE' } }),
    ]);

    return {
      total,
      enCours,
      terminees,
      validees,
      annulees,
      tauxValidation: total > 0 ? Math.round((validees / total) * 100) : 0,
    };
  }

  /**
   * Générer un rapport PDF pour une session
   */
  async genererRapport(sessionId: number, format: string = 'pdf', res: any) {
    const session = await this.getSessionDetails(sessionId);
    
    // Calculate stats from session
    const lignes = session.lignes || [];
    const totalProduits = lignes.length;
    const produitsComptes = lignes.filter((l: any) => l.quantiteComptee !== null).length;
    const produitsAvecEcart = lignes.filter((l: any) => l.ecart !== 0).length;

    const rapport = {
      session: {
        id: session.id,
        reference: session.reference,
        entrepot: session.entrepot?.nom,
        responsable: session.createur?.nomComplet,
        dateDebut: session.dateDebut,
        dateFin: session.dateFin,
        statut: session.statut,
      },
      statistiques: {
        totalProduits,
        produitsComptes,
        produitsAvecEcart,
        progression: totalProduits > 0 ? Math.round((produitsComptes / totalProduits) * 100) : 0,
      },
      lignes: lignes.map((l: any) => ({
        produit: l.produit?.nom,
        reference: l.produit?.reference,
        quantiteTheorique: l.quantiteTheorique,
        quantiteComptee: l.quantiteComptee,
        ecart: l.ecart,
        valeurEcart: l.valeurEcart,
      })),
    };

    if (res) {
      res.setHeader('Content-Type', 'application/json');
      res.json(rapport);
    }
    return rapport;
  }

  // ============================================
  // MÉTHODES CRUD ADDITIONNELLES
  // ============================================

  async update(sessionId: number, updateData: any) {
    const session = await this.prisma.sessionInventairePhysique.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} non trouvée`);
    }

    if (session.statut !== 'EN_COURS') {
      throw new BadRequestException('Seules les sessions en cours peuvent être modifiées');
    }

    return this.prisma.sessionInventairePhysique.update({
      where: { id: sessionId },
      data: updateData,
      include: {
        entrepot: true,
        createur: { select: { id: true, nomComplet: true, email: true } },
      },
    });
  }

  async remove(sessionId: number) {
    const session = await this.prisma.sessionInventairePhysique.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} non trouvée`);
    }

    if (session.statut !== 'EN_COURS') {
      throw new BadRequestException('Seules les sessions en cours peuvent être supprimées');
    }

    // Supprimer les lignes d'abord
    await this.prisma.ligneInventairePhysique.deleteMany({
      where: { sessionId },
    });

    return this.prisma.sessionInventairePhysique.delete({
      where: { id: sessionId },
    });
  }

  async demarrer(sessionId: number, userId: number) {
    const session = await this.prisma.sessionInventairePhysique.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} non trouvée`);
    }

    if (session.statut !== 'EN_PAUSE') {
      throw new BadRequestException('Seules les sessions en pause peuvent être démarrées');
    }

    return this.prisma.sessionInventairePhysique.update({
      where: { id: sessionId },
      data: {
        statut: 'EN_COURS',
        dateDebut: session.dateDebut || new Date(),
      },
      include: {
        entrepot: true,
        createur: { select: { id: true, nomComplet: true, email: true } },
      },
    });
  }

  async terminer(sessionId: number, userId: number) {
    const session = await this.prisma.sessionInventairePhysique.findUnique({
      where: { id: sessionId },
      include: { lignes: true },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} non trouvée`);
    }

    if (session.statut !== 'EN_COURS') {
      throw new BadRequestException('Seules les sessions en cours peuvent être terminées');
    }

    // Vérifier que tous les produits sont comptés
    const nonComptes = session.lignes.filter((l: any) => l.quantiteComptee === null);
    if (nonComptes.length > 0) {
      throw new BadRequestException(`${nonComptes.length} produit(s) n'ont pas encore été comptés`);
    }

    return this.prisma.sessionInventairePhysique.update({
      where: { id: sessionId },
      data: {
        statut: 'TERMINE',
        dateFin: new Date(),
      },
      include: {
        entrepot: true,
        createur: { select: { id: true, nomComplet: true, email: true } },
      },
    });
  }

  async getLignes(sessionId: number, filters?: { page?: number; limit?: number; statut?: string }) {
    const session = await this.prisma.sessionInventairePhysique.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} non trouvée`);
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = { sessionId };

    if (filters?.statut === 'comptes') {
      where.quantiteComptee = { not: null };
    } else if (filters?.statut === 'non_comptes') {
      where.quantiteComptee = null;
    } else if (filters?.statut === 'ecarts') {
      where.ecart = { not: 0 };
    }

    const [lignes, total] = await Promise.all([
      this.prisma.ligneInventairePhysique.findMany({
        where,
        skip,
        take: limit,
        include: {
          produit: {
            select: { id: true, reference: true, nom: true, coutUnitaire: true },
          },
        },
        orderBy: { id: 'asc' },
      }),
      this.prisma.ligneInventairePhysique.count({ where }),
    ]);

    return {
      data: lignes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async ajouterProduit(sessionId: number, produitId: number, userId: number) {
    const session = await this.prisma.sessionInventairePhysique.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} non trouvée`);
    }

    if (session.statut !== 'EN_COURS') {
      throw new BadRequestException('Les produits ne peuvent être ajoutés qu\'aux sessions en cours');
    }

    // Vérifier si le produit existe déjà dans la session
    const existing = await this.prisma.ligneInventairePhysique.findFirst({
      where: { sessionId, produitId },
    });

    if (existing) {
      throw new BadRequestException('Ce produit est déjà dans la session d\'inventaire');
    }

    // Récupérer le stock actuel du produit dans l'entrepôt
    const stock = await this.prisma.inventaire.findFirst({
      where: { produitId, entrepotId: session.entrepotId },
    });

    // Récupérer le coût unitaire du produit
    const produit = await this.prisma.produit.findUnique({
      where: { id: produitId },
      select: { coutUnitaire: true },
    });

    return this.prisma.ligneInventairePhysique.create({
      data: {
        sessionId,
        produitId,
        quantiteTheorique: stock?.quantite || 0,
        quantiteComptee: null,
        ecart: 0,
        valeurEcart: 0,
        coutUnitaire: produit?.coutUnitaire || 0,
      },
      include: {
        produit: {
          select: { id: true, reference: true, nom: true, coutUnitaire: true },
        },
      },
    });
  }

  async compterLigne(sessionId: number, ligneId: number, data: { quantiteComptee: number; notes?: string }, userId: number) {
    const ligne = await this.prisma.ligneInventairePhysique.findFirst({
      where: { id: ligneId, sessionId },
      include: { produit: true },
    });

    if (!ligne) {
      throw new NotFoundException(`Ligne ${ligneId} non trouvée dans la session ${sessionId}`);
    }

    const ecart = data.quantiteComptee - ligne.quantiteTheorique;
    const valeurEcart = ecart * (Number(ligne.produit?.coutUnitaire || 0));

    return this.prisma.ligneInventairePhysique.update({
      where: { id: ligneId },
      data: {
        quantiteComptee: data.quantiteComptee,
        ecart,
        valeurEcart,
        notes: data.notes,
        dateComptage: new Date(),
      },
      include: {
        produit: {
          select: { id: true, reference: true, nom: true, coutUnitaire: true },
        },
      },
    });
  }

  async demanderRecomptage(sessionId: number, ligneId: number, userId: number) {
    const ligne = await this.prisma.ligneInventairePhysique.findFirst({
      where: { id: ligneId, sessionId },
    });

    if (!ligne) {
      throw new NotFoundException(`Ligne ${ligneId} non trouvée dans la session ${sessionId}`);
    }

    return this.prisma.ligneInventairePhysique.update({
      where: { id: ligneId },
      data: {
        necessiteRecomptage: true,
        quantiteComptee: null,
        ecart: 0,
        valeurEcart: 0,
      },
      include: {
        produit: {
          select: { id: true, reference: true, nom: true, coutUnitaire: true },
        },
      },
    });
  }

  async recompterLigne(sessionId: number, ligneId: number, data: { quantiteComptee: number; notes?: string }, userId: number) {
    const ligne = await this.prisma.ligneInventairePhysique.findFirst({
      where: { id: ligneId, sessionId },
      include: { produit: true },
    });

    if (!ligne) {
      throw new NotFoundException(`Ligne ${ligneId} non trouvée dans la session ${sessionId}`);
    }

    const ecart = data.quantiteComptee - ligne.quantiteTheorique;
    const valeurEcart = ecart * (Number(ligne.produit?.coutUnitaire || 0));

    return this.prisma.ligneInventairePhysique.update({
      where: { id: ligneId },
      data: {
        quantiteComptee: data.quantiteComptee,
        ecart,
        valeurEcart,
        notes: data.notes,
        necessiteRecomptage: false,
        dateRecomptage: new Date(),
      },
      include: {
        produit: {
          select: { id: true, reference: true, nom: true, coutUnitaire: true },
        },
      },
    });
  }

  async getResume(sessionId: number) {
    const session = await this.prisma.sessionInventairePhysique.findUnique({
      where: { id: sessionId },
      include: {
        entrepot: true,
        createur: { select: { id: true, nomComplet: true, email: true } },
        lignes: {
          include: {
            produit: { select: { id: true, reference: true, nom: true, coutUnitaire: true } },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} non trouvée`);
    }

    const totalProduits = session.lignes.length;
    const produitsComptes = session.lignes.filter((l: any) => l.quantiteComptee !== null).length;
    const produitsAvecEcart = session.lignes.filter((l: any) => l.ecart !== 0).length;
    const valeurTotaleEcarts = session.lignes.reduce((sum: number, l: any) => sum + Math.abs(l.valeurEcart || 0), 0);
    const ecartsPositifs = session.lignes.filter((l: any) => l.ecart > 0).length;
    const ecartsNegatifs = session.lignes.filter((l: any) => l.ecart < 0).length;
    const recomptagesRequis = session.lignes.filter((l: any) => l.necessiteRecomptage).length;

    return {
      session: {
        id: session.id,
        reference: session.reference,
        statut: session.statut,
        dateDebut: session.dateDebut,
        dateFin: session.dateFin,
        entrepot: session.entrepot?.nom,
        responsable: session.createur?.nomComplet,
      },
      progression: {
        totalProduits,
        produitsComptes,
        pourcentage: totalProduits > 0 ? Math.round((produitsComptes / totalProduits) * 100) : 0,
      },
      ecarts: {
        total: produitsAvecEcart,
        positifs: ecartsPositifs,
        negatifs: ecartsNegatifs,
        valeurTotale: valeurTotaleEcarts,
      },
      recomptages: {
        requis: recomptagesRequis,
      },
    };
  }
}