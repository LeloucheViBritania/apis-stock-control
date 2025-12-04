import { Module } from '@nestjs/common';
import { JournalAuditService } from './journal-audit.service';
import { JournalAuditController } from './journal-audit.controller';

@Module({
  controllers: [JournalAuditController],
  providers: [JournalAuditService],
  exports: [JournalAuditService],
})
export class JournalAuditModule {}
