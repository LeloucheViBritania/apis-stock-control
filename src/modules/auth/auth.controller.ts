import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiBody,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '../../common/guards/auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ 
    summary: 'Inscription d\'un nouvel utilisateur',
    description: `
      Crée un nouveau compte utilisateur dans le système.
      
      **Par défaut:**
      - Rôle: EMPLOYE
      - Tier: GRATUIT (FREE)
      - Statut: Actif
      
      **Validation:**
      - Nom d'utilisateur unique (3 caractères minimum)
      - Email valide et unique
      - Mot de passe sécurisé (6 caractères minimum)
    `
  })
  @ApiBody({
    type: RegisterDto,
    description: 'Informations pour créer un nouveau compte',
    examples: {
      exemple1: {
        summary: 'Inscription basique',
        value: {
          nomUtilisateur: 'john_doe',
          email: 'john@example.com',
          motDePasse: 'password123',
          nomComplet: 'John Doe'
        }
      },
      exemple2: {
        summary: 'Inscription avec rôle personnalisé',
        value: {
          nomUtilisateur: 'manager',
          email: 'manager@example.com',
          motDePasse: 'securepass456',
          nomComplet: 'Manager Name',
          role: 'GESTIONNAIRE'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Utilisateur créé avec succès',
    schema: {
      example: {
        message: 'Utilisateur créé avec succès',
        utilisateur: {
          id: 5,
          nomUtilisateur: 'john_doe',
          email: 'john@example.com',
          nomComplet: 'John Doe',
          role: 'EMPLOYE',
          tierAbonnement: 'GRATUIT'
        }
      }
    }
  })
  @ApiConflictResponse({ 
    description: 'Nom d\'utilisateur ou email déjà utilisé',
    schema: {
      example: {
        statusCode: 409,
        message: 'Nom d\'utilisateur ou email déjà utilisé',
        error: 'Conflict'
      }
    }
  })
  @ApiBadRequestResponse({
    description: 'Données invalides',
    schema: {
      example: {
        statusCode: 400,
        message: [
          'nomUtilisateur doit avoir au moins 3 caractères',
          'email doit être un email valide',
          'motDePasse doit avoir au moins 6 caractères'
        ],
        error: 'Bad Request'
      }
    }
  })
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @ApiOperation({ 
    summary: 'Connexion d\'un utilisateur',
    description: `
      Authentifie un utilisateur et retourne un token JWT.
      
      **Durée de validité du token:** 7 jours (configurable)
      
      **Utilisation du token:**
      Ajoutez le token dans les headers de vos requêtes:
      \`Authorization: Bearer <votre_token>\`
      
      **Comptes de test disponibles:**
      - Admin (PREMIUM): admin / admin123
      - Gestionnaire (FREE): gestionnaire / gestionnaire123
      - Employé (FREE): employe / employe123
    `
  })
  @ApiBody({
    type: LoginDto,
    description: 'Identifiants de connexion',
    examples: {
      admin: {
        summary: 'Connexion Admin (PREMIUM)',
        value: {
          nomUtilisateur: 'admin',
          motDePasse: 'admin123'
        }
      },
      gestionnaire: {
        summary: 'Connexion Gestionnaire (FREE)',
        value: {
          nomUtilisateur: 'gestionnaire',
          motDePasse: 'gestionnaire123'
        }
      },
      employe: {
        summary: 'Connexion Employé (FREE)',
        value: {
          nomUtilisateur: 'employe',
          motDePasse: 'employe123'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Connexion réussie - Token JWT retourné',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsIm5vbVV0aWxpc2F0ZXVyIjoiYWRtaW4iLCJyb2xlIjoiQURNSU4iLCJ0aWVyQWJvbm5lbWVudCI6IlBSRU1JVU0iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDYwNDgwMH0.signature',
        utilisateur: {
          id: 1,
          nomUtilisateur: 'admin',
          email: 'admin@gestionstock.com',
          nomComplet: 'Administrateur Principal',
          role: 'ADMIN',
          tierAbonnement: 'PREMIUM',
          dateExpiration: '2025-12-31T00:00:00.000Z'
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ 
    description: 'Identifiants incorrects',
    schema: {
      example: {
        statusCode: 401,
        message: 'Identifiants incorrects',
        error: 'Unauthorized'
      }
    }
  })
  @ApiBadRequestResponse({
    description: 'Données manquantes ou invalides',
    schema: {
      example: {
        statusCode: 400,
        message: [
          'nomUtilisateur ne doit pas être vide',
          'motDePasse doit avoir au moins 6 caractères'
        ],
        error: 'Bad Request'
      }
    }
  })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Get('profile')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Obtenir le profil de l\'utilisateur connecté',
    description: `
      Retourne les informations complètes du profil de l'utilisateur actuellement authentifié.
      
      **Authentification requise:** Oui (Token JWT)
      
      **Informations retournées:**
      - Données personnelles (nom, email)
      - Rôle et permissions
      - Statut de l'abonnement (FREE/PREMIUM)
      - Date d'expiration de l'abonnement PREMIUM
      - Statut du compte (actif/inactif)
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Profil utilisateur récupéré avec succès',
    schema: {
      example: {
        id: 1,
        nomUtilisateur: 'admin',
        email: 'admin@gestionstock.com',
        nomComplet: 'Administrateur Principal',
        role: 'ADMIN',
        tierAbonnement: 'PREMIUM',
        dateExpiration: '2025-12-31T00:00:00.000Z',
        estActif: true,
        dateCreation: '2024-01-01T00:00:00.000Z'
      }
    }
  })
  @ApiUnauthorizedResponse({ 
    description: 'Token manquant, invalide ou expiré',
    schema: {
      example: {
        statusCode: 401,
        message: 'Token invalide',
        error: 'Unauthorized'
      }
    }
  })
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }

  @Get('check')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Vérifier l\'état de l\'authentification',
    description: `
      Endpoint simple pour vérifier si le token JWT est valide.
      
      **Cas d'usage:**
      - Vérifier si l'utilisateur est toujours connecté
      - Valider un token avant d'effectuer des actions sensibles
      - Rafraîchir l'état de l'application côté client
      
      **Authentification requise:** Oui (Token JWT)
      
      **Réponse rapide:** Uniquement le statut d'authentification et les infos de base
    `
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Token valide - Utilisateur authentifié',
    schema: {
      example: {
        authenticated: true,
        user: {
          id: 1,
          nomUtilisateur: 'admin',
          email: 'admin@gestionstock.com',
          nomComplet: 'Administrateur Principal',
          role: 'ADMIN',
          tierAbonnement: 'PREMIUM',
          dateExpiration: '2025-12-31T00:00:00.000Z',
          estActif: true
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ 
    description: 'Non authentifié - Token invalide ou expiré',
    schema: {
      example: {
        statusCode: 401,
        message: 'Token invalide',
        error: 'Unauthorized'
      }
    }
  })
  async checkAuth(@Request() req) {
    return {
      authenticated: true,
      user: req.user,
    };
  }
}