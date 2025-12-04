import { Test, TestingModule } from '@nestjs/testing';
import { JournalAuditService } from './journal-audit.service';

describe('JournalAuditService', () => {
  let service: JournalAuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JournalAuditService],
    }).compile();

    service = module.get<JournalAuditService>(JournalAuditService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
