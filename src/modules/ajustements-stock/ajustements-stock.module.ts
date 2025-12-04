import { Module } from '@nestjs/common';
import { AjustementsStockService } from './ajustements-stock.service';
import { AjustementsStockController } from './ajustements-stock.controller';

@Module({
  controllers: [AjustementsStockController],
  providers: [AjustementsStockService],
})
export class AjustementsStockModule {}
