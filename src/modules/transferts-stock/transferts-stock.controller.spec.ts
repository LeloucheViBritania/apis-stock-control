import { Test, TestingModule } from '@nestjs/testing';
import { TransfertsStockController } from './transferts-stock.controller';
import { TransfertsStockService } from './transferts-stock.service';

describe('TransfertsStockController', () => {
  let controller: TransfertsStockController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransfertsStockController],
      providers: [TransfertsStockService],
    }).compile();

    controller = module.get<TransfertsStockController>(TransfertsStockController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
