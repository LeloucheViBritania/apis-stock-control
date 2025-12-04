import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      usernameField: 'nomUtilisateur',
      passwordField: 'motDePasse',
    });
  }

  async validate(nomUtilisateur: string, motDePasse: string): Promise<any> {
    const utilisateur = await this.authService.validateUser(nomUtilisateur, motDePasse);
    
    if (!utilisateur) {
      throw new UnauthorizedException('Identifiants incorrects');
    }
    
    return utilisateur;
  }
}