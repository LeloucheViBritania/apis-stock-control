import { Test, TestingModule } from '@nestjs/testing';
import { MouvementsStockService } from './mouvements-stock.service';

describe('MouvementsStockService', () => {
  let service: MouvementsStockService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MouvementsStockService],
    }).compile();

    service = module.get<MouvementsStockService>(MouvementsStockService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
