import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { Role, RolesGuard } from '../../common/guards/roles.guard';
import { PremiumFeature } from '../../common/decorators/premium-feature.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Feature } from '../../common/enums/features.enum';

@ApiTags('Dashboard')
@ApiBearerAuth()
@ApiSecurity('premium-access')
@Controller('dashboard')
@UseGuards(AuthGuard, PremiumGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('statistiques')
  @PremiumFeature(Feature.DASHBOARD_BASIQUE)
  @ApiOperation({ 
    summary: 'Obtenir les statistiques globales du dashboard',
    description: 'Retourne les statistiques globales (KPIs) : total produits, ruptures, valeur stock, etc.'
  })
  @ApiResponse({ status: 200, description: 'Statistiques récupérées avec succès' })
  getStatistiques(@Request() req) {
    return this.dashboardService.getStatistiquesGlobales(req.user.id);
  }

  @Get('activites-recentes')
  @PremiumFeature(Feature.DASHBOARD_BASIQUE)
  @ApiOperation({ 
    summary: 'Obtenir les activités récentes',
    description: 'Retourne la liste des derniers mouvements de stock'
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  getActivitesRecentes(@Query('limit') limit?: string) {
    return this.dashboardService.getActivitesRecentes(limit ? +limit : 10);
  }

  @Get('top-produits')
  @PremiumFeature(Feature.DASHBOARD_BASIQUE)
  @ApiOperation({ 
    summary: 'Top produits (Stock)',
    description: 'Retourne les produits ayant la plus grande quantité en stock (Dormant)'
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 5 })
  getTopProduits(@Query('limit') limit?: string) {
    return this.dashboardService.getProduitsTopStock(limit ? +limit : 5);
  }

  @Get('commandes-recentes')
  @PremiumFeature(Feature.DASHBOARD_BASIQUE)
  @ApiOperation({ summary: 'Commandes récentes' })
  getCommandesRecentes(@Query('limit') limit?: string) {
    return this.dashboardService.getCommandesRecentes(limit ? +limit : 5);
  }

  // =================================================================
  // NOUVELLES ROUTES (Business Intelligence)
  // =================================================================

  @Get('top-ventes')
  @PremiumFeature(Feature.DASHBOARD_BASIQUE)
  @ApiOperation({ 
    summary: 'Top produits (Ventes)',
    description: 'Retourne les produits les plus vendus avec le chiffre d\'affaires généré'
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 5 })
  @ApiResponse({
    status: 200,
    description: 'Top ventes récupéré avec succès',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nom: { type: 'string', example: 'iPhone 13' },
          totalVendu: { type: 'number', example: 150 },
          chiffreAffairesGenere: { type: 'number', example: 150000 }
        }
      }
    }
  })
  getTopVentes(@Query('limit') limit?: string) {
    return this.dashboardService.getProduitsLesPlusVendus(limit ? +limit : 5);
  }

  @Get('alertes-stock')
  @PremiumFeature(Feature.DASHBOARD_BASIQUE)
  @ApiOperation({ 
    summary: 'Détail des alertes de stock',
    description: 'Retourne la liste détaillée des produits en dessous du seuil minimum pour réapprovisionnement'
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des alertes récupérée',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nom: { type: 'string', example: 'Câble USB-C' },
          quantiteStock: { type: 'number', example: 2 },
          niveauStockMin: { type: 'number', example: 10 },
          produitsFournisseurs: { type: 'array', items: { type: 'object' } }
        }
      }
    }
  })
  getAlertesStock() {
    return this.dashboardService.getDetailsAlerteStock();
  }

  @Get('evolution-revenus')
  @Roles(Role.ADMIN, Role.GESTIONNAIRE) // Sécurité renforcée pour les données financières
  @PremiumFeature(Feature.DASHBOARD_BASIQUE)
  @ApiOperation({ 
    summary: 'Évolution des revenus (Admin/Gestionnaire)',
    description: 'Retourne le chiffre d\'affaires mensuel sur les 12 derniers mois. Nécessite le rôle ADMIN ou GESTIONNAIRE.'
  })
  @ApiResponse({
    status: 200,
    description: 'Données financières récupérées',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          mois: { type: 'string', example: '2023-11' },
          revenu: { type: 'number', example: 45000.50 }
        }
      }
    }
  })
  @ApiResponse({ status: 403, description: 'Accès interdit (Rôle insuffisant)' })
  getEvolutionRevenus() {
    return this.dashboardService.getEvolutionRevenus();
  }
}