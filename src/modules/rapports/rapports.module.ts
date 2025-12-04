import { Module } from '@nestjs/common';
import { RapportsService } from './rapports.service';
import { RapportsController } from './rapports.controller';

@Module({
  controllers: [RapportsController],
  providers: [RapportsService],
})
export class RapportsModule {}
