import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStatistiquesGlobales(userId: number) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: { tierAbonnement: true },
    });

    const isPremium = utilisateur?.tierAbonnement === 'PREMIUM';

    // Statistiques de base (FREE)
    const [
      totalProduits,
      totalClients,
      totalFournisseurs,
      produitsStockFaible,
      commandesEnCours,
    ] = await Promise.all([
      this.prisma.produit.count({ where: { estActif: true } }),
      this.prisma.client.count({ where: { estActif: true } }),
      this.prisma.fournisseur.count({ where: { estActif: true } }),
      this.prisma.produit.count({
        where: {
          quantiteStock: { lte: this.prisma.produit.fields.niveauStockMin },
          estActif: true,
        },
      }),
      this.prisma.commande.count({
        where: { statut: { in: ['EN_ATTENTE', 'EN_TRAITEMENT'] } },
      }),
    ]);

    // Valeur du stock
    const produits = await this.prisma.produit.findMany({
      select: { quantiteStock: true, coutUnitaire: true },
    });

    const valeurTotaleStock = produits.reduce(
      (sum, p) => sum + p.quantiteStock * Number(p.coutUnitaire || 0),
      0,
    );

    const stats: any = {
      totalProduits,
      totalClients,
      totalFournisseurs,
      produitsStockFaible,
      commandesEnCours,
      valeurTotaleStock,
    };

    // Statistiques PREMIUM
    if (isPremium) {
      const [totalEntrepots, totalTransferts] = await Promise.all([
        this.prisma.entrepot.count({ where: { estActif: true } }),
        this.prisma.transfertStock.count({
          where: { statut: { in: ['EN_ATTENTE', 'EN_TRANSIT'] } },
        }),
      ]);

      stats.totalEntrepots = totalEntrepots;
      stats.transfertsEnCours = totalTransferts;
    }

    return stats;
  }

  async getActivitesRecentes(limit: number = 10) {
    const mouvements = await this.prisma.mouvementStock.findMany({
      take: limit,
      orderBy: { dateMouvement: 'desc' },
      include: {
        produit: { select: { nom: true, reference: true } },
        utilisateur: { select: { nomComplet: true } },
      },
    });

    return mouvements;
  }

  async getProduitsTopStock(limit: number = 5) {
    return this.prisma.produit.findMany({
      take: limit,
      where: { estActif: true },
      orderBy: { quantiteStock: 'desc' },
      select: {
        id: true,
        nom: true,
        reference: true,
        quantiteStock: true,
        niveauStockMin: true,
      },
    });
  }

  async getCommandesRecentes(limit: number = 5) {
    return this.prisma.commande.findMany({
      take: limit,
      orderBy: { dateCommande: 'desc' },
      include: {
        client: { select: { nom: true } },
        details: {
          include: {
            produit: { select: { nom: true } },
          },
        },
      },
    });
  }
}