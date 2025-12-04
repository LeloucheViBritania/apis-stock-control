import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam, ApiBearerAuth, ApiSecurity, ApiBody } from '@nestjs/swagger';
import { FournisseursService } from './fournisseurs.service';
import { CreateFournisseurDto } from './dto/create-fournisseur.dto';
import { UpdateFournisseurDto } from './dto/update-fournisseur.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { PremiumFeature } from '../../common/decorators/premium-feature.decorator';
import { Feature } from '../../common/enums/features.enum';

@ApiTags('Fournisseurs')
@ApiBearerAuth()
@ApiSecurity('premium-access')
@Controller('fournisseurs')
@UseGuards(AuthGuard, PremiumGuard)
export class FournisseursController {
  constructor(private readonly fournisseursService: FournisseursService) {}

  @Post()
  @PremiumFeature(Feature.GESTION_FOURNISSEURS)
  @ApiOperation({ 
    summary: 'Créer un nouveau fournisseur',
    description: 'Permet de créer un nouveau fournisseur avec toutes ses informations de contact et commerciales'
  })
  @ApiBody({
    type: CreateFournisseurDto,
    description: 'Données du fournisseur à créer',
    examples: {
      exemple1: {
        summary: 'Fournisseur complet',
        value: {
          nom: 'Fournisseur ABC',
          email: 'contact@fournisseur-abc.com',
          telephone: '+225 07 12 34 56 78',
          adresse: '123 Boulevard de la République, Abidjan',
          ville: 'Abidjan',
          pays: 'Côte d\'Ivoire',
          contact: 'M. Kouassi Jean',
          notes: 'Fournisseur principal pour l\'électronique',
          estActif: true
        }
      }
    }
  })
  @ApiResponse({
    status: 201,
    description: 'Fournisseur créé avec succès',
    schema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          example: 1
        },
        nom: {
          type: 'string',
          example: 'Fournisseur ABC'
        },
        email: {
          type: 'string',
          example: 'contact@fournisseur-abc.com'
        },
        telephone: {
          type: 'string',
          example: '+225 07 12 34 56 78'
        },
        adresse: {
          type: 'string',
          example: '123 Boulevard de la République, Abidjan'
        },
        ville: {
          type: 'string',
          example: 'Abidjan'
        },
        pays: {
          type: 'string',
          example: 'Côte d\'Ivoire'
        },
        contact: {
          type: 'string',
          example: 'M. Kouassi Jean'
        },
        notes: {
          type: 'string',
          example: 'Fournisseur principal pour l\'électronique'
        },
        estActif: {
          type: 'boolean',
          example: true
        },
        dateCreation: {
          type: 'string',
          format: 'date-time',
          example: '2025-11-18T10:30:00Z'
        },
        dateMiseAJour: {
          type: 'string',
          format: 'date-time',
          example: '2025-11-18T10:30:00Z'
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides - Vérifier les champs obligatoires et leur format'
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié - Token invalide ou manquant'
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Fonctionnalité premium requise (GESTION_FOURNISSEURS)'
  })
  @ApiResponse({
    status: 409,
    description: 'Conflit - Un fournisseur avec cet email existe déjà'
  })
  create(@Body() createFournisseurDto: CreateFournisseurDto) {
    return this.fournisseursService.create(createFournisseurDto);
  }

  @Get()
  @PremiumFeature(Feature.GESTION_FOURNISSEURS)
  @ApiOperation({ 
    summary: 'Obtenir la liste des fournisseurs',
    description: 'Retourne la liste de tous les fournisseurs avec possibilité de filtrage par statut actif et recherche textuelle'
  })
  @ApiQuery({
    name: 'estActif',
    required: false,
    type: String,
    description: 'Filtrer par statut actif (true/false)',
    example: 'true'
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Rechercher par nom, email, téléphone ou contact',
    example: 'ABC'
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des fournisseurs récupérée avec succès',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'number',
            example: 1
          },
          nom: {
            type: 'string',
            example: 'Fournisseur ABC'
          },
          email: {
            type: 'string',
            example: 'contact@fournisseur-abc.com'
          },
          telephone: {
            type: 'string',
            example: '+225 07 12 34 56 78'
          },
          adresse: {
            type: 'string',
            example: '123 Boulevard de la République, Abidjan'
          },
          ville: {
            type: 'string',
            example: 'Abidjan'
          },
          pays: {
            type: 'string',
            example: 'Côte d\'Ivoire'
          },
          contact: {
            type: 'string',
            example: 'M. Kouassi Jean'
          },
          estActif: {
            type: 'boolean',
            example: true
          },
          nombreProduits: {
            type: 'number',
            example: 15,
            description: 'Nombre de produits associés à ce fournisseur'
          },
          dateCreation: {
            type: 'string',
            format: 'date-time',
            example: '2025-11-18T10:30:00Z'
          },
          dateMiseAJour: {
            type: 'string',
            format: 'date-time',
            example: '2025-11-18T10:30:00Z'
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
    description: 'Accès refusé - Fonctionnalité premium requise (GESTION_FOURNISSEURS)'
  })
  findAll(@Query('estActif') estActif?: string, @Query('search') search?: string) {
    return this.fournisseursService.findAll({
      estActif: estActif ? estActif === 'true' : undefined,
      search,
    });
  }

  @Get(':id')
  @PremiumFeature(Feature.GESTION_FOURNISSEURS)
  @ApiOperation({ 
    summary: 'Obtenir les détails d\'un fournisseur',
    description: 'Retourne toutes les informations d\'un fournisseur spécifique, incluant la liste de ses produits'
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Identifiant unique du fournisseur',
    example: 1
  })
  @ApiResponse({
    status: 200,
    description: 'Détails du fournisseur récupérés avec succès',
    schema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          example: 1
        },
        nom: {
          type: 'string',
          example: 'Fournisseur ABC'
        },
        email: {
          type: 'string',
          example: 'contact@fournisseur-abc.com'
        },
        telephone: {
          type: 'string',
          example: '+225 07 12 34 56 78'
        },
        adresse: {
          type: 'string',
          example: '123 Boulevard de la République, Abidjan'
        },
        ville: {
          type: 'string',
          example: 'Abidjan'
        },
        pays: {
          type: 'string',
          example: 'Côte d\'Ivoire'
        },
        contact: {
          type: 'string',
          example: 'M. Kouassi Jean'
        },
        notes: {
          type: 'string',
          example: 'Fournisseur principal pour l\'électronique'
        },
        estActif: {
          type: 'boolean',
          example: true
        },
        produits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: {
                type: 'number',
                example: 10
              },
              nom: {
                type: 'string',
                example: 'Ordinateur Portable'
              },
              reference: {
                type: 'string',
                example: 'ORD-001'
              },
              quantite: {
                type: 'number',
                example: 25
              }
            }
          }
        },
        dateCreation: {
          type: 'string',
          format: 'date-time',
          example: '2025-11-18T10:30:00Z'
        },
        dateMiseAJour: {
          type: 'string',
          format: 'date-time',
          example: '2025-11-18T10:30:00Z'
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
    description: 'Accès refusé - Fonctionnalité premium requise (GESTION_FOURNISSEURS)'
  })
  @ApiResponse({
    status: 404,
    description: 'Fournisseur non trouvé'
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.fournisseursService.findOne(id);
  }

  @Patch(':id')
  @PremiumFeature(Feature.GESTION_FOURNISSEURS)
  @ApiOperation({ 
    summary: 'Mettre à jour un fournisseur',
    description: 'Permet de modifier les informations d\'un fournisseur existant. Tous les champs sont optionnels.'
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Identifiant unique du fournisseur à modifier',
    example: 1
  })
  @ApiBody({
    type: UpdateFournisseurDto,
    description: 'Données à mettre à jour (tous les champs sont optionnels)',
    examples: {
      exemple1: {
        summary: 'Mise à jour partielle',
        value: {
          telephone: '+225 07 98 76 54 32',
          estActif: false,
          notes: 'Fournisseur temporairement inactif'
        }
      },
      exemple2: {
        summary: 'Mise à jour complète',
        value: {
          nom: 'Fournisseur ABC International',
          email: 'international@fournisseur-abc.com',
          telephone: '+225 07 12 34 56 78',
          adresse: '456 Avenue du Commerce, Abidjan',
          ville: 'Abidjan',
          pays: 'Côte d\'Ivoire',
          contact: 'Mme. Diallo Fatoumata',
          notes: 'Extension internationale du fournisseur',
          estActif: true
        }
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'Fournisseur mis à jour avec succès',
    schema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          example: 1
        },
        nom: {
          type: 'string',
          example: 'Fournisseur ABC International'
        },
        email: {
          type: 'string',
          example: 'international@fournisseur-abc.com'
        },
        telephone: {
          type: 'string',
          example: '+225 07 12 34 56 78'
        },
        adresse: {
          type: 'string',
          example: '456 Avenue du Commerce, Abidjan'
        },
        ville: {
          type: 'string',
          example: 'Abidjan'
        },
        pays: {
          type: 'string',
          example: 'Côte d\'Ivoire'
        },
        contact: {
          type: 'string',
          example: 'Mme. Diallo Fatoumata'
        },
        notes: {
          type: 'string',
          example: 'Extension internationale du fournisseur'
        },
        estActif: {
          type: 'boolean',
          example: true
        },
        dateCreation: {
          type: 'string',
          format: 'date-time',
          example: '2025-11-18T10:30:00Z'
        },
        dateMiseAJour: {
          type: 'string',
          format: 'date-time',
          example: '2025-11-18T14:45:00Z'
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides - Vérifier le format des champs'
  })
  @ApiResponse({
    status: 401,
    description: 'Non authentifié - Token invalide ou manquant'
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Fonctionnalité premium requise (GESTION_FOURNISSEURS)'
  })
  @ApiResponse({
    status: 404,
    description: 'Fournisseur non trouvé'
  })
  @ApiResponse({
    status: 409,
    description: 'Conflit - L\'email est déjà utilisé par un autre fournisseur'
  })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateFournisseurDto: UpdateFournisseurDto) {
    return this.fournisseursService.update(id, updateFournisseurDto);
  }

  @Delete(':id')
  @PremiumFeature(Feature.GESTION_FOURNISSEURS)
  @ApiOperation({ 
    summary: 'Supprimer un fournisseur',
    description: 'Supprime définitivement un fournisseur. Attention : cette action est irréversible. Les produits associés ne seront pas supprimés mais n\'auront plus de fournisseur lié.'
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Identifiant unique du fournisseur à supprimer',
    example: 1
  })
  @ApiResponse({
    status: 200,
    description: 'Fournisseur supprimé avec succès',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Fournisseur supprimé avec succès'
        },
        id: {
          type: 'number',
          example: 1
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
    description: 'Accès refusé - Fonctionnalité premium requise (GESTION_FOURNISSEURS)'
  })
  @ApiResponse({
    status: 404,
    description: 'Fournisseur non trouvé'
  })
  @ApiResponse({
    status: 409,
    description: 'Impossible de supprimer - Le fournisseur a des commandes en cours ou des produits associés avec des contraintes'
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.fournisseursService.remove(id);
  }


  @Get(':id/produits')
  @PremiumFeature(Feature.GESTION_FOURNISSEURS)
  @ApiOperation({ 
    summary: 'Obtenir les produits d\'un fournisseur',
    description: 'Retourne la liste de tous les produits associés à un fournisseur avec leurs conditions commerciales'
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Identifiant du fournisseur',
    example: 1
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des produits du fournisseur récupérée avec succès',
    schema: {
      type: 'object',
      properties: {
        fournisseur: {
          type: 'object',
          properties: {
            id: { type: 'number', example: 1 },
            nom: { type: 'string', example: 'Fournisseur ABC' },
            personneContact: { type: 'string', example: 'M. Kouassi Jean' },
            email: { type: 'string', example: 'contact@fournisseur-abc.com' },
            telephone: { type: 'string', example: '+225 07 12 34 56 78' },
          },
        },
        produits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number', example: 1 },
              nom: { type: 'string', example: 'Ordinateur Portable' },
              reference: { type: 'string', example: 'ORD-001' },
              quantiteStock: { type: 'number', example: 50 },
              prixVente: { type: 'number', example: 650000 },
              referenceFournisseur: { type: 'string', example: 'FREF-ORD-001' },
              delaiLivraisonJours: { type: 'number', example: 7 },
              quantiteMinimumCommande: { type: 'number', example: 10 },
              prixUnitaire: { type: 'number', example: 450000 },
              estPrefere: { type: 'boolean', example: true },
              categorie: {
                type: 'object',
                properties: {
                  id: { type: 'number', example: 1 },
                  nom: { type: 'string', example: 'Électronique' },
                },
              },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Fournisseur non trouvé' })
  getProduits(@Param('id', ParseIntPipe) id: number) {
    return this.fournisseursService.getProduits(id);
  }
}