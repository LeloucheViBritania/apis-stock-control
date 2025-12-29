// ============================================
// FICHIER: src/common/services/import.module.ts
// Module d'import global
// ============================================

import { Module, Global } from '@nestjs/common';
import { ImportService } from './import.service';

@Global()
@Module({
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportModule {}