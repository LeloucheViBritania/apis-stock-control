import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async create(createClientDto: CreateClientDto) {
    // Mapper segment string vers enum
    let segment: any = 'NOUVEAU';
    if (createClientDto.segment) {
      const segmentMap: Record<string, string> = {
        'Particulier': 'NOUVEAU',
        'Entreprise': 'REGULIER',
        'VIP': 'VIP',
        'particulier': 'NOUVEAU',
        'entreprise': 'REGULIER',
        'vip': 'VIP',
      };
      segment = segmentMap[createClientDto.segment] || 'NOUVEAU';
    }

    const data: any = {
      nom: createClientDto.nom,
      email: createClientDto.email || null,
      telephone: createClientDto.telephone,
      adresse: createClientDto.adresse,
      ville: createClientDto.ville,
      pays: createClientDto.pays,
      numeroFiscal: createClientDto.numeroFiscal,
      estActif: createClientDto.estActif ?? true,
      segment: segment,
      limiteCredit: createClientDto.limiteCredit || 0,
    };

    // Filtrer les valeurs undefined
    Object.keys(data).forEach(key => data[key] === undefined && delete data[key]);

    return this.prisma.client.create({
      data,
    });
  }

  async findAll(filters?: {
    estActif?: boolean;
    search?: string;
    page?: number;
    limit?: number;
    statut?: string;
    segment?: string;
  }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters?.estActif !== undefined) {
      where.estActif = filters.estActif;
    }

    // Support statut filter
    if (filters?.statut) {
      where.statut = filters.statut;
    }

    // Support segment filter
    if (filters?.segment) {
      // Map frontend segment values to backend enum values
      const segmentMap: Record<string, string> = {
        'PARTICULIER': 'NOUVEAU',
        'PROFESSIONNEL': 'REGULIER',
        'ENTREPRISE': 'FIDELE',
        'VIP': 'VIP',
      };
      where.segment = segmentMap[filters.segment] || filters.segment;
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

    // Mapper segment string vers enum si présent
    const data: any = { ...updateClientDto };
    if (updateClientDto.segment) {
      const segmentMap: Record<string, string> = {
        'Particulier': 'NOUVEAU',
        'Entreprise': 'REGULIER',
        'VIP': 'VIP',
        'particulier': 'NOUVEAU',
        'entreprise': 'REGULIER',
        'vip': 'VIP',
      };
      data.segment = segmentMap[updateClientDto.segment] || updateClientDto.segment;
    }

    // Supprimer les champs non-Prisma
    delete data.entreprise;
    delete data.notes;

    return this.prisma.client.update({
      where: { id },
      data,
    });
  }

  async remove(id: number) {
    await this.findOne(id);

    return this.prisma.client.update({
      where: { id },
      data: {estActif: false}
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