// ============================================
// FICHIER: src/modules/previsions/previsions.controller.ts
// Controller pour les prévisions de stock
// ============================================

import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { PrevisionsService } from './previsions.service';
import {
  PrevisionStockQueryDto,
  PrevisionsCommandesQueryDto,
  MethodePrevision,
  PeriodeAnalyse,
} from './dto/previsions.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { RolesGuard, Role } from '../../common/guards/roles.guard';
import { PremiumFeature } from '../../common/decorators/premium-feature.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Feature } from '../../common/enums/features.enum';

@ApiTags('📊 Prévisions')
@ApiBearerAuth('JWT-auth')
@Controller('previsions')
@UseGuards(AuthGuard, PremiumGuard, RolesGuard)
@PremiumFeature(Feature.PREVISIONS_STOCK)
export class PrevisionsController {
  constructor(private readonly previsionsService: PrevisionsService) {}

  // ============================================
  // PRÉVISION STOCK D'UN PRODUIT
  // ============================================

  @Get('stock/:produitId')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Prévision de rupture pour un produit',
    description: `
      Analyse l'historique des mouvements et prédit la date de rupture de stock.
      
      **Fonctionnalité:** 🔒 PREMIUM
      
      **Méthodes de prévision disponibles:**
      - **MOYENNE_MOBILE**: Moyenne des X derniers jours (stable, recommandée)
      - **MOYENNE_PONDEREE**: Plus de poids aux données récentes
      - **LISSAGE_EXPONENTIEL**: Réactif aux changements récents
      - **TENDANCE_LINEAIRE**: Projette la tendance future
      
      **Données retournées:**
      - Stock actuel et seuils
      - Consommation moyenne (jour/semaine/mois)
      - Jours avant rupture estimés
      - Niveau d'urgence (CRITIQUE, URGENT, ATTENTION, OK)
      - Quantité suggérée à commander
      - Fiabilité de la prévision
    `,
  })
  @ApiParam({ name: 'produitId', description: 'ID du produit', example: 1 })
  @ApiQuery({ name: 'entrepotId', type: Number, required: false, description: 'ID de l\'entrepôt' })
  @ApiQuery({ name: 'joursPrevisison', type: Number, required: false, example: 30 })
  @ApiQuery({ name: 'methode', enum: MethodePrevision, required: false })
  @ApiResponse({ status: 200, description: 'Prévision du stock' })
  @ApiResponse({ status: 404, description: 'Produit non trouvé' })
  async getPrevisionStock(
    @Param('produitId', ParseIntPipe) produitId: number,
    @Query() query: PrevisionStockQueryDto,
  ) {
    return this.previsionsService.getPrevisionStock(produitId, query);
  }

  // ============================================
  // PRÉVISIONS GLOBALES COMMANDES
  // ============================================

  @Get('produits-a-commander')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Liste des produits à commander',
    description: `
      Retourne la liste des produits nécessitant un réapprovisionnement urgent.
      
      **Fonctionnalité:** 🔒 PREMIUM
      
      **Critères:**
      - Stock actuel ≤ stock minimum
      - Ou point de commande atteint
      
      **Données retournées:**
      - Liste des produits triés par urgence
      - Quantité suggérée à commander
      - Fournisseur préféré (si disponible)
    `,
  })
  @ApiQuery({ name: 'limit', type: Number, required: false, example: 20 })
  @ApiQuery({ name: 'entrepotId', type: Number, required: false })
  @ApiResponse({ status: 200, description: 'Liste des produits à commander' })
  async getProduitsACommander(
    @Query('limit') limit?: string,
    @Query('entrepotId') entrepotId?: string,
  ) {
    return this.previsionsService.getProduitsACommander(
      limit ? +limit : 20,
      entrepotId ? +entrepotId : undefined,
    );
  }

  @Get('commandes')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Prévisions basées sur l\'historique des commandes',
    description: `
      Analyse globale des besoins de réapprovisionnement pour tous les produits.
      
      **Fonctionnalité:** 🔒 PREMIUM
      
      **Périodes d'analyse:**
      - SEMAINE: 7 jours
      - MOIS: 30 jours
      - TRIMESTRE: 90 jours (recommandé)
      - ANNEE: 365 jours
      
      **Données retournées:**
      - Résumé global (produits en alerte, valeur stock, etc.)
      - Liste des produits avec prévisions
      - Tendances par catégorie
      - Alertes prioritaires
    `,
  })
  @ApiQuery({ name: 'periodeAnalyse', enum: PeriodeAnalyse, required: false })
  @ApiQuery({ name: 'entrepotId', type: Number, required: false })
  @ApiQuery({ name: 'categorieId', type: Number, required: false })
  @ApiQuery({ name: 'joursPrevision', type: Number, required: false, example: 30 })
  @ApiResponse({ status: 200, description: 'Prévisions des commandes' })
  async getPrevisionsCommandes(@Query() query: PrevisionsCommandesQueryDto) {
    return this.previsionsService.getPrevisionsCommandes(query);
  }
}