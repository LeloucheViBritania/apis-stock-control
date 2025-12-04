import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, ParseIntPipe, Request } from '@nestjs/common';
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
import { CommandesService } from './commandes.service';
import { CreateCommandeDto } from './dto/create-commande.dto';
import { UpdateCommandeDto } from './dto/update-commande.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { PremiumFeature } from '../../common/decorators/premium-feature.decorator';
import { Feature } from '../../common/enums/features.enum';

@ApiTags('Commandes')
@ApiBearerAuth('JWT-auth')
@Controller('commandes')
@UseGuards(AuthGuard, PremiumGuard)
export class CommandesController {
  constructor(private readonly commandesService: CommandesService) {}

  @Post()
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ 
    summary: 'Créer une nouvelle commande',
    description: `
      Crée une nouvelle commande client avec gestion automatique du stock.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Processus automatisé:**
      1. Validation de la disponibilité des produits
      2. Génération automatique du numéro de commande (CMD-XXXXXX)
      3. Calcul automatique du montant total
      4. Réduction du stock pour chaque produit
      5. Création des mouvements de stock (traçabilité)
      6. Enregistrement de l'utilisateur créateur
      
      **Validation du stock:**
      - Vérifie que chaque produit existe
      - Vérifie la disponibilité en stock
      - Retourne une erreur si stock insuffisant
      - Empêche la création si un produit manque
      
      **Protection des données:**
      - Transaction atomique (tout ou rien)
      - Si une étape échoue, tout est annulé
      - Le stock n'est jamais bloqué partiellement
      
      **Calcul du prix:**
      - Prix = prixUnitaire × quantité (pour chaque ligne)
      - Si prixUnitaire non fourni, utilise le prix de vente du produit
      - Montant total = somme de toutes les lignes
      
      **Traçabilité:**
      - L'utilisateur créateur est enregistré
      - Date de création automatique
      - Numéro unique incrémental
      - Mouvements de stock créés automatiquement
      
      **⚠️ Important:**
      - Une fois créée, la commande impacte immédiatement le stock
      - Pour annuler, utilisez POST /commandes/:id/annuler
    `
  })
  @ApiBody({
    type: CreateCommandeDto,
    examples: {
      simple: {
        summary: 'Commande simple (1 produit)',
        value: {
          clientId: 1,
          dateCommande: '2024-11-18',
          dateLivraison: '2024-11-25',
          details: [
            {
              produitId: 1,
              quantite: 2
            }
          ]
        }
      },
      multiple: {
        summary: 'Commande multiple produits',
        value: {
          clientId: 5,
          dateCommande: '2024-11-18',
          dateLivraison: '2024-11-22',
          details: [
            {
              produitId: 1,
              quantite: 2,
              prixUnitaire: 1200
            },
            {
              produitId: 3,
              quantite: 5,
              prixUnitaire: 15
            },
            {
              produitId: 7,
              quantite: 1,
              prixUnitaire: 450
            }
          ]
        }
      },
      sansClient: {
        summary: 'Vente comptoir (sans client)',
        value: {
          dateCommande: '2024-11-18',
          details: [
            {
              produitId: 12,
              quantite: 1
            }
          ]
        }
      }
    }
  })
  @ApiResponse({ 
    description: 'Commande créée avec succès - Stock mis à jour',
    schema: {
      example: {
        id: 15,
        numeroCommande: 'CMD-000015',
        clientId: 1,
        dateCommande: '2024-11-18',
        dateLivraison: '2024-11-25',
        statut: 'EN_ATTENTE',
        montantTotal: 2475.00,
        creePar: 1,
        dateCreation: '2024-11-18T14:30:00.000Z',
        client: {
          id: 1,
          nom: 'Entreprise ABC',
          email: 'contact@abc.com'
        },
        details: [
          {
            id: 45,
            produitId: 1,
            quantite: 2,
            prixUnitaire: 1200.00,
            produit: {
              id: 1,
              nom: 'Dell XPS 15',
              reference: 'LAPTOP-001'
            }
          },
          {
            id: 46,
            produitId: 3,
            quantite: 5,
            prixUnitaire: 15.00,
            produit: {
              id: 3,
              nom: 'Câble USB-C',
              reference: 'CABLE-001'
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
  @ApiBadRequestResponse({ 
    description: 'Stock insuffisant ou données invalides',
    schema: {
      example: {
        statusCode: 400,
        message: 'Stock insuffisant pour Dell XPS 15. Disponible: 3',
        error: 'Bad Request'
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  @ApiForbiddenResponse({ description: 'Accès refusé - Nécessite abonnement FREE ou PREMIUM' })
  create(@Body() createCommandeDto: CreateCommandeDto, @Request() req) {
    return this.commandesService.create(createCommandeDto, req.user.id);
  }

  @Get()
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ 
    summary: 'Lister toutes les commandes',
    description: `
      Récupère la liste de toutes les commandes avec filtres avancés et pagination.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Filtres disponibles:**
      - **Par statut:** EN_ATTENTE, EN_TRAITEMENT, EXPEDIE, LIVRE, ANNULE
      - **Par client:** ID du client
      - **Par période:** Date début et/ou date fin
      
      **Informations incluses:**
      - Données complètes de la commande
      - Informations du client
      - Détails de chaque ligne (produit + quantité + prix)
      
      **Pagination:**
      - Par défaut: 50 commandes par page
      - Personnalisable avec limit
      
      **Tri:**
      - Par date de commande (plus récente en premier)
      
      **Cas d'usage:**
      - Suivi des commandes en cours
      - Historique des ventes
      - Préparation des livraisons
      - Rapports de ventes
      - Tableau de bord commercial
      
      **Exemples de filtres:**
      - Commandes en attente aujourd'hui
      - Toutes les commandes d'un client
      - Commandes à livrer cette semaine
      - Commandes annulées du mois
    `
  })
  @ApiQuery({ 
    name: 'statut', 
    required: false, 
    enum: ['EN_ATTENTE', 'EN_TRAITEMENT', 'EXPEDIE', 'LIVRE', 'ANNULE'],
    description: 'Filtrer par statut de commande', 
    example: 'EN_ATTENTE' 
  })
  @ApiQuery({ 
    name: 'clientId', 
    required: false, 
    type: Number, 
    description: 'Filtrer par ID client', 
    example: 1 
  })
  @ApiQuery({ 
    name: 'dateDebut', 
    required: false, 
    type: String, 
    format: 'date',
    description: 'Date de début (format: YYYY-MM-DD)', 
    example: '2024-11-01' 
  })
  @ApiQuery({ 
    name: 'dateFin', 
    required: false, 
    type: String, 
    format: 'date',
    description: 'Date de fin (format: YYYY-MM-DD)', 
    example: '2024-11-30' 
  })
  @ApiQuery({ 
    name: 'page', 
    required: false, 
    type: Number, 
    description: 'Numéro de page', 
    example: 1 
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number, 
    description: 'Résultats par page', 
    example: 10 
  })
  @ApiResponse({ 
    description: 'Liste des commandes avec pagination',
    schema: {
      example: {
        data: [
          {
            id: 15,
            numeroCommande: 'CMD-000015',
            clientId: 1,
            dateCommande: '2024-11-18',
            dateLivraison: '2024-11-25',
            statut: 'EN_ATTENTE',
            montantTotal: 2475.00,
            dateCreation: '2024-11-18T14:30:00.000Z',
            client: {
              id: 1,
              nom: 'Entreprise ABC',
              ville: 'Abidjan'
            },
            details: [
              {
                id: 45,
                quantite: 2,
                prixUnitaire: 1200.00,
                produit: {
                  nom: 'Dell XPS 15',
                  reference: 'LAPTOP-001'
                }
              }
            ]
          },
          {
            id: 14,
            numeroCommande: 'CMD-000014',
            clientId: 5,
            dateCommande: '2024-11-17',
            dateLivraison: null,
            statut: 'LIVRE',
            montantTotal: 890.00,
            dateCreation: '2024-11-17T10:15:00.000Z',
            client: {
              id: 5,
              nom: 'Société XYZ',
              ville: 'Abidjan'
            },
            details: [
              {
                id: 42,
                quantite: 1,
                prixUnitaire: 890.00,
                produit: {
                  nom: 'iPhone 14 Pro',
                  reference: 'PHONE-001'
                }
              }
            ]
          }
        ],
        meta: {
          total: 245,
          page: 1,
          limit: 10,
          totalPages: 25
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  findAll(
    @Query('statut') statut?: string,
    @Query('clientId') clientId?: string,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.commandesService.findAll({
      statut,
      clientId: clientId ? +clientId : undefined,
      dateDebut,
      dateFin,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get('statistiques')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ 
    summary: 'Obtenir les statistiques des commandes',
    description: `
      Retourne un résumé statistique des commandes et ventes.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Métriques incluses:**
      - Nombre total de commandes
      - Commandes en cours (EN_ATTENTE + EN_TRAITEMENT + EXPEDIE)
      - Commandes complétées (LIVRE)
      - Commandes annulées
      - Montant total des ventes (commandes livrées uniquement)
      
      **Calculs:**
      - En cours = EN_ATTENTE + EN_TRAITEMENT + EXPEDIE
      - Complétées = LIVRE
      - Montant total = Σ(montantTotal) WHERE statut = LIVRE
      
      **Utilité:**
      - Dashboard commercial
      - KPI de vente
      - Suivi de performance
      - Rapport de gestion
      - Prévisions
      
      **Analyses possibles:**
      - Taux de conversion (complétées / total)
      - Taux d'annulation (annulées / total)
      - Chiffre d'affaires réalisé
      - Commandes à traiter
    `
  })
  @ApiResponse({ 
    description: 'Statistiques des commandes',
    schema: {
      example: {
        total: 245,
        enCours: 18,
        completees: 215,
        annulees: 12,
        montantTotal: 1850450.75
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  getStatistiques() {
    return this.commandesService.getStatistiques();
  }

  @Get(':id')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ 
    summary: 'Obtenir les détails d\'une commande',
    description: `
      Récupère toutes les informations d'une commande spécifique.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Informations incluses:**
      - Toutes les données de la commande
      - Informations complètes du client
      - Utilisateur créateur de la commande
      - Détails de chaque ligne:
        * Produit complet (avec catégorie)
        * Quantité commandée
        * Prix unitaire appliqué
        * Sous-total de la ligne
      
      **Utilité:**
      - Bon de commande détaillé
      - Préparation de livraison
      - Facturation
      - Suivi client
      - Service après-vente
      
      **Informations pour préparateurs:**
      - Liste des produits à prélever
      - Quantités exactes
      - Références produits
      - Emplacement stock (si disponible)
    `
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID de la commande', example: 15 })
  @ApiResponse({ 
    description: 'Détails complets de la commande',
    schema: {
      example: {
        id: 15,
        numeroCommande: 'CMD-000015',
        clientId: 1,
        dateCommande: '2024-11-18',
        dateLivraison: '2024-11-25',
        statut: 'EN_ATTENTE',
        montantTotal: 2475.00,
        creePar: 1,
        dateCreation: '2024-11-18T14:30:00.000Z',
        client: {
          id: 1,
          nom: 'Entreprise ABC SARL',
          email: 'contact@abc.com',
          telephone: '+225 01 23 45 67',
          adresse: '123 Boulevard du Commerce',
          ville: 'Abidjan',
          pays: 'Côte d\'Ivoire'
        },
        createur: {
          id: 1,
          nomComplet: 'Administrateur Principal'
        },
        details: [
          {
            id: 45,
            commandeId: 15,
            produitId: 1,
            quantite: 2,
            prixUnitaire: 1200.00,
            produit: {
              id: 1,
              reference: 'LAPTOP-001',
              nom: 'Dell XPS 15',
              description: 'Ordinateur portable haute performance',
              marque: 'Dell',
              categorie: {
                id: 2,
                nom: 'Ordinateurs'
              }
            }
          },
          {
            id: 46,
            commandeId: 15,
            produitId: 3,
            quantite: 5,
            prixUnitaire: 15.00,
            produit: {
              id: 3,
              reference: 'CABLE-USB-C',
              nom: 'Câble USB-C 2m',
              marque: 'Generic',
              categorie: {
                id: 8,
                nom: 'Accessoires'
              }
            }
          }
        ]
      }
    }
  })
  @ApiNotFoundResponse({ 
    description: 'Commande non trouvée',
    schema: {
      example: {
        statusCode: 404,
        message: 'Commande #999 non trouvée',
        error: 'Not Found'
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.commandesService.findOne(id);
  }

  @Patch(':id')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ 
    summary: 'Mettre à jour le statut d\'une commande',
    description: `
      Modifie le statut d'une commande dans son cycle de vie.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Cycle de vie d'une commande:**
      \`\`\`
      EN_ATTENTE → EN_TRAITEMENT → EXPEDIE → LIVRE
                ↓                                 ↓
              ANNULE ←-------------------------→ ANNULE
      \`\`\`
      
      **Statuts disponibles:**
      - **EN_ATTENTE:** Commande créée, en attente de traitement
      - **EN_TRAITEMENT:** Préparation en cours
      - **EXPEDIE:** Colis expédié, en transit
      - **LIVRE:** Commande livrée au client
      - **ANNULE:** Commande annulée (utiliser POST /commandes/:id/annuler)
      
      **Règles métier:**
      - ✅ EN_ATTENTE → EN_TRAITEMENT → EXPEDIE → LIVRE (progression normale)
      - ✅ EN_ATTENTE → ANNULE (annulation avant traitement)
      - ✅ EN_TRAITEMENT → ANNULE (annulation pendant traitement)
      - ❌ LIVRE → autre statut (une fois livrée, immuable)
      - ❌ ANNULE → autre statut (une fois annulée, immuable)
      
      **⚠️ Important:**
      - Seul le statut peut être modifié via PATCH
      - Pour annuler avec restauration de stock: POST /commandes/:id/annuler
      - Les produits et quantités ne peuvent pas être modifiés après création
      
      **Notifications recommandées:**
      - EN_TRAITEMENT: Email au client "Commande en préparation"
      - EXPEDIE: Email "Votre colis est en route"
      - LIVRE: Email "Commande livrée, merci !"
    `
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID de la commande', example: 15 })
  @ApiBody({
    type: UpdateCommandeDto,
    examples: {
      traitement: {
        summary: 'Passer en traitement',
        value: {
          statut: 'EN_TRAITEMENT'
        }
      },
      expedie: {
        summary: 'Marquer comme expédiée',
        value: {
          statut: 'EXPEDIE'
        }
      },
      livre: {
        summary: 'Marquer comme livrée',
        value: {
          statut: 'LIVRE'
        }
      }
    }
  })
  @ApiResponse({ 
    description: 'Statut de commande mis à jour',
    schema: {
      example: {
        id: 15,
        numeroCommande: 'CMD-000015',
        statut: 'EN_TRAITEMENT',
        montantTotal: 2475.00,
        client: {
          nom: 'Entreprise ABC',
          email: 'contact@abc.com'
        },
        details: [
          {
            quantite: 2,
            prixUnitaire: 1200.00,
            produit: {
              nom: 'Dell XPS 15'
            }
          }
        ]
      }
    }
  })
  @ApiNotFoundResponse({ description: 'Commande non trouvée' })
  @ApiBadRequestResponse({ 
    description: 'Transition de statut invalide',
    schema: {
      example: {
        statusCode: 400,
        message: 'Impossible de modifier une commande déjà livrée',
        error: 'Bad Request'
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  update(@Param('id', ParseIntPipe) id: number, @Body() updateCommandeDto: UpdateCommandeDto) {
    return this.commandesService.update(id, updateCommandeDto);
  }

  @Post(':id/annuler')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ 
    summary: 'Annuler une commande',
    description: `
      Annule une commande et restaure automatiquement le stock des produits.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Processus automatisé:**
      1. Vérification du statut actuel
      2. Changement du statut vers ANNULE
      3. Restauration automatique du stock pour chaque produit
      4. Création des mouvements de stock inversés (traçabilité)
      5. Enregistrement de l'utilisateur qui a annulé
      
      **Restrictions:**
      - ❌ Impossible d'annuler si déjà ANNULE
      - ❌ Impossible d'annuler si déjà LIVRE
      - ✅ Possible si EN_ATTENTE, EN_TRAITEMENT, ou EXPEDIE
      
      **Restauration du stock:**
      - Pour chaque ligne de commande, le stock est réaugmenté
      - Mouvement de stock créé: type "ENTREE", raison "Annulation commande"
      - Traçabilité complète maintenue
      
      **Transaction atomique:**
      - Tout se fait en une seule transaction
      - Si une étape échoue, rien n'est modifié
      - Garantit la cohérence des données
      
      **Exemple de flux:**
      \`\`\`
      Commande CMD-000015:
      - 2× Dell XPS 15 (stock avant: 8)
      - 5× Câble USB-C (stock avant: 45)
      
      Après annulation:
      - Dell XPS 15 stock: 8 + 2 = 10
      - Câble USB-C stock: 45 + 5 = 50
      
      Mouvements créés:
      - ENTREE: +2 Dell XPS 15 (raison: Annulation CMD-000015)
      - ENTREE: +5 Câble USB-C (raison: Annulation CMD-000015)
      \`\`\`
      
      **⚠️ Important:**
      - L'annulation est définitive
      - Le stock est immédiatement disponible à nouveau
      - Impossible de "désannuler" une commande
      - Pour recréer: nouvelle commande nécessaire
      
      **Raisons d'annulation courantes:**
      - Client a changé d'avis
      - Erreur de saisie
      - Produit indisponible finalement
      - Problème de paiement
      - Demande client
    `
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID de la commande', example: 15 })
  @ApiResponse({ 
    description: 'Commande annulée avec succès - Stock restauré',
    schema: {
      example: {
        id: 15,
        numeroCommande: 'CMD-000015',
        clientId: 1,
        dateCommande: '2024-11-18',
        statut: 'ANNULE',
        montantTotal: 2475.00,
        client: {
          nom: 'Entreprise ABC',
          email: 'contact@abc.com'
        },
        details: [
          {
            produitId: 1,
            quantite: 2,
            prixUnitaire: 1200.00,
            produit: {
              nom: 'Dell XPS 15',
              quantiteStock: 10
            }
          },
          {
            produitId: 3,
            quantite: 5,
            prixUnitaire: 15.00,
            produit: {
              nom: 'Câble USB-C',
              quantiteStock: 50
            }
          }
        ]
      }
    }
  })
  @ApiNotFoundResponse({ description: 'Commande non trouvée' })
  @ApiBadRequestResponse({ 
    description: 'Impossible d\'annuler cette commande',
    schema: {
      example: {
        statusCode: 400,
        message: 'Impossible d\'annuler une commande déjà livrée',
        error: 'Bad Request'
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  cancel(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.commandesService.cancel(id, req.user.id);
  }
}