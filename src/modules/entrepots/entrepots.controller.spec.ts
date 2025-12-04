import { Test, TestingModule } from '@nestjs/testing';
import { EntrepotsController } from './entrepots.controller';
import { EntrepotsService } from './entrepots.service';

describe('EntrepotsController', () => {
  let controller: EntrepotsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EntrepotsController],
      providers: [EntrepotsService],
    }).compile();

    controller = module.get<EntrepotsController>(EntrepotsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
