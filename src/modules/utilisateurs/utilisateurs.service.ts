import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { CreateUtilisateurDto } from './dto/create-utilisateur.dto';
import { UpdateUtilisateurDto } from './dto/update-utilisateur.dto';

@Injectable()
export class UtilisateursService {
  constructor(private prisma: PrismaService) {}

  // Stratégie de mot de passe : Min 6 char
  private validatePasswordStrength(password: string): boolean {
    return Boolean(password && password.length >= 6);
  }

  // ==========================================
  // CRUD DE BASE
  // ==========================================

  async create(createDto: CreateUtilisateurDto) {
    // Vérifier unicité email/username
    const existing = await this.prisma.utilisateur.findFirst({
      where: {
        OR: [
          { email: createDto.email },
          { nomUtilisateur: createDto.nomUtilisateur }
        ],
      }
    });
    
    if (existing) {
      throw new ConflictException('Email ou Nom d\'utilisateur déjà pris');
    }

    // Hasher le mot de passe
    const motDePasseHash = await bcrypt.hash(createDto.motDePasse, 10);

    const utilisateur = await this.prisma.utilisateur.create({
      data: {
        nomUtilisateur: createDto.nomUtilisateur,
        email: createDto.email,
        motDePasseHash,
        nomComplet: createDto.nomComplet,
        role: (createDto.role || 'EMPLOYE') as any,
        tierAbonnement: (createDto.tierAbonnement || 'GRATUIT') as any,
        estActif: true,
      },
      select: {
        id: true,
        nomUtilisateur: true,
        email: true,
        nomComplet: true,
        role: true,
        tierAbonnement: true,
        estActif: true,
        dateCreation: true,
      },
    });

    return utilisateur;
  }

  async findAll(filters?: {
    search?: string;
    role?: string;
    estActif?: boolean;
    tierAbonnement?: string;
    page?: number;
    limit?: number;
  }) {
    const { search, role, estActif, tierAbonnement, page = 1, limit = 20 } = filters || {};
    
    const where: any = {};

    if (search) {
      where.OR = [
        { nomUtilisateur: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { nomComplet: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (estActif !== undefined) {
      where.estActif = estActif;
    }

    if (tierAbonnement) {
      where.tierAbonnement = tierAbonnement;
    }

    const [data, total] = await Promise.all([
      this.prisma.utilisateur.findMany({
        where,
        select: {
          id: true,
          nomUtilisateur: true,
          email: true,
          nomComplet: true,
          role: true,
          estActif: true,
          tierAbonnement: true,
          dateExpiration: true,
          dateCreation: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { dateCreation: 'desc' },
      }),
      this.prisma.utilisateur.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id },
      select: {
        id: true,
        nomUtilisateur: true,
        email: true,
        nomComplet: true,
        role: true,
        estActif: true,
        tierAbonnement: true,
        dateExpiration: true,
        dateCreation: true,
      },
    });
    
    if (!user) {
      throw new NotFoundException(`Utilisateur #${id} non trouvé`);
    }
    
    return user;
  }

  async update(id: number, updateDto: UpdateUtilisateurDto) {
    // Vérifier que l'utilisateur existe
    await this.findOne(id);

    // Vérification unicité email/username si modifiés
    if (updateDto.email || updateDto.nomUtilisateur) {
      const existing = await this.prisma.utilisateur.findFirst({
        where: {
          OR: [
            updateDto.email ? { email: updateDto.email } : {},
            updateDto.nomUtilisateur ? { nomUtilisateur: updateDto.nomUtilisateur } : {},
          ],
          NOT: { id },
        }
      });
      
      if (existing) {
        throw new ConflictException('Email ou Nom d\'utilisateur déjà pris');
      }
    }

    return this.prisma.utilisateur.update({
      where: { id },
      data: updateDto,
      select: {
        id: true,
        nomUtilisateur: true,
        email: true,
        nomComplet: true,
        role: true,
        estActif: true,
        tierAbonnement: true,
        dateExpiration: true,
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    
    // Soft delete : désactiver au lieu de supprimer
    return this.prisma.utilisateur.update({
      where: { id },
      data: { estActif: false },
    });
  }

  // ==========================================
  // LISTES SPÉCIFIQUES
  // ==========================================

  async getActifs() {
    return this.prisma.utilisateur.findMany({
      where: { estActif: true },
      select: {
        id: true,
        nomUtilisateur: true,
        email: true,
        nomComplet: true,
        role: true,
        tierAbonnement: true,
      },
      orderBy: { nomComplet: 'asc' },
    });
  }

  async getByRole(role: string) {
    return this.prisma.utilisateur.findMany({
      where: { 
        role: role as any,
        estActif: true,
      },
      select: {
        id: true,
        nomUtilisateur: true,
        email: true,
        nomComplet: true,
        role: true,
        tierAbonnement: true,
      },
      orderBy: { nomComplet: 'asc' },
    });
  }

  // ==========================================
  // STATISTIQUES
  // ==========================================

  async getStatistiques() {
    const [total, actifs, parRole, parTier] = await Promise.all([
      this.prisma.utilisateur.count(),
      this.prisma.utilisateur.count({ where: { estActif: true } }),
      this.prisma.utilisateur.groupBy({
        by: ['role'],
        _count: true,
      }),
      this.prisma.utilisateur.groupBy({
        by: ['tierAbonnement'],
        _count: true,
      }),
    ]);

    return {
      total,
      actifs,
      inactifs: total - actifs,
      parRole: parRole.reduce((acc, item) => {
        acc[item.role] = item._count;
        return acc;
      }, {} as Record<string, number>),
      parTier: parTier.reduce((acc, item) => {
        acc[item.tierAbonnement] = item._count;
        return acc;
      }, {} as Record<string, number>),
    };
  }

  // ==========================================
  // GESTION DES MOTS DE PASSE
  // ==========================================

  async changePassword(id: number, dto: { ancienMotDePasse: string; nouveauMotDePasse: string }) {
    const user = await this.prisma.utilisateur.findUnique({ where: { id } });
    
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Vérifier l'ancien mot de passe
    const isMatch = await bcrypt.compare(dto.ancienMotDePasse, user.motDePasseHash);
    
    if (!isMatch) {
      throw new BadRequestException('L\'ancien mot de passe est incorrect');
    }

    // Vérifier la robustesse du nouveau mot de passe
    if (!this.validatePasswordStrength(dto.nouveauMotDePasse)) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 6 caractères');
    }

    // Hasher et sauvegarder
    const newHash = await bcrypt.hash(dto.nouveauMotDePasse, 10);
    
    await this.prisma.utilisateur.update({
      where: { id },
      data: { motDePasseHash: newHash },
    });

    return { message: 'Mot de passe modifié avec succès' };
  }

  async resetPassword(id: number, newPassword: string) {
    await this.findOne(id);

    if (!this.validatePasswordStrength(newPassword)) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 6 caractères');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    
    await this.prisma.utilisateur.update({
      where: { id },
      data: { motDePasseHash: newHash },
    });

    return { message: 'Mot de passe réinitialisé avec succès' };
  }

  // ==========================================
  // ACTIVATION / DÉSACTIVATION
  // ==========================================

  async activer(id: number) {
    await this.findOne(id);
    
    return this.prisma.utilisateur.update({
      where: { id },
      data: { estActif: true },
      select: {
        id: true,
        nomUtilisateur: true,
        email: true,
        nomComplet: true,
        role: true,
        estActif: true,
        tierAbonnement: true,
      },
    });
  }

  async desactiver(id: number) {
    await this.findOne(id);
    
    return this.prisma.utilisateur.update({
      where: { id },
      data: { estActif: false },
      select: {
        id: true,
        nomUtilisateur: true,
        email: true,
        nomComplet: true,
        role: true,
        estActif: true,
        tierAbonnement: true,
      },
    });
  }

  // ==========================================
  // GESTION DES RÔLES
  // ==========================================

  async changeRole(id: number, role: string) {
    await this.findOne(id);

    const validRoles = ['ADMIN', 'GESTIONNAIRE', 'EMPLOYE'];
    if (!validRoles.includes(role)) {
      throw new BadRequestException(`Rôle invalide. Rôles valides: ${validRoles.join(', ')}`);
    }
    
    return this.prisma.utilisateur.update({
      where: { id },
      data: { role: role as any },
      select: {
        id: true,
        nomUtilisateur: true,
        email: true,
        nomComplet: true,
        role: true,
        estActif: true,
        tierAbonnement: true,
      },
    });
  }

  // ==========================================
  // GESTION PREMIUM
  // ==========================================

  async togglePremium(id: number) {
    const user = await this.findOne(id);
    
    const newTier = user.tierAbonnement === 'PREMIUM' ? 'GRATUIT' : 'PREMIUM';
    const newExpiration = newTier === 'PREMIUM' 
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 an
      : null;
    
    return this.prisma.utilisateur.update({
      where: { id },
      data: { 
        tierAbonnement: newTier,
        dateExpiration: newExpiration,
      },
      select: {
        id: true,
        nomUtilisateur: true,
        email: true,
        nomComplet: true,
        role: true,
        estActif: true,
        tierAbonnement: true,
        dateExpiration: true,
      },
    });
  }

  async activerPremium(id: number, tier?: string, dateExpiration?: string) {
    await this.findOne(id);

    const tierValue = tier || 'PREMIUM';
    const expirationValue = dateExpiration 
      ? new Date(dateExpiration)
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 an par défaut
    
    return this.prisma.utilisateur.update({
      where: { id },
      data: { 
        tierAbonnement: tierValue as any,
        dateExpiration: expirationValue,
      },
      select: {
        id: true,
        nomUtilisateur: true,
        email: true,
        nomComplet: true,
        role: true,
        estActif: true,
        tierAbonnement: true,
        dateExpiration: true,
      },
    });
  }

  async desactiverPremium(id: number) {
    await this.findOne(id);
    
    return this.prisma.utilisateur.update({
      where: { id },
      data: { 
        tierAbonnement: 'GRATUIT',
        dateExpiration: null,
      },
      select: {
        id: true,
        nomUtilisateur: true,
        email: true,
        nomComplet: true,
        role: true,
        estActif: true,
        tierAbonnement: true,
        dateExpiration: true,
      },
    });
  }
}
