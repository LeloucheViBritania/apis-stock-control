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
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { TransfertsStockService } from './transferts-stock.service';
import { CreateTransfertStockDto } from './dto/create-transfert.dto';
import { UpdateTransfertStockDto } from './dto/update-transfert.dto'
import { ReceptionPartielleDto } from './dto/reception-partielle.dto'
import { AuthGuard } from '../../common/guards/auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';

/**
 * Contrôleur pour la gestion des transferts de stock entre entrepôts
 *
 *  Fonctionnalité PREMIUM - Nécessite un abonnement premium
 *
 * Ce contrôleur expose les endpoints pour :
 * - Créer des transferts
 * - Expédier et réceptionner
 * - Gérer les statuts
 * - Réception partielle
 * - Annulation
 * - Statistiques
 *
 * @controller transferts-stock
 */
@ApiTags(' Transferts Stock (PREMIUM)')
@ApiBearerAuth()
@Controller('transferts-stock')
@UseGuards(AuthGuard, PremiumGuard)
export class TransfertsStockController {
  constructor(
    private readonly transfertsStockService: TransfertsStockService,
  ) {}

  /**
   * Créer un nouveau transfert
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Créer un transfert de stock',
    description:
      'Crée un nouveau transfert entre deux entrepôts avec statut EN_ATTENTE. Les stocks ne sont pas encore modifiés.',
  })
  @ApiBody({
    type: CreateTransfertStockDto,
    examples: {
      exemple1: {
        summary: 'Transfert standard',
        value: {
          entrepotSourceId: 1,
          entrepotDestinationId: 2,
          dateTransfert: '2025-11-20',
          notes: 'Réapprovisionnement urgent',
          lignes: [
            { produitId: 42, quantite: 50 },
            { produitId: 15, quantite: 30 },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Transfert créé avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Données invalides (source = destination, etc.)',
  })
  @ApiResponse({
    status: 404,
    description: 'Entrepôt ou produit non trouvé',
  })
  create(@Body() createDto: CreateTransfertStockDto, @Request() req) {
    return this.transfertsStockService.createTransfert(createDto, req.user.id);
  }

  /**
   * Récupérer tous les transferts
   */
  @Get()
  @ApiOperation({
    summary: 'Récupérer tous les transferts',
    description: 'Liste tous les transferts avec possibilité de filtrage.',
  })
  @ApiQuery({
    name: 'entrepotSourceId',
    required: false,
    type: Number,
    description: 'Filtrer par entrepôt source',
  })
  @ApiQuery({
    name: 'entrepotDestinationId',
    required: false,
    type: Number,
    description: 'Filtrer par entrepôt destination',
  })
  @ApiQuery({
    name: 'statut',
    required: false,
    enum: ['EN_ATTENTE', 'EN_TRANSIT', 'COMPLETE', 'ANNULE'],
    description: 'Filtrer par statut',
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
    description: 'Liste des transferts',
  })
  findAll(
    @Query('entrepotSourceId', new ParseIntPipe({ optional: true }))
    entrepotSourceId?: number,
    @Query('entrepotDestinationId', new ParseIntPipe({ optional: true }))
    entrepotDestinationId?: number,
    @Query('statut') statut?: string,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
  ) {
    return this.transfertsStockService.findAll({
      entrepotSourceId,
      entrepotDestinationId,
      statut,
      dateDebut: dateDebut ? new Date(dateDebut) : undefined,
      dateFin: dateFin ? new Date(dateFin) : undefined,
    });
  }

  /**
   * Obtenir les statistiques des transferts
   */
  @Get('statistiques')
  @ApiOperation({
    summary: 'Obtenir les statistiques des transferts',
    description: 'Retourne des statistiques sur les transferts par statut.',
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
    description: 'Statistiques des transferts',
    schema: {
      example: {
        totalTransferts: 125,
        enAttente: 8,
        enTransit: 12,
        completes: 95,
        annules: 10,
      },
    },
  })
  getStatistiques(
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
  ) {
    return this.transfertsStockService.getStatistiques({
      dateDebut: dateDebut ? new Date(dateDebut) : undefined,
      dateFin: dateFin ? new Date(dateFin) : undefined,
    });
  }

  /**
   * Récupérer un transfert par ID
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Récupérer un transfert par ID',
    description: "Retourne les détails complets d'un transfert.",
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID du transfert',
  })
  @ApiResponse({
    status: 200,
    description: 'Transfert trouvé',
  })
  @ApiResponse({
    status: 404,
    description: 'Transfert non trouvé',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.transfertsStockService.findOne(id);
  }

  /**
   * Mettre à jour un transfert (EN_ATTENTE uniquement)
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Mettre à jour un transfert',
    description:
      "Met à jour les informations d'un transfert en attente (date, notes).",
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID du transfert',
  })
  @ApiBody({
    type: UpdateTransfertStockDto,
    examples: {
      exemple1: {
        summary: 'Reporter la date',
        value: {
          dateTransfert: '2025-11-21',
          notes: 'Date reportée à demain',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Transfert mis à jour',
  })
  @ApiResponse({
    status: 400,
    description: 'Impossible de modifier (pas en attente)',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateTransfertStockDto,
  ) {
    return this.transfertsStockService.update(id, updateDto);
  }

  /**
   * Expédier un transfert
   */
  @Post(':id/expedier')
  @ApiOperation({
    summary: 'Expédier un transfert',
    description:
      "Passe le transfert de EN_ATTENTE à EN_TRANSIT. Décrémente les stocks de l'entrepôt source.",
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID du transfert',
  })
  @ApiResponse({
    status: 200,
    description: 'Transfert expédié avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Stock insuffisant ou statut invalide',
  })
  expedier(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.transfertsStockService.expedierTransfert(id, req.user.id);
  }

  /**
   * Réceptionner un transfert (complet)
   */
  @Post(':id/receptionner')
  @ApiOperation({
    summary: 'Réceptionner un transfert',
    description:
      "Passe le transfert de EN_TRANSIT à COMPLETE. Incrémente les stocks de l'entrepôt destination.",
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID du transfert',
  })
  @ApiResponse({
    status: 200,
    description: 'Transfert réceptionné avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Statut invalide (pas en transit)',
  })
  receptionner(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.transfertsStockService.receptionnerTransfert(id, req.user.id);
  }

  /**
   * Réceptionner partiellement un transfert
   */
  @Post(':id/receptionner-partiel')
  @ApiOperation({
    summary: 'Réceptionner partiellement un transfert',
    description:
      'Permet de réceptionner des quantités différentes des quantités expédiées (manquants, dommages).',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID du transfert',
  })
  @ApiBody({
    type: ReceptionPartielleDto,
    examples: {
      exemple1: {
        summary: 'Réception partielle',
        value: {
          lignes: [
            { produitId: 42, quantite: 45 }, // 5 manquants sur 50
            { produitId: 15, quantite: 30 }, // Complet
          ],
          notes: '5 unités endommagées lors du transport',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Réception partielle enregistrée',
  })
  receptionnerPartiel(
    @Param('id', ParseIntPipe) id: number,
    @Body() receptionDto: ReceptionPartielleDto,
    @Request() req,
  ) {
    return this.transfertsStockService.receptionnerPartiel(
      id,
      receptionDto,
      req.user.id,
    );
  }

  /**
   * Annuler un transfert
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Annuler un transfert',
    description:
      'Annule un transfert. Si en transit, recrédite le stock source.',
  })
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'ID du transfert',
  })
  @ApiQuery({
    name: 'raison',
    required: false,
    type: String,
    description: "Raison de l'annulation",
  })
  @ApiResponse({
    status: 200,
    description: 'Transfert annulé avec succès',
  })
  @ApiResponse({
    status: 400,
    description: "Impossible d'annuler (déjà complété)",
  })
  annuler(
    @Param('id', ParseIntPipe) id: number,
    @Query('raison') raison: string,
    @Request() req,
  ) {
    return this.transfertsStockService.annulerTransfert(
      id,
      req.user.id,
      raison,
    );
  }
}
