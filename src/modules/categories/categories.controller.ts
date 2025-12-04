import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { PremiumFeature } from '../../common/decorators/premium-feature.decorator';
import { Feature } from '../../common/enums/features.enum';

@ApiTags('Categories')
@ApiBearerAuth('JWT-auth')
@Controller('categories')
@UseGuards(AuthGuard, PremiumGuard)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @PremiumFeature(Feature.GESTION_CATEGORIES)
  @ApiOperation({ 
    summary: 'Créer une nouvelle catégorie',
    description: `
      Crée une nouvelle catégorie de produits dans le système.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Structure hiérarchique:**
      - Une catégorie peut être une catégorie racine (sans parent)
      - Une catégorie peut être une sous-catégorie (avec un parent)
      - Niveaux illimités de hiérarchie possibles
      
      **Exemples de hiérarchie:**
      \`\`\`
      Électronique (parent: null)
      ├── Ordinateurs (parent: Électronique)
      │   ├── Laptops (parent: Ordinateurs)
      │   └── Desktop (parent: Ordinateurs)
      └── Téléphones (parent: Électronique)
          ├── Smartphones (parent: Téléphones)
          └── Feature Phones (parent: Téléphones)
      \`\`\`
      
      **Validation:**
      - Le nom est requis (minimum 2 caractères)
      - Si categorieParenteId est fourni, la catégorie parente doit exister
    `
  })
  @ApiBody({
    type: CreateCategoryDto,
    examples: {
      racine: {
        summary: 'Catégorie racine (niveau 0)',
        value: {
          nom: 'Électronique',
          description: 'Tous les produits électroniques'
        }
      },
      sousCategorie: {
        summary: 'Sous-catégorie (niveau 1)',
        value: {
          nom: 'Ordinateurs',
          description: 'Ordinateurs portables et de bureau',
          categorieParenteId: 1
        }
      },
      sousSousCategorie: {
        summary: 'Sous-sous-catégorie (niveau 2)',
        value: {
          nom: 'Laptops Gaming',
          description: 'Ordinateurs portables dédiés au gaming',
          categorieParenteId: 2
        }
      }
    }
  })
  @ApiResponse({ 
    description: 'Catégorie créée avec succès',
    schema: {
      example: {
        id: 3,
        nom: 'Ordinateurs',
        description: 'Ordinateurs portables et de bureau',
        categorieParenteId: 1,
        dateCreation: '2024-11-18T10:00:00.000Z',
        categorieParente: {
          id: 1,
          nom: 'Électronique'
        },
        sousCategories: []
      }
    }
  })
  @ApiNotFoundResponse({ 
    description: 'Catégorie parente non trouvée',
    schema: {
      example: {
        statusCode: 404,
        message: 'Catégorie parente non trouvée',
        error: 'Not Found'
      }
    }
  })
  @ApiBadRequestResponse({ description: 'Données invalides' })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  @ApiForbiddenResponse({ description: 'Accès refusé - Nécessite abonnement FREE ou PREMIUM' })
  create(@Body() createCategoryDto: CreateCategoryDto) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  @PremiumFeature(Feature.GESTION_CATEGORIES)
  @ApiOperation({ 
    summary: 'Lister toutes les catégories',
    description: `
      Récupère la liste complète de toutes les catégories avec leurs relations.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Structure plate:**
      - Liste simple de toutes les catégories
      - Chaque catégorie contient sa référence vers son parent
      - Chaque catégorie contient la liste de ses enfants directs
      
      **Informations incluses:**
      - Catégorie parente (si existe)
      - Sous-catégories directes
      - Nombre de produits dans cette catégorie
      
      **Tri:**
      - Par nom (ordre alphabétique)
      
      **Alternative:**
      - Pour une vue hiérarchique, utilisez GET /categories/tree
    `
  })
  @ApiResponse({ 
    description: 'Liste de toutes les catégories',
    schema: {
      example: [
        {
          id: 1,
          nom: 'Électronique',
          description: 'Produits électroniques',
          categorieParenteId: null,
          categorieParente: null,
          sousCategories: [
            { id: 2, nom: 'Ordinateurs' },
            { id: 5, nom: 'Téléphones' }
          ],
          _count: {
            produits: 45
          }
        },
        {
          id: 2,
          nom: 'Ordinateurs',
          description: 'Ordinateurs et accessoires',
          categorieParenteId: 1,
          categorieParente: {
            id: 1,
            nom: 'Électronique'
          },
          sousCategories: [
            { id: 3, nom: 'Laptops' },
            { id: 4, nom: 'Desktop' }
          ],
          _count: {
            produits: 12
          }
        },
        {
          id: 9,
          nom: 'Vêtements',
          description: 'Articles vestimentaires',
          categorieParenteId: null,
          categorieParente: null,
          sousCategories: [
            { id: 10, nom: 'Hommes' },
            { id: 13, nom: 'Femmes' }
          ],
          _count: {
            produits: 230
          }
        }
      ]
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  findAll() {
    return this.categoriesService.findAll();
  }

  @Get('tree')
  @PremiumFeature(Feature.GESTION_CATEGORIES)
  @ApiOperation({ 
    summary: 'Obtenir l\'arbre hiérarchique des catégories',
    description: `
      Récupère les catégories organisées en arborescence hiérarchique.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Structure arborescente:**
      - Uniquement les catégories racines au premier niveau
      - Chaque catégorie contient ses sous-catégories imbriquées
      - Navigation récursive jusqu'à 3 niveaux de profondeur
      
      **Cas d'usage:**
      - Menu de navigation
      - Sélecteur de catégories
      - Affichage hiérarchique dans l'interface
      
      **Avantages:**
      - Structure claire parent-enfant
      - Facile à transformer en menu déroulant
      - Visualisation de la hiérarchie complète
      
      **Exemple de structure:**
      \`\`\`
      [
        {
          id: 1,
          nom: "Électronique",
          sousCategories: [
            {
              id: 2,
              nom: "Ordinateurs",
              sousCategories: [
                { id: 3, nom: "Laptops" },
                { id: 4, nom: "Desktop" }
              ]
            }
          ]
        }
      ]
      \`\`\`
    `
  })
  @ApiResponse({ 
    description: 'Arbre hiérarchique des catégories',
    schema: {
      example: [
        {
          id: 1,
          nom: 'Électronique',
          description: 'Produits électroniques',
          sousCategories: [
            {
              id: 2,
              nom: 'Ordinateurs',
              description: 'Ordinateurs et accessoires',
              sousCategories: [
                {
                  id: 3,
                  nom: 'Laptops',
                  description: 'Ordinateurs portables',
                  sousCategories: []
                },
                {
                  id: 4,
                  nom: 'Desktop',
                  description: 'Ordinateurs de bureau',
                  sousCategories: []
                }
              ]
            },
            {
              id: 5,
              nom: 'Téléphones',
              description: 'Téléphones mobiles',
              sousCategories: [
                {
                  id: 6,
                  nom: 'Smartphones',
                  description: 'Téléphones intelligents',
                  sousCategories: []
                }
              ]
            }
          ],
          _count: {
            produits: 45
          }
        },
        {
          id: 9,
          nom: 'Vêtements',
          description: 'Articles vestimentaires',
          sousCategories: [
            {
              id: 10,
              nom: 'Hommes',
              sousCategories: [
                { id: 11, nom: 'Chemises', sousCategories: [] },
                { id: 12, nom: 'Pantalons', sousCategories: [] }
              ]
            }
          ],
          _count: {
            produits: 230
          }
        }
      ]
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  findTree() {
    return this.categoriesService.findTree();
  }

  @Get('statistiques')
  @PremiumFeature(Feature.GESTION_CATEGORIES)
  @ApiOperation({ 
    summary: 'Obtenir les statistiques des catégories',
    description: `
      Retourne un résumé statistique du système de catégories.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Métriques incluses:**
      - Nombre total de catégories
      - Nombre de catégories racines (niveau 0)
      - Nombre de catégories contenant des produits
      - Nombre de catégories vides (sans produits)
      
      **Utilité:**
      - Dashboard de gestion
      - Audit de la structure des catégories
      - Identification des catégories inutilisées
      - Planification de réorganisation
      
      **Recommandations:**
      - Les catégories vides peuvent être supprimées
      - Vérifier régulièrement l'utilisation des catégories
    `
  })
  @ApiResponse({ 
    description: 'Statistiques des catégories',
    schema: {
      example: {
        totalCategories: 25,
        categoriesRacines: 5,
        categoriesAvecProduits: 18,
        categoriesVides: 7
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  getStatistiques() {
    return this.categoriesService.getStatistiques();
  }

  @Get(':id')
  @PremiumFeature(Feature.GESTION_CATEGORIES)
  @ApiOperation({ 
    summary: 'Obtenir les détails d\'une catégorie',
    description: `
      Récupère toutes les informations d'une catégorie spécifique.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Informations incluses:**
      - Toutes les données de la catégorie
      - Catégorie parente (si existe)
      - Liste des sous-catégories directes
      - 10 premiers produits de cette catégorie
      - Compteurs:
        * Nombre total de produits
        * Nombre de sous-catégories
      
      **Utilité:**
      - Page détaillée d'une catégorie
      - Navigation dans la hiérarchie
      - Gestion des produits par catégorie
    `
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID de la catégorie', example: 2 })
  @ApiResponse({ 
    description: 'Détails complets de la catégorie',
    schema: {
      example: {
        id: 2,
        nom: 'Ordinateurs',
        description: 'Ordinateurs et accessoires',
        categorieParenteId: 1,
        dateCreation: '2024-11-15T10:00:00.000Z',
        categorieParente: {
          id: 1,
          nom: 'Électronique',
          description: 'Produits électroniques'
        },
        sousCategories: [
          {
            id: 3,
            nom: 'Laptops',
            description: 'Ordinateurs portables'
          },
          {
            id: 4,
            nom: 'Desktop',
            description: 'Ordinateurs de bureau'
          }
        ],
        produits: [
          {
            id: 1,
            reference: 'LAPTOP-001',
            nom: 'Dell XPS 15',
            quantiteStock: 10,
            prixVente: 1200
          },
          {
            id: 7,
            reference: 'LAPTOP-002',
            nom: 'MacBook Pro 16"',
            quantiteStock: 5,
            prixVente: 2500
          }
        ],
        _count: {
          produits: 12,
          sousCategories: 2
        }
      }
    }
  })
  @ApiNotFoundResponse({ 
    description: 'Catégorie non trouvée',
    schema: {
      example: {
        statusCode: 404,
        message: 'Catégorie #999 non trouvée',
        error: 'Not Found'
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.findOne(id);
  }

  @Patch(':id')
  @PremiumFeature(Feature.GESTION_CATEGORIES)
  @ApiOperation({ 
    summary: 'Mettre à jour une catégorie',
    description: `
      Modifie les informations d'une catégorie existante.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Champs modifiables:**
      - Nom
      - Description
      - Catégorie parente (permet de réorganiser la hiérarchie)
      
      **Validation:**
      - Une catégorie ne peut pas être son propre parent
      - Si categorieParenteId est modifié, la nouvelle catégorie parente doit exister
      
      **⚠️ Attention - Changement de parent:**
      - Modifier le parent déplace toute la sous-arborescence
      - Exemple: Si "Laptops" passe de parent "Ordinateurs" à "Portables",
        toutes les sous-catégories de "Laptops" suivent
      
      **Cas d'usage:**
      - Renommer une catégorie
      - Corriger une description
      - Réorganiser la hiérarchie
      - Transformer une sous-catégorie en catégorie racine (parent: null)
    `
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID de la catégorie', example: 2 })
  @ApiBody({
    type: UpdateCategoryDto,
    examples: {
      nom: {
        summary: 'Modifier uniquement le nom',
        value: {
          nom: 'Ordinateurs et Tablettes'
        }
      },
      description: {
        summary: 'Modifier la description',
        value: {
          description: 'Tous types d\'ordinateurs : portables, de bureau, et tablettes'
        }
      },
      parent: {
        summary: 'Changer de catégorie parente',
        value: {
          categorieParenteId: 5
        }
      },
      racine: {
        summary: 'Transformer en catégorie racine',
        value: {
          categorieParenteId: null
        }
      },
      complet: {
        summary: 'Modification complète',
        value: {
          nom: 'Informatique',
          description: 'Matériel et équipement informatique',
          categorieParenteId: 1
        }
      }
    }
  })
  @ApiResponse({ 
    description: 'Catégorie mise à jour avec succès',
    schema: {
      example: {
        id: 2,
        nom: 'Ordinateurs et Tablettes',
        description: 'Tous types d\'ordinateurs',
        categorieParenteId: 1,
        categorieParente: {
          id: 1,
          nom: 'Électronique'
        },
        sousCategories: [
          { id: 3, nom: 'Laptops' },
          { id: 4, nom: 'Desktop' }
        ]
      }
    }
  })
  @ApiNotFoundResponse({ description: 'Catégorie non trouvée' })
  @ApiBadRequestResponse({ 
    description: 'Validation échouée',
    schema: {
      example: {
        statusCode: 400,
        message: 'Une catégorie ne peut pas être son propre parent',
        error: 'Bad Request'
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @PremiumFeature(Feature.GESTION_CATEGORIES)
  @ApiOperation({ 
    summary: 'Supprimer une catégorie',
    description: `
      Supprime définitivement une catégorie du système.
      
      **Fonctionnalité:** 🆓 FREE
      
      **⚠️ Restrictions importantes:**
      - Impossible de supprimer une catégorie contenant des produits
      - Les produits doivent d'abord être déplacés ou supprimés
      
      **Comportement avec les sous-catégories:**
      - Si la catégorie a des sous-catégories, celles-ci deviennent orphelines
      - Les sous-catégories sont automatiquement transformées en catégories racines
      - Configuration: ON DELETE SET NULL
      
      **Exemple:**
      \`\`\`
      Avant suppression:
      Électronique (id: 1)
      └── Ordinateurs (id: 2)
          └── Laptops (id: 3)
      
      Après suppression de "Électronique":
      Ordinateurs (id: 2, parent: null) // Devient racine
      └── Laptops (id: 3, parent: 2)    // Garde son parent
      \`\`\`
      
      **Recommandation:**
      - Vérifier d'abord s'il y a des produits (GET /categories/:id)
      - Déplacer les produits vers une autre catégorie
      - Puis supprimer la catégorie vide
      
      **Alternative:**
      - Plutôt que supprimer, archiver en renommant
      - Ex: "Ordinateurs (Obsolète)"
    `
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID de la catégorie', example: 5 })
  @ApiResponse({ 
    description: 'Catégorie supprimée avec succès',
    schema: {
      example: {
        id: 5,
        nom: 'Catégorie Vide',
        message: 'Catégorie supprimée avec succès'
      }
    }
  })
  @ApiNotFoundResponse({ description: 'Catégorie non trouvée' })
  @ApiBadRequestResponse({ 
    description: 'Impossible de supprimer - contient des produits',
    schema: {
      example: {
        statusCode: 400,
        message: 'Impossible de supprimer cette catégorie car elle contient 12 produit(s)',
        error: 'Bad Request'
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categoriesService.remove(id);
  }
}