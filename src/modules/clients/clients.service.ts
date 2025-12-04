import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(createClientDto: CreateClientDto) {
    return this.prisma.client.create({
      data: createClientDto,
    });
  }

  async findAll(filters?: {
    estActif?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters?.estActif !== undefined) {
      where.estActif = filters.estActif;
    }

    if (filters?.search) {
      where.OR = [
        { nom: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { telephone: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        include: {
          _count: {
            select: {
              commandes: true,
            },
          },
        },
        orderBy: { nom: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data: clients,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      include: {
        commandes: {
          orderBy: { dateCommande: 'desc' },
          take: 10,
          select: {
            id: true,
            numeroCommande: true,
            dateCommande: true,
            statut: true,
            montantTotal: true,
          },
        },
        _count: {
          select: {
            commandes: true,
          },
        },
      },
    });

    if (!client) {
      throw new NotFoundException(`Client #${id} non trouvé`);
    }

    return client;
  }

  async update(id: number, updateClientDto: UpdateClientDto) {
    await this.findOne(id);

    return this.prisma.client.update({
      where: { id },
      data: updateClientDto,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.client.delete({
      where: { id },
    });
  }

  async getStatistiques() {
    const [totalClients, clientsActifs] = await Promise.all([
      this.prisma.client.count(),
      this.prisma.client.count({ where: { estActif: true } }),
    ]);

    // Clients avec le plus de commandes
    const topClients = await this.prisma.client.findMany({
      take: 5,
      include: {
        _count: {
          select: {
            commandes: true,
          },
        },
      },
      orderBy: {
        commandes: {
          _count: 'desc',
        },
      },
    });

    return {
      totalClients,
      clientsActifs,
      clientsInactifs: totalClients - clientsActifs,
      topClients,
    };
  }
}