import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommandeDto } from './dto/create-commande.dto';
import { UpdateCommandeDto } from './dto/update-commande.dto';
// 1. IMPORT DU GATEWAY
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class CommandesService {
  constructor(
    private prisma: PrismaService,
    // 2. INJECTION DU GATEWAY
    private notificationsGateway: NotificationsGateway
  ) {}

  async create(createCommandeDto: CreateCommandeDto, userId: number) {
    // Générer un numéro de commande unique
    const count = await this.prisma.commande.count();
    const numeroCommande = `CMD-${String(count + 1).padStart(6, '0')}`;

    // 1. Pré-vérification (Lecture seule)
    for (const detail of createCommandeDto.details) {
      const produit = await this.prisma.produit.findUnique({
        where: { id: detail.produitId },
      });

      if (!produit) {
        throw new NotFoundException(`Produit #${detail.produitId} non trouvé`);
      }

      if (produit.quantiteStock < detail.quantite) {
        throw new BadRequestException(
          `Stock insuffisant pour ${produit.nom}. Disponible: ${produit.quantiteStock}`,
        );
      }
    }

    // Calculer le montant total et préparer les détails
    let montantTotal = 0;
    const detailsAvecPrix = await Promise.all(
      createCommandeDto.details.map(async (detail) => {
        const produit = await this.prisma.produit.findUnique({
          where: { id: detail.produitId },
        });
        const prix = detail.prixUnitaire || Number(produit?.prixVente || 0);
        montantTotal += prix * detail.quantite;
        return { ...detail, prixUnitaire: prix };
      }),
    );

    // 2. Création avec Sécurité de Concurrence
    return this.prisma.$transaction(async (tx) => {
      // Créer la commande
      const commande = await tx.commande.create({
        data: {
          numeroCommande,
          clientId: createCommandeDto.clientId,
          dateCommande: new Date(createCommandeDto.dateCommande),
          dateLivraison: createCommandeDto.dateLivraison
            ? new Date(createCommandeDto.dateLivraison)
            : null,
          montantTotal,
          creePar: userId,
          details: {
            create: detailsAvecPrix.map((d) => ({
              produitId: d.produitId,
              quantite: d.quantite,
              prixUnitaire: d.prixUnitaire,
            })),
          },
        },
        include: {
          client: true,
          details: {
            include: {
              produit: true,
            },
          },
        },
      });

      // Réduire le stock des produits de manière ATOMIQUE
      for (const detail of detailsAvecPrix) {
        const updateResult = await tx.produit.updateMany({
          where: { 
            id: detail.produitId,
            quantiteStock: {
              gte: detail.quantite // Condition critique : Stock >= Quantité demandée
            }
          },
          data: {
            quantiteStock: { decrement: detail.quantite },
          },
        });

        // Si count est 0, c'est que le stock a changé entre temps
        if (updateResult.count === 0) {
          const produitInfo = await tx.produit.findUnique({ 
            where: { id: detail.produitId },
            select: { nom: true }
          });
          
          throw new BadRequestException(
            `Échec de la commande : Stock insuffisant pour ${produitInfo?.nom || 'un produit'} (Conflit de concurrence détecté)`
          );
        }

        // --- 3. LOGIQUE DE NOTIFICATION TEMPS RÉEL (AJOUTÉE) ---
        // On récupère le produit mis à jour pour vérifier son nouveau stock
        const produitAjour = await tx.produit.findUnique({
          where: { id: detail.produitId },
          select: { nom: true, quantiteStock: true, niveauStockMin: true } // On prend le 'niveauStockMin' du schéma
        });

        if (produitAjour && produitAjour.quantiteStock <= produitAjour.niveauStockMin) {
           // Envoi du signal via WebSocket
           this.notificationsGateway.sendStockAlert({
             produit: produitAjour.nom,
             stockRestant: produitAjour.quantiteStock,
             message: `⚠️ ALERTE : Le stock de "${produitAjour.nom}" est critique ! (${produitAjour.quantiteStock} restants)`
           });
        }
        // --------------------------------------------------------

        // Créer un mouvement de stock
        await tx.mouvementStock.create({
          data: {
            produitId: detail.produitId,
            typeMouvement: 'SORTIE',
            quantite: detail.quantite,
            raison: `Commande ${numeroCommande}`,
            typeReference: 'commande',
            referenceId: commande.id,
            effectuePar: userId,
          },
        });
      }

      return commande;
    });
  }

  // ... (Le reste des méthodes findAll, findOne, update, cancel, getStatistiques reste inchangé)
  async findAll(filters?: {
    statut?: string;
    clientId?: number;
    dateDebut?: string;
    dateFin?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters?.statut) {
      where.statut = filters.statut;
    }

    if (filters?.clientId) {
      where.clientId = filters.clientId;
    }

    if (filters?.dateDebut || filters?.dateFin) {
      where.dateCommande = {};
      if (filters.dateDebut) {
        where.dateCommande.gte = new Date(filters.dateDebut);
      }
      if (filters.dateFin) {
        where.dateCommande.lte = new Date(filters.dateFin);
      }
    }

    const [commandes, total] = await Promise.all([
      this.prisma.commande.findMany({
        where,
        include: {
          client: true,
          details: {
            include: {
              produit: true,
            },
          },
        },
        orderBy: { dateCommande: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.commande.count({ where }),
    ]);

    return {
      data: commandes,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const commande = await this.prisma.commande.findUnique({
      where: { id },
      include: {
        client: true,
        createur: {
          select: {
            id: true,
            nomComplet: true,
          },
        },
        details: {
          include: {
            produit: {
              include: {
                categorie: true,
              },
            },
          },
        },
      },
    });

    if (!commande) {
      throw new NotFoundException(`Commande #${id} non trouvée`);
    }

    return commande;
  }

  async update(id: number, updateCommandeDto: UpdateCommandeDto) {
    await this.findOne(id);

    return this.prisma.commande.update({
      where: { id },
      data: updateCommandeDto,
      include: {
        client: true,
        details: {
          include: {
            produit: true,
          },
        },
      },
    });
  }

  async cancel(id: number, userId: number) {
    const commande = await this.findOne(id);

    if (commande.statut === 'ANNULE') {
      throw new BadRequestException('Cette commande est déjà annulée');
    }

    if (commande.statut === 'LIVRE') {
      throw new BadRequestException('Impossible d\'annuler une commande déjà livrée');
    }

    // Transaction pour annuler et restaurer le stock
    return this.prisma.$transaction(async (tx) => {
      // Restaurer le stock
      for (const detail of commande.details) {
        await tx.produit.update({
          where: { id: detail.produitId },
          data: {
            quantiteStock: { increment: detail.quantite },
          },
        });

        // Créer un mouvement de stock
        await tx.mouvementStock.create({
          data: {
            produitId: detail.produitId,
            typeMouvement: 'ENTREE',
            quantite: detail.quantite,
            raison: `Annulation commande ${commande.numeroCommande}`,
            typeReference: 'commande',
            referenceId: commande.id,
            effectuePar: userId,
          },
        });
      }

      // Mettre à jour le statut
      return tx.commande.update({
        where: { id },
        data: { statut: 'ANNULE' },
        include: {
          client: true,
          details: {
            include: {
              produit: true,
            },
          },
        },
      });
    });
  }

  async getStatistiques() {
    const [total, enCours, completees, annulees, montantTotal] = await Promise.all([
      this.prisma.commande.count(),
      this.prisma.commande.count({
        where: { statut: { in: ['EN_ATTENTE', 'EN_TRAITEMENT', 'EXPEDIE'] } },
      }),
      this.prisma.commande.count({ where: { statut: 'LIVRE' } }),
      this.prisma.commande.count({ where: { statut: 'ANNULE' } }),
      this.prisma.commande.aggregate({
        _sum: { montantTotal: true },
        where: { statut: 'LIVRE' },
      }),
    ]);

    return {
      total,
      enCours,
      completees,
      annulees,
      montantTotal: Number(montantTotal._sum.montantTotal || 0),
    };
  }
}