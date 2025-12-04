import { Controller } from '@nestjs/common';
import { AjustementsStockService } from './ajustements-stock.service';

@Controller('ajustements-stock')
export class AjustementsStockController {
  constructor(private readonly ajustementsStockService: AjustementsStockService) {}
}
