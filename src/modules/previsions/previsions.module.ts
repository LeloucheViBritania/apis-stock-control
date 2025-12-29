// ============================================
// FICHIER: src/modules/previsions/previsions.module.ts
// Module NestJS pour les prévisions
// ============================================

import { Module } from '@nestjs/common';
import { PrevisionsController } from './previsions.controller';
import { PrevisionsService } from './previsions.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PrevisionsController],
  providers: [PrevisionsService],
  exports: [PrevisionsService],
})
export class PrevisionsModule {}