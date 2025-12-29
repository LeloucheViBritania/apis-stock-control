// ============================================
// FICHIER: src/modules/commandes/commandes.controller.updated.ts
// Controller Commandes avec routes d'export intégrées
// ============================================

import { 
  Controller, Get, Post, Body, Patch, Param, Delete, Query, 
  UseGuards, ParseIntPipe, Request, Res, HttpCode, HttpStatus 
} from '@nestjs/common';
import { 
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, 
  ApiParam, ApiBody, ApiNotFoundResponse, ApiBadRequestResponse, 
  ApiUnauthorizedResponse, ApiForbiddenResponse, ApiProduces,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CommandesService } from './commandes.service';
import { CommandesExportService } from './commandes-export.service';
import { CreateCommandeDto } from './dto/create-commande.dto';
import { UpdateCommandeDto } from './dto/update-commande.dto';
import { ExportCommandesQueryDto, ExportFormat } from '../../common/dto/export-query.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { PremiumFeature } from '../../common/decorators/premium-feature.decorator';
import { Feature } from '../../common/enums/features.enum';

@ApiTags('Commandes')
@ApiBearerAuth('JWT-auth')
@Controller('commandes')
@UseGuards(AuthGuard, PremiumGuard)
export class CommandesController {
  constructor(
    private readonly commandesService: CommandesService,
    private readonly commandesExportService: CommandesExportService,
  ) {}

  // ============================================
  // EXPORT DES COMMANDES
  // ============================================

  @Get('export')
  @HttpCode(HttpStatus.OK)
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({
    summary: 'Exporter la liste des commandes',
    description: `
      Exporte les commandes dans le format souhaité.
      
      **Fonctionnalité:**  FREE
      
      **Formats disponibles:**
      - **CSV:** Format texte pour import/export
      - **XLSX:** Fichier Excel formaté
      - **PDF:** Document imprimable
      
      **Informations exportées:**
      - Numéro et dates de commande
      - Informations client
      - Montant total et nombre d'articles
      - Statut de la commande
      - Créateur de la commande
      
      **Filtres disponibles:**
      - Par période (date début/fin)
      - Par statut
      - Par client
    `,
  })
  @ApiQuery({
    name: 'format',
    enum: ['csv', 'xlsx', 'pdf'],
    required: true,
    description: 'Format d\'export souhaité',
    example: 'xlsx',
  })
  @ApiQuery({
    name: 'dateDebut',
    required: false,
    type: String,
    description: 'Date de début (YYYY-MM-DD)',
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'dateFin',
    required: false,
    type: String,
    description: 'Date de fin (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @ApiQuery({
    name: 'statut',
    required: false,
    enum: ['EN_ATTENTE', 'EN_TRAITEMENT', 'EXPEDIE', 'LIVRE', 'ANNULE'],
    description: 'Filtrer par statut',
  })
  @ApiQuery({
    name: 'clientId',
    required: false,
    type: Number,
    description: 'Filtrer par client',
  })
  @ApiProduces('text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf')
  @ApiResponse({ status: 200, description: 'Fichier exporté avec succès' })
  @ApiResponse({ status: 400, description: 'Format non supporté' })
  async exportCommandes(
    @Query() query: ExportCommandesQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.commandesExportService.export(
      query,
      query.format as ExportFormat,
      res,
    );
  }

  @Get('export/detaille')
  @HttpCode(HttpStatus.OK)
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({
    summary: 'Exporter les commandes avec détail des lignes',
    description: `
      Exporte un détail complet des commandes avec une ligne par produit commandé.
      
      **Fonctionnalité:**  FREE
      
      **Utilisation:**
      - Analyse détaillée des ventes
      - Statistiques par produit
      - Suivi de performance
    `,
  })
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx', 'pdf'], required: true })
  @ApiQuery({ name: 'dateDebut', required: false, type: String })
  @ApiQuery({ name: 'dateFin', required: false, type: String })
  @ApiQuery({ name: 'statut', required: false, enum: ['EN_ATTENTE', 'EN_TRAITEMENT', 'EXPEDIE', 'LIVRE', 'ANNULE'] })
  @ApiProduces('text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf')
  async exportCommandesDetaille(
    @Query() query: ExportCommandesQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.commandesExportService.exportDetaille(
      query,
      query.format as ExportFormat,
      res,
    );
  }

  // ============================================
  // ROUTES EXISTANTES (inchangées)
  // ============================================

  @Post()
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Créer une nouvelle commande' })
  create(@Body() createCommandeDto: CreateCommandeDto, @Request() req) {
    return this.commandesService.create(createCommandeDto, req.user?.id);
  }

  @Get()
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Liste des commandes' })
  @ApiQuery({ name: 'statut', required: false })
  @ApiQuery({ name: 'clientId', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('statut') statut?: string,
    @Query('clientId') clientId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.commandesService.findAll({
      statut,
      clientId: clientId ? +clientId : undefined,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get('statistiques')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Statistiques des commandes' })
  getStatistiques() {
    return this.commandesService.getStatistiques();
  }

  @Get(':id')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Détails d\'une commande' })
  @ApiParam({ name: 'id', type: Number })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.commandesService.findOne(id);
  }

  @Patch(':id')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Mettre à jour le statut d\'une commande' })
  @ApiParam({ name: 'id', type: Number })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCommandeDto: UpdateCommandeDto,
  ) {
    return this.commandesService.update(id, updateCommandeDto);
  }

/*  
 @Post(':id/annuler')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Annuler une commande' })
  @ApiParam({ name: 'id', type: Number })
  annuler(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.commandesService.annuler(id, req.user?.id);
  }

  @Delete(':id')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Supprimer une commande' })
  @ApiParam({ name: 'id', type: Number })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.commandesService.remove(id);
  }
     */
}