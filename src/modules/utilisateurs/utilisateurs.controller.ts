import { Controller, Get, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { UtilisateursService } from './utilisateurs.service';
import { AuthGuard } from '../../common/guards/auth.guard'; // Supposé existant
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/guards/roles.guard';
@Controller('utilisateurs')
@UseGuards(AuthGuard, RolesGuard)
export class UtilisateursController {
  constructor(private readonly utilisateursService: UtilisateursService) {}

  @Get()
  @Roles(Role.ADMIN, Role.GESTIONNAIRE)
  findAll() {
    return this.utilisateursService.findAll();
  }

  @Get('profile')
  getProfile(@Request() req) {
    return this.utilisateursService.findOne(req.user.id);
  }

  @Patch('change-password')
  changePassword(@Request() req, @Body() changePasswordDto: any) {
    return this.utilisateursService.changePassword(req.user.id, changePasswordDto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  update(@Param('id') id: string, @Body() updateUtilisateurDto: any) {
    return this.utilisateursService.update(+id, updateUtilisateurDto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.utilisateursService.remove(+id);
  }
}