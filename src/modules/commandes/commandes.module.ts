import { Module } from '@nestjs/common';
import { CommandesService } from './commandes.service';
import { CommandesExportService } from './commandes-export.service';
import { CommandesController } from './commandes.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [CommandesController],
  providers: [CommandesService, CommandesExportService],
  exports: [CommandesService, CommandesExportService],
})
export class CommandesModule {}