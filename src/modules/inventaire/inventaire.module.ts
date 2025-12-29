import { Module } from '@nestjs/common';
import { InventaireService } from './inventaire.service';
import { InventaireExportService } from './inventaire-export.service';
import { InventaireController } from './inventaire.controller';

@Module({
  controllers: [InventaireController],
  providers: [InventaireService, InventaireExportService],
  exports: [InventaireService, InventaireExportService],
})
export class InventaireModule {}
