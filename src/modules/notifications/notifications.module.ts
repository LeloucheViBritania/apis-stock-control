import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from '../../prisma/prisma.module'; // Pour accéder aux données

@Module({
  imports: [PrismaModule],
  providers: [NotificationsService],
  exports: [NotificationsService], // Exporté si on veut l'utiliser ailleurs
})
export class NotificationsModule {}