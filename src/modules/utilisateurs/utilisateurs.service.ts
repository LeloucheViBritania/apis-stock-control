import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UpdateUtilisateurDto } from './dto/update-utilisateur.dto'; // À créer
import { ChangePasswordDto } from './dto/change-password.dto'; // À créer

@Injectable()
export class UtilisateursService {
  constructor(private prisma: PrismaService) {}

  // Stratégie de mot de passe : Min 8 char, 1 maj, 1 min, 1 chiffre, 1 spécial
  private validatePasswordStrength(password: string): boolean {
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
  }

  async findAll() {
    return this.prisma.utilisateur.findMany({
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

  async findOne(id: number) {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id },
    });
    if (!user) throw new NotFoundException(`Utilisateur #${id} non trouvé`);
    
    // On retire le hash du mot de passe avant de renvoyer
    const { motDePasseHash, ...result } = user;
    return result;
  }

  async update(id: number, updateDto: UpdateUtilisateurDto) {
    // Vérification unicité email/username si modifiés
    if (updateDto.email || updateDto.nomUtilisateur) {
       const existing = await this.prisma.utilisateur.findFirst({
        where: {
          OR: [
            { email: updateDto.email },
            { nomUtilisateur: updateDto.nomUtilisateur }
          ],
          NOT: { id } // Exclure l'utilisateur courant
        }
      });
      if (existing) throw new ConflictException('Email ou Nom d\'utilisateur déjà pris');
    }

    return this.prisma.utilisateur.update({
      where: { id },
      data: updateDto,
    });
  }

  async changePassword(id: number, dto: ChangePasswordDto) {
    const user = await this.prisma.utilisateur.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Utilisateur introuvable');

    // 1. Vérifier l'ancien mot de passe
    const isMatch = await bcrypt.compare(dto.ancienMotDePasse, user.motDePasseHash);
    if (!isMatch) throw new BadRequestException('L\'ancien mot de passe est incorrect');

    // 2. Vérifier la robustesse du nouveau mot de passe
    if (!this.validatePasswordStrength(dto.nouveauMotDePasse)) {
      throw new BadRequestException(
        'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial',
      );
    }

    // 3. Hasher et sauvegarder
    const newHash = await bcrypt.hash(dto.nouveauMotDePasse, 10);
    
    return this.prisma.utilisateur.update({
      where: { id },
      data: { motDePasseHash: newHash },
    });
  }

  // Soft Delete : On désactive au lieu de supprimer pour garder l'historique (audit)
  async remove(id: number) {
    return this.prisma.utilisateur.update({
      where: { id },
      data: { estActif: false },
    });
  }
}