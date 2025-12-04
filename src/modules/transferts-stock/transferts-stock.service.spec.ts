import { Test, TestingModule } from '@nestjs/testing';
import { TransfertsStockService } from './transferts-stock.service';

describe('TransfertsStockService', () => {
  let service: TransfertsStockService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransfertsStockService],
    }).compile();

    service = module.get<TransfertsStockService>(TransfertsStockService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
