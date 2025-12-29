// ============================================
// FICHIER: src/modules/rapports/rapports.module.ts
// Module Rapports avec service d'export
// ============================================

import { Module } from '@nestjs/common';
import { RapportsController } from './rapports.controller';
import { RapportsExportService } from './rapports-export.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RapportsController],
  providers: [RapportsExportService],
  exports: [RapportsExportService],
})
export class RapportsModule {}