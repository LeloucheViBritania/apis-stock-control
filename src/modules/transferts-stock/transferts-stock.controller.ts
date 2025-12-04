import { Controller } from '@nestjs/common';
import { TransfertsStockService } from './transferts-stock.service';

@Controller('transferts-stock')
export class TransfertsStockController {
  constructor(private readonly transfertsStockService: TransfertsStockService) {}
}
