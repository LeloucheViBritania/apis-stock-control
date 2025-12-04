import { Test, TestingModule } from '@nestjs/testing';
import { RapportsController } from './rapports.controller';
import { RapportsService } from './rapports.service';

describe('RapportsController', () => {
  let controller: RapportsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RapportsController],
      providers: [RapportsService],
    }).compile();

    controller = module.get<RapportsController>(RapportsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
