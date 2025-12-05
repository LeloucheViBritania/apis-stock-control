import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto) {
    // Vérifier si l'utilisateur existe déjà
    const existingUser = await this.prisma.utilisateur.findFirst({
      where: {
        OR: [
          { nomUtilisateur: registerDto.nomUtilisateur },
          { email: registerDto.email },
        ],
      },
    });

    if (existingUser) {
      throw new ConflictException("Nom d'utilisateur ou email déjà utilisé");
    }

    // Hasher le mot de passe
    const motDePasseHash = await bcrypt.hash(registerDto.motDePasse, 10);

    // Créer l'utilisateur
    const utilisateur = await this.prisma.utilisateur.create({
      data: {
        nomUtilisateur: registerDto.nomUtilisateur,
        email: registerDto.email,
        motDePasseHash,
        nomComplet: registerDto.nomComplet,
        role: registerDto.role || 'EMPLOYE',
        tierAbonnement: 'GRATUIT', // Par défaut gratuit
      },
      select: {
        id: true,
        nomUtilisateur: true,
        email: true,
        nomComplet: true,
        role: true,
        tierAbonnement: true,
      },
    });

    return {
      message: 'Utilisateur créé avec succès',
      utilisateur,
    };
  }

  async login(loginDto: LoginDto) {
    const utilisateur = await this.validateUser(
      loginDto.nomUtilisateur,
      loginDto.motDePasse,
    );

    if (!utilisateur) {
      throw new UnauthorizedException('Identifiants incorrects');
    }

    const payload = {
      sub: utilisateur.id,
      nomUtilisateur: utilisateur.nomUtilisateur,
      role: utilisateur.role,
      tierAbonnement: utilisateur.tierAbonnement,
    };

    return {
      access_token: this.jwtService.sign(payload),
      utilisateur: {
        id: utilisateur.id,
        nomUtilisateur: utilisateur.nomUtilisateur,
        email: utilisateur.email,
        nomComplet: utilisateur.nomComplet,
        role: utilisateur.role,
        tierAbonnement: utilisateur.tierAbonnement,
        dateExpiration: utilisateur.dateExpiration,
      },
    };
  }

  async validateUser(nomUtilisateur: string, motDePasse: string) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { nomUtilisateur },
    });

    if (!utilisateur || !utilisateur.estActif) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(
      motDePasse,
      utilisateur.motDePasseHash,
    );

    if (!isPasswordValid) {
      return null;
    }

    const { motDePasseHash, ...result } = utilisateur;
    return result;
  }

  async getProfile(userId: number) {
    return this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nomUtilisateur: true,
        email: true,
        nomComplet: true,
        role: true,
        tierAbonnement: true,
        dateExpiration: true,
        estActif: true,
        dateCreation: true,
      },
    });
  }
}
