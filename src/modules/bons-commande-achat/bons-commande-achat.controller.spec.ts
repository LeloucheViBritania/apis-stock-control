import { Test, TestingModule } from '@nestjs/testing';
import { BonsCommandeAchatController } from './bons-commande-achat.controller';
import { BonsCommandeAchatService } from './bons-commande-achat.service';

describe('BonsCommandeAchatController', () => {
  let controller: BonsCommandeAchatController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BonsCommandeAchatController],
      providers: [BonsCommandeAchatService],
    }).compile();

    controller = module.get<BonsCommandeAchatController>(BonsCommandeAchatController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
