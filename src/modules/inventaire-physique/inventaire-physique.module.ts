import { Module } from '@nestjs/common';
import { InventairePhysiqueController } from './inventaire-physique.controller';
import { InventairePhysiqueService } from './inventaire-physique.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InventairePhysiqueController],
  providers: [InventairePhysiqueService],
  exports: [InventairePhysiqueService],
})
export class InventairePhysiqueModule {}