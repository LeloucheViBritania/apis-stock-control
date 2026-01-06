import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query,
  UseGuards, ParseIntPipe, Request,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiBody,
} from '@nestjs/swagger';
import { UtilisateursService } from './utilisateurs.service';
import { CreateUtilisateurDto } from './dto/create-utilisateur.dto';
import { UpdateUtilisateurDto } from './dto/update-utilisateur.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/guards/roles.guard';

@ApiTags('Utilisateurs')
@ApiBearerAuth('JWT-auth')
@Controller('utilisateurs')
@UseGuards(AuthGuard)
export class UtilisateursController {
  constructor(private readonly utilisateursService: UtilisateursService) {}

  // ==========================================
  // CRUD DE BASE
  // ==========================================

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Créer un utilisateur' })
  @ApiBody({ type: CreateUtilisateurDto })
  create(@Body() createUtilisateurDto: CreateUtilisateurDto) {
    return this.utilisateursService.create(createUtilisateurDto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({ summary: 'Lister les utilisateurs' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'role', required: false })
  @ApiQuery({ name: 'estActif', required: false, type: Boolean })
  @ApiQuery({ name: 'tierAbonnement', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('estActif') estActif?: string,
    @Query('tierAbonnement') tierAbonnement?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.utilisateursService.findAll({
      search, role, tierAbonnement,
      estActif: estActif !== undefined ? estActif === 'true' : undefined,
      page: page ? +page : undefined,
      limit: limit ? +limit : undefined,
    });
  }

  @Get('actifs')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({ summary: 'Lister les utilisateurs actifs' })
  getActifs() {
    return this.utilisateursService.getActifs();
  }

  @Get('gestionnaires')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({ summary: 'Lister les gestionnaires' })
  getGestionnaires() {
    return this.utilisateursService.getByRole('GESTIONNAIRE');
  }

  @Get('statistiques')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Statistiques des utilisateurs' })
  getStatistiques() {
    return this.utilisateursService.getStatistiques();
  }

  @Get('role/:role')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({ summary: 'Lister les utilisateurs par rôle' })
  @ApiParam({ name: 'role', type: String })
  getByRole(@Param('role') role: string) {
    return this.utilisateursService.getByRole(role);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Obtenir son profil' })
  getProfile(@Request() req) {
    return this.utilisateursService.findOne(req.user.id);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  @ApiOperation({ summary: 'Détails d\'un utilisateur' })
  @ApiParam({ name: 'id', type: Number })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.utilisateursService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Mettre à jour un utilisateur' })
  @ApiParam({ name: 'id', type: Number })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUtilisateurDto: UpdateUtilisateurDto,
  ) {
    return this.utilisateursService.update(id, updateUtilisateurDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Supprimer un utilisateur' })
  @ApiParam({ name: 'id', type: Number })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.utilisateursService.remove(id);
  }

  // ==========================================
  // GESTION DU MOT DE PASSE
  // ==========================================

  @Patch('change-password')
  @ApiOperation({ summary: 'Changer son mot de passe' })
  changePassword(@Request() req, @Body() changePasswordDto: any) {
    return this.utilisateursService.changePassword(req.user.id, changePasswordDto);
  }

  @Post(':id/reset-password')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Réinitialiser le mot de passe d\'un utilisateur' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: { properties: { newPassword: { type: 'string' } } } })
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body('newPassword') newPassword: string,
  ) {
    return this.utilisateursService.resetPassword(id, newPassword);
  }

  // ==========================================
  // ACTIVATION / DÉSACTIVATION
  // ==========================================

  @Post(':id/activer')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Activer un utilisateur' })
  @ApiParam({ name: 'id', type: Number })
  activer(@Param('id', ParseIntPipe) id: number) {
    return this.utilisateursService.activer(id);
  }

  @Post(':id/desactiver')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Désactiver un utilisateur' })
  @ApiParam({ name: 'id', type: Number })
  desactiver(@Param('id', ParseIntPipe) id: number) {
    return this.utilisateursService.desactiver(id);
  }

  // ==========================================
  // GESTION DES RÔLES
  // ==========================================

  @Patch(':id/role')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Changer le rôle d\'un utilisateur' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ schema: { properties: { role: { type: 'string', enum: ['ADMIN', 'GESTIONNAIRE', 'EMPLOYE'] } } } })
  changeRole(
    @Param('id', ParseIntPipe) id: number,
    @Body('role') role: string,
  ) {
    return this.utilisateursService.changeRole(id, role);
  }

  // ==========================================
  // GESTION PREMIUM
  // ==========================================

  @Post(':id/toggle-premium')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Basculer le statut premium' })
  @ApiParam({ name: 'id', type: Number })
  togglePremium(@Param('id', ParseIntPipe) id: number) {
    return this.utilisateursService.togglePremium(id);
  }

  @Post(':id/activer-premium')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Activer le premium pour un utilisateur' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ 
    schema: { 
      properties: { 
        tier: { type: 'string', enum: ['PREMIUM', 'ENTERPRISE'] },
        dateExpiration: { type: 'string', format: 'date-time' }
      } 
    } 
  })
  activerPremium(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { tier?: string; dateExpiration?: string },
  ) {
    return this.utilisateursService.activerPremium(id, data.tier, data.dateExpiration);
  }

  @Post(':id/desactiver-premium')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Désactiver le premium pour un utilisateur' })
  @ApiParam({ name: 'id', type: Number })
  desactiverPremium(@Param('id', ParseIntPipe) id: number) {
    return this.utilisateursService.desactiverPremium(id);
  }
}
