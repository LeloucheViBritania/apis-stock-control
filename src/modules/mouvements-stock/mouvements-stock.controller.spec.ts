import { Test, TestingModule } from '@nestjs/testing';
import { MouvementsStockController } from './mouvements-stock.controller';
import { MouvementsStockService } from './mouvements-stock.service';

describe('MouvementsStockController', () => {
  let controller: MouvementsStockController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MouvementsStockController],
      providers: [MouvementsStockService],
    }).compile();

    controller = module.get<MouvementsStockController>(MouvementsStockController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
