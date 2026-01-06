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
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { PremiumFeature } from '../../common/decorators/premium-feature.decorator';
import { Feature } from '../../common/enums/features.enum';

@ApiTags('Clients')
@ApiBearerAuth('JWT-auth')
@Controller('clients')
@UseGuards(AuthGuard, PremiumGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @PremiumFeature(Feature.GESTION_CLIENTS)
  @ApiOperation({ 
    summary: 'Créer un nouveau client',
    description: `
      Enregistre un nouveau client dans le système.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Champ requis:**
      - Nom (entreprise ou personne)
      
      **Champs optionnels:**
      - Email (pour communications)
      - Téléphone (pour contact rapide)
      - Adresse complète (livraison/facturation)
      - Numéro fiscal (pour facturation légale)
      
      **Types de clients:**
      - **B2B (Business):** Nom d'entreprise, numéro fiscal requis
      - **B2C (Particulier):** Nom complet de la personne
      
      **Validation:**
      - Email doit être valide si fourni
      - Tous les champs texte acceptent les caractères internationaux
      
      **Statut par défaut:**
      - estActif: true (client actif)
    `
  })
  @ApiBody({
    type: CreateClientDto,
    examples: {
      entreprise: {
        summary: 'Client Entreprise (B2B)',
        value: {
          nom: 'Entreprise ABC SARL',
          email: 'contact@abc.com',
          telephone: '+225 01 23 45 67',
          adresse: '123 Boulevard du Commerce',
          ville: 'Abidjan',
          pays: 'Côte d\'Ivoire',
          numeroFiscal: 'CI-2024-ABC-12345'
        }
      },
      particulier: {
        summary: 'Client Particulier (B2C)',
        value: {
          nom: 'Jean Kouadio',
          email: 'jean.kouadio@gmail.com',
          telephone: '+225 07 89 12 34',
          adresse: '45 Rue des Jardins, Cocody',
          ville: 'Abidjan',
          pays: 'Côte d\'Ivoire'
        }
      },
      minimal: {
        summary: 'Client minimum (nom uniquement)',
        value: {
          nom: 'Client Sans Email',
          telephone: '+225 05 55 55 55'
        }
      }
    }
  })
  @ApiResponse({ 
    description: 'Client créé avec succès',
    schema: {
      example: {
        id: 5,
        nom: 'Entreprise ABC SARL',
        email: 'contact@abc.com',
        telephone: '+225 01 23 45 67',
        adresse: '123 Boulevard du Commerce',
        ville: 'Abidjan',
        pays: 'Côte d\'Ivoire',
        numeroFiscal: 'CI-2024-ABC-12345',
        estActif: true,
        dateCreation: '2024-11-18T10:00:00.000Z'
      }
    }
  })
  @ApiBadRequestResponse({ 
    description: 'Données invalides',
    schema: {
      example: {
        statusCode: 400,
        message: [
          'email doit être un email valide',
          'nom ne doit pas être vide'
        ],
        error: 'Bad Request'
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  @ApiForbiddenResponse({ description: 'Accès refusé - Nécessite abonnement FREE ou PREMIUM' })
  create(@Body() createClientDto: CreateClientDto) {
    return this.clientsService.create(createClientDto);
  }

  @Get()
  @PremiumFeature(Feature.GESTION_CLIENTS)
  @ApiOperation({ 
    summary: 'Lister tous les clients',
    description: `
      Récupère la liste de tous les clients avec filtres et pagination.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Filtres disponibles:**
      - **Par statut:** Actif/Inactif
      - **Par recherche:** Nom, email ou téléphone
      
      **Informations incluses:**
      - Données complètes du client
      - Nombre de commandes passées
      
      **Pagination:**
      - Par défaut: 50 clients par page
      - Personnalisable avec limit
      
      **Tri:**
      - Par nom (ordre alphabétique)
      
      **Cas d'usage:**
      - Liste clients pour sélection
      - Annuaire clients
      - Export de base clients
      - Recherche rapide de client
    `
  })
  @ApiQuery({ 
    name: 'estActif', 
    required: false, 
    type: Boolean, 
    description: 'Filtrer par statut actif/inactif', 
    example: true 
  })
  @ApiQuery({ 
    name: 'search', 
    required: false, 
    type: String, 
    description: 'Rechercher dans nom, email ou téléphone', 
    example: 'ABC' 
  })
  @ApiQuery({ 
    name: 'page', 
    required: false, 
    type: Number, 
    description: 'Numéro de page (commence à 1)', 
    example: 1 
  })
  @ApiQuery({ 
    name: 'limit', 
    required: false, 
    type: Number, 
    description: 'Nombre de résultats par page (max 100)', 
    example: 10 
  })
  @ApiResponse({ 
    description: 'Liste des clients avec pagination',
    schema: {
      example: {
        data: [
          {
            id: 1,
            nom: 'Entreprise ABC SARL',
            email: 'contact@abc.com',
            telephone: '+225 01 23 45 67',
            ville: 'Abidjan',
            pays: 'Côte d\'Ivoire',
            estActif: true,
            _count: {
              commandes: 15
            }
          },
          {
            id: 2,
            nom: 'Société XYZ',
            email: 'contact@xyz.com',
            telephone: '+225 02 34 56 78',
            ville: 'Abidjan',
            pays: 'Côte d\'Ivoire',
            estActif: true,
            _count: {
              commandes: 8
            }
          }
        ],
        meta: {
          total: 150,
          page: 1,
          limit: 10,
          totalPages: 15
        }
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  findAll(
    @Query('estActif') estActif?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('statut') statut?: string,
    @Query('segment') segment?: string,
  ) {
    return this.clientsService.findAll({
      estActif: estActif ? estActif === 'true' : undefined,
      search,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
      statut,
      segment,
    });
  }

  @Get('statistiques')
  @PremiumFeature(Feature.GESTION_CLIENTS)
  @ApiOperation({ 
    summary: 'Obtenir les statistiques des clients',
    description: `
      Retourne un résumé statistique de la base clients.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Métriques incluses:**
      - Nombre total de clients
      - Nombre de clients actifs
      - Nombre de clients inactifs
      - Top 5 clients (par nombre de commandes)
      
      **Top clients:**
      - Classement par nombre de commandes passées
      - Utile pour identifier les clients VIP
      - Base pour programme de fidélité
      
      **Utilité:**
      - Dashboard commercial
      - Analyse de portefeuille clients
      - Segmentation clients
      - KPI commerciaux
      
      **Recommandations:**
      - Clients inactifs: campagne de réactivation
      - Top clients: offres privilégiées
      - Nouveau client sans commande: relance commerciale
    `
  })
  @ApiResponse({ 
    description: 'Statistiques des clients',
    schema: {
      example: {
        totalClients: 150,
        clientsActifs: 142,
        clientsInactifs: 8,
        topClients: [
          {
            id: 1,
            nom: 'Entreprise ABC SARL',
            email: 'contact@abc.com',
            ville: 'Abidjan',
            _count: {
              commandes: 45
            }
          },
          {
            id: 5,
            nom: 'Société XYZ',
            email: 'contact@xyz.com',
            ville: 'Abidjan',
            _count: {
              commandes: 32
            }
          },
          {
            id: 12,
            nom: 'Distribution Plus',
            email: 'info@distplus.com',
            ville: 'Abidjan',
            _count: {
              commandes: 28
            }
          },
          {
            id: 8,
            nom: 'Groupe Commercial',
            email: 'commercial@groupe.ci',
            ville: 'Bouaké',
            _count: {
              commandes: 21
            }
          },
          {
            id: 15,
            nom: 'Import Export CI',
            email: 'contact@impexp.ci',
            ville: 'San-Pédro',
            _count: {
              commandes: 19
            }
          }
        ]
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  getStatistiques() {
    return this.clientsService.getStatistiques();
  }

  @Get(':id')
  @PremiumFeature(Feature.GESTION_CLIENTS)
  @ApiOperation({ 
    summary: 'Obtenir les détails d\'un client',
    description: `
      Récupère toutes les informations d'un client spécifique avec son historique.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Informations incluses:**
      - Toutes les données du client
      - 10 dernières commandes avec détails:
        * Numéro de commande
        * Date
        * Statut
        * Montant total
      - Nombre total de commandes
      
      **Utilité:**
      - Fiche client détaillée
      - Historique des transactions
      - Support client
      - Analyse du comportement d'achat
      - Préparer une relance commerciale
      
      **Informations pour commerciaux:**
      - Fréquence d'achat
      - Panier moyen
      - Dernière commande
      - Client actif ou dormant
    `
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID du client', example: 1 })
  @ApiResponse({ 
    description: 'Détails complets du client',
    schema: {
      example: {
        id: 1,
        nom: 'Entreprise ABC SARL',
        email: 'contact@abc.com',
        telephone: '+225 01 23 45 67',
        adresse: '123 Boulevard du Commerce',
        ville: 'Abidjan',
        pays: 'Côte d\'Ivoire',
        numeroFiscal: 'CI-2024-ABC-12345',
        estActif: true,
        dateCreation: '2024-01-15T10:00:00.000Z',
        commandes: [
          {
            id: 25,
            numeroCommande: 'CMD-000025',
            dateCommande: '2024-11-15',
            statut: 'LIVRE',
            montantTotal: 15600.00
          },
          {
            id: 18,
            numeroCommande: 'CMD-000018',
            dateCommande: '2024-10-28',
            statut: 'LIVRE',
            montantTotal: 8900.00
          },
          {
            id: 12,
            numeroCommande: 'CMD-000012',
            dateCommande: '2024-10-05',
            statut: 'LIVRE',
            montantTotal: 12300.00
          }
        ],
        _count: {
          commandes: 45
        }
      }
    }
  })
  @ApiNotFoundResponse({ 
    description: 'Client non trouvé',
    schema: {
      example: {
        statusCode: 404,
        message: 'Client #999 non trouvé',
        error: 'Not Found'
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.findOne(id);
  }

  @Patch(':id')
  @PremiumFeature(Feature.GESTION_CLIENTS)
  @ApiOperation({ 
    summary: 'Mettre à jour un client',
    description: `
      Modifie les informations d'un client existant.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Champs modifiables:**
      - Toutes les informations du client
      - Statut actif/inactif
      
      **Modification partielle:**
      - Seuls les champs fournis sont modifiés
      - Les autres champs restent inchangés
      
      **Cas d'usage courants:**
      - Mise à jour coordonnées (déménagement)
      - Correction email/téléphone
      - Ajout numéro fiscal (passage B2C → B2B)
      - Désactivation client (impayés, litiges)
      - Réactivation client
      
      **Bonnes pratiques:**
      - ⚠️ Ne pas supprimer un client avec historique
      - ✅ Le désactiver plutôt (estActif: false)
      - ✅ Garder la traçabilité des commandes
      
      **Validation:**
      - Email doit être valide si modifié
    `
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID du client', example: 1 })
  @ApiBody({
    type: UpdateClientDto,
    examples: {
      contact: {
        summary: 'Mettre à jour les coordonnées',
        value: {
          telephone: '+225 07 99 88 77',
          email: 'nouveau.contact@abc.com'
        }
      },
      adresse: {
        summary: 'Mettre à jour l\'adresse (déménagement)',
        value: {
          adresse: '456 Nouvelle Rue',
          ville: 'Yamoussoukro',
          pays: 'Côte d\'Ivoire'
        }
      },
      desactiver: {
        summary: 'Désactiver un client (impayés)',
        value: {
          estActif: false
        }
      },
      reactiver: {
        summary: 'Réactiver un client',
        value: {
          estActif: true
        }
      },
      b2b: {
        summary: 'Ajouter info fiscale (passage B2B)',
        value: {
          nom: 'Entreprise ABC SARL',
          numeroFiscal: 'CI-2024-ABC-67890'
        }
      }
    }
  })
  @ApiResponse({ 
    description: 'Client mis à jour avec succès',
    schema: {
      example: {
        id: 1,
        nom: 'Entreprise ABC SARL',
        email: 'nouveau.contact@abc.com',
        telephone: '+225 07 99 88 77',
        adresse: '123 Boulevard du Commerce',
        ville: 'Abidjan',
        pays: 'Côte d\'Ivoire',
        numeroFiscal: 'CI-2024-ABC-12345',
        estActif: true
      }
    }
  })
  @ApiNotFoundResponse({ description: 'Client non trouvé' })
  @ApiBadRequestResponse({ 
    description: 'Données invalides',
    schema: {
      example: {
        statusCode: 400,
        message: ['email doit être un email valide'],
        error: 'Bad Request'
      }
    }
  })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateClientDto: UpdateClientDto,
  ) {
    return this.clientsService.update(id, updateClientDto);
  }

  @Delete(':id')
  @PremiumFeature(Feature.GESTION_CLIENTS)
  @ApiOperation({ 
    summary: 'Supprimer un client',
    description: `
      Supprime définitivement un client du système.
      
      **Fonctionnalité:** 🆓 FREE
      
      **⚠️ ATTENTION - Action irréversible:**
      - Toutes les données du client sont supprimées
      - Les commandes associées restent (pour traçabilité comptable)
      - Les commandes seront liées à un client "supprimé"
      
      **Recommandation forte:**
      - **❌ NE PAS supprimer** un client avec historique de commandes
      - **✅ PLUTÔT désactiver** le client : PATCH /clients/:id { estActif: false }
      
      **Raisons de désactivation vs suppression:**
      - **Désactiver:** Impayés, litiges, inactif, mauvais payeur
      - **Supprimer:** Doublon, test, erreur de saisie, RGPD (droit à l'oubli)
      
      **Conformité RGPD:**
      - Droit à l'oubli du client
      - Conserver les données comptables obligatoires (factures)
      - Anonymiser plutôt que supprimer si commandes existantes
      
      **Alternative recommandée:**
      \`\`\`typescript
      // Au lieu de supprimer
      PATCH /clients/:id
      {
        "nom": "Client Anonymisé #1234",
        "email": null,
        "telephone": null,
        "adresse": "Anonymisé",
        "estActif": false
      }
      \`\`\`
      
      **Protection des données:**
      - Vérifier d'abord s'il y a des commandes
      - Demander confirmation à l'utilisateur
      - Logger l'action pour audit
    `
  })
  @ApiParam({ name: 'id', type: Number, description: 'ID du client', example: 5 })
  @ApiResponse({ 
    description: 'Client supprimé avec succès',
    schema: {
      example: {
        id: 5,
        nom: 'Client Test',
        message: 'Client supprimé avec succès'
      }
    }
  })
  @ApiNotFoundResponse({ description: 'Client non trouvé' })
  @ApiUnauthorizedResponse({ description: 'Token JWT manquant ou invalide' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.clientsService.remove(id);
  }
}