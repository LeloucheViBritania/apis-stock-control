// ============================================
// FICHIER: src/modules/produits/produits.controller.ts
// Controller Produits avec documentation Swagger complète
// ============================================

import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { ProduitsService } from './produits.service';
import { CreateProduitDto } from './dto/create-produit.dto';
import { UpdateProduitDto } from './dto/update-produit.dto';
import { AjusterStockDto } from './dto/ajuster-stock.dto';
import { AjouterFournisseurDto } from './dto/create-produit-fournisseur.dto';
import { ModifierFournisseurDto } from './dto/update-produit-fournisseur.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { PremiumFeature } from '../../common/decorators/premium-feature.decorator';
import { Feature } from '../../common/enums/features.enum';

@ApiTags('Produits')
@ApiBearerAuth('JWT-auth')
@Controller('produits')
@UseGuards(AuthGuard, PremiumGuard)
export class ProduitsController {
  constructor(private readonly produitsService: ProduitsService) {}

  @Post()
  @PremiumFeature(Feature.GESTION_PRODUITS)
  @ApiOperation({ 
    summary: 'Créer un nouveau produit',
    description: `
      Crée un nouveau produit dans le système avec toutes ses informations.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Champs requis:**
      - Référence (unique)
      - Nom
      
      **Validation:**
      - La référence doit être unique dans le système
      - Le niveau de stock minimum doit être ≥ 0
      - Les prix doivent être positifs
      
      **Automatique:**
      - Date de création
      - Stock initial à 0 si non spécifié
      - Statut actif par défaut
    `
  })
  @ApiBody({
    type: CreateProduitDto,
    examples: {
      laptop: {
        summary: 'Ordinateur portable',
        value: {
          reference: 'LAPTOP-001',
          nom: 'Dell XPS 15',
          description: 'Ordinateur portable haute performance',
          categorieId: 2,
          marque: 'Dell',
          uniteMesure: 'unite',
          poids: 2.5,
          coutUnitaire: 800,
          prixVente: 1200,
          niveauStockMin: 5,
          niveauStockMax: 50,
          quantiteStock: 10
        }
      },
      telephone: {
        summary: 'Smartphone',
        value: {
          reference: 'PHONE-001',
          nom: 'iPhone 14 Pro',
          description: 'Smartphone Apple dernière génération',
          categorieId: 5,
          marque: 'Apple',
          coutUnitaire: 900,
          prixVente: 1400,
          niveauStockMin: 10,
          quantiteStock: 25
        }
      }
    }
  })
  @ApiResponse({ 
    description: 'Produit créé avec succès',
    schema: {
      example: {
        id: 1,
        reference: 'LAPTOP-001',
        nom: 'Dell XPS 15',
        description: 'Ordinateur portable haute performance',
        categorieId: 2,
        marque: 'Dell',
        quantiteStock: 10,
        coutUnitaire: 800,
        prixVente: 1200,
        niveauStockMin: 5,
        estActif: true,
        dateCreation: '2024-11-18T10:00:00.000Z',
        categorie: {
          id: 2,
          nom: 'Ordinateurs'
        }
      }
    }
  })
  @ApiBadRequestResponse({ 
    description: 'Données invalides ou référence déjà existante',
    schema: {
      example: {
        statusCode: 400,
        message: 'Cette référence produit existe déjà',
        error: 'Bad Request'
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  @ApiForbiddenResponse({ description: 'Accès refusé - Nécessite abonnement FREE ou PREMIUM' })
  create(@Body() createProduitDto: CreateProduitDto) {
    return this.produitsService.create(createProduitDto);
  }

  @Get()
  @PremiumFeature(Feature.GESTION_PRODUITS)
  @ApiOperation({ 
    summary: 'Lister tous les produits',
    description: `
      Récupère la liste de tous les produits avec pagination et filtres.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Filtres disponibles:**
      - Par catégorie
      - Par statut (actif/inactif)
      - Recherche par nom, référence ou marque
      
      **Pagination:**
      - Par défaut: 50 résultats par page
      - Maximum recommandé: 100 résultats
      
      **Tri:**
      - Par nom (ordre alphabétique)
    `
  })
  @ApiQuery({ name: 'categorieId', required: false, type: Number, description: 'Filtrer par ID de catégorie', example: 2 })
  @ApiQuery({ name: 'estActif', required: false, type: Boolean, description: 'Filtrer par statut actif', example: true })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Rechercher dans nom, référence ou marque', example: 'Dell' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Numéro de page (commence à 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Nombre de résultats par page', example: 10 })
  @ApiResponse({ 
    description: 'Liste des produits avec pagination',
    schema: {
      example: {
        data: [
          {
            id: 1,
            reference: 'LAPTOP-001',
            nom: 'Dell XPS 15',
            marque: 'Dell',
            quantiteStock: 10,
            niveauStockMin: 5,
            prixVente: 1200,
            estActif: true,
            categorie: {
              id: 2,
              nom: 'Ordinateurs'
            }
          },
          {
            id: 2,
            reference: 'PHONE-001',
            nom: 'iPhone 14 Pro',
            marque: 'Apple',
            quantiteStock: 25,
            niveauStockMin: 10,
            prixVente: 1400,
            estActif: true,
            categorie: {
              id: 5,
              nom: 'Téléphones'
            }
          }
        ],
        meta: {
          total: 100,
          page: 1,
          limit: 10,
          totalPages: 10
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  findAll(
    @Query('categorieId') categorieId?: string,
    @Query('estActif') estActif?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.produitsService.findAll({
      categorieId: categorieId ? +categorieId : undefined,
      estActif: estActif ? estActif === 'true' : undefined,
      search,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get('statistiques')
  @PremiumFeature(Feature.GESTION_PRODUITS)
  @ApiOperation({ 
    summary: 'Obtenir les statistiques globales des produits',
    description: `
      Retourne un résumé statistique de tous les produits.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Informations incluses:**
      - Nombre total de produits
      - Nombre de produits actifs/inactifs
      - Nombre de produits en stock faible
      - Total des articles en stock
      - Valeur totale du stock (quantité × coût unitaire)
      
      **Utilité:**
      - Dashboard principal
      - Rapports de gestion
      - Vue d'ensemble rapide
    `
  })
  @ApiResponse({ 
    description: 'Statistiques des produits',
    schema: {
      example: {
        totalProduits: 150,
        produitsActifs: 145,
        produitsInactifs: 5,
        stockFaible: 12,
        totalArticlesEnStock: 5430,
        valeurTotaleStock: 1250000.50
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  getStatistiques() {
    return this.produitsService.getStatistiques();
  }

  @Get('stock-faible')
  @PremiumFeature(Feature.ALERTES_STOCK)
  @ApiOperation({ 
    summary: 'Obtenir les produits en stock faible',
    description: `
      Retourne tous les produits dont la quantité en stock est inférieure ou égale au niveau minimum défini.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Critère:**
      - quantiteStock ≤ niveauStockMin
      - Uniquement les produits actifs
      
      **Tri:**
      - Par quantité (du plus faible au plus élevé)
      
      **Utilité:**
      - Alertes de réapprovisionnement
      - Gestion préventive des ruptures de stock
      - Planification des commandes fournisseurs
    `
  })
  @ApiResponse({ 
    description: 'Liste des produits en stock faible',
    schema: {
      example: [
        {
          id: 5,
          reference: 'CABLE-USB-C',
          nom: 'Câble USB-C 2m',
          quantiteStock: 3,
          niveauStockMin: 20,
          prixVente: 15,
          categorie: {
            id: 8,
            nom: 'Accessoires'
          }
        },
        {
          id: 12,
          reference: 'MOUSE-WIRELESS',
          nom: 'Souris Sans Fil',
          quantiteStock: 5,
          niveauStockMin: 10,
          prixVente: 25,
          categorie: {
            id: 8,
            nom: 'Accessoires'
          }
        }
      ]
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  getStockFaible() {
    return this.produitsService.getStockFaible();
  }

  @Get('top')
  @PremiumFeature(Feature.GESTION_PRODUITS)
  @ApiOperation({ 
    summary: 'Obtenir les produits avec le plus de stock',
    description: `
      Retourne les produits ayant les quantités en stock les plus élevées.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Tri:**
      - Par quantité en stock décroissante
      
      **Limite:**
      - Par défaut: 10 produits
      - Maximum: 100 produits
      
      **Utilité:**
      - Identifier les produits sur-stockés
      - Planifier des promotions
      - Analyser la rotation des stocks
    `
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Nombre de résultats', example: 10 })
  @ApiResponse({ 
    description: 'Top produits par quantité en stock',
    schema: {
      example: [
        {
          id: 3,
          reference: 'TSHIRT-001',
          nom: 'T-Shirt Coton Blanc',
          quantiteStock: 500,
          niveauStockMin: 50,
          categorie: {
            id: 9,
            nom: 'Vêtements'
          }
        },
        {
          id: 7,
          reference: 'MASK-FFP2',
          nom: 'Masques FFP2 (Boîte de 50)',
          quantiteStock: 350,
          niveauStockMin: 100,
          categorie: {
            id: 15,
            nom: 'Protection'
          }
        }
      ]
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  getTopProduits(@Query('limit') limit?: string) {
    return this.produitsService.getTopProduits(limit ? +limit : 10);
  }

  @Get(':id')
  @PremiumFeature(Feature.GESTION_PRODUITS)
  @ApiOperation({ 
    summary: 'Obtenir les détails d\'un produit',
    description: `
      Récupère toutes les informations détaillées d'un produit spécifique.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Informations incluses:**
      - Toutes les données du produit
      - Informations de la catégorie
      - 10 derniers mouvements de stock
      - 5 dernières commandes contenant ce produit
      
      **Utilité:**
      - Fiche produit détaillée
      - Historique des mouvements
      - Analyse des ventes
    `
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID du produit', example: 1 })
  @ApiResponse({ 
    description: 'Détails complets du produit',
    schema: {
      example: {
        id: 1,
        reference: 'LAPTOP-001',
        nom: 'Dell XPS 15',
        description: 'Ordinateur portable haute performance',
        categorieId: 2,
        marque: 'Dell',
        uniteMesure: 'unite',
        poids: 2.5,
        quantiteStock: 10,
        niveauStockMin: 5,
        niveauStockMax: 50,
        coutUnitaire: 800,
        prixVente: 1200,
        estActif: true,
        dateCreation: '2024-11-18T10:00:00.000Z',
        categorie: {
          id: 2,
          nom: 'Ordinateurs',
          description: 'Ordinateurs et accessoires'
        },
        mouvementsStock: [
          {
            id: 15,
            typeMouvement: 'ENTREE',
            quantite: 10,
            raison: 'Réception commande fournisseur',
            dateMouvement: '2024-11-18T09:00:00.000Z',
            utilisateur: {
              id: 1,
              nomComplet: 'Administrateur'
            }
          }
        ],
        detailsCommande: [
          {
            id: 5,
            quantite: 2,
            prixUnitaire: 1200,
            commande: {
              numeroCommande: 'CMD-000001',
              dateCommande: '2024-11-17',
              statut: 'LIVRE'
            }
          }
        ]
      }
    }
  })
  @ApiNotFoundResponse({ 
    description: 'Produit non trouvé',
    schema: {
      example: {
        statusCode: 404,
        message: 'Produit #999 non trouvé',
        error: 'Not Found'
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.produitsService.findOne(id);
  }

  @Patch(':id')
  @PremiumFeature(Feature.GESTION_PRODUITS)
  @ApiOperation({ 
    summary: 'Mettre à jour un produit',
    description: `
      Modifie les informations d'un produit existant.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Champs modifiables:**
      - Toutes les informations du produit
      - La référence (doit rester unique)
      
      **Note:**
      - Seuls les champs fournis seront modifiés
      - Les autres champs restent inchangés
      - La date de modification est mise à jour automatiquement
      
      **Validation:**
      - Si la référence est modifiée, elle doit rester unique
    `
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID du produit', example: 1 })
  @ApiBody({
    type: UpdateProduitDto,
    examples: {
      prix: {
        summary: 'Modifier uniquement le prix',
        value: {
          prixVente: 1300
        }
      },
      stock: {
        summary: 'Modifier le stock et le niveau minimum',
        value: {
          quantiteStock: 25,
          niveauStockMin: 10
        }
      },
      complet: {
        summary: 'Modification complète',
        value: {
          nom: 'Dell XPS 15 (Modèle 2024)',
          description: 'Nouvelle génération avec processeur Intel Core i9',
          prixVente: 1400,
          quantiteStock: 15,
          niveauStockMin: 8
        }
      }
    }
  })
  @ApiResponse({ 
    description: 'Produit mis à jour avec succès',
    schema: {
      example: {
        id: 1,
        reference: 'LAPTOP-001',
        nom: 'Dell XPS 15',
        prixVente: 1300,
        quantiteStock: 15,
        dateModification: '2024-11-18T14:30:00.000Z'
      }
    }
  })
  @ApiNotFoundResponse({ description: 'Produit non trouvé' })
  @ApiBadRequestResponse({ description: 'Données invalides ou référence déjà utilisée' })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProduitDto: UpdateProduitDto,
  ) {
    return this.produitsService.update(id, updateProduitDto);
  }

  @Delete(':id')
  @PremiumFeature(Feature.GESTION_PRODUITS)
  @ApiOperation({ 
    summary: 'Supprimer un produit',
    description: `
      Supprime définitivement un produit du système.
      
      **Fonctionnalité:** 🆓 FREE
      
      **⚠️ Attention:**
      - Action irréversible
      - Toutes les données liées seront supprimées
      - Les mouvements de stock historiques seront conservés
      
      **Alternative recommandée:**
      - Désactiver le produit plutôt que le supprimer
      - PATCH /produits/:id avec { estActif: false }
      
      **Vérifications:**
      - Le produit ne doit pas avoir de commandes en cours
    `
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID du produit', example: 1 })
  @ApiResponse({ 
    description: 'Produit supprimé avec succès',
    schema: {
      example: {
        id: 1,
        reference: 'LAPTOP-001',
        nom: 'Dell XPS 15',
        message: 'Produit supprimé avec succès'
      }
    }
  })
  @ApiNotFoundResponse({ description: 'Produit non trouvé' })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.produitsService.remove(id);
  }

  @Post(':id/ajuster-stock')
  @PremiumFeature(Feature.MOUVEMENTS_STOCK_BASIQUE)
  @ApiOperation({ 
    summary: 'Ajuster manuellement le stock d\'un produit',
    description: `
      Ajoute ou retire du stock d'un produit et crée automatiquement un mouvement de stock pour traçabilité.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Types d'ajustement:**
      - **entree**: Augmente le stock (réception, retour client, correction)
      - **sortie**: Diminue le stock (vente, perte, casse, don)
      
      **Traçabilité:**
      - Chaque ajustement crée un enregistrement dans mouvements_stock
      - L'utilisateur qui effectue l'action est enregistré
      - La date et l'heure sont automatiquement enregistrées
      
      **Protection:**
      - Le stock ne peut pas devenir négatif
      - Si sortie > stock disponible, le stock devient 0
      
      **Cas d'usage:**
      - Réception de marchandises
      - Inventaire physique (correction)
      - Perte ou casse de produits
      - Retour client
    `
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID du produit', example: 1 })
  @ApiBody({
    type: AjusterStockDto,
    examples: {
      reception: {
        summary: 'Réception de marchandises (entrée)',
        value: {
          quantite: 50,
          type: 'entree',
          raison: 'Réception commande fournisseur TechSupply',
          notes: 'Bon de livraison BL-2024-1234'
        }
      },
      vente: {
        summary: 'Vente (sortie)',
        value: {
          quantite: 3,
          type: 'sortie',
          raison: 'Vente client',
          notes: 'Commande CMD-000015'
        }
      },
      casse: {
        summary: 'Produit endommagé (sortie)',
        value: {
          quantite: 2,
          type: 'sortie',
          raison: 'Produit endommagé lors du transport',
          notes: 'Déclaration sinistre #2024-456'
        }
      },
      inventaire: {
        summary: 'Correction inventaire (entrée)',
        value: {
          quantite: 5,
          type: 'entree',
          raison: 'Correction après inventaire physique',
          notes: 'Différence trouvée lors du comptage du 18/11/2024'
        }
      }
    }
  })
  @ApiResponse({ 
    description: 'Stock ajusté avec succès',
    schema: {
      example: {
        id: 1,
        reference: 'LAPTOP-001',
        nom: 'Dell XPS 15',
        quantiteStock: 60,
        niveauStockMin: 5,
        categorie: {
          id: 2,
          nom: 'Ordinateurs'
        }
      }
    }
  })
  @ApiNotFoundResponse({ description: 'Produit non trouvé' })
  @ApiBadRequestResponse({ 
    description: 'Données invalides',
    schema: {
      example: {
        statusCode: 400,
        message: [
          'quantite doit être au moins 1',
          'type doit être "entree" ou "sortie"'
        ],
        error: 'Bad Request'
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  ajusterStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() ajusterStockDto: AjusterStockDto,
    @Request() req,
  ) {
    return this.produitsService.ajusterStock(id, ajusterStockDto, req.user.id);
  }


  
// ==========================================
// ROUTES POUR GÉRER LES FOURNISSEURS
// ==========================================

@Get(':id/fournisseurs')
@PremiumFeature(Feature.GESTION_FOURNISSEURS)
@ApiOperation({ 
  summary: 'Obtenir tous les fournisseurs d\'un produit',
  description: `
    Récupère la liste complète des fournisseurs associés à un produit avec leurs conditions commerciales.
    
    **Fonctionnalité:** 💎 PREMIUM
    
    **Informations incluses:**
    - Détails du fournisseur
    - Prix d'achat négocié
    - Référence fournisseur du produit
    - Délai de livraison
    - Quantité minimum de commande
    - Statut préféré
    - Disponibilité
    
    **Tri:**
    - Fournisseur préféré en premier
    - Puis par prix croissant
    
    **Utilité:**
    - Comparaison des prix fournisseurs
    - Sélection du meilleur fournisseur
    - Gestion des commandes
  `
})
@ApiParam({ name: 'id', type: Number, description: 'ID du produit', example: 1 })
@ApiResponse({ 
  description: 'Liste des fournisseurs du produit',
  schema: {
    example: [
      {
        fournisseur: {
          id: 3,
          nom: 'TechSupply SARL',
          email: 'commandes@techsupply.com',
          telephone: '+225 27 20 30 40 50',
          estActif: true
        },
        prixAchat: 750,
        referenceFournisseur: 'TS-LAPTOP-XPS15',
        delaiLivraison: 5,
        quantiteMinimum: 10,
        estPrefere: true,
        estDisponible: true,
        notes: 'Fournisseur principal - excellent service'
      },
      {
        fournisseur: {
          id: 7,
          nom: 'Distributeur Pro CI',
          email: 'vente@distripro.ci',
          telephone: '+225 27 21 45 67 89',
          estActif: true
        },
        prixAchat: 780,
        referenceFournisseur: 'DPC-DEL-XPS-15',
        delaiLivraison: 7,
        quantiteMinimum: 5,
        estPrefere: false,
        estDisponible: true,
        notes: 'Bon rapport qualité/prix'
      }
    ]
  }
})
@ApiNotFoundResponse({ 
  description: 'Produit non trouvé',
  schema: {
    example: {
      statusCode: 404,
      message: 'Produit #999 non trouvé',
      error: 'Not Found'
    }
  }
})
@ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
@ApiForbiddenResponse({ description: 'Accès refusé - Nécessite abonnement PREMIUM' })
getFournisseurs(@Param('id', ParseIntPipe) id: number) {
  return this.produitsService.getFournisseurs(id);
}

@Get(':id/fournisseurs/prefere')
@PremiumFeature(Feature.GESTION_FOURNISSEURS)
@ApiOperation({ 
  summary: 'Obtenir le fournisseur préféré d\'un produit',
  description: `
    Retourne le fournisseur défini comme préféré pour ce produit.
    
    **Fonctionnalité:** 💎 PREMIUM
    
    **Critère:**
    - Un seul fournisseur peut être marqué comme préféré
    - C'est le fournisseur par défaut pour les commandes
    
    **Utilité:**
    - Commandes automatiques
    - Réapprovisionnement rapide
    - Suggestion lors de la création de commande
    
    **Note:**
    - Si aucun fournisseur n'est préféré, retourne null
    - Le fournisseur préféré doit être actif et disponible
  `
})
@ApiParam({ name: 'id', type: Number, description: 'ID du produit', example: 1 })
@ApiResponse({ 
  description: 'Fournisseur préféré trouvé',
  schema: {
    example: {
      fournisseur: {
        id: 3,
        nom: 'TechSupply SARL',
        email: 'commandes@techsupply.com',
        telephone: '+225 27 20 30 40 50',
        adresse: 'Zone Industrielle, Yopougon',
        estActif: true
      },
      prixAchat: 750,
      referenceFournisseur: 'TS-LAPTOP-XPS15',
      delaiLivraison: 5,
      quantiteMinimum: 10,
      estPrefere: true,
      estDisponible: true
    }
  }
})
@ApiResponse({ 
  status: 204,
  description: 'Aucun fournisseur préféré défini'
})
@ApiNotFoundResponse({ description: 'Produit non trouvé' })
@ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
@ApiForbiddenResponse({ description: 'Accès refusé - Nécessite abonnement PREMIUM' })
getFournisseurPrefere(@Param('id', ParseIntPipe) id: number) {
  return this.produitsService.getFournisseurPrefere(id);
}

@Get(':id/fournisseurs/meilleur-prix')
@PremiumFeature(Feature.GESTION_FOURNISSEURS)
@ApiOperation({ 
  summary: 'Obtenir le fournisseur avec le meilleur prix',
  description: `
    Identifie automatiquement le fournisseur proposant le prix d'achat le plus bas pour ce produit.
    
    **Fonctionnalité:** 💎 PREMIUM
    
    **Critères:**
    - Prix d'achat le plus bas
    - Fournisseur actif et disponible uniquement
    - Tient compte de la quantité minimum
    
    **Calcul:**
    - Compare tous les prix fournisseurs actifs
    - Retourne le moins cher avec ses conditions
    
    **Utilité:**
    - Optimisation des coûts d'achat
    - Aide à la décision d'achat
    - Analyse comparative rapide
    
    **Affichage:**
    - Prix unitaire
    - Économie par rapport au fournisseur préféré (si différent)
  `
})
@ApiParam({ name: 'id', type: Number, description: 'ID du produit', example: 1 })
@ApiResponse({ 
  description: 'Fournisseur avec le meilleur prix trouvé',
  schema: {
    example: {
      fournisseur: {
        id: 3,
        nom: 'TechSupply SARL',
        email: 'commandes@techsupply.com',
        telephone: '+225 27 20 30 40 50'
      },
      prixAchat: 750,
      referenceFournisseur: 'TS-LAPTOP-XPS15',
      delaiLivraison: 5,
      quantiteMinimum: 10,
      estPrefere: true,
      estDisponible: true,
      economie: {
        montant: 0,
        pourcentage: 0,
        message: 'Ce fournisseur est déjà le préféré'
      }
    }
  }
})
@ApiNotFoundResponse({ 
  description: 'Produit non trouvé ou aucun fournisseur disponible',
  schema: {
    example: {
      statusCode: 404,
      message: 'Aucun fournisseur disponible pour ce produit',
      error: 'Not Found'
    }
  }
})
@ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
@ApiForbiddenResponse({ description: 'Accès refusé - Nécessite abonnement PREMIUM' })
getMeilleurPrix(@Param('id', ParseIntPipe) id: number) {
  return this.produitsService.getMeilleurPrix(id);
}

@Post(':id/fournisseurs')
@PremiumFeature(Feature.GESTION_FOURNISSEURS)
@ApiOperation({ 
  summary: 'Ajouter un fournisseur à un produit',
  description: `
    Associe un fournisseur à un produit avec ses conditions commerciales spécifiques.
    
    **Fonctionnalité:** 💎 PREMIUM
    
    **Champs requis:**
    - ID du fournisseur
    - Prix d'achat
    
    **Champs optionnels:**
    - Référence fournisseur
    - Délai de livraison (en jours)
    - Quantité minimum de commande
    - Marquer comme préféré
    - Disponibilité
    - Notes
    
    **Validation:**
    - Le fournisseur ne doit pas déjà être associé à ce produit
    - Le prix d'achat doit être positif
    - Si estPrefere = true, les autres fournisseurs sont automatiquement dé-préférés
    
    **Utilité:**
    - Gestion multi-fournisseurs
    - Comparaison des prix
    - Flexibilité d'approvisionnement
  `
})
@ApiParam({ name: 'id', type: Number, description: 'ID du produit', example: 1 })
@ApiBody({
  type: AjouterFournisseurDto,
  examples: {
    simple: {
      summary: 'Association simple',
      value: {
        fournisseurId: 3,
        prixAchat: 750,
        referenceFournisseur: 'TS-LAPTOP-XPS15'
      }
    },
    complet: {
      summary: 'Association complète avec préférence',
      value: {
        fournisseurId: 3,
        prixAchat: 750,
        referenceFournisseur: 'TS-LAPTOP-XPS15',
        delaiLivraison: 5,
        quantiteMinimum: 10,
        estPrefere: true,
        estDisponible: true,
        notes: 'Fournisseur principal - excellent service et délais respectés'
      }
    },
    secondaire: {
      summary: 'Fournisseur secondaire',
      value: {
        fournisseurId: 7,
        prixAchat: 780,
        referenceFournisseur: 'DPC-DEL-XPS-15',
        delaiLivraison: 7,
        quantiteMinimum: 5,
        estPrefere: false,
        notes: 'Fournisseur de backup'
      }
    }
  }
})
@ApiResponse({ 
  description: 'Fournisseur ajouté avec succès',
  schema: {
    example: {
      produitId: 1,
      fournisseurId: 3,
      prixAchat: 750,
      referenceFournisseur: 'TS-LAPTOP-XPS15',
      delaiLivraison: 5,
      quantiteMinimum: 10,
      estPrefere: true,
      estDisponible: true,
      dateCreation: '2024-11-18T10:00:00.000Z',
      fournisseur: {
        id: 3,
        nom: 'TechSupply SARL',
        email: 'commandes@techsupply.com'
      }
    }
  }
})
@ApiBadRequestResponse({ 
  description: 'Données invalides ou fournisseur déjà associé',
  schema: {
    example: {
      statusCode: 400,
      message: 'Ce fournisseur est déjà associé à ce produit',
      error: 'Bad Request'
    }
  }
})
@ApiNotFoundResponse({ description: 'Produit ou fournisseur non trouvé' })
@ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
@ApiForbiddenResponse({ description: 'Accès refusé - Nécessite abonnement PREMIUM' })
ajouterFournisseur(
  @Param('id', ParseIntPipe) id: number,
  @Body() ajouterFournisseurDto: AjouterFournisseurDto,
) {
  return this.produitsService.ajouterFournisseur(
    id,
    ajouterFournisseurDto.fournisseurId,
    ajouterFournisseurDto,
  );
}

@Patch(':id/fournisseurs/:fournisseurId')
@PremiumFeature(Feature.GESTION_FOURNISSEURS)
@ApiOperation({ 
  summary: 'Modifier les conditions d\'un fournisseur',
  description: `
    Met à jour les conditions commerciales d'un fournisseur pour ce produit.
    
    **Fonctionnalité:** 💎 PREMIUM
    
    **Champs modifiables:**
    - Prix d'achat
    - Référence fournisseur
    - Délai de livraison
    - Quantité minimum
    - Disponibilité
    - Notes
    
    **Note:**
    - Seuls les champs fournis seront modifiés
    - La date de modification est mise à jour automatiquement
    - Pour changer le statut préféré, utiliser la route dédiée
    
    **Utilité:**
    - Mise à jour des tarifs
    - Ajustement des conditions
    - Maintien des informations à jour
  `
})
@ApiParam({ name: 'id', type: Number, description: 'ID du produit', example: 1 })
@ApiParam({ name: 'fournisseurId', type: Number, description: 'ID du fournisseur', example: 3 })
@ApiBody({
  type: ModifierFournisseurDto,
  examples: {
    prix: {
      summary: 'Modifier uniquement le prix',
      value: {
        prixAchat: 720
      }
    },
    delai: {
      summary: 'Modifier le délai de livraison',
      value: {
        delaiLivraison: 3,
        notes: 'Nouveau délai négocié'
      }
    },
    complet: {
      summary: 'Modification complète',
      value: {
        prixAchat: 720,
        delaiLivraison: 3,
        quantiteMinimum: 15,
        referenceFournisseur: 'TS-LAPTOP-XPS15-V2',
        notes: 'Nouvelles conditions 2024 - prix réduit, délai amélioré'
      }
    },
    indisponible: {
      summary: 'Marquer comme indisponible',
      value: {
        estDisponible: false,
        notes: 'Rupture temporaire - retour prévu fin décembre'
      }
    }
  }
})
@ApiResponse({ 
  description: 'Conditions mises à jour avec succès',
  schema: {
    example: {
      produitId: 1,
      fournisseurId: 3,
      prixAchat: 720,
      referenceFournisseur: 'TS-LAPTOP-XPS15-V2',
      delaiLivraison: 3,
      quantiteMinimum: 15,
      estPrefere: true,
      estDisponible: true,
      dateModification: '2024-11-18T14:30:00.000Z'
    }
  }
})
@ApiNotFoundResponse({ 
  description: 'Association produit-fournisseur non trouvée',
  schema: {
    example: {
      statusCode: 404,
      message: 'Association entre le produit #1 et le fournisseur #3 non trouvée',
      error: 'Not Found'
    }
  }
})
@ApiBadRequestResponse({ description: 'Données invalides' })
@ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
@ApiForbiddenResponse({ description: 'Accès refusé - Nécessite abonnement PREMIUM' })
modifierFournisseur(
  @Param('id', ParseIntPipe) id: number,
  @Param('fournisseurId', ParseIntPipe) fournisseurId: number,
  @Body() modifierFournisseurDto: ModifierFournisseurDto,
) {
  return this.produitsService.modifierFournisseur(
    id,
    fournisseurId,
    modifierFournisseurDto,
  );
}

@Patch(':id/fournisseurs/:fournisseurId/prefere')
@PremiumFeature(Feature.GESTION_FOURNISSEURS)
@ApiOperation({ 
  summary: 'Définir un fournisseur comme préféré',
  description: `
    Marque ce fournisseur comme fournisseur préféré pour ce produit.
    
    **Fonctionnalité:** 💎 PREMIUM
    
    **Comportement:**
    - Définit ce fournisseur comme préféré (estPrefere = true)
    - Retire automatiquement le statut préféré des autres fournisseurs
    - Un seul fournisseur peut être préféré à la fois
    
    **Impact:**
    - Ce fournisseur sera proposé par défaut lors des commandes
    - Utilisé pour les réapprovisionnements automatiques
    - Mis en évidence dans l'interface
    
    **Utilité:**
    - Simplifier le processus de commande
    - Standardiser les approvisionnements
    - Prioriser le meilleur fournisseur
  `
})
@ApiParam({ name: 'id', type: Number, description: 'ID du produit', example: 1 })
@ApiParam({ name: 'fournisseurId', type: Number, description: 'ID du fournisseur à définir comme préféré', example: 7 })
@ApiResponse({ 
  description: 'Fournisseur défini comme préféré',
  schema: {
    example: {
      produitId: 1,
      fournisseurId: 7,
      estPrefere: true,
      message: 'Fournisseur "Distributeur Pro CI" défini comme préféré pour "Dell XPS 15"',
      ancienPrefere: {
        fournisseurId: 3,
        nom: 'TechSupply SARL'
      }
    }
  }
})
@ApiNotFoundResponse({ 
  description: 'Association produit-fournisseur non trouvée',
  schema: {
    example: {
      statusCode: 404,
      message: 'Association entre le produit #1 et le fournisseur #7 non trouvée',
      error: 'Not Found'
    }
  }
})
@ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
@ApiForbiddenResponse({ description: 'Accès refusé - Nécessite abonnement PREMIUM' })
definirFournisseurPrefere(
  @Param('id', ParseIntPipe) id: number,
  @Param('fournisseurId', ParseIntPipe) fournisseurId: number,
) {
  return this.produitsService.definirFournisseurPrefere(id, fournisseurId);
}

@Delete(':id/fournisseurs/:fournisseurId')
@PremiumFeature(Feature.GESTION_FOURNISSEURS)
@ApiOperation({ 
  summary: 'Retirer un fournisseur d\'un produit',
  description: `
    Supprime l'association entre un produit et un fournisseur.
    
    **Fonctionnalité:** 💎 PREMIUM
    
    **⚠️ Attention:**
    - Action irréversible
    - Supprime toutes les conditions commerciales associées
    - L'historique des commandes passées est conservé
    
    **Vérifications:**
    - Impossible de retirer le dernier fournisseur d'un produit
    - Si c'est le fournisseur préféré, recommandation d'en définir un autre
    
    **Alternative:**
    - Marquer le fournisseur comme indisponible plutôt que le supprimer
    - PATCH /produits/:id/fournisseurs/:fournisseurId avec { estDisponible: false }
    
    **Impact:**
    - Le fournisseur n'apparaîtra plus dans les listes
    - Impossible de créer des commandes avec ce fournisseur
  `
})
@ApiParam({ name: 'id', type: Number, description: 'ID du produit', example: 1 })
@ApiParam({ name: 'fournisseurId', type: Number, description: 'ID du fournisseur à retirer', example: 7 })
@ApiResponse({ 
  description: 'Fournisseur retiré avec succès',
  schema: {
    example: {
      produitId: 1,
      fournisseurId: 7,
      message: 'Fournisseur "Distributeur Pro CI" retiré du produit "Dell XPS 15"',
      etaitPrefere: false,
      nombreFournisseursRestants: 2
    }
  }
})
@ApiNotFoundResponse({ 
  description: 'Association produit-fournisseur non trouvée',
  schema: {
    example: {
      statusCode: 404,
      message: 'Association entre le produit #1 et le fournisseur #7 non trouvée',
      error: 'Not Found'
    }
  }
})
@ApiBadRequestResponse({ 
  description: 'Impossible de retirer le dernier fournisseur',
  schema: {
    example: {
      statusCode: 400,
      message: 'Impossible de retirer le dernier fournisseur de ce produit. Veuillez en ajouter un autre d\'abord.',
      error: 'Bad Request'
    }
  }
})
@ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
@ApiForbiddenResponse({ description: 'Accès refusé - Nécessite abonnement PREMIUM' })
retirerFournisseur(
  @Param('id', ParseIntPipe) id: number,
  @Param('fournisseurId', ParseIntPipe) fournisseurId: number,
) {
  return this.produitsService.retirerFournisseur(id, fournisseurId);
}
}