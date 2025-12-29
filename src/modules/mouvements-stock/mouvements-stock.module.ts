import { Module } from '@nestjs/common';
import { MouvementsStockService } from './mouvements-stock.service';
import { MouvementsStockExportService } from './mouvements-stock-export.service';
import { MouvementsStockController } from './mouvements-stock.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MouvementsStockController],
  providers: [MouvementsStockService, MouvementsStockExportService],
  exports: [MouvementsStockService, MouvementsStockExportService],
})
export class MouvementsStockModule {}