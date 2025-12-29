// ============================================
// FICHIER: src/modules/reapprovisionnement/reapprovisionnement.module.ts
// Module NestJS pour le réapprovisionnement
// ============================================

import { Module } from '@nestjs/common';
import { ReapprovisionnementController } from './reapprovisionnement.controller';
import { ReapprovisionnementService } from './reapprovisionnement.service';
import { PrevisionsModule } from '../previsions/previsions.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    PrevisionsModule, // Dépendance pour les calculs de prévision
  ],
  controllers: [ReapprovisionnementController],
  providers: [ReapprovisionnementService],
  exports: [ReapprovisionnementService],
})
export class ReapprovisionnementModule {}