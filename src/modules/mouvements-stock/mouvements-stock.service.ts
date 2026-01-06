import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MouvementsStockService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: {
    produitId?: number;
    entrepotId?: number;
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

    if (filters?.produitId) where.produitId = filters.produitId;
    if (filters?.entrepotId) where.entrepotId = filters.entrepotId;
    if (filters?.typeMouvement) where.typeMouvement = filters.typeMouvement;

    if (filters?.dateDebut || filters?.dateFin) {
      where.dateMouvement = {};
      if (filters.dateDebut) where.dateMouvement.gte = new Date(filters.dateDebut);
      if (filters.dateFin) where.dateMouvement.lte = new Date(filters.dateFin);
    }

    const [mouvements, total] = await Promise.all([
      this.prisma.mouvementStock.findMany({
        where,
        include: {
          produit: { select: { id: true, nom: true, reference: true } },
          entrepot: { select: { id: true, nom: true } },
          utilisateur: { select: { id: true, nomComplet: true } },
        },
        orderBy: { dateMouvement: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.mouvementStock.count({ where }),
    ]);

    return {
      data: mouvements,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number) {
    const mouvement = await this.prisma.mouvementStock.findUnique({
      where: { id },
      include: {
        produit: true,
        entrepot: true,
        utilisateur: { select: { id: true, nomComplet: true, email: true } },
      },
    });

    if (!mouvement) {
      throw new NotFoundException(`Mouvement #${id} non trouvé`);
    }
    return mouvement;
  }

  async getRecent(limit: number = 10) {
    return this.prisma.mouvementStock.findMany({
      include: {
        produit: { select: { id: true, nom: true } },
        entrepot: { select: { id: true, nom: true } },
        utilisateur: { select: { id: true, nomComplet: true } },
      },
      orderBy: { dateMouvement: 'desc' },
      take: limit,
    });
  }

  async getParType() {
    const types = ['ENTREE', 'SORTIE', 'AJUSTEMENT', 'TRANSFERT', 'RETOUR'];
    const counts = await Promise.all(
      types.map(async (type) => ({
        type,
        count: await this.prisma.mouvementStock.count({ where: { typeMouvement: type as any } }),
      }))
    );
    return counts;
  }

  async getByProduit(produitId: number, filters?: { page?: number; limit?: number }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const [mouvements, total] = await Promise.all([
      this.prisma.mouvementStock.findMany({
        where: { produitId },
        include: {
          entrepot: { select: { id: true, nom: true } },
          utilisateur: { select: { id: true, nomComplet: true } },
        },
        orderBy: { dateMouvement: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.mouvementStock.count({ where: { produitId } }),
    ]);

    return {
      data: mouvements,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getByEntrepot(entrepotId: number, filters?: { page?: number; limit?: number }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const [mouvements, total] = await Promise.all([
      this.prisma.mouvementStock.findMany({
        where: { entrepotId },
        include: {
          produit: { select: { id: true, nom: true } },
          utilisateur: { select: { id: true, nomComplet: true } },
        },
        orderBy: { dateMouvement: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.mouvementStock.count({ where: { entrepotId } }),
    ]);

    return {
      data: mouvements,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getByType(type: string, filters?: { page?: number; limit?: number }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const [mouvements, total] = await Promise.all([
      this.prisma.mouvementStock.findMany({
        where: { typeMouvement: type as any },
        include: {
          produit: { select: { id: true, nom: true } },
          entrepot: { select: { id: true, nom: true } },
          utilisateur: { select: { id: true, nomComplet: true } },
        },
        orderBy: { dateMouvement: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.mouvementStock.count({ where: { typeMouvement: type as any } }),
    ]);

    return {
      data: mouvements,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getStatistiques() {
    const [totalMouvements, entrees, sorties, ajustements, transferts, retours] = await Promise.all([
      this.prisma.mouvementStock.count(),
      this.prisma.mouvementStock.count({ where: { typeMouvement: 'ENTREE' } }),
      this.prisma.mouvementStock.count({ where: { typeMouvement: 'SORTIE' } }),
      this.prisma.mouvementStock.count({ where: { typeMouvement: 'AJUSTEMENT' } }),
      this.prisma.mouvementStock.count({ where: { typeMouvement: 'TRANSFERT' } }),
      this.prisma.mouvementStock.count({ where: { typeMouvement: 'RETOUR' } }),
    ]);

    return {
      totalMouvements,
      entrees,
      sorties,
      ajustements,
      transferts,
      retours,
    };
  }
}