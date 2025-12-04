import { Test, TestingModule } from '@nestjs/testing';
import { BonsCommandeAchatService } from './bons-commande-achat.service';

describe('BonsCommandeAchatService', () => {
  let service: BonsCommandeAchatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BonsCommandeAchatService],
    }).compile();

    service = module.get<BonsCommandeAchatService>(BonsCommandeAchatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
