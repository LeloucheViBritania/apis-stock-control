import { Test, TestingModule } from '@nestjs/testing';
import { EntrepotsService } from './entrepots.service';

describe('EntrepotsService', () => {
  let service: EntrepotsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EntrepotsService],
    }).compile();

    service = module.get<EntrepotsService>(EntrepotsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
