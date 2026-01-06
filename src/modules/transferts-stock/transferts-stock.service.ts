import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTransfertStockDto} from './dto/create-transfert.dto';
import { ReceptionPartielleDto } from './dto/reception-partielle.dto'
import { UpdateTransfertStockDto } from './dto/update-transfert.dto'

/**
 * Service de gestion des transferts de stock entre entrepôts
 *
 * Ce service gère toutes les opérations liées aux transferts inter-entrepôts :
 * - Création de transferts
 * - Expédition et réception
 * - Gestion des statuts
 * - Réception partielle
 * - Annulation
 * - Historique et statistiques
 *
 * ⚠️ Fonctionnalité PREMIUM - Nécessite un abonnement premium
 *
 * @class TransfertsStockService
 * @injectable
 */
@Injectable()
export class TransfertsStockService {
  constructor(private prisma: PrismaService) {}

  /**
   * Créer un nouveau transfert de stock
   *
   * Crée un transfert avec statut EN_ATTENTE et génère un numéro unique.
   * Ne modifie PAS encore les stocks (attente expédition).
   *
   * @param {CreateTransfertStockDto} createDto - Données du transfert
   * @param {number} userId - ID de l'utilisateur créateur
   * @returns {Promise<TransfertStock>} Le transfert créé
   * @throws {BadRequestException} Si source = destination ou données invalides
   * @throws {NotFoundException} Si un entrepôt n'existe pas
   *
   * @example
   * ```typescript
   * const transfert = await service.createTransfert({
   *   entrepotSourceId: 1,
   *   entrepotDestinationId: 2,
   *   dateTransfert: '2025-11-20',
   *   notes: 'Réapprovisionnement urgent',
   *   lignes: [
   *     { produitId: 42, quantite: 50 },
   *     { produitId: 15, quantite: 30 }
   *   ]
   * }, userId);
   * ```
   */
  async createTransfert(createDto: CreateTransfertStockDto, userId: number) {
    // Utiliser les alias si nécessaire
    const entrepotSourceId = createDto.entrepotSourceId || createDto.entrepotOrigineId;
    const entrepotDestinationId = createDto.entrepotDestinationId;
    const lignes = createDto.lignes || createDto.produits || [];
    const dateTransfert = createDto.dateTransfert || new Date().toISOString();
    const notes = createDto.notes;

    if (!entrepotSourceId || !entrepotDestinationId) {
      throw new BadRequestException('Les entrepôts source et destination sont requis');
    }

    if (!lignes || lignes.length === 0) {
      throw new BadRequestException('Au moins un produit est requis');
    }

    // 1. Validation : source ≠ destination
    if (entrepotSourceId === entrepotDestinationId) {
      throw new BadRequestException(
        'L\'entrepôt source et destination doivent être différents'
      );
    }

    // 2. Vérifier que les entrepôts existent et sont actifs
    const [source, destination] = await Promise.all([
      this.prisma.entrepot.findUnique({
        where: { id: entrepotSourceId },
      }),
      this.prisma.entrepot.findUnique({
        where: { id: entrepotDestinationId },
      }),
    ]);

    if (!source) {
      throw new NotFoundException(
        `Entrepôt source #${entrepotSourceId} non trouvé`
      );
    }

    if (!destination) {
      throw new NotFoundException(
        `Entrepôt destination #${entrepotDestinationId} non trouvé`
      );
    }

    if (!source.estActif) {
      throw new BadRequestException(
        `L'entrepôt source "${source.nom}" est inactif`
      );
    }

    if (!destination.estActif) {
      throw new BadRequestException(
        `L'entrepôt destination "${destination.nom}" est inactif`
      );
    }

    // 3. Vérifier que tous les produits existent
    const produitsIds = lignes.map(l => l.produitId);
    const produits = await this.prisma.produit.findMany({
      where: { id: { in: produitsIds } },
    });

    if (produits.length !== produitsIds.length) {
      throw new NotFoundException('Un ou plusieurs produits sont introuvables');
    }

    // 4. Générer numéro unique de transfert
    const numeroTransfert = await this.generateNumeroTransfert();

    // 5. Créer le transfert (SANS modifier les stocks)
    return this.prisma.transfertStock.create({
      data: {
        numeroTransfert,
        entrepotSourceId,
        entrepotDestinationId,
        dateTransfert: new Date(dateTransfert),
        statut: 'EN_ATTENTE', // Pas encore expédié
        notes,
        creePar: userId,
        lignes: {
          create: lignes.map(ligne => ({
            produitId: ligne.produitId,
            quantite: ligne.quantite,
            quantiteRecue: 0,
          })),
        },
      },
      include: {
        lignes: {
          include: {
            produit: {
              select: {
                id: true,
                nom: true,
                reference: true,
              },
            },
          },
        },
        entrepotSource: {
          select: {
            id: true,
            nom: true,
            code: true,
          },
        },
        entrepotDestination: {
          select: {
            id: true,
            nom: true,
            code: true,
          },
        },
        createur: {
          select: {
            id: true,
            nomComplet: true,
          },
        },
      },
    });
  }

  /**
   * Expédier un transfert (passer de EN_ATTENTE à EN_TRANSIT)
   *
   * Vérifie les stocks disponibles et décrémente l'inventaire source.
   *
   * @param {number} transfertId - ID du transfert
   * @param {number} userId - ID de l'utilisateur
   * @returns {Promise<TransfertStock>} Le transfert expédié
   * @throws {NotFoundException} Si le transfert n'existe pas
   * @throws {BadRequestException} Si déjà expédié ou stock insuffisant
   *
   * @example
   * ```typescript
   * await service.expedierTransfert(1, userId);
   * ```
   */
  async expedierTransfert(transfertId: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Récupérer le transfert
      const transfert = await tx.transfertStock.findUnique({
        where: { id: transfertId },
        include: {
          lignes: true,
          entrepotSource: true,
          entrepotDestination: true,
        },
      });

      if (!transfert) {
        throw new NotFoundException(`Transfert #${transfertId} non trouvé`);
      }

      // 2. Vérifier le statut
      if (transfert.statut !== 'EN_ATTENTE') {
        throw new BadRequestException(
          `Impossible d'expédier : le transfert est ${transfert.statut}`
        );
      }

      // 3. Vérifier et décrémenter les stocks sources
      for (const ligne of transfert.lignes) {
        const stockSource = await tx.inventaire.findFirst({
          where: {
            produitId: ligne.produitId,
            entrepotId: transfert.entrepotSourceId,
          },
        });

        if (!stockSource) {
          throw new BadRequestException(
            `Produit #${ligne.produitId} non disponible dans l'entrepôt source`
          );
        }

        const disponible = stockSource.quantite - stockSource.quantiteReservee;

        if (disponible < ligne.quantite) {
          throw new BadRequestException(
            `Stock disponible insuffisant pour le produit #${ligne.produitId}. ` +
            `Disponible: ${disponible}, Demandé: ${ligne.quantite}`
          );
        }

        // Décrémenter le stock source
        await tx.inventaire.update({
          where: { id: stockSource.id },
          data: {
            quantite: { decrement: ligne.quantite },
          },
        });

        // Enregistrer le mouvement de sortie
        await tx.mouvementStock.create({
          data: {
            produitId: ligne.produitId,
            entrepotId: transfert.entrepotSourceId,
            typeMouvement: 'SORTIE',
            quantite: ligne.quantite,
            typeReference: 'transfert',
            referenceId: transfert.id,
            effectuePar: userId,
            raison: `Transfert vers ${transfert.entrepotDestination.nom} (${transfert.numeroTransfert})`,
          },
        });
      }

      // 4. Mettre à jour le statut du transfert
      return tx.transfertStock.update({
        where: { id: transfertId },
        data: {
          statut: 'EN_TRANSIT',
        },
        include: {
          lignes: {
            include: {
              produit: true,
            },
          },
          entrepotSource: true,
          entrepotDestination: true,
        },
      });
    });
  }

  /**
   * Réceptionner complètement un transfert
   *
   * Incrémente les stocks dans l'entrepôt de destination.
   * Passe le statut à COMPLETE.
   *
   * @param {number} transfertId - ID du transfert
   * @param {number} userId - ID de l'utilisateur
   * @returns {Promise<TransfertStock>} Le transfert réceptionné
   * @throws {NotFoundException} Si le transfert n'existe pas
   * @throws {BadRequestException} Si pas en transit
   *
   * @example
   * ```typescript
   * await service.receptionnerTransfert(1, userId);
   * ```
   */
  async receptionnerTransfert(transfertId: number, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      // 1. Récupérer le transfert
      const transfert = await tx.transfertStock.findUnique({
        where: { id: transfertId },
        include: {
          lignes: true,
          entrepotDestination: true,
        },
      });

      if (!transfert) {
        throw new NotFoundException(`Transfert #${transfertId} non trouvé`);
      }

      // 2. Vérifier le statut
      if (transfert.statut !== 'EN_TRANSIT') {
        throw new BadRequestException(
          `Impossible de réceptionner : le transfert est ${transfert.statut}`
        );
      }

      // 3. Incrémenter les stocks de destination
      for (const ligne of transfert.lignes) {
        // Upsert : créer si n'existe pas, incrémenter sinon
       await tx.inventaire.upsert({
          where: {
            unique_produit_entrepot: { // <--- Utiliser le nom défini dans le schema
              produitId: ligne.produitId,
              entrepotId: transfert.entrepotDestinationId,
            },
          },
          update: {
            quantite: { increment: ligne.quantite },
          },
          create: {
            produitId: ligne.produitId,
            entrepotId: transfert.entrepotDestinationId,
            quantite: ligne.quantite,
            quantiteReservee: 0,
          },
        });

        // Mettre à jour la ligne comme entièrement reçue
        await tx.ligneTransfertStock.update({
          where: { id: ligne.id },
          data: { quantiteRecue: ligne.quantite },
        });

        // Enregistrer le mouvement d'entrée
        await tx.mouvementStock.create({
          data: {
            produitId: ligne.produitId,
            entrepotId: transfert.entrepotDestinationId,
            typeMouvement: 'ENTREE',
            quantite: ligne.quantite,
            typeReference: 'transfert',
            referenceId: transfert.id,
            effectuePar: userId,
            raison: `Réception transfert ${transfert.numeroTransfert}`,
          },
        });
      }

      // 4. Clôturer le transfert
      return tx.transfertStock.update({
        where: { id: transfertId },
        data: {
          statut: 'COMPLETE',
          dateCompletion: new Date(),
        },
        include: {
          lignes: {
            include: {
              produit: true,
            },
          },
          entrepotSource: true,
          entrepotDestination: true,
        },
      });
    });
  }

  /**
   * Réceptionner partiellement un transfert
   *
   * Permet de réceptionner des quantités différentes des quantités expédiées.
   *
   * @param {number} transfertId - ID du transfert
   * @param {ReceptionPartielleDto} receptionDto - Quantités reçues
   * @param {number} userId - ID de l'utilisateur
   * @returns {Promise<TransfertStock>} Le transfert mis à jour
   * @throws {NotFoundException} Si le transfert n'existe pas
   * @throws {BadRequestException} Si pas en transit ou quantités invalides
   *
   * @example
   * ```typescript
   * await service.receptionnerPartiel(1, {
   *   lignes: [
   *     { produitId: 42, quantite: 45 }, // 5 manquants
   *     { produitId: 15, quantite: 30 }  // Complet
   *   ],
   *   notes: '5 unités endommagées'
   * }, userId);
   * ```
   */
  async receptionnerPartiel(
    transfertId: number,
    receptionDto: ReceptionPartielleDto,
    userId: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const transfert = await tx.transfertStock.findUnique({
        where: { id: transfertId },
        include: { lignes: true },
      });

      if (!transfert) {
        throw new NotFoundException(`Transfert #${transfertId} non trouvé`);
      }

      if (transfert.statut !== 'EN_TRANSIT') {
        throw new BadRequestException(
          `Impossible de réceptionner : le transfert est ${transfert.statut}`
        );
      }

      // Vérifier que toutes les lignes sont valides
      for (const ligneRecue of receptionDto.lignes) {
        const ligneTransfert = transfert.lignes.find(
          l => l.produitId === ligneRecue.produitId
        );

        if (!ligneTransfert) {
          throw new BadRequestException(
            `Produit #${ligneRecue.produitId} non trouvé dans ce transfert`
          );
        }

        if (ligneRecue.quantite > ligneTransfert.quantite) {
          throw new BadRequestException(
            `Quantité reçue (${ligneRecue.quantite}) > quantité expédiée (${ligneTransfert.quantite}) pour produit #${ligneRecue.produitId}`
          );
        }
      }

      // Traiter chaque ligne
      for (const ligneRecue of receptionDto.lignes) {
        const ligneTransfert = transfert.lignes.find(
          l => l.produitId === ligneRecue.produitId
        );

       if (ligneRecue.quantite > 0) {
          // Upsert dans l'inventaire destination
          await tx.inventaire.upsert({
            where: {
              unique_produit_entrepot: { // <--- Correction ici aussi
                produitId: ligneRecue.produitId,
                entrepotId: transfert.entrepotDestinationId,
              },
            },
            update: {
              quantite: { increment: ligneRecue.quantite },
            },
            create: {
              produitId: ligneRecue.produitId,
              entrepotId: transfert.entrepotDestinationId,
              quantite: ligneRecue.quantite,
              quantiteReservee: 0,
            },
          });
          // Mouvement d'entrée
          await tx.mouvementStock.create({
            data: {
              produitId: ligneRecue.produitId,
              entrepotId: transfert.entrepotDestinationId,
              typeMouvement: 'ENTREE',
              quantite: ligneRecue.quantite,
              typeReference: 'transfert',
              referenceId: transfert.id,
              effectuePar: userId,
              raison: `Réception partielle ${transfert.numeroTransfert}`,
            },
          });
        }

        // Mettre à jour la quantité reçue
        await tx.ligneTransfertStock.update({
          where: { id: ligneTransfert!.id },
          data: { quantiteRecue: ligneRecue.quantite },
        });
      }

      // Vérifier si tout est reçu
      const lignesMisesAJour = await tx.ligneTransfertStock.findMany({
        where: { transfertId },
      });

      const toutRecu = lignesMisesAJour.every(
        l => l.quantiteRecue === l.quantite
      );

      // Mettre à jour le transfert
      return tx.transfertStock.update({
        where: { id: transfertId },
        data: {
          statut: toutRecu ? 'COMPLETE' : 'EN_TRANSIT',
          dateCompletion: toutRecu ? new Date() : null,
          notes: receptionDto.notes
            ? `${transfert.notes || ''}\n${receptionDto.notes}`.trim()
            : transfert.notes,
        },
        include: {
          lignes: {
            include: {
              produit: true,
            },
          },
          entrepotSource: true,
          entrepotDestination: true,
        },
      });
    });
  }

  /**
   * Annuler un transfert
   *
   * Si le transfert est EN_TRANSIT, recrédite le stock source.
   *
   * @param {number} transfertId - ID du transfert
   * @param {number} userId - ID de l'utilisateur
   * @param {string} [raison] - Raison de l'annulation
   * @returns {Promise<TransfertStock>} Le transfert annulé
   * @throws {NotFoundException} Si le transfert n'existe pas
   * @throws {BadRequestException} Si déjà complété
   */
  async annulerTransfert(transfertId: number, userId: number, raison?: string) {
    return this.prisma.$transaction(async (tx) => {
      const transfert = await tx.transfertStock.findUnique({
        where: { id: transfertId },
        include: { lignes: true, entrepotSource: true },
      });

      if (!transfert) {
        throw new NotFoundException(`Transfert #${transfertId} non trouvé`);
      }

      if (transfert.statut === 'COMPLETE') {
        throw new BadRequestException(
          'Impossible d\'annuler un transfert complété'
        );
      }

      if (transfert.statut === 'ANNULE') {
        throw new BadRequestException('Ce transfert est déjà annulé');
      }

      // Si en transit, recréditer le stock source
      if (transfert.statut === 'EN_TRANSIT') {
        for (const ligne of transfert.lignes) {
          await tx.inventaire.updateMany({
            where: {
              produitId: ligne.produitId,
              entrepotId: transfert.entrepotSourceId,
            },
            data: {
              quantite: { increment: ligne.quantite },
            },
          });

          // Mouvement de retour
          await tx.mouvementStock.create({
            data: {
              produitId: ligne.produitId,
              entrepotId: transfert.entrepotSourceId,
              typeMouvement: 'ENTREE',
              quantite: ligne.quantite,
              typeReference: 'transfert_annulation',
              referenceId: transfert.id,
              effectuePar: userId,
              raison: `Annulation transfert ${transfert.numeroTransfert}: ${raison || 'Non spécifiée'}`,
            },
          });
        }
      }

      return tx.transfertStock.update({
        where: { id: transfertId },
        data: {
          statut: 'ANNULE',
          notes: raison
            ? `${transfert.notes || ''}\nANNULÉ: ${raison}`.trim()
            : transfert.notes,
        },
        include: {
          lignes: {
            include: {
              produit: true,
            },
          },
          entrepotSource: true,
          entrepotDestination: true,
        },
      });
    });
  }

  /**
   * Récupérer tous les transferts avec filtres
   */
  async findAll(filters?: {
    entrepotSourceId?: number;
    entrepotDestinationId?: number;
    statut?: string;
    dateDebut?: Date;
    dateFin?: Date;
  }) {
    const where: any = {};

    if (filters?.entrepotSourceId) {
      where.entrepotSourceId = filters.entrepotSourceId;
    }

    if (filters?.entrepotDestinationId) {
      where.entrepotDestinationId = filters.entrepotDestinationId;
    }

    if (filters?.statut) {
      where.statut = filters.statut;
    }

    if (filters?.dateDebut || filters?.dateFin) {
      where.dateTransfert = {};
      if (filters.dateDebut) {
        where.dateTransfert.gte = filters.dateDebut;
      }
      if (filters.dateFin) {
        where.dateTransfert.lte = filters.dateFin;
      }
    }

    return this.prisma.transfertStock.findMany({
      where,
      include: {
        entrepotSource: {
          select: {
            id: true,
            nom: true,
            code: true,
          },
        },
        entrepotDestination: {
          select: {
            id: true,
            nom: true,
            code: true,
          },
        },
        createur: {
          select: {
            id: true,
            nomComplet: true,
          },
        },
        _count: {
          select: {
            lignes: true,
          },
        },
      },
      orderBy: {
        dateCreation: 'desc',
      },
    });
  }

  /**
   * Récupérer un transfert par ID
   */
  async findOne(id: number) {
    const transfert = await this.prisma.transfertStock.findUnique({
      where: { id },
      include: {
        lignes: {
          include: {
            produit: {
              include: {
                categorie: true,
              },
            },
          },
        },
        entrepotSource: true,
        entrepotDestination: true,
        createur: {
          select: {
            id: true,
            nomUtilisateur: true,
            nomComplet: true,
          },
        },
      },
    });

    if (!transfert) {
      throw new NotFoundException(`Transfert #${id} non trouvé`);
    }

    return transfert;
  }

  /**
   * Mettre à jour un transfert (EN_ATTENTE uniquement)
   */
  async update(id: number, updateDto: UpdateTransfertStockDto) {
    const transfert = await this.findOne(id);

    if (transfert.statut !== 'EN_ATTENTE') {
      throw new BadRequestException(
        'Impossible de modifier un transfert qui n\'est pas en attente'
      );
    }

    return this.prisma.transfertStock.update({
      where: { id },
      data: {
        dateTransfert: updateDto.dateTransfert
          ? new Date(updateDto.dateTransfert)
          : undefined,
        notes: updateDto.notes,
      },
      include: {
        lignes: {
          include: {
            produit: true,
          },
        },
        entrepotSource: true,
        entrepotDestination: true,
      },
    });
  }

  /**
   * Générer un numéro de transfert unique
   *
   * @private
   * @returns {Promise<string>} Numéro au format TRF-YYYY-XXXXX
   */
  private async generateNumeroTransfert(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.transfertStock.count({
      where: {
        numeroTransfert: {
          startsWith: `TRF-${year}-`,
        },
      },
    });

    return `TRF-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  /**
   * Obtenir les statistiques des transferts
   */
  async getStatistiques(filters?: {
    dateDebut?: Date;
    dateFin?: Date;
  }) {
    const where: any = {};

    if (filters?.dateDebut || filters?.dateFin) {
      where.dateCreation = {};
      if (filters.dateDebut) {
        where.dateCreation.gte = filters.dateDebut;
      }
      if (filters.dateFin) {
        where.dateCreation.lte = filters.dateFin;
      }
    }

    const [
      totalTransferts,
      enAttente,
      enTransit,
      completes,
      annules,
    ] = await Promise.all([
      this.prisma.transfertStock.count({ where }),
      this.prisma.transfertStock.count({
        where: { ...where, statut: 'EN_ATTENTE' },
      }),
      this.prisma.transfertStock.count({
        where: { ...where, statut: 'EN_TRANSIT' },
      }),
      this.prisma.transfertStock.count({
        where: { ...where, statut: 'COMPLETE' },
      }),
      this.prisma.transfertStock.count({
        where: { ...where, statut: 'ANNULE' },
      }),
    ]);

    return {
      totalTransferts,
      enAttente,
      enTransit,
      completes,
      annules,
    };
  }

  // ==========================================
  // MÉTHODES SUPPLÉMENTAIRES FRONTEND
  // ==========================================

  /**
   * Obtenir les transferts en transit
   */
  async getEnTransit() {
    return this.prisma.transfertStock.findMany({
      where: { statut: 'EN_TRANSIT' },
      include: {
        entrepotSource: { select: { id: true, nom: true, code: true } },
        entrepotDestination: { select: { id: true, nom: true, code: true } },
        lignes: {
          include: {
            produit: { select: { id: true, nom: true, reference: true } },
          },
        },
      },
      orderBy: { dateTransfert: 'asc' },
    });
  }

  /**
   * Obtenir les transferts récents
   */
  async getRecent(limit: number = 10) {
    return this.prisma.transfertStock.findMany({
      include: {
        entrepotSource: { select: { id: true, nom: true, code: true } },
        entrepotDestination: { select: { id: true, nom: true, code: true } },
        _count: { select: { lignes: true } },
      },
      orderBy: { dateCreation: 'desc' },
      take: limit,
    });
  }

  /**
   * Obtenir les transferts en attente pour un entrepôt
   */
  async getPending(entrepotId: number, type: string = 'destination') {
    const where: any = { statut: { in: ['EN_ATTENTE', 'EN_TRANSIT'] } };
    
    if (type === 'source') {
      where.entrepotSourceId = entrepotId;
    } else {
      where.entrepotDestinationId = entrepotId;
    }

    return this.prisma.transfertStock.findMany({
      where,
      include: {
        entrepotSource: { select: { id: true, nom: true, code: true } },
        entrepotDestination: { select: { id: true, nom: true, code: true } },
        lignes: {
          include: {
            produit: { select: { id: true, nom: true, reference: true } },
          },
        },
      },
      orderBy: { dateTransfert: 'asc' },
    });
  }

  /**
   * Exporter les transferts
   */
  async export(filters: { dateDebut?: string; dateFin?: string; statut?: string }, format: string, res: any) {
    const where: any = {};

    if (filters.statut) {
      where.statut = filters.statut;
    }

    if (filters.dateDebut || filters.dateFin) {
      where.dateTransfert = {};
      if (filters.dateDebut) where.dateTransfert.gte = new Date(filters.dateDebut);
      if (filters.dateFin) where.dateTransfert.lte = new Date(filters.dateFin);
    }

    const transferts = await this.prisma.transfertStock.findMany({
      where,
      include: {
        entrepotSource: { select: { nom: true, code: true } },
        entrepotDestination: { select: { nom: true, code: true } },
        lignes: { include: { produit: { select: { reference: true, nom: true } } } },
      },
      orderBy: { dateTransfert: 'desc' },
    });

    // Générer CSV
    if (format === 'csv') {
      const csvContent = this.generateCSV(transferts);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=transferts.csv');
      return res.send(csvContent);
    }

    // Par défaut, retourner les données
    return { data: transferts, count: transferts.length };
  }

  private generateCSV(transferts: any[]): string {
    const headers = ['Numéro', 'Source', 'Destination', 'Date', 'Statut', 'Nb Lignes'];
    const rows = transferts.map(t => [
      t.numeroTransfert,
      t.entrepotSource?.nom || '',
      t.entrepotDestination?.nom || '',
      t.dateTransfert?.toISOString().split('T')[0] || '',
      t.statut,
      t.lignes?.length || 0,
    ].join(';'));
    return [headers.join(';'), ...rows].join('\n');
  }

  /**
   * Ajouter une ligne à un transfert
   */
  async ajouterLigne(transfertId: number, ligne: { produitId: number; quantite: number }) {
    const transfert = await this.findOne(transfertId);

    if (transfert.statut !== 'EN_ATTENTE') {
      throw new BadRequestException('Impossible d\'ajouter une ligne à un transfert qui n\'est pas en attente');
    }

    // Vérifier que le produit existe
    const produit = await this.prisma.produit.findUnique({
      where: { id: ligne.produitId },
    });

    if (!produit) {
      throw new NotFoundException(`Produit #${ligne.produitId} non trouvé`);
    }

    // Vérifier que le produit n'est pas déjà dans le transfert
    const existante = transfert.lignes.find(l => l.produitId === ligne.produitId);
    if (existante) {
      throw new BadRequestException(`Le produit ${produit.reference} est déjà dans ce transfert`);
    }

    return this.prisma.ligneTransfertStock.create({
      data: {
        transfertId,
        produitId: ligne.produitId,
        quantite: ligne.quantite,
        quantiteRecue: 0,
      },
      include: {
        produit: { select: { id: true, nom: true, reference: true } },
      },
    });
  }

  /**
   * Modifier une ligne d'un transfert
   */
  async modifierLigne(transfertId: number, ligneId: number, data: { quantite?: number }) {
    const transfert = await this.findOne(transfertId);

    if (transfert.statut !== 'EN_ATTENTE') {
      throw new BadRequestException('Impossible de modifier une ligne d\'un transfert qui n\'est pas en attente');
    }

    const ligne = transfert.lignes.find(l => l.id === ligneId);
    if (!ligne) {
      throw new NotFoundException(`Ligne #${ligneId} non trouvée dans ce transfert`);
    }

    return this.prisma.ligneTransfertStock.update({
      where: { id: ligneId },
      data: {
        quantite: data.quantite,
      },
      include: {
        produit: { select: { id: true, nom: true, reference: true } },
      },
    });
  }

  /**
   * Supprimer une ligne d'un transfert
   */
  async supprimerLigne(transfertId: number, ligneId: number) {
    const transfert = await this.findOne(transfertId);

    if (transfert.statut !== 'EN_ATTENTE') {
      throw new BadRequestException('Impossible de supprimer une ligne d\'un transfert qui n\'est pas en attente');
    }

    const ligne = transfert.lignes.find(l => l.id === ligneId);
    if (!ligne) {
      throw new NotFoundException(`Ligne #${ligneId} non trouvée dans ce transfert`);
    }

    // Vérifier qu'il reste au moins une ligne
    if (transfert.lignes.length <= 1) {
      throw new BadRequestException('Un transfert doit avoir au moins une ligne');
    }

    await this.prisma.ligneTransfertStock.delete({
      where: { id: ligneId },
    });

    return { success: true, message: 'Ligne supprimée' };
  }

  /**
   * Générer document PDF
   */
  async genererDocument(transfertId: number, res: any) {
    const transfert = await this.findOne(transfertId);

    // Retourner les données pour génération côté client ou service PDF
    const documentData = {
      transfert,
      titre: `Bon de Transfert ${transfert.numeroTransfert}`,
      dateGeneration: new Date().toISOString(),
      lignes: transfert.lignes.map(l => ({
        reference: l.produit.reference,
        nom: l.produit.nom,
        quantite: l.quantite,
        quantiteRecue: l.quantiteRecue,
      })),
    };

    res.setHeader('Content-Type', 'application/json');
    return res.json(documentData);
  }
}
