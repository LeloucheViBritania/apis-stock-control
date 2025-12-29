// ============================================
// FICHIER: src/modules/commandes/commandes-avancees.module.ts
// Module NestJS pour les fonctionnalités avancées de commandes
// ============================================

import { Module } from '@nestjs/common';
import { CommandesAvanceesController, DevisController } from './commandes-avancees.controller';
import { CommandesAvanceesService } from './commandes-avancees.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CommandesAvanceesController, DevisController],
  providers: [CommandesAvanceesService],
  exports: [CommandesAvanceesService],
})
export class CommandesAvanceesModule {}