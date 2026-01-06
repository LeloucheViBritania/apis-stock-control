import { 
  Controller, Get, Post, Body, Patch, Param, Delete, Query, 
  UseGuards, ParseIntPipe, Request, Res, HttpCode, HttpStatus 
} from '@nestjs/common';
import { 
  ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, 
  ApiParam, ApiBody, ApiProduces,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { CommandesService } from './commandes.service';
import { CommandesExportService } from './commandes-export.service';
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
  constructor(
    private readonly commandesService: CommandesService,
    private readonly commandesExportService: CommandesExportService,
  ) {}

  // ==========================================
  // CRUD DE BASE
  // ==========================================

  @Post()
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Créer une nouvelle commande' })
  @ApiBody({ type: CreateCommandeDto })
  create(@Body() createCommandeDto: CreateCommandeDto, @Request() req) {
    return this.commandesService.create(createCommandeDto, req.user?.id);
  }

  @Get()
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Liste des commandes' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'statut', required: false, enum: ['EN_ATTENTE', 'VALIDEE', 'EN_PREPARATION', 'EXPEDIEE', 'LIVREE', 'ANNULEE'] })
  @ApiQuery({ name: 'clientId', required: false, type: Number })
  @ApiQuery({ name: 'entrepotId', required: false, type: Number })
  @ApiQuery({ name: 'dateDebut', required: false })
  @ApiQuery({ name: 'dateFin', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('search') search?: string,
    @Query('statut') statut?: string,
    @Query('clientId') clientId?: string,
    @Query('entrepotId') entrepotId?: string,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.commandesService.findAll({
      search, statut, dateDebut, dateFin,
      clientId: clientId ? +clientId : undefined,
      entrepotId: entrepotId ? +entrepotId : undefined,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get('statistiques')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Statistiques des commandes' })
  @ApiQuery({ name: 'dateDebut', required: false })
  @ApiQuery({ name: 'dateFin', required: false })
  getStatistiques(
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
  ) {
    return this.commandesService.getStatistiques({ dateDebut, dateFin });
  }

  @Get('par-statut')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Comptes des commandes par statut' })
  getParStatut() {
    return this.commandesService.getParStatut();
  }

  @Get('export')
  @HttpCode(HttpStatus.OK)
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Exporter la liste des commandes' })
  @ApiQuery({ name: 'format', enum: ['csv', 'excel', 'pdf'], required: false })
  @ApiQuery({ name: 'dateDebut', required: false })
  @ApiQuery({ name: 'dateFin', required: false })
  @ApiQuery({ name: 'statut', required: false })
  @ApiQuery({ name: 'clientId', required: false, type: Number })
  @ApiProduces('text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf')
  async exportCommandes(
    @Query('format') format: string = 'excel',
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('statut') statut?: string,
    @Query('clientId') clientId?: string,
    @Res() res?: Response,
  ): Promise<void> {
    return this.commandesExportService.export(
      { dateDebut, dateFin, statut, clientId: clientId ? +clientId : undefined, format: format as any },
      format as any,
      res!,
    );
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
  @ApiOperation({ summary: 'Mettre à jour une commande' })
  @ApiParam({ name: 'id', type: Number })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateCommandeDto: UpdateCommandeDto,
  ) {
    return this.commandesService.update(id, updateCommandeDto);
  }

  @Delete(':id')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Supprimer une commande' })
  @ApiParam({ name: 'id', type: Number })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.commandesService.remove(id);
  }

  // ==========================================
  // GESTION DES STATUTS
  // ==========================================

  @Patch(':id/statut')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Changer le statut d\'une commande' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: { properties: { statut: { type: 'string' }, notes: { type: 'string' } } } })
  changeStatut(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { statut: string; notes?: string },
    @Request() req,
  ) {
    return this.commandesService.changeStatut(id, data.statut, data.notes, req.user?.id);
  }

  @Post(':id/valider')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Valider une commande' })
  @ApiParam({ name: 'id', type: Number })
  valider(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.commandesService.valider(id, req.user?.id);
  }

  @Post(':id/expedier')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Expédier une commande' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ 
    schema: { 
      properties: { 
        transporteur: { type: 'string' },
        numeroSuivi: { type: 'string' },
        notes: { type: 'string' }
      } 
    },
    required: false
  })
  expedier(
    @Param('id', ParseIntPipe) id: number,
    @Body() data?: { transporteur?: string; numeroSuivi?: string; notes?: string },
    @Request() req?,
  ) {
    return this.commandesService.expedier(id, data, req?.user?.id);
  }

  @Post(':id/livrer')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Marquer une commande comme livrée' })
  @ApiParam({ name: 'id', type: Number })
  livrer(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.commandesService.livrer(id, req.user?.id);
  }

  @Post(':id/annuler')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Annuler une commande' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: { properties: { raison: { type: 'string' } } } })
  annuler(
    @Param('id', ParseIntPipe) id: number,
    @Body('raison') raison?: string,
    @Request() req?,
  ) {
    return this.commandesService.annuler(id, raison, req?.user?.id);
  }

  // ==========================================
  // GESTION DES LIGNES
  // ==========================================

  @Post(':id/lignes')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Ajouter une ligne à la commande' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ 
    schema: { 
      properties: { 
        produitId: { type: 'number' },
        quantite: { type: 'number' },
        prixUnitaire: { type: 'number' },
        remise: { type: 'number' }
      } 
    }
  })
  ajouterLigne(
    @Param('id', ParseIntPipe) id: number,
    @Body() ligne: { produitId: number; quantite: number; prixUnitaire?: number; remise?: number },
  ) {
    return this.commandesService.ajouterLigne(id, ligne);
  }

  @Patch(':id/lignes/:ligneId')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Modifier une ligne de commande' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'ligneId', type: Number })
  modifierLigne(
    @Param('id', ParseIntPipe) id: number,
    @Param('ligneId', ParseIntPipe) ligneId: number,
    @Body() data: { quantite?: number; prixUnitaire?: number; remise?: number },
  ) {
    return this.commandesService.modifierLigne(id, ligneId, data);
  }

  @Delete(':id/lignes/:ligneId')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Supprimer une ligne de commande' })
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'ligneId', type: Number })
  supprimerLigne(
    @Param('id', ParseIntPipe) id: number,
    @Param('ligneId', ParseIntPipe) ligneId: number,
  ) {
    return this.commandesService.supprimerLigne(id, ligneId);
  }

  // ==========================================
  // DOCUMENTS PDF
  // ==========================================

  @Get(':id/facture')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Générer la facture PDF' })
  @ApiParam({ name: 'id', type: Number })
  @ApiProduces('application/pdf')
  genererFacture(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    return this.commandesService.genererFacture(id, res);
  }

  @Get(':id/bon-livraison')
  @PremiumFeature(Feature.GESTION_COMMANDES)
  @ApiOperation({ summary: 'Générer le bon de livraison PDF' })
  @ApiParam({ name: 'id', type: Number })
  @ApiProduces('application/pdf')
  genererBonLivraison(
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    return this.commandesService.genererBonLivraison(id, res);
  }
}
