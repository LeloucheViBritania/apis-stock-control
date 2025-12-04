import { Test, TestingModule } from '@nestjs/testing';
import { JournalAuditController } from './journal-audit.controller';
import { JournalAuditService } from './journal-audit.service';

describe('JournalAuditController', () => {
  let controller: JournalAuditController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [JournalAuditController],
      providers: [JournalAuditService],
    }).compile();

    controller = module.get<JournalAuditController>(JournalAuditController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
