import { Module } from '@nestjs/common';
import { EntrepotsService } from './entrepots.service';
import { EntrepotsController } from './entrepots.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EntrepotsController],
  providers: [EntrepotsService],
  exports: [EntrepotsService],
})
export class EntrepotsModule {}