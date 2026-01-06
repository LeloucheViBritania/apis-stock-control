// ============================================
// FICHIER: src/modules/inventaire/inventaire.controller.updated.ts
// Controller Inventaire avec routes d'export intégrées
// ============================================

import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards,
  ParseIntPipe, HttpCode, HttpStatus, Res,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth, 
  ApiBody, ApiProduces,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { InventaireService } from './inventaire.service';
import { InventaireExportService } from './inventaire-export.service';
import { CreateInventaireDto } from './dto/create-inventaire.dto';
import { UpdateInventaireDto } from './dto/update-inventaire.dto';
import { AjusterQuantiteDto } from './dto/ajuster-quantite.dto';
import { ReserverStockDto } from './dto/reserver-stock.dto';
import { ExportInventaireQueryDto, ExportFormat } from '../../common/dto/export-query.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { PremiumFeature } from '../../common/decorators/premium-feature.decorator';
import { Feature } from '../../common/enums/features.enum';

@ApiTags('Inventaire (PREMIUM)')
@ApiBearerAuth('JWT-auth')
@Controller('inventaire')
@UseGuards(AuthGuard, PremiumGuard)
export class InventaireController {
  constructor(
    private readonly inventaireService: InventaireService,
    private readonly inventaireExportService: InventaireExportService,
  ) {}

  // ============================================
  // EXPORT DE L'INVENTAIRE
  // ============================================

  @Get('export')
  @HttpCode(HttpStatus.OK)
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({
    summary: 'Exporter l\'état de l\'inventaire',
    description: `
      Exporte l'état complet de l'inventaire multi-entrepôts.
      
      **Fonctionnalité:** 🔒 PREMIUM
      
      **Formats disponibles:**
      - **CSV:** Import facile dans d'autres systèmes
      - **XLSX:** Fichier Excel avec mise en forme
      - **PDF:** Document imprimable pour audit physique
      
      **Informations exportées:**
      - Entrepôt (nom et code)
      - Produit (référence et nom)
      - Catégorie du produit
      - Emplacement dans l'entrepôt
      - Quantités (totale, réservée, disponible)
      - Niveaux de stock (min/max)
      - Valorisation (coût unitaire × quantité)
      - Statut (Normal, Stock Faible, Rupture, Surstock)
      - Date de dernière vérification
      
      **Filtres disponibles:**
      - Par entrepôt
      - Uniquement les stocks faibles
      - Uniquement les ruptures
      
      **Utilisation:**
      - Inventaire physique
      - Audit de stock
      - Valorisation comptable
      - Analyse par entrepôt
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
    name: 'entrepotId',
    required: false,
    type: Number,
    description: 'Filtrer par entrepôt',
  })
  @ApiQuery({
    name: 'stockFaible',
    required: false,
    type: Boolean,
    description: 'Uniquement les stocks faibles',
  })
  @ApiQuery({
    name: 'ruptures',
    required: false,
    type: Boolean,
    description: 'Uniquement les ruptures de stock',
  })
  @ApiProduces('text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf')
  @ApiResponse({ status: 200, description: 'Fichier exporté avec succès' })
  @ApiResponse({ status: 400, description: 'Format non supporté' })
  @ApiResponse({ status: 403, description: 'Abonnement Premium requis' })
  async exportInventaire(
    @Query() query: ExportInventaireQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.inventaireExportService.export(
      query,
      query.format as ExportFormat,
      res,
    );
  }

  @Get('export/resume-entrepots')
  @HttpCode(HttpStatus.OK)
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({
    summary: 'Exporter un résumé par entrepôt',
    description: `
      Exporte un résumé de l'inventaire groupé par entrepôt.
      
      **Fonctionnalité:** 🔒 PREMIUM
      
      **Informations par entrepôt:**
      - Nombre de produits
      - Quantité totale et réservée
      - Taux d'occupation (si capacité définie)
      - Nombre de ruptures et alertes
      - Valeur totale du stock
      
      **Utilisation:**
      - Comparaison entre entrepôts
      - Équilibrage des stocks
      - Reporting direction
    `,
  })
  @ApiQuery({ name: 'format', enum: ['csv', 'xlsx', 'pdf'], required: true })
  @ApiProduces('text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf')
  async exportResumeEntrepots(
    @Query('format') format: string,
    @Res() res: Response,
  ): Promise<void> {
    await this.inventaireExportService.exportResumeParEntrepot(
      format as ExportFormat,
      res,
    );
  }

  // ============================================
  // ROUTES EXISTANTES (inchangées)
  // ============================================

  @Post()
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Créer une entrée d\'inventaire' })
  create(@Body() createInventaireDto: CreateInventaireDto) {
    return this.inventaireService.create(createInventaireDto);
  }

  @Get()
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Liste de l\'inventaire' })
  @ApiQuery({ name: 'entrepotId', required: false, type: Number })
  @ApiQuery({ name: 'produitId', required: false, type: Number })
  @ApiQuery({ name: 'stockFaible', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('entrepotId') entrepotId?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,   // Reçu comme string
    @Query('limit') limit?: string, // Reçu comme string
    // ... autres query params
  ) {
    // On prépare l'objet de filtres (argument 1)
    const filters = {
      entrepotId: entrepotId ? +entrepotId : undefined,
      search,
      // ... autres filtres
    };

    // On prépare l'objet de pagination (argument 2)
    const pagination = {
      page: page ? +page : 1,     // Conversion string -> number
      limit: limit ? +limit : 10, // Conversion string -> number
    };

    // On appelle le service avec 2 arguments distincts
    return this.inventaireService.findAll(filters, pagination);
  }

  @Get('statistiques')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Statistiques de l\'inventaire' })
  @ApiQuery({ name: 'entrepotId', required: false, type: Number })
  getStatistiques(
    @Query('entrepotId', new ParseIntPipe({ optional: true })) entrepotId?: number,
  ) {
    return this.inventaireService.getStatistiques(entrepotId);
  }

  @Get('stocks-faibles')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Stocks faibles' })
  @ApiQuery({ name: 'entrepotId', required: false, type: Number })
  getStocksFaibles(
    @Query('entrepotId', new ParseIntPipe({ optional: true })) entrepotId?: number,
  ) {
    return this.inventaireService.getStocksFaibles(entrepotId);
  }

  @Get('ruptures')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Ruptures de stock' })
  @ApiQuery({ name: 'entrepotId', required: false, type: Number })
  getRuptures(
    @Query('entrepotId', new ParseIntPipe({ optional: true })) entrepotId?: number,
  ) {
    return this.inventaireService.getRuptures(entrepotId);
  }

  @Get('produit/:produitId/disponibilites')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Disponibilité d\'un produit dans tous les entrepôts' })
  @ApiParam({ name: 'produitId', type: Number })
  getDisponibilitesProduit(@Param('produitId', ParseIntPipe) produitId: number) {
    return this.inventaireService.getDisponibilitesProduit(produitId);
  }

  @Get(':id')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Détails d\'une entrée d\'inventaire' })
  @ApiParam({ name: 'id', type: Number })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.inventaireService.findOne(id);
  }

  @Patch(':id')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Mettre à jour une entrée d\'inventaire' })
  @ApiParam({ name: 'id', type: Number })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateInventaireDto: UpdateInventaireDto,
  ) {
    return this.inventaireService.update(id, updateInventaireDto);
  }

  @Post(':id/ajuster')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Ajuster la quantité en stock' })
  @ApiParam({ name: 'id', type: Number })
  ajusterQuantite(
    @Param('id', ParseIntPipe) id: number,
    @Body() ajusterDto: AjusterQuantiteDto,
  ) {
    return this.inventaireService.ajusterQuantite(id, ajusterDto);
  }

  @Post(':id/reserver')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Réserver du stock' })
  @ApiParam({ name: 'id', type: Number })
  reserverStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() reserverDto: ReserverStockDto,
  ) {
    return this.inventaireService.reserverStock(id, reserverDto);
  }

  @Post(':id/liberer')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Libérer du stock réservé' })
  @ApiParam({ name: 'id', type: Number })
  libererStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() libererDto: ReserverStockDto,
  ) {
    return this.inventaireService.libererStock(id, libererDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Supprimer une entrée d\'inventaire' })
  @ApiParam({ name: 'id', type: Number })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.inventaireService.remove(id);
  }

  // === ROUTES SUPPLÉMENTAIRES ===

  @Get('stock-faible')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Alias pour stocks-faibles (compatibilité frontend)' })
  @ApiQuery({ name: 'entrepotId', required: false, type: Number })
  @ApiQuery({ name: 'categorieId', required: false, type: Number })
  getStockFaibleAlias(
    @Query('entrepotId') entrepotId?: string,
    @Query('categorieId') categorieId?: string,
  ) {
    return this.inventaireService.getStocksFaibles({
      entrepotId: entrepotId ? +entrepotId : undefined,
      categorieId: categorieId ? +categorieId : undefined,
    });
  }

  @Get('a-commander')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Produits à commander (sous le seuil de commande)' })
  @ApiQuery({ name: 'entrepotId', required: false, type: Number })
  getACommander(@Query('entrepotId') entrepotId?: string) {
    return this.inventaireService.getACommander(entrepotId ? +entrepotId : undefined);
  }

  @Get('valeur')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Valeur totale de l\'inventaire' })
  @ApiQuery({ name: 'entrepotId', required: false, type: Number })
  @ApiQuery({ name: 'categorieId', required: false, type: Number })
  getValeur(
    @Query('entrepotId') entrepotId?: string,
    @Query('categorieId') categorieId?: string,
  ) {
    return this.inventaireService.getValeur({
      entrepotId: entrepotId ? +entrepotId : undefined,
      categorieId: categorieId ? +categorieId : undefined,
    });
  }

  @Get('produit/:produitId')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Inventaire d\'un produit dans tous les entrepôts' })
  @ApiParam({ name: 'produitId', type: Number })
  getByProduit(@Param('produitId', ParseIntPipe) produitId: number) {
    return this.inventaireService.getByProduit(produitId);
  }

  @Get('entrepot/:entrepotId')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Inventaire d\'un entrepôt' })
  @ApiParam({ name: 'entrepotId', type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getByEntrepot(
    @Param('entrepotId', ParseIntPipe) entrepotId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventaireService.findAll(
      { entrepotId },
      { page: page ? +page : undefined, limit: limit ? +limit : undefined }
    );
  }

  @Patch(':id/emplacement')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Modifier l\'emplacement d\'un inventaire' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: { properties: { emplacement: { type: 'string' } } } })
  changeEmplacement(
    @Param('id', ParseIntPipe) id: number,
    @Body('emplacement') emplacement: string,
  ) {
    return this.inventaireService.update(id, { emplacement });
  }
}