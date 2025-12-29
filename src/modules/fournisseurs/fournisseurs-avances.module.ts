// ============================================
// FICHIER: src/modules/fournisseurs/fournisseurs-avances.module.ts
// Module NestJS pour les fonctionnalités avancées fournisseurs
// ============================================

import { Module } from '@nestjs/common';
import { FournisseursAvancesController } from './fournisseurs-avances.controller';
import { FournisseursAvancesService } from './fournisseurs-avances.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FournisseursAvancesController],
  providers: [FournisseursAvancesService],
  exports: [FournisseursAvancesService],
})
export class FournisseursAvancesModule {}