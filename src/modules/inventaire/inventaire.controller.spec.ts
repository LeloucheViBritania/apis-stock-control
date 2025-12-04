import { Test, TestingModule } from '@nestjs/testing';
import { InventaireController } from './inventaire.controller';
import { InventaireService } from './inventaire.service';

describe('InventaireController', () => {
  let controller: InventaireController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventaireController],
      providers: [InventaireService],
    }).compile();

    controller = module.get<InventaireController>(InventaireController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
