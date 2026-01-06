import { Controller, Get, Query, Param, UseGuards, ParseIntPipe, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth, ApiSecurity, ApiParam, ApiProduces } from '@nestjs/swagger';
import type { Response } from 'express';
import { MouvementsStockService } from './mouvements-stock.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { PremiumFeature } from '../../common/decorators/premium-feature.decorator';
import { Feature } from '../../common/enums/features.enum';

@ApiTags('Mouvements de Stock')
@ApiBearerAuth()
@ApiSecurity('premium-access')
@Controller('mouvements-stock')
@UseGuards(AuthGuard, PremiumGuard)
export class MouvementsStockController {
  constructor(private readonly mouvementsStockService: MouvementsStockService) {}

  @Get()
  @PremiumFeature(Feature.MOUVEMENTS_STOCK_BASIQUE)
  @ApiOperation({ 
    summary: 'Obtenir l\'historique des mouvements de stock',
    description: 'Retourne la liste paginée de tous les mouvements de stock (entrées, sorties, ajustements) avec possibilité de filtrage par produit, type de mouvement et période'
  })
  @ApiQuery({
    name: 'produitId',
    required: false,
    type: Number,
    description: 'Filtrer par identifiant du produit',
    example: 1
  })
  @ApiQuery({
    name: 'typeMouvement',
    required: false,
    type: String,
    enum: ['ENTREE', 'SORTIE', 'AJUSTEMENT', 'RETOUR', 'TRANSFERT'],
    description: 'Filtrer par type de mouvement',
    example: 'ENTREE'
  })
  @ApiQuery({
    name: 'dateDebut',
    required: false,
    type: String,
    format: 'date',
    description: 'Date de début de la période (format: YYYY-MM-DD)',
    example: '2025-11-01'
  })
  @ApiQuery({
    name: 'dateFin',
    required: false,
    type: String,
    format: 'date',
    description: 'Date de fin de la période (format: YYYY-MM-DD)',
    example: '2025-11-18'
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numéro de la page (commence à 1)',
    example: 1
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre d\'éléments par page',
    example: 20
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des mouvements de stock récupérée avec succès',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'number',
                example: 1
              },
              typeMouvement: {
                type: 'string',
                enum: ['ENTREE', 'SORTIE', 'AJUSTEMENT', 'RETOUR', 'TRANSFERT'],
                example: 'ENTREE',
                description: 'ENTREE: Réception de stock, SORTIE: Vente/Livraison, AJUSTEMENT: Correction d\'inventaire, RETOUR: Retour client/fournisseur, TRANSFERT: Déplacement entre entrepôts'
              },
              quantite: {
                type: 'number',
                example: 50,
                description: 'Quantité déplacée (toujours positive, le type indique le sens)'
              },
              quantiteAvant: {
                type: 'number',
                example: 100,
                description: 'Quantité en stock avant le mouvement'
              },
              quantiteApres: {
                type: 'number',
                example: 150,
                description: 'Quantité en stock après le mouvement'
              },
              produit: {
                type: 'object',
                properties: {
                  id: {
                    type: 'number',
                    example: 1
                  },
                  nom: {
                    type: 'string',
                    example: 'Ordinateur Portable'
                  },
                  reference: {
                    type: 'string',
                    example: 'ORD-001'
                  },
                  unite: {
                    type: 'string',
                    example: 'unité'
                  }
                }
              },
              motif: {
                type: 'string',
                example: 'Réception commande CMD-2025-0123',
                description: 'Raison du mouvement'
              },
              reference: {
                type: 'string',
                example: 'MOV-2025-0001',
                description: 'Référence unique du mouvement'
              },
              utilisateur: {
                type: 'object',
                properties: {
                  id: {
                    type: 'number',
                    example: 1
                  },
                  nom: {
                    type: 'string',
                    example: 'Jean Kouassi'
                  },
                  email: {
                    type: 'string',
                    example: 'jean.kouassi@example.com'
                  }
                },
                description: 'Utilisateur ayant effectué le mouvement'
              },
              commande: {
                type: 'object',
                nullable: true,
                properties: {
                  id: {
                    type: 'number',
                    example: 5
                  },
                  numeroCommande: {
                    type: 'string',
                    example: 'CMD-2025-0123'
                  }
                },
                description: 'Commande associée (si applicable)'
              },
              dateCreation: {
                type: 'string',
                format: 'date-time',
                example: '2025-11-18T10:30:00Z'
              }
            }
          }
        },
        pagination: {
          type: 'object',
          properties: {
            total: {
              type: 'number',
              example: 156,
              description: 'Nombre total de mouvements'
            },
            page: {
              type: 'number',
              example: 1,
              description: 'Page actuelle'
            },
            limit: {
              type: 'number',
              example: 20,
              description: 'Nombre d\'éléments par page'
            },
            totalPages: {
              type: 'number',
              example: 8,
              description: 'Nombre total de pages'
            }
          }
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Paramètres invalides - Vérifier le format des dates et des numéros'
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié - Token invalide ou manquant'
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Fonctionnalité premium requise (MOUVEMENTS_STOCK_BASIQUE)'
  })
  findAll(
    @Query('produitId') produitId?: string,
    @Query('typeMouvement') typeMouvement?: string,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.mouvementsStockService.findAll({
      produitId: produitId ? +produitId : undefined,
      typeMouvement,
      dateDebut,
      dateFin,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get('statistiques')
  @PremiumFeature(Feature.MOUVEMENTS_STOCK_BASIQUE)
  @ApiOperation({ 
    summary: 'Obtenir les statistiques des mouvements de stock',
    description: 'Retourne des statistiques agrégées sur les mouvements de stock : totaux par type, évolution temporelle, produits les plus mouvementés, etc.'
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques des mouvements récupérées avec succès',
    schema: {
      type: 'object',
      properties: {
        totalMouvements: {
          type: 'number',
          example: 1543,
          description: 'Nombre total de mouvements enregistrés'
        },
        mouvementsParType: {
          type: 'object',
          properties: {
            ENTREE: {
              type: 'object',
              properties: {
                nombre: {
                  type: 'number',
                  example: 645
                },
                quantiteTotale: {
                  type: 'number',
                  example: 12500
                }
              }
            },
            SORTIE: {
              type: 'object',
              properties: {
                nombre: {
                  type: 'number',
                  example: 723
                },
                quantiteTotale: {
                  type: 'number',
                  example: 11800
                }
              }
            },
            AJUSTEMENT: {
              type: 'object',
              properties: {
                nombre: {
                  type: 'number',
                  example: 125
                },
                quantiteTotale: {
                  type: 'number',
                  example: 450
                }
              }
            },
            RETOUR: {
              type: 'object',
              properties: {
                nombre: {
                  type: 'number',
                  example: 35
                },
                quantiteTotale: {
                  type: 'number',
                  example: 180
                }
              }
            },
            TRANSFERT: {
              type: 'object',
              properties: {
                nombre: {
                  type: 'number',
                  example: 15
                },
                quantiteTotale: {
                  type: 'number',
                  example: 250
                }
              }
            }
          }
        },
        mouvementsPar30Jours: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: {
                type: 'string',
                format: 'date',
                example: '2025-11-18'
              },
              entrees: {
                type: 'number',
                example: 12
              },
              sorties: {
                type: 'number',
                example: 15
              },
              ajustements: {
                type: 'number',
                example: 2
              }
            }
          },
          description: 'Évolution des mouvements sur les 30 derniers jours'
        },
        produitsLesPlusActifs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              produit: {
                type: 'object',
                properties: {
                  id: {
                    type: 'number',
                    example: 1
                  },
                  nom: {
                    type: 'string',
                    example: 'Ordinateur Portable'
                  },
                  reference: {
                    type: 'string',
                    example: 'ORD-001'
                  }
                }
              },
              nombreMouvements: {
                type: 'number',
                example: 87,
                description: 'Nombre total de mouvements pour ce produit'
              },
              quantiteTotaleEntree: {
                type: 'number',
                example: 450
              },
              quantiteTotaleSortie: {
                type: 'number',
                example: 423
              }
            }
          },
          description: 'Top 10 des produits avec le plus de mouvements'
        },
        stockActuelTotal: {
          type: 'number',
          example: 15234,
          description: 'Quantité totale en stock tous produits confondus'
        },
        valeurStockTotal: {
          type: 'number',
          example: 2450000.50,
          description: 'Valeur totale du stock en devise'
        },
        mouvementsAujourdHui: {
          type: 'number',
          example: 23,
          description: 'Nombre de mouvements effectués aujourd\'hui'
        },
        dernierMouvement: {
          type: 'object',
          properties: {
            id: {
              type: 'number',
              example: 1543
            },
            typeMouvement: {
              type: 'string',
              example: 'SORTIE'
            },
            produit: {
              type: 'string',
              example: 'Ordinateur Portable'
            },
            quantite: {
              type: 'number',
              example: 5
            },
            dateCreation: {
              type: 'string',
              format: 'date-time',
              example: '2025-11-18T14:30:00Z'
            }
          },
          description: 'Dernier mouvement enregistré'
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
    description: 'Accès refusé - Fonctionnalité premium requise (MOUVEMENTS_STOCK_BASIQUE)'
  })
  getStatistiques() {
    return this.mouvementsStockService.getStatistiques();
  }

  // ==========================================
  // ROUTES SUPPLÉMENTAIRES
  // ==========================================

  @Get('recent')
  @PremiumFeature(Feature.MOUVEMENTS_STOCK_BASIQUE)
  @ApiOperation({ summary: 'Mouvements récents' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRecent(@Query('limit') limit?: string) {
    return this.mouvementsStockService.getRecent(limit ? +limit : 10);
  }

  @Get('par-type')
  @PremiumFeature(Feature.MOUVEMENTS_STOCK_BASIQUE)
  @ApiOperation({ summary: 'Mouvements regroupés par type' })
  getParType() {
    return this.mouvementsStockService.getParType();
  }

  @Get('export')
  @PremiumFeature(Feature.MOUVEMENTS_STOCK_BASIQUE)
  @ApiOperation({ summary: 'Exporter les mouvements' })
  @ApiQuery({ name: 'format', enum: ['csv', 'excel', 'pdf'], required: false })
  @ApiQuery({ name: 'produitId', required: false, type: Number })
  @ApiQuery({ name: 'entrepotId', required: false, type: Number })
  @ApiQuery({ name: 'typeMouvement', required: false })
  @ApiQuery({ name: 'dateDebut', required: false })
  @ApiQuery({ name: 'dateFin', required: false })
  @ApiProduces('text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf')
  async export(
    @Query('format') format: string = 'excel',
    @Query('produitId') produitId?: string,
    @Query('entrepotId') entrepotId?: string,
    @Query('typeMouvement') typeMouvement?: string,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Res() res?: Response,
  ) {
    // Simplified export - just return data for now
    const data = await this.mouvementsStockService.findAll({
      produitId: produitId ? +produitId : undefined,
      entrepotId: entrepotId ? +entrepotId : undefined,
      typeMouvement,
      dateDebut,
      dateFin,
    });
    
    if (res) {
      res.json(data);
    }
    return data;
  }

  @Get('produit/:produitId')
  @PremiumFeature(Feature.MOUVEMENTS_STOCK_BASIQUE)
  @ApiOperation({ summary: 'Mouvements d\'un produit' })
  @ApiParam({ name: 'produitId', type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getByProduit(
    @Param('produitId', ParseIntPipe) produitId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.mouvementsStockService.findAll({
      produitId,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get('entrepot/:entrepotId')
  @PremiumFeature(Feature.MOUVEMENTS_STOCK_BASIQUE)
  @ApiOperation({ summary: 'Mouvements d\'un entrepôt' })
  @ApiParam({ name: 'entrepotId', type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getByEntrepot(
    @Param('entrepotId', ParseIntPipe) entrepotId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.mouvementsStockService.findAll({
      entrepotId,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get('type/:type')
  @PremiumFeature(Feature.MOUVEMENTS_STOCK_BASIQUE)
  @ApiOperation({ summary: 'Mouvements par type' })
  @ApiParam({ name: 'type', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getByType(
    @Param('type') type: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.mouvementsStockService.findAll({
      typeMouvement: type,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get(':id')
  @PremiumFeature(Feature.MOUVEMENTS_STOCK_BASIQUE)
  @ApiOperation({ summary: 'Détails d\'un mouvement' })
  @ApiParam({ name: 'id', type: Number })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.mouvementsStockService.findOne(id);
  }
}