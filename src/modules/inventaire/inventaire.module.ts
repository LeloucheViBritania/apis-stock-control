import { Module } from '@nestjs/common';
import { InventaireService } from './inventaire.service';
import { InventaireController } from './inventaire.controller';

@Module({
  controllers: [InventaireController],
  providers: [InventaireService],
  exports: [InventaireService],
})
export class InventaireModule {}
