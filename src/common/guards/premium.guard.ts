import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PREMIUM_FEATURE_KEY } from '../decorators/premium-feature.decorator';
import { Feature, PREMIUM_FEATURES } from '../enums/features.enum';
import { TierAbonnement } from '../enums/subscription-tier.enum';

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredFeature = this.reflector.getAllAndOverride<Feature>(
      PREMIUM_FEATURE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredFeature) {
      return true; // Pas de restriction sur cette route
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    // Vérifier si la fonctionnalité nécessite un abonnement premium
    const isPremiumFeature = PREMIUM_FEATURES.includes(requiredFeature);

    if (isPremiumFeature && user.tierAbonnement !== TierAbonnement.PREMIUM) {
      throw new ForbiddenException(
        'Cette fonctionnalité nécessite un abonnement Premium. ' +
          'Veuillez mettre à niveau votre compte.',
      );
    }

    // Vérifier si l'abonnement est expiré
    if (
      user.tierAbonnement === TierAbonnement.PREMIUM &&
      user.dateExpiration &&
      new Date(user.dateExpiration) < new Date()
    ) {
      throw new ForbiddenException(
        'Votre abonnement Premium a expiré. ' +
          'Veuillez renouveler votre abonnement.',
      );
    }

    return true;
  }
}