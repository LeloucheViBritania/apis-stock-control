import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { PremiumFeature } from '../../common/decorators/premium-feature.decorator';
import { Feature } from '../../common/enums/features.enum';

@ApiTags('Dashboard')
@ApiBearerAuth()
@ApiSecurity('premium-access')
@Controller('dashboard')
@UseGuards(AuthGuard, PremiumGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('statistiques')
  @PremiumFeature(Feature.DASHBOARD_BASIQUE)
  @ApiOperation({ 
    summary: 'Obtenir les statistiques globales du dashboard',
    description: 'Retourne les statistiques globales de l\'utilisateur incluant : total des produits, produits en rupture, valeur totale du stock, mouvements récents, etc.'
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques globales récupérées avec succès',
    schema: {
      type: 'object',
      properties: {
        totalProduits: {
          type: 'number',
          example: 150,
          description: 'Nombre total de produits'
        },
        produitsEnRupture: {
          type: 'number',
          example: 5,
          description: 'Nombre de produits en rupture de stock'
        },
        valeurTotaleStock: {
          type: 'number',
          example: 125000.50,
          description: 'Valeur totale du stock en devise'
        },
        mouvementsAujourdHui: {
          type: 'number',
          example: 23,
          description: 'Nombre de mouvements de stock aujourd\'hui'
        },
        commandesEnCours: {
          type: 'number',
          example: 8,
          description: 'Nombre de commandes en cours'
        },
        produitsAlerteSeuil: {
          type: 'number',
          example: 12,
          description: 'Nombre de produits ayant atteint le seuil d\'alerte'
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié - Token invalide ou manquant'
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Fonctionnalité premium requise (DASHBOARD_BASIQUE)'
  })
  getStatistiques(@Request() req) {
    return this.dashboardService.getStatistiquesGlobales(req.user.id);
  }

  @Get('activites-recentes')
  @PremiumFeature(Feature.DASHBOARD_BASIQUE)
  @ApiOperation({ 
    summary: 'Obtenir les activités récentes',
    description: 'Retourne la liste des activités récentes (mouvements de stock, commandes, modifications, etc.)'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre maximum d\'activités à retourner',
    example: 10
  })
  @ApiResponse({
    status: 200,
    description: 'Activités récentes récupérées avec succès',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: 'act_123456'
          },
          type: {
            type: 'string',
            enum: ['MOUVEMENT', 'COMMANDE', 'AJUSTEMENT', 'ALERTE'],
            example: 'MOUVEMENT'
          },
          description: {
            type: 'string',
            example: 'Entrée de stock - 50 unités de Produit A'
          },
          produit: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                example: 'prod_789'
              },
              nom: {
                type: 'string',
                example: 'Produit A'
              }
            }
          },
          quantite: {
            type: 'number',
            example: 50
          },
          dateActivite: {
            type: 'string',
            format: 'date-time',
            example: '2025-11-18T10:30:00Z'
          },
          utilisateur: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                example: 'user_456'
              },
              nom: {
                type: 'string',
                example: 'Jean Dupont'
              }
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié - Token invalide ou manquant'
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Fonctionnalité premium requise (DASHBOARD_BASIQUE)'
  })
  getActivitesRecentes(@Query('limit') limit?: string) {
    return this.dashboardService.getActivitesRecentes(limit ? +limit : 10);
  }

  @Get('top-produits')
  @PremiumFeature(Feature.DASHBOARD_BASIQUE)
  @ApiOperation({ 
    summary: 'Obtenir les produits avec le plus de stock',
    description: 'Retourne la liste des produits ayant les quantités en stock les plus élevées'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre maximum de produits à retourner',
    example: 5
  })
  @ApiResponse({
    status: 200,
    description: 'Top produits récupérés avec succès',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: 'prod_123'
          },
          nom: {
            type: 'string',
            example: 'Produit Premium'
          },
          reference: {
            type: 'string',
            example: 'REF-001'
          },
          quantite: {
            type: 'number',
            example: 500,
            description: 'Quantité en stock'
          },
          valeurStock: {
            type: 'number',
            example: 25000.00,
            description: 'Valeur totale du stock pour ce produit'
          },
          categorie: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                example: 'cat_456'
              },
              nom: {
                type: 'string',
                example: 'Électronique'
              }
            }
          },
          prixUnitaire: {
            type: 'number',
            example: 50.00
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié - Token invalide ou manquant'
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Fonctionnalité premium requise (DASHBOARD_BASIQUE)'
  })
  getTopProduits(@Query('limit') limit?: string) {
    return this.dashboardService.getProduitsTopStock(limit ? +limit : 5);
  }

  @Get('commandes-recentes')
  @PremiumFeature(Feature.DASHBOARD_BASIQUE)
  @ApiOperation({ 
    summary: 'Obtenir les commandes récentes',
    description: 'Retourne la liste des commandes les plus récentes avec leur statut'
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre maximum de commandes à retourner',
    example: 5
  })
  @ApiResponse({
    status: 200,
    description: 'Commandes récentes récupérées avec succès',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: 'cmd_789'
          },
          numeroCommande: {
            type: 'string',
            example: 'CMD-2025-0123'
          },
          dateCommande: {
            type: 'string',
            format: 'date-time',
            example: '2025-11-15T14:30:00Z'
          },
          statut: {
            type: 'string',
            enum: ['EN_ATTENTE', 'EN_COURS', 'LIVREE', 'ANNULEE'],
            example: 'EN_COURS'
          },
          fournisseur: {
            type: 'object',
            properties: {
              id: {
                type: 'string',
                example: 'four_456'
              },
              nom: {
                type: 'string',
                example: 'Fournisseur ABC'
              }
            }
          },
          montantTotal: {
            type: 'number',
            example: 15000.00
          },
          nombreArticles: {
            type: 'number',
            example: 25,
            description: 'Nombre total d\'articles dans la commande'
          },
          dateLivraisonPrevue: {
            type: 'string',
            format: 'date-time',
            example: '2025-11-25T00:00:00Z'
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié - Token invalide ou manquant'
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Fonctionnalité premium requise (DASHBOARD_BASIQUE)'
  })
  getCommandesRecentes(@Query('limit') limit?: string) {
    return this.dashboardService.getCommandesRecentes(limit ? +limit : 5);
  }
}