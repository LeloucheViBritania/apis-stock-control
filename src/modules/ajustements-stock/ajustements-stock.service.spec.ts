import { Test, TestingModule } from '@nestjs/testing';
import { AjustementsStockService } from './ajustements-stock.service';

describe('AjustementsStockService', () => {
  let service: AjustementsStockService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AjustementsStockService],
    }).compile();

    service = module.get<AjustementsStockService>(AjustementsStockService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
