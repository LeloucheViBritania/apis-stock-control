import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
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

@Controller('entrepots')
@UseGuards(AuthGuard, PremiumGuard, RolesGuard)
export class EntrepotsController {
  constructor(private readonly entrepotsService: EntrepotsService) {}

  @Post()
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  create(@Body() createEntrepotDto: CreateEntrepotDto) {
    return this.entrepotsService.create(createEntrepotDto);
  }

  @Get()
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  findAll(@Query('estActif') estActif?: string) {
    return this.entrepotsService.findAll(estActif ? estActif === 'true' : undefined);
  }

  @Get(':id')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.entrepotsService.findOne(id);
  }

  @Get(':id/inventaire')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  getInventaire(@Param('id', ParseIntPipe) id: number) {
    return this.entrepotsService.getInventaire(id);
  }

  @Get(':id/statistiques')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  getStatistiques(@Param('id', ParseIntPipe) id: number) {
    return this.entrepotsService.getStatistiques(id);
  }

  @Patch(':id')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateEntrepotDto: UpdateEntrepotDto) {
    return this.entrepotsService.update(id, updateEntrepotDto);
  }

  @Delete(':id')
  @PremiumFeature(Feature.MULTI_ENTREPOTS)
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.entrepotsService.remove(id);
  }
}