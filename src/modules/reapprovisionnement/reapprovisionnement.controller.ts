// ============================================
// FICHIER: src/modules/reapprovisionnement/reapprovisionnement.controller.ts
// Controller pour le réapprovisionnement automatique
// ============================================

import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { ReapprovisionnementService } from './reapprovisionnement.service';
import {
  SuggererReapprovisionnementDto,
  CommanderAutoDto,
  StrategieReapprovisionnement,
} from './dto/reapprovisionnement.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { RolesGuard, Role } from '../../common/guards/roles.guard';
import { PremiumFeature } from '../../common/decorators/premium-feature.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Feature } from '../../common/enums/features.enum';

@ApiTags('🔄 Réapprovisionnement')
@ApiBearerAuth('JWT-auth')
@Controller('reapprovisionnement')
@UseGuards(AuthGuard, PremiumGuard, RolesGuard)
@PremiumFeature(Feature.REAPPROVISIONNEMENT_AUTO)
export class ReapprovisionnementController {
  constructor(
    private readonly reapprovisionnementService: ReapprovisionnementService,
  ) {}

  // ============================================
  // SUGGÉRER LES RÉAPPROVISIONNEMENTS
  // ============================================

  @Post('suggerer')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Obtenir des suggestions de réapprovisionnement',
    description: `
      Analyse les stocks et les prévisions pour suggérer les commandes à passer.
      
      **Fonctionnalité:** 🔒 PREMIUM
      
      **Stratégies disponibles:**
      - **POINT_COMMANDE**: Commander quand stock ≤ point de commande
      - **PERIODICITE_FIXE**: Commander pour couvrir une période fixe
      - **JUSTE_A_TEMPS**: Minimiser le stock (commandes fréquentes)
      - **STOCK_SECURITE**: Maximiser la sécurité (stock élevé)
      
      **Options:**
      - Filtrer par entrepôt ou catégorie
      - Limiter à certains fournisseurs
      - Afficher uniquement les alertes
      - Appliquer un budget maximum
      - Grouper les suggestions par fournisseur
      
      **Retourne:**
      - Suggestions groupées par fournisseur
      - Priorité de chaque suggestion
      - Coût estimé
      - Produits sans fournisseur assigné
    `,
  })
  @ApiBody({ type: SuggererReapprovisionnementDto })
  @ApiResponse({
    status: 200,
    description: 'Suggestions de réapprovisionnement',
    schema: {
      example: {
        parametres: {
          strategie: 'POINT_COMMANDE',
          horizonJours: 30,
        },
        resume: {
          totalProduits: 25,
          produitsEnAlerte: 8,
          montantTotalSuggere: 1500000,
        },
        parFournisseur: [
          {
            fournisseur: { id: 1, nom: 'Tech SA' },
            nombreProduits: 5,
            montantTotal: 750000,
          },
        ],
      },
    },
  })
  async suggerer(@Body() dto: SuggererReapprovisionnementDto) {
    return this.reapprovisionnementService.suggerer(dto);
  }

  // ============================================
  // CRÉER BON DE COMMANDE AUTOMATIQUE
  // ============================================

  @Post('commander')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Créer un bon de commande automatique',
    description: `
      Crée un bon de commande d'achat basé sur les suggestions ou des lignes manuelles.
      
      **Fonctionnalité:** 🔒 PREMIUM
      
      **Modes de fonctionnement:**
      
      1. **Automatique** (utiliserSuggestions: true)
         - Génère les lignes depuis les suggestions pour le fournisseur
         - Inclut uniquement les produits en alerte
      
      2. **Manuel** (lignes fournies)
         - Utilise les lignes spécifiées
         - Les prix sont récupérés automatiquement si non fournis
      
      **Actions effectuées:**
      - Création du bon de commande avec statut EN_ATTENTE
      - Génération du numéro de commande unique
      - Calcul des montants
      
      **Note:** Le bon doit être approuvé manuellement avant envoi au fournisseur.
    `,
  })
  @ApiBody({
    type: CommanderAutoDto,
    examples: {
      automatique: {
        summary: 'Commande automatique',
        value: {
          fournisseurId: 1,
          entrepotId: 1,
          utiliserSuggestions: true,
          notes: 'Commande urgente - ruptures imminentes',
        },
      },
      manuel: {
        summary: 'Commande manuelle',
        value: {
          fournisseurId: 1,
          entrepotId: 1,
          lignes: [
            { produitId: 1, quantite: 100 },
            { produitId: 2, quantite: 50, prixUnitaire: 15000 },
          ],
          notes: 'Commande exceptionnelle',
          dateLivraisonSouhaitee: '2025-02-15',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Bon de commande créé',
    schema: {
      example: {
        success: true,
        bonCommande: {
          id: 15,
          numeroCommande: 'BC-202501-0015',
          fournisseur: 'Tech SA',
          montantTotal: 750000,
          nombreLignes: 5,
        },
        message: 'Bon de commande BC-202501-0015 créé avec succès',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 404, description: 'Fournisseur ou entrepôt non trouvé' })
  async commander(@Body() dto: CommanderAutoDto, @Request() req: any) {
    return this.reapprovisionnementService.commander(dto, req.user.id);
  }
}