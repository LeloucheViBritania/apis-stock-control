import { Test, TestingModule } from '@nestjs/testing';
import { AjustementsStockController } from './ajustements-stock.controller';
import { AjustementsStockService } from './ajustements-stock.service';

describe('AjustementsStockController', () => {
  let controller: AjustementsStockController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AjustementsStockController],
      providers: [AjustementsStockService],
    }).compile();

    controller = module.get<AjustementsStockController>(AjustementsStockController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
