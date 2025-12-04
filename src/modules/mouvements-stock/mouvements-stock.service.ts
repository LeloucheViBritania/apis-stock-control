import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MouvementsStockService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: {
    produitId?: number;
    typeMouvement?: string;
    dateDebut?: string;
    dateFin?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters?.produitId) {
      where.produitId = filters.produitId;
    }

    if (filters?.typeMouvement) {
      where.typeMouvement = filters.typeMouvement;
    }

    if (filters?.dateDebut || filters?.dateFin) {
      where.dateMouvement = {};
      if (filters.dateDebut) {
        where.dateMouvement.gte = new Date(filters.dateDebut);
      }
      if (filters.dateFin) {
        where.dateMouvement.lte = new Date(filters.dateFin);
      }
    }

    const [mouvements, total] = await Promise.all([
      this.prisma.mouvementStock.findMany({
        where,
        include: {
          produit: {
            select: {
              id: true,
              nom: true,
              reference: true,
            },
          },
          utilisateur: {
            select: {
              id: true,
              nomComplet: true,
            },
          },
        },
        orderBy: { dateMouvement: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.mouvementStock.count({ where }),
    ]);

    return {
      data: mouvements,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStatistiques() {
    const [totalMouvements, entrees, sorties] = await Promise.all([
      this.prisma.mouvementStock.count(),
      this.prisma.mouvementStock.count({ where: { typeMouvement: 'ENTREE' } }),
      this.prisma.mouvementStock.count({ where: { typeMouvement: 'SORTIE' } }),
    ]);

    return {
      totalMouvements,
      entrees,
      sorties,
      ajustements: totalMouvements - entrees - sorties,
    };
  }
}