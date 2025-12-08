import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommandeDto } from './dto/create-commande.dto';
import { UpdateCommandeDto } from './dto/update-commande.dto';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class CommandesService {
  constructor(
    private prisma: PrismaService,
    private notificationsGateway: NotificationsGateway
  ) {}

  async create(createCommandeDto: CreateCommandeDto, userId: number) {
    // Générer un numéro de commande unique
    const count = await this.prisma.commande.count();
    const numeroCommande = `CMD-${String(count + 1).padStart(6, '0')}`;
    const { entrepotId, details } = createCommandeDto;

    // =========================================================
    // 1. PRÉ-VÉRIFICATION DU STOCK (Lecture seule)
    // =========================================================
    for (const detail of details) {
      const produit = await this.prisma.produit.findUnique({
        where: { id: detail.produitId },
      });

      if (!produit) {
        throw new NotFoundException(`Produit #${detail.produitId} non trouvé`);
      }

      // --- LOGIQUE PREMIUM : Vérification stock Entrepôt ---
      if (entrepotId) {
        const inventaire = await this.prisma.inventaire.findUnique({
          where: {
            unique_produit_entrepot: {
              produitId: detail.produitId,
              entrepotId: entrepotId
            }
          }
        });

        if (!inventaire) {
           throw new BadRequestException(`Produit ${produit.nom} non référencé dans l'entrepôt #${entrepotId}`);
        }

        // On vérifie le stock disponible (Quantité réelle - Quantité réservée)
        const disponible = inventaire.quantite - inventaire.quantiteReservee;
        if (disponible < detail.quantite) {
          throw new BadRequestException(
            `Stock insuffisant à l'entrepôt pour ${produit.nom}. Disponible: ${disponible}`
          );
        }
      } 
      // --- LOGIQUE FREE : Vérification stock Global ---
      else {
        if (produit.quantiteStock < detail.quantite) {
          throw new BadRequestException(
            `Stock insuffisant pour ${produit.nom}. Disponible: ${produit.quantiteStock}`,
          );
        }
      }
    }

    // Calculer le montant total
    let montantTotal = 0;
    const detailsAvecPrix = await Promise.all(
      details.map(async (detail) => {
        const produit = await this.prisma.produit.findUnique({
          where: { id: detail.produitId },
        });
        const prix = detail.prixUnitaire || Number(produit?.prixVente || 0);
        montantTotal += prix * detail.quantite;
        return { ...detail, prixUnitaire: prix };
      }),
    );

    // =========================================================
    // 2. TRANSACTION DE CRÉATION (Écriture atomique)
    // =========================================================
    return this.prisma.$transaction(async (tx) => {
      // A. Créer la commande (Table unifiée)
      const commande = await tx.commande.create({
        data: {
          numeroCommande,
          clientId: createCommandeDto.clientId,
          entrepotId: entrepotId || null, // Important pour la distinction
          dateCommande: new Date(createCommandeDto.dateCommande),
          dateLivraison: createCommandeDto.dateLivraison
            ? new Date(createCommandeDto.dateLivraison)
            : null,
          montantTotal,
          creePar: userId,
          // Attention : 'lignes' correspond au nouveau nom dans le schema.prisma
          lignes: {
            create: detailsAvecPrix.map((d) => ({
              produitId: d.produitId,
              quantite: d.quantite,
              prixUnitaire: d.prixUnitaire,
            })),
          },
        },
        include: {
          client: true,
          lignes: { // On inclut les lignes nouvellement créées
            include: {
              produit: true,
            },
          },
        },
      });

      // B. Décrémenter le stock selon le mode
      for (const detail of detailsAvecPrix) {
        let stockRestantPourAlerte = 0;
        let produitNom = '';
        let niveauMin = 0;

        // --- CAS PREMIUM : Update Inventaire ---
        if (entrepotId) {
          // Utilisation de updateMany pour la sécurité de concurrence (clause where gte)
          const updateResult = await tx.inventaire.updateMany({
            where: {
              produitId: detail.produitId,
              entrepotId: entrepotId,
              quantite: { gte: detail.quantite } // Sécurité atomique
            },
            data: {
              quantite: { decrement: detail.quantite }
            }
          });

          if (updateResult.count === 0) {
            throw new BadRequestException(`Conflit de stock (Premium) sur le produit ID ${detail.produitId}`);
          }

          // Récupérer infos pour alerte
          const invAjour = await tx.inventaire.findUnique({
            where: { unique_produit_entrepot: { produitId: detail.produitId, entrepotId } },
            include: { produit: true }
          });
          stockRestantPourAlerte = invAjour.quantite;
          produitNom = invAjour.produit.nom;
          niveauMin = invAjour.produit.niveauStockMin;
        } 
        
        // --- CAS FREE : Update Produit ---
        else {
          const updateResult = await tx.produit.updateMany({
            where: { 
              id: detail.produitId,
              quantiteStock: { gte: detail.quantite } // Sécurité atomique
            },
            data: {
              quantiteStock: { decrement: detail.quantite },
            },
          });

          if (updateResult.count === 0) {
             throw new BadRequestException(`Conflit de stock (Free) sur le produit ID ${detail.produitId}`);
          }

          // Récupérer infos pour alerte
          const prodAjour = await tx.produit.findUnique({
             where: { id: detail.produitId } 
          });
          stockRestantPourAlerte = prodAjour.quantiteStock;
          produitNom = prodAjour.nom;
          niveauMin = prodAjour.niveauStockMin;
        }

        // C. Gestion des Alertes WebSocket
        if (stockRestantPourAlerte <= niveauMin) {
           this.notificationsGateway.sendStockAlert({
             produit: produitNom,
             stockRestant: stockRestantPourAlerte,
             message: `⚠️ ALERTE STOCK : "${produitNom}" est bas (${stockRestantPourAlerte}) ${entrepotId ? `dans l'entrepôt #${entrepotId}` : '(Global)'}`
           });
        }

        // D. Créer le mouvement de stock
        await tx.mouvementStock.create({
          data: {
            produitId: detail.produitId,
            entrepotId: entrepotId || null, // Null si Free tier
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

  // Adapter aussi findAll pour inclure 'lignes' au lieu de 'details'
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
    // ... (logique de filtrage identique) ...
    if (filters?.statut) where.statut = filters.statut;
    if (filters?.clientId) where.clientId = filters.clientId;
    if (filters?.dateDebut || filters?.dateFin) {
        where.dateCommande = {};
        if (filters.dateDebut) where.dateCommande.gte = new Date(filters.dateDebut);
        if (filters.dateFin) where.dateCommande.lte = new Date(filters.dateFin);
    }

    const [commandes, total] = await Promise.all([
      this.prisma.commande.findMany({
        where,
        include: {
          client: true,
          entrepot: true, // On peut maintenant voir l'entrepôt
          lignes: {       // RENOMMAGE ICI
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
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // Adapter findOne
  async findOne(id: number) {
    const commande = await this.prisma.commande.findUnique({
      where: { id },
      include: {
        client: true,
        entrepot: true,
        createur: { select: { id: true, nomComplet: true } },
        lignes: { // RENOMMAGE ICI
          include: {
            produit: { include: { categorie: true } },
          },
        },
      },
    });

    if (!commande) {
      throw new NotFoundException(`Commande #${id} non trouvée`);
    }
    return commande;
  }

  // Adapter cancel
  async cancel(id: number, userId: number) {
    const commande = await this.findOne(id);

    if (commande.statut === 'ANNULE') throw new BadRequestException('Déjà annulée');
    if (commande.statut === 'LIVRE') throw new BadRequestException('Déjà livrée');

    return this.prisma.$transaction(async (tx) => {
      // Restaurer le stock
      for (const ligne of commande.lignes) { // 'lignes' ici
        
        // --- RESTAURATION PREMIUM ---
        if (commande.entrepotId) {
             await tx.inventaire.upsert({
                where: { unique_produit_entrepot: { produitId: ligne.produitId, entrepotId: commande.entrepotId }},
                update: { quantite: { increment: ligne.quantite } },
                create: { 
                    produitId: ligne.produitId, 
                    entrepotId: commande.entrepotId, 
                    quantite: ligne.quantite 
                } // Cas rare où l'inventaire aurait été supprimé entre temps
             });
        } 
        // --- RESTAURATION FREE ---
        else {
            await tx.produit.update({
                where: { id: ligne.produitId },
                data: { quantiteStock: { increment: ligne.quantite } },
            });
        }

        // Créer mouvement RETOUR
        await tx.mouvementStock.create({
          data: {
            produitId: ligne.produitId,
            entrepotId: commande.entrepotId || null,
            typeMouvement: 'RETOUR', // Correction logique : c'est un retour en stock
            quantite: ligne.quantite,
            raison: `Annulation commande ${commande.numeroCommande}`,
            typeReference: 'commande',
            referenceId: commande.id,
            effectuePar: userId,
          },
        });
      }

      // Update Statut
      return tx.commande.update({
        where: { id },
        data: { statut: 'ANNULE' },
        include: { lignes: true }
      });
    });
  }

  // getStatistiques reste inchangé sauf si vous voulez filtrer par entrepotId
  async getStatistiques() {
      // ... code existant ...
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