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
        lignes: {
          include: {
            produit: { select: { nom: true } },
          },
        },
      },
    });
  }

  // ==========================================
  // NOUVELLES MÉTHODES (Correctement intégrées)
  // ==========================================

  // 1. Pour savoir ce qui se vend le mieux (vs ce qui stocke le plus)
  async getProduitsLesPlusVendus(limit: number = 5) {
    const topVentes = await this.prisma.ligneCommande.groupBy({
      by: ['produitId'],
      _sum: { quantite: true },
      orderBy: { _sum: { quantite: 'desc' } },
      take: limit,
    });

    // Récupérer les noms des produits associés
    const produitsDetails = await this.prisma.produit.findMany({
      where: { id: { in: topVentes.map((t) => t.produitId) } },
      select: { id: true, nom: true, reference: true, prixVente: true },
    });

    return topVentes.map((vente) => {
      const info = produitsDetails.find((p) => p.id === vente.produitId);
      return {
        ...info,
        totalVendu: vente._sum.quantite,
        chiffreAffairesGenere: (Number(info?.prixVente) || 0) * (vente._sum.quantite || 0)
      };
    });
  }

  // 2. Pour obtenir la liste précise des produits à réapprovisionner (pas juste le nombre)
  async getDetailsAlerteStock() {
    return this.prisma.produit.findMany({
      where: {
        estActif: true,
        quantiteStock: { lte: this.prisma.produit.fields.niveauStockMin },
      },
      select: {
        id: true, 
        nom: true, 
        quantiteStock: true, 
        niveauStockMin: true,
        // Optionnel: inclure le fournisseur pour commander vite
        produitsFournisseurs: {
          take: 1,
          where: { estPrefere: true },
          include: { fournisseur: { select: { nom: true, email: true } } }
        }
      },
    });
  }

  // 3. Pour le graphique de revenus (Uniquement pour ADMIN/GESTIONNAIRE)
  async getEvolutionRevenus() {
    // Note: Cette requête brute est optimisée pour PostgreSQL
    const result: any[] = await this.prisma.$queryRaw`
      SELECT 
        TO_CHAR(date_commande, 'YYYY-MM') as mois,
        SUM(montant_total) as revenu
      FROM commandes
      WHERE statut = 'LIVRE'
      GROUP BY mois
      ORDER BY mois DESC
      LIMIT 12
    `;

    // Conversion sécurisée des types (Postgres renvoie parfois des strings pour SUM)
    return result.map(r => ({
      mois: r.mois,
      revenu: Number(r.revenu || 0)
    }));
  }
}