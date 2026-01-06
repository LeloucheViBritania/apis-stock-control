// ============================================
// FICHIER: src/modules/produits/produits.controller.ts
// Controller Produits avec routes d'export intégrées
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
  Res,
  HttpCode,
  HttpStatus,
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
  ApiProduces,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ProduitsService } from './produits.service';
import { ProduitsExportService } from './produits-export.service';
import { CreateProduitDto } from './dto/create-produit.dto';
import { UpdateProduitDto } from './dto/update-produit.dto';
import { AjusterStockDto } from './dto/ajuster-stock.dto';
import { AjouterFournisseurDto } from './dto/create-produit-fournisseur.dto';
import { ModifierFournisseurDto } from './dto/update-produit-fournisseur.dto';
import { ExportProduitsQueryDto, ExportFormat } from '../../common/dto/export-query.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { PremiumFeature } from '../../common/decorators/premium-feature.decorator';
import { Feature } from '../../common/enums/features.enum';

@ApiTags('Produits')
@ApiBearerAuth('JWT-auth')
@Controller('produits')
@UseGuards(AuthGuard, PremiumGuard)
export class ProduitsController {
  constructor(
    private readonly produitsService: ProduitsService,
    private readonly produitsExportService: ProduitsExportService,
  ) {}

  // ============================================
  // EXPORT DES PRODUITS
  // ============================================

  @Get('export')
  @HttpCode(HttpStatus.OK)
  @PremiumFeature(Feature.GESTION_PRODUITS)
  @ApiOperation({
    summary: 'Exporter la liste des produits',
    description: `
      Exporte la liste complète des produits dans le format souhaité.
      
      **Fonctionnalité:** 🆓 FREE
      
      **Formats disponibles:**
      - **CSV:** Format texte, compatible Excel et Google Sheets
      - **XLSX:** Fichier Excel avec mise en forme professionnelle
      - **PDF:** Document prêt à imprimer avec en-tête et pied de page
      
      **Informations exportées:**
      - Référence et nom du produit
      - Catégorie et marque
      - Niveaux de stock (actuel, min, max)
      - Prix (coût et vente)
      - Valeur totale du stock
      - Statut (Normal, Stock Faible, Rupture)
      
      **Filtres disponibles:**
      - Par catégorie
      - Par statut actif/inactif
      - Uniquement les produits en stock faible
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
    name: 'categorieId',
    required: false,
    type: Number,
    description: 'Filtrer par catégorie',
  })
  @ApiQuery({
    name: 'estActif',
    required: false,
    type: Boolean,
    description: 'Filtrer par statut actif',
  })
  @ApiQuery({
    name: 'stockFaible',
    required: false,
    type: Boolean,
    description: 'Uniquement les produits en stock faible',
  })
  @ApiProduces('text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf')
  @ApiResponse({
    status: 200,
    description: 'Fichier exporté avec succès',
  })
  @ApiResponse({
    status: 400,
    description: 'Format d\'export non supporté',
  })
  async exportProduits(
    @Query() query: ExportProduitsQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.produitsExportService.export(
      query,
      query.format as ExportFormat,
      res,
    );
  }

  // ============================================
  // ROUTES EXISTANTES (à conserver)
  // ============================================

  @Post()
  @PremiumFeature(Feature.GESTION_PRODUITS)
  @ApiOperation({ summary: 'Créer un nouveau produit' })
  create(@Body() createProduitDto: CreateProduitDto, @Request() req) {
    return this.produitsService.create(createProduitDto);
  }

  @Get()
  @PremiumFeature(Feature.GESTION_PRODUITS)
  @ApiOperation({ summary: 'Liste des produits' })
  @ApiQuery({ name: 'categorieId', required: false, type: Number })
  @ApiQuery({ name: 'estActif', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
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
  @ApiOperation({ summary: 'Statistiques globales des produits' })
  getStatistiques() {
    return this.produitsService.getStatistiques();
  }

  @Get('stock-faible')
  @PremiumFeature(Feature.ALERTES_STOCK)
  @ApiOperation({ summary: 'Produits en stock faible' })
  getStockFaible() {
    return this.produitsService.getStockFaible();
  }

  @Get('top')
  @PremiumFeature(Feature.GESTION_PRODUITS)
  @ApiOperation({ summary: 'Top produits par stock' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getTopProduits(@Query('limit') limit?: string) {
    return this.produitsService.getTopProduits(limit ? +limit : 10);
  }

  @Get(':id')
  @PremiumFeature(Feature.GESTION_PRODUITS)
  @ApiOperation({ summary: 'Détails d\'un produit' })
  @ApiParam({ name: 'id', type: Number })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.produitsService.findOne(id);
  }

  @Patch(':id')
  @PremiumFeature(Feature.GESTION_PRODUITS)
  @ApiOperation({ summary: 'Mettre à jour un produit' })
  @ApiParam({ name: 'id', type: Number })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProduitDto: UpdateProduitDto,
  ) {
    return this.produitsService.update(id, updateProduitDto);
  }

  @Delete(':id')
  @PremiumFeature(Feature.GESTION_PRODUITS)
  @ApiOperation({ summary: 'Supprimer un produit' })
  @ApiParam({ name: 'id', type: Number })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.produitsService.remove(id);
  }

  @Post(':id/ajuster-stock')
  @PremiumFeature(Feature.MOUVEMENTS_STOCK_BASIQUE)
  @ApiOperation({ summary: 'Ajuster le stock d\'un produit' })
  @ApiParam({ name: 'id', type: Number })
  ajusterStock(
    @Param('id', ParseIntPipe) id: number,
    @Body() ajusterStockDto: AjusterStockDto,
    @Request() req,
  ) {
    return this.produitsService.ajusterStock(id, ajusterStockDto, req.user?.id);
  }

  // === ROUTES PREMIUM - Relation Produit-Fournisseur ===

  @Post(':id/fournisseurs')
    @PremiumFeature(Feature.RELATION_PRODUITS_FOURNISSEURS)
    @ApiOperation({ summary: 'Ajouter un fournisseur à un produit' })
    @ApiParam({ name: 'id', type: Number })
    ajouterFournisseur(
      @Param('id', ParseIntPipe) id: number,
      @Body() ajouterFournisseurDto: AjouterFournisseurDto,
    ) {
      // CORRECTION ICI :
      // On sépare l'ID du fournisseur du reste des données (prix, délai, etc.)
      const { fournisseurId, ...data } = ajouterFournisseurDto;

      // On appelle le service avec les 3 arguments attendus :
      // 1. ID du produit
      // 2. ID du fournisseur
      // 3. Les données additionnelles (data)
    return this.produitsService.ajouterFournisseur(id, fournisseurId, data);
  }

  @Patch(':id/fournisseurs/:fournisseurId')
  @PremiumFeature(Feature.RELATION_PRODUITS_FOURNISSEURS)
  @ApiOperation({ summary: 'Modifier la relation produit-fournisseur' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'fournisseurId', type: Number })
  modifierFournisseur(
    @Param('id', ParseIntPipe) id: number,
    @Param('fournisseurId', ParseIntPipe) fournisseurId: number,
    @Body() modifierFournisseurDto: ModifierFournisseurDto,
  ) {
    return this.produitsService.modifierFournisseur(id, fournisseurId, modifierFournisseurDto);
  }

  @Delete(':id/fournisseurs/:fournisseurId')
  @PremiumFeature(Feature.RELATION_PRODUITS_FOURNISSEURS)
  @ApiOperation({ summary: 'Retirer un fournisseur d\'un produit' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'fournisseurId', type: Number })
  retirerFournisseur(
    @Param('id', ParseIntPipe) id: number,
    @Param('fournisseurId', ParseIntPipe) fournisseurId: number,
  ) {
    return this.produitsService.retirerFournisseur(id, fournisseurId);
  }

  // === ROUTES MANQUANTES - Fournisseurs ===

  @Get(':id/fournisseurs')
  @PremiumFeature(Feature.RELATION_PRODUITS_FOURNISSEURS)
  @ApiOperation({ summary: 'Lister les fournisseurs d\'un produit' })
  @ApiParam({ name: 'id', type: Number })
  getFournisseurs(@Param('id', ParseIntPipe) id: number) {
    return this.produitsService.getFournisseurs(id);
  }

  @Post(':id/fournisseurs/:fournisseurId/prefere')
  @PremiumFeature(Feature.RELATION_PRODUITS_FOURNISSEURS)
  @ApiOperation({ summary: 'Définir un fournisseur comme préféré' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'fournisseurId', type: Number })
  definirFournisseurPrefere(
    @Param('id', ParseIntPipe) id: number,
    @Param('fournisseurId', ParseIntPipe) fournisseurId: number,
  ) {
    return this.produitsService.definirFournisseurPrefere(id, fournisseurId);
  }

  @Get(':id/fournisseur-prefere')
  @PremiumFeature(Feature.RELATION_PRODUITS_FOURNISSEURS)
  @ApiOperation({ summary: 'Obtenir le fournisseur préféré du produit' })
  @ApiParam({ name: 'id', type: Number })
  getFournisseurPrefere(@Param('id', ParseIntPipe) id: number) {
    return this.produitsService.getFournisseurPrefere(id);
  }

  @Get(':id/meilleur-prix')
  @PremiumFeature(Feature.RELATION_PRODUITS_FOURNISSEURS)
  @ApiOperation({ summary: 'Obtenir le meilleur prix fournisseur' })
  @ApiParam({ name: 'id', type: Number })
  getMeilleurPrix(@Param('id', ParseIntPipe) id: number) {
    return this.produitsService.getMeilleurPrix(id);
  }

  // === IMPORT ===

  @Post('import')
  @PremiumFeature(Feature.GESTION_PRODUITS)
  @ApiOperation({ summary: 'Importer des produits depuis un fichier' })
  @ApiBody({ 
    schema: { 
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' }
      }
    }
  })
  import(@Body() formData: any, @Request() req) {
    return this.produitsService.import(formData, req.user?.id);
  }
}