import { Test, TestingModule } from '@nestjs/testing';
import { RapportsService } from './rapports.service';

describe('RapportsService', () => {
  let service: RapportsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RapportsService],
    }).compile();

    service = module.get<RapportsService>(RapportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
