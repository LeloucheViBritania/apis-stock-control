// ============================================
// FICHIER: src/modules/clients/clients-avances.controller.ts
// Controller pour les fonctionnalités avancées clients
// ============================================

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
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
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { ClientsAvancesService } from './clients-avances.service';
import {
  FiltresHistoriqueAchatsDto,
  BloquerClientDto,
  DebloquerClientDto,
  FiltresSegmentationDto,
  AjouterNoteClientDto,
  SegmentClient,
} from './dto/clients-avances.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard, Role } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('👥 Clients - Fonctionnalités Avancées')
@ApiBearerAuth('JWT-auth')
@Controller('clients')
@UseGuards(AuthGuard, RolesGuard)
export class ClientsAvancesController {
  constructor(
    private readonly clientsAvancesService: ClientsAvancesService,
  ) {}

  // ============================================
  // HISTORIQUE DES ACHATS
  // ============================================

  @Get(':id/historique-achats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Historique des achats d\'un client',
    description: `
      Retourne l'historique complet des commandes d'un client.
      
      **Informations:**
      - Liste des commandes avec détails
      - Résumé (total, montant, panier moyen)
      - Produits les plus achetés
      - Date de dernière commande
      
      **Filtres disponibles:**
      - Période (date début/fin)
      - Statut des commandes
      - Entrepôt
      
      **Options:**
      - Inclure les lignes de commande détaillées
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du client' })
  @ApiQuery({ name: 'dateDebut', required: false, example: '2024-01-01' })
  @ApiQuery({ name: 'dateFin', required: false, example: '2024-12-31' })
  @ApiQuery({ name: 'statut', required: false, example: 'LIVREE' })
  @ApiQuery({ name: 'inclureLignes', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Historique des achats',
    schema: {
      example: {
        clientId: 1,
        client: { nom: 'Société ABC', email: 'contact@abc.ci', segment: 'FIDELE' },
        resume: {
          nombreCommandes: 25,
          montantTotal: 12500000,
          panierMoyen: 500000,
          derniereCommande: '2025-01-15',
        },
        commandes: [],
        produitsFrequents: [],
      },
    },
  })
  async getHistoriqueAchats(
    @Param('id', ParseIntPipe) id: number,
    @Query() filtres: FiltresHistoriqueAchatsDto,
  ) {
    return this.clientsAvancesService.getHistoriqueAchats(id, filtres);
  }

  // ============================================
  // SOLDE / ENCOURS CLIENT
  // ============================================

  @Get(':id/solde')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solde et encours d\'un client',
    description: `
      Retourne la situation financière d'un client:
      
      **Solde:**
      - Total facturé
      - Total payé
      - Solde actuel (montant dû)
      - Crédit disponible
      
      **Échéancier:**
      - Non échu
      - Échu 0-30 jours
      - Échu 31-60 jours
      - Échu 61-90 jours
      - Échu > 90 jours
      
      **Indicateurs:**
      - Score de crédit (0-100)
      - Niveau de risque
      - Tendance (amélioration/stable/dégradation)
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du client' })
  @ApiResponse({
    status: 200,
    description: 'Solde et encours',
    schema: {
      example: {
        clientId: 1,
        client: { nom: 'Société ABC', statut: 'ACTIF' },
        limiteCredit: 5000000,
        solde: {
          factureTotal: 8500000,
          paye: 6000000,
          soldeActuel: 2500000,
          creditDisponible: 2500000,
          tauxUtilisation: 50,
        },
        echeancier: {
          nonEchu: 1500000,
          echu0_30: 500000,
          echu31_60: 300000,
          echu61_90: 200000,
          echuPlus90: 0,
          totalEchu: 1000000,
        },
        indicateurs: {
          scoreCredit: 75,
          risque: 'MOYEN',
          tendance: 'STABLE',
        },
      },
    },
  })
  async getSolde(@Param('id', ParseIntPipe) id: number) {
    return this.clientsAvancesService.getSoldeClient(id);
  }

  // ============================================
  // STATISTIQUES CLIENT
  // ============================================

  @Get(':id/statistiques')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Statistiques détaillées d\'un client',
    description: `
      Analyse complète du comportement d'achat d'un client:
      
      **Commandes:**
      - Total, année, mois en cours
      - Fréquence d'achat
      
      **Chiffre d'affaires:**
      - Total, année, mois
      - Panier moyen
      - Valeur client (lifetime value)
      
      **Évolution:**
      - Graphique CA/commandes sur 12 mois
      
      **Paiements:**
      - Délai moyen de paiement
      - Taux de paiement à temps
      
      **Produits:**
      - Catégorie préférée
      - Top produits achetés
      
      **Segmentation:**
      - Segment actuel
      - Potentiel de croissance
      - Recommandations personnalisées
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du client' })
  @ApiResponse({ status: 200, description: 'Statistiques client' })
  async getStatistiques(@Param('id', ParseIntPipe) id: number) {
    return this.clientsAvancesService.getStatistiquesClient(id);
  }

  // ============================================
  // BLOQUER UN CLIENT
  // ============================================

  @Post(':id/bloquer')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Bloquer un client',
    description: `
      Bloque un client (mauvais payeur, litige, etc.)
      
      **Raisons possibles:**
      - IMPAYE: Factures impayées
      - LITIGE: Litige en cours
      - FRAUDE: Suspicion de fraude
      - INACTIF: Client inactif
      - DEMANDE_CLIENT: À la demande du client
      - AUTRE: Autre raison
      
      **Effets:**
      - Le client ne peut plus passer de commandes
      - Un historique de blocage est créé
      - Une notification peut être envoyée
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du client' })
  @ApiBody({ type: BloquerClientDto })
  @ApiResponse({ status: 200, description: 'Client bloqué' })
  @ApiResponse({ status: 409, description: 'Client déjà bloqué' })
  async bloquer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BloquerClientDto,
    @Request() req: any,
  ) {
    return this.clientsAvancesService.bloquerClient(id, dto, req.user.id);
  }

  @Post(':id/debloquer')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Débloquer un client',
    description: 'Retire le blocage d\'un client et le remet en statut actif.',
  })
  @ApiParam({ name: 'id', description: 'ID du client' })
  @ApiBody({ type: DebloquerClientDto })
  @ApiResponse({ status: 200, description: 'Client débloqué' })
  @ApiResponse({ status: 400, description: 'Client non bloqué' })
  async debloquer(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DebloquerClientDto,
    @Request() req: any,
  ) {
    return this.clientsAvancesService.debloquerClient(id, dto, req.user.id);
  }

  // ============================================
  // SEGMENTATION
  // ============================================

  @Get('segments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Segmentation des clients',
    description: `
      Analyse et répartition des clients par segment.
      
      **Segments:**
      - NOUVEAU: < 3 mois
      - OCCASIONNEL: 1-2 commandes/an
      - REGULIER: 3-6 commandes/an
      - FIDELE: 7-12 commandes/an
      - VIP: > 12 commandes/an ou CA élevé
      - INACTIF: Pas de commande depuis 6 mois
      - A_RISQUE: Retards de paiement fréquents
      
      **Données:**
      - Nombre de clients par segment
      - CA par segment
      - Panier moyen par segment
      - Répartition géographique
      - Alertes (clients à risque, inactifs, etc.)
      - Top clients
    `,
  })
  @ApiQuery({ name: 'segment', required: false, enum: SegmentClient })
  @ApiQuery({ name: 'caMin', required: false, example: 1000000 })
  @ApiQuery({ name: 'caMax', required: false, example: 10000000 })
  @ApiQuery({ name: 'inclureBloques', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'Données de segmentation',
    schema: {
      example: {
        resume: {
          totalClients: 150,
          clientsActifs: 135,
          clientsBloques: 5,
          caTotal: 450000000,
        },
        segments: [
          {
            segment: 'VIP',
            nombreClients: 10,
            pourcentage: 7,
            caTotal: 200000000,
            description: 'Plus de 12 commandes/an ou CA élevé',
          },
        ],
        alertes: {
          clientsARisque: 8,
          clientsInactifs: 15,
          clientsDepassementCredit: 3,
        },
      },
    },
  })
  async getSegmentation(@Query() filtres: FiltresSegmentationDto) {
    return this.clientsAvancesService.getSegmentation(filtres);
  }

  @Post('segments/recalculer')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Recalculer la segmentation',
    description: 'Force le recalcul des segments pour tous les clients.',
  })
  @ApiResponse({ status: 200, description: 'Segmentation recalculée' })
  async recalculerSegments() {
    return this.clientsAvancesService.recalculerSegments();
  }

  // ============================================
  // NOTES CLIENT
  // ============================================

  @Post(':id/notes')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({
    summary: 'Ajouter une note à un client',
    description: `
      Ajoute une note ou un commentaire sur la fiche client.
      
      **Types de notes:**
      - Appels téléphoniques
      - Échanges email
      - Points d'attention
      - Rappels
      
      **Priorités:**
      - BASSE
      - NORMALE
      - HAUTE
      - URGENTE
    `,
  })
  @ApiParam({ name: 'id', description: 'ID du client' })
  @ApiBody({ type: AjouterNoteClientDto })
  @ApiResponse({ status: 201, description: 'Note ajoutée' })
  async ajouterNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AjouterNoteClientDto,
    @Request() req: any,
  ) {
    return this.clientsAvancesService.ajouterNote(id, dto, req.user.id);
  }
}