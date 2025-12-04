import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  async upgradeToPremi(userId: number, durationMonths: number = 1) {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    if (user.tierAbonnement === 'PREMIUM') {
      // Prolonger l'abonnement existant
      const newExpiration = user.dateExpiration
        ? new Date(user.dateExpiration)
        : new Date();
      newExpiration.setMonth(newExpiration.getMonth() + durationMonths);

      return this.prisma.utilisateur.update({
        where: { id: userId },
        data: {
          dateExpiration: newExpiration,
        },
        select: {
          id: true,
          nomUtilisateur: true,
          email: true,
          tierAbonnement: true,
          dateExpiration: true,
        },
      });
    }

    // Nouveau abonnement PREMIUM
    const dateExpiration = new Date();
    dateExpiration.setMonth(dateExpiration.getMonth() + durationMonths);

    return this.prisma.utilisateur.update({
      where: { id: userId },
      data: {
        tierAbonnement: 'PREMIUM',
        dateExpiration,
      },
      select: {
        id: true,
        nomUtilisateur: true,
        email: true,
        tierAbonnement: true,
        dateExpiration: true,
      },
    });
  }

  async downgradeToFree(userId: number) {
    return this.prisma.utilisateur.update({
      where: { id: userId },
      data: {
        tierAbonnement: 'GRATUIT',
        dateExpiration: null,
      },
      select: {
        id: true,
        nomUtilisateur: true,
        email: true,
        tierAbonnement: true,
        dateExpiration: true,
      },
    });
  }

  async checkSubscriptionStatus(userId: number) {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: {
        id: true,
        tierAbonnement: true,
        dateExpiration: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const isActive =
      user.tierAbonnement === 'PREMIUM' &&
      (!user.dateExpiration || new Date(user.dateExpiration) > new Date());

    const daysRemaining = user.dateExpiration
      ? Math.ceil(
          (new Date(user.dateExpiration).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : null;

    return {
      tier: user.tierAbonnement,
      isActive,
      expiresAt: user.dateExpiration,
      daysRemaining,
    };
  }

  async getFeatures(userId: number) {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: { tierAbonnement: true, dateExpiration: true },
    });

    // Vérification null
    if (!user) {
      throw new NotFoundException('Utilisateur non trouvé');
    }

    const isPremium =
      user.tierAbonnement === 'PREMIUM' &&
      (!user.dateExpiration || new Date(user.dateExpiration) > new Date());

    return {
      tier: user.tierAbonnement,
      features: {
        gestionProduits: true,
        gestionCategories: true,
        gestionClients: true,
        gestionFournisseurs: true,
        gestionCommandes: true,
        mouvementsStockBasique: true,
        dashboardBasique: true,
        alertesStock: true,
        // Features PREMIUM
        multiEntrepots: isPremium,
        transfertsStock: isPremium,
        ajustementsAvances: isPremium,
        bonsCommandeAchat: isPremium,
        gestionRoles: isPremium,
        journalAudit: isPremium,
        rapportsAvances: isPremium,
      },
    };
  }
}