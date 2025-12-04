import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: any) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        nomUtilisateur: true,
        email: true,
        nomComplet: true,
        role: true,
        tierAbonnement: true,
        dateExpiration: true,
        estActif: true,
      },
    });

    if (!utilisateur || !utilisateur.estActif) {
      throw new UnauthorizedException('Utilisateur non actif');
    }

    return utilisateur;
  }
}