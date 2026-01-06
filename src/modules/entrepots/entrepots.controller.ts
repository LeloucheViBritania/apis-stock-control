import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query,
  UseGuards, ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiBody,
} from '@nestjs/swagger';
import { EntrepotsService } from './entrepots.service';
import { CreateEntrepotDto } from './dto/create-entrepot.dto';
import { UpdateEntrepotDto } from './dto/update-entrepot.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PremiumFeature } from '../../common/decorators/premium-feature.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Feature } from '../../common/enums/features.enum';
import { Role } from '../../common/guards/roles.guard';

@ApiTags('Entrepôts')
@ApiBearerAuth('JWT-auth')
@Controller('entrepots')
@UseGuards(AuthGuard, PremiumGuard, RolesGuard)
export class EntrepotsController {
  constructor(private readonly entrepotsService: EntrepotsService) {}

  // ==========================================
  // CRUD DE BASE
  // ==========================================

  @Post()
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({ summary: 'Créer un entrepôt' })
  @ApiBody({ type: CreateEntrepotDto })
  create(@Body() createEntrepotDto: CreateEntrepotDto) {
    return this.entrepotsService.create(createEntrepotDto);
  }

  @Get()
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Lister les entrepôts' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'estActif', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('search') search?: string,
    @Query('estActif') estActif?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.entrepotsService.findAll({
      search,
      estActif: estActif !== undefined ? estActif === 'true' : undefined,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get('actifs')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Lister les entrepôts actifs' })
  getActifs() {
    return this.entrepotsService.getActifs();
  }

  @Get('statistiques')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Statistiques globales des entrepôts' })
  getStatistiquesGlobales() {
    return this.entrepotsService.getStatistiquesGlobales();
  }

  @Post('comparer')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Comparer plusieurs entrepôts' })
  @ApiBody({ schema: { properties: { entrepotIds: { type: 'array', items: { type: 'number' } } } } })
  comparer(@Body('entrepotIds') entrepotIds: number[]) {
    return this.entrepotsService.comparer(entrepotIds);
  }

  @Get(':id')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Détails d\'un entrepôt' })
  @ApiParam({ name: 'id', type: Number })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.entrepotsService.findOne(id);
  }

  @Patch(':id')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({ summary: 'Mettre à jour un entrepôt' })
  @ApiParam({ name: 'id', type: Number })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateEntrepotDto: UpdateEntrepotDto,
  ) {
    return this.entrepotsService.update(id, updateEntrepotDto);
  }

  @Delete(':id')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Supprimer un entrepôt' })
  @ApiParam({ name: 'id', type: Number })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.entrepotsService.remove(id);
  }

  // ==========================================
  // INVENTAIRE ET STOCK
  // ==========================================

  @Get(':id/inventaire')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Inventaire d\'un entrepôt' })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'categorieId', required: false, type: Number })
  @ApiQuery({ name: 'stockFaible', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getInventaire(
    @Param('id', ParseIntPipe) id: number,
    @Query('search') search?: string,
    @Query('categorieId') categorieId?: string,
    @Query('stockFaible') stockFaible?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.entrepotsService.getInventaire(id, {
      search,
      categorieId: categorieId ? +categorieId : undefined,
      stockFaible: stockFaible === 'true',
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get(':id/stock-faible')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Produits en stock faible' })
  @ApiParam({ name: 'id', type: Number })
  getStockFaible(@Param('id', ParseIntPipe) id: number) {
    return this.entrepotsService.getStockFaible(id);
  }

  // ==========================================
  // MOUVEMENTS ET TRANSFERTS
  // ==========================================

  @Get(':id/mouvements')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Mouvements de stock d\'un entrepôt' })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({ name: 'typeMouvement', required: false })
  @ApiQuery({ name: 'dateDebut', required: false })
  @ApiQuery({ name: 'dateFin', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getMouvements(
    @Param('id', ParseIntPipe) id: number,
    @Query('typeMouvement') typeMouvement?: string,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.entrepotsService.getMouvements(id, {
      typeMouvement, dateDebut, dateFin,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get(':id/transferts-pending')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Transferts en attente pour l\'entrepôt' })
  @ApiParam({ name: 'id', type: Number })
  getTransfertsPending(@Param('id', ParseIntPipe) id: number) {
    return this.entrepotsService.getTransfertsPending(id);
  }

  // ==========================================
  // COMMANDES
  // ==========================================

  @Get(':id/commandes')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Commandes liées à l\'entrepôt' })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({ name: 'statut', required: false })
  @ApiQuery({ name: 'dateDebut', required: false })
  @ApiQuery({ name: 'dateFin', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getCommandes(
    @Param('id', ParseIntPipe) id: number,
    @Query('statut') statut?: string,
    @Query('dateDebut') dateDebut?: string,
    @Query('dateFin') dateFin?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.entrepotsService.getCommandes(id, {
      statut, dateDebut, dateFin,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  // ==========================================
  // STATISTIQUES ET CAPACITÉ
  // ==========================================

  @Get(':id/statistiques')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Statistiques d\'un entrepôt' })
  @ApiParam({ name: 'id', type: Number })
  getStatistiques(@Param('id', ParseIntPipe) id: number) {
    return this.entrepotsService.getStatistiques(id);
  }

  @Get(':id/capacite')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @ApiOperation({ summary: 'Capacité et utilisation de l\'entrepôt' })
  @ApiParam({ name: 'id', type: Number })
  getCapacite(@Param('id', ParseIntPipe) id: number) {
    return this.entrepotsService.getCapacite(id);
  }

  @Patch(':id/responsable')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Changer le responsable de l\'entrepôt' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: { properties: { responsableId: { type: 'number' } } } })
  changeResponsable(
    @Param('id', ParseIntPipe) id: number,
    @Body('responsableId') responsableId: number,
  ) {
    return this.entrepotsService.changeResponsable(id, responsableId);
  }
}
