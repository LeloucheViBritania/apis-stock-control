import { Test, TestingModule } from '@nestjs/testing';
import { InventaireService } from './inventaire.service';

describe('InventaireService', () => {
  let service: InventaireService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InventaireService],
    }).compile();

    service = module.get<InventaireService>(InventaireService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
