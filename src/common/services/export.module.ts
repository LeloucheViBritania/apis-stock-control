// ============================================
// FICHIER: src/common/services/export.module.ts
// Module d'export commun
// ============================================

import { Module, Global } from '@nestjs/common';
import { ExportService } from './export.service';

@Global()
@Module({
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}