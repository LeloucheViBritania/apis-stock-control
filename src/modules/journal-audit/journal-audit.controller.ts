import {
  Controller,
  Get,
  Param,
  Query,
  Delete,
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JournalAuditService } from './journal-audit.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/guards/roles.guard';

/**
 * Contrôleur pour la gestion du journal d'audit
 * 
 *  Fonctionnalité - Nécessite un abonnement premium
 * 
 * Ce contrôleur expose les endpoints pour :
 * - Consultation des logs d'audit
 * - Historique par utilisateur ou enregistrement
 * - Statistiques d'utilisation
 * - Export des logs
 * - Nettoyage des logs anciens (admin uniquement)
 * 
 * @controller journal-audit
 */
@ApiTags('Journal d\'Audit')
@ApiBearerAuth()
@Controller('journal-audit')
@UseGuards(AuthGuard, PremiumGuard)
export class JournalAuditController {
  constructor(private readonly journalAuditService: JournalAuditService) {}

  /**
   * Récupérer tous les logs d'audit avec filtres
   */
  @Get()
  @ApiOperation({
    summary: 'Récupérer tous les logs d\'audit',
    description: 'Liste tous les logs d\'audit avec possibilité de filtrage avancé et pagination.',
  })
  @ApiQuery({
    name: 'utilisateurId',
    required: false,
    type: Number,
    description: 'Filtrer par utilisateur',
  })
  @ApiQuery({
    name: 'action',
    required: false,
    type: String,
    description: 'Filtrer par type d\'action (ex: CREATE_PRODUIT, UPDATE_FOURNISSEUR)',
  })
  @ApiQuery({
    name: 'nomTable',
    required: false,
    type: String,
    description: 'Filtrer par nom de table',
  })
  @ApiQuery({
    name: 'enregistrementId',
    required: false,
    type: Number,
    description: 'Filtrer par ID d\'enregistrement',
  })
  @ApiQuery({
    name: 'dateDebut',
    required: false,
    type: String,
    description: 'Date de début (ISO 8601)',
    example: '2025-01-01T00:00:00.000Z',
  })
  @ApiQuery({
    name: 'dateFin',
    required: false,
    type: String,
    description: 'Date de fin (ISO 8601)',
    example: '2025-12-31T23:59:59.999Z',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Numéro de page',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de résultats par page',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des logs récupérée avec succès',
    schema: {
      example: {
        data: [
          {
            id: 1,
            utilisateurId: 5,
            action: 'CREATE_PRODUIT',
            nomTable: 'produits',
            enregistrementId: 42,
            nouvellesValeurs: {
              nom: 'Écran LCD 15 pouces',
              reference: 'LCD-15-001',
              prixVente: 150.0,
            },
            adresseIp: '192.168.1.100',
            dateCreation: '2025-11-19T10:30:00.000Z',
            utilisateur: {
              id: 5,
              nomUtilisateur: 'jdupont',
              nomComplet: 'Jean Dupont',
              email: 'j.dupont@example.com',
            },
          },
        ],
        meta: {
          total: 1250,
          page: 1,
          limit: 50,
          totalPages: 25,
        },
      },
    },
  })
  findAll(
    @Query('utilisateurId', new ParseIntPipe({ optional: true })) utilisateurId?: number,
    @Query('action') action?: string,
    @Query('nomTable') nomTable?: string,
    @Query('enregistrementId', new ParseIntPipe({ optional: true })) enregistrementId?: number,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.journalAuditService.findAll({
      utilisateurId,
      action,
      nomTable,
      enregistrementId,
      dateDebut: dateDebut ? new Date(dateDebut) : undefined,
      dateFin: dateFin ? new Date(dateFin) : undefined,
      page,
      limit,
    });
  }

  /**
   * Obtenir les statistiques d'utilisation
   */
  @Get('statistiques')
  @ApiOperation({
    summary: 'Obtenir les statistiques d\'utilisation',
    description: 'Retourne des métriques sur l\'activité dans le système.',
  })
  @ApiQuery({
    name: 'dateDebut',
    required: false,
    type: String,
    description: 'Date de début (ISO 8601)',
  })
  @ApiQuery({
    name: 'dateFin',
    required: false,
    type: String,
    description: 'Date de fin (ISO 8601)',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistiques récupérées avec succès',
    schema: {
      example: {
        totalActions: 1250,
        utilisateursActifs: 15,
        actionsParType: [
          { action: 'CREATE_PRODUIT', count: 250 },
          { action: 'UPDATE_PRODUIT', count: 180 },
          { action: 'DELETE_PRODUIT', count: 50 },
        ],
        tablesModifiees: [
          { table: 'produits', count: 480 },
          { table: 'commandes', count: 320 },
          { table: 'clients', count: 180 },
        ],
      },
    },
  })
  getStatistiques(
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
  ) {
    return this.journalAuditService.getStatistiques(
      dateDebut ? new Date(dateDebut) : undefined,
      dateFin ? new Date(dateFin) : undefined,
    );
  }

  /**
   * Obtenir l'activité récente
   */
  @Get('activite-recente')
  @ApiOperation({
    summary: 'Obtenir l\'activité récente',
    description: 'Retourne les dernières actions effectuées dans le système.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre d\'actions à retourner',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Activité récente récupérée avec succès',
  })
  getActiviteRecente(@Query('limit', new ParseIntPipe({ optional: true })) limit?: number) {
    return this.journalAuditService.getActiviteRecente(limit);
  }

  /**
   * Obtenir les utilisateurs les plus actifs
   */
  @Get('utilisateurs-actifs')
  @ApiOperation({
    summary: 'Obtenir les utilisateurs les plus actifs',
    description: 'Retourne les utilisateurs avec le plus d\'actions.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre d\'utilisateurs à retourner',
    example: 10,
  })
  @ApiQuery({
    name: 'dateDebut',
    required: false,
    type: String,
    description: 'Date de début (ISO 8601)',
  })
  @ApiQuery({
    name: 'dateFin',
    required: false,
    type: String,
    description: 'Date de fin (ISO 8601)',
  })
  @ApiResponse({
    status: 200,
    description: 'Liste des utilisateurs actifs',
    schema: {
      example: [
        {
          id: 5,
          nomUtilisateur: 'jdupont',
          nomComplet: 'Jean Dupont',
          email: 'j.dupont@example.com',
          role: 'GESTIONNAIRE',
          nombreActions: 350,
        },
      ],
    },
  })
  getUtilisateursPlusActifs(
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
  ) {
    return this.journalAuditService.getUtilisateursPlusActifs(
      limit,
      dateDebut ? new Date(dateDebut) : undefined,
      dateFin ? new Date(dateFin) : undefined,
    );
  }

  /**
   * Rechercher dans les logs
   */
  @Get('rechercher')
  @ApiOperation({
    summary: 'Rechercher dans les logs',
    description: 'Permet de rechercher des logs par terme de recherche.',
  })
  @ApiQuery({
    name: 'q',
    required: true,
    type: String,
    description: 'Terme de recherche',
    example: 'urgent',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de résultats',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Résultats de la recherche',
  })
  rechercher(
    @Query('q') searchTerm: string,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.journalAuditService.rechercher(searchTerm, limit);
  }

  /**
   * Exporter les logs
   */
  @Get('exporter')
  @ApiOperation({
    summary: 'Exporter les logs au format JSON',
    description: 'Exporte tous les logs correspondant aux filtres au format JSON.',
  })
  @ApiQuery({
    name: 'utilisateurId',
    required: false,
    type: Number,
    description: 'Filtrer par utilisateur',
  })
  @ApiQuery({
    name: 'action',
    required: false,
    type: String,
    description: 'Filtrer par action',
  })
  @ApiQuery({
    name: 'nomTable',
    required: false,
    type: String,
    description: 'Filtrer par table',
  })
  @ApiQuery({
    name: 'dateDebut',
    required: false,
    type: String,
    description: 'Date de début',
  })
  @ApiQuery({
    name: 'dateFin',
    required: false,
    type: String,
    description: 'Date de fin',
  })
  @ApiResponse({
    status: 200,
    description: 'Logs exportés avec succès',
  })
  exporterLogs(
    @Query('utilisateurId', new ParseIntPipe({ optional: true })) utilisateurId?: number,
    @Query('action') action?: string,
    @Query('nomTable') nomTable?: string,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
  ) {
    return this.journalAuditService.exporterLogs({
      utilisateurId,
      action,
      nomTable,
      dateDebut: dateDebut ? new Date(dateDebut) : undefined,
      dateFin: dateFin ? new Date(dateFin) : undefined,
    });
  }

  /**
   * Obtenir l'historique d'un utilisateur
   */
  @Get('utilisateur/:id')
  @ApiOperation({
    summary: 'Obtenir l\'historique d\'un utilisateur',
    description: 'Retourne toutes les actions effectuées par un utilisateur spécifique.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID de l\'utilisateur',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Nombre de logs à récupérer',
    example: 50,
  })
  @ApiResponse({
    status: 200,
    description: 'Historique de l\'utilisateur',
  })
  getHistoriqueUtilisateur(
    @Param('id', ParseIntPipe) id: number,
    @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    return this.journalAuditService.getHistoriqueUtilisateur(id, limit);
  }

  /**
   * Obtenir l'historique d'un enregistrement
   */
  @Get('enregistrement/:nomTable/:id')
  @ApiOperation({
    summary: 'Obtenir l\'historique d\'un enregistrement',
    description: 'Retourne toutes les modifications d\'un enregistrement spécifique.',
  })
  @ApiParam({
    name: 'nomTable',
    type: String,
    description: 'Nom de la table',
    example: 'produits',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID de l\'enregistrement',
    example: 42,
  })
  @ApiResponse({
    status: 200,
    description: 'Historique de l\'enregistrement',
  })
  getHistoriqueEnregistrement(
    @Param('nomTable') nomTable: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.journalAuditService.getHistoriqueEnregistrement(nomTable, id);
  }

  /**
   * Récupérer un log par ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer un log d\'audit par ID',
    description: 'Retourne les détails complets d\'un log spécifique.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID du log',
  })
  @ApiResponse({
    status: 200,
    description: 'Log trouvé',
  })
  @ApiResponse({
    status: 404,
    description: 'Log non trouvé',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.journalAuditService.findOne(id);
  }

  /**
   * Supprimer les logs anciens (ADMIN uniquement)
   */
  @Delete('nettoyer')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Supprimer les logs anciens',
    description: 'ADMIN UNIQUEMENT - Supprime les logs plus vieux qu\'une certaine date.',
  })
  @ApiQuery({
    name: 'dateAvant',
    required: true,
    type: String,
    description: 'Supprimer les logs avant cette date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @ApiResponse({
    status: 200,
    description: 'Logs supprimés avec succès',
    schema: {
      example: {
        message: '1250 logs supprimés',
        nombreSupprime: 1250,
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Accès refusé - Administrateur requis',
  })
  async supprimerLogsAnciens(@Query('dateAvant') dateAvant: string) {
    const count = await this.journalAuditService.supprimerLogsAnciens(
      new Date(dateAvant),
    );

    return {
      message: `${count} logs supprimés`,
      nombreSupprime: count,
    };
  }
}