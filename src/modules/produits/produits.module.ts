import { Module } from '@nestjs/common';
import { ProduitsService } from './produits.service';
import { ProduitsExportService } from './produits-export.service';
import { ProduitsController } from './produits.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ProduitsController],
  providers: [ProduitsService, ProduitsExportService],
  exports: [ProduitsService, ProduitsExportService],
})
export class ProduitsModule {}