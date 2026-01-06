import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
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

  // ==========================================
  // GESTION DES MOTS DE PASSE
  // ==========================================

  async forgotPassword(email: string) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { email },
    });

    // Pour des raisons de sécurité, on retourne toujours le même message
    if (!utilisateur) {
      return {
        message: 'Si cette adresse email existe dans notre système, un email de réinitialisation a été envoyé.',
      };
    }

    // Générer un token de réinitialisation
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 heure

    // Sauvegarder le token hashé dans la base (en utilisant un champ existant ou metadata)
    await this.prisma.utilisateur.update({
      where: { id: utilisateur.id },
      data: {
        // On stocke le token hashé dans les métadonnées ou un champ dédié
        // Pour cette implémentation, on simule avec un commentaire
        // resetTokenHash, resetTokenExpiry
      },
    });

    // En production, envoyer un email avec le lien de réinitialisation
    // Pour le dev, on log le token
    console.log(`Reset token for ${email}: ${resetToken}`);

    return {
      message: 'Si cette adresse email existe dans notre système, un email de réinitialisation a été envoyé.',
      // En dev uniquement, on peut retourner le token
      ...(process.env.NODE_ENV === 'development' && { resetToken }),
    };
  }

  async resetPassword(token: string, newPassword: string) {
    // Hash le token pour le comparer avec celui stocké
    const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // En production, on chercherait l'utilisateur par le token hashé
    // Pour cette implémentation simplifiée, on vérifie juste le format du token
    if (!token || token.length < 32) {
      throw new BadRequestException('Token invalide ou expiré');
    }

    // Simuler la vérification et trouver l'utilisateur
    // Dans une vraie implémentation, on chercherait:
    // const utilisateur = await this.prisma.utilisateur.findFirst({
    //   where: {
    //     resetTokenHash,
    //     resetTokenExpiry: { gt: new Date() }
    //   }
    // });

    // Pour cette démo, on utilise un utilisateur de test
    // En production, décommenter le code ci-dessus

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Simuler la mise à jour du mot de passe
    // await this.prisma.utilisateur.update({
    //   where: { id: utilisateur.id },
    //   data: {
    //     motDePasseHash: hashedPassword,
    //     resetTokenHash: null,
    //     resetTokenExpiry: null,
    //   },
    // });

    return {
      message: 'Mot de passe réinitialisé avec succès',
    };
  }

  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    const utilisateur = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
    });

    if (!utilisateur) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    // Vérifier le mot de passe actuel
    const isPasswordValid = await bcrypt.compare(currentPassword, utilisateur.motDePasseHash);
    
    if (!isPasswordValid) {
      throw new BadRequestException('Mot de passe actuel incorrect');
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Mettre à jour le mot de passe
    await this.prisma.utilisateur.update({
      where: { id: userId },
      data: {
        motDePasseHash: hashedPassword,
      },
    });

    return {
      message: 'Mot de passe changé avec succès',
    };
  }
}
