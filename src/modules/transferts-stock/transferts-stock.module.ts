import { Module } from '@nestjs/common';
import { TransfertsStockService } from './transferts-stock.service';
import { TransfertsStockController } from './transferts-stock.controller';

@Module({
  controllers: [TransfertsStockController],
  providers: [TransfertsStockService],
})
export class TransfertsStockModule {}
