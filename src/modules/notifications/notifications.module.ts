import { Module , Global} from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { PrismaModule } from '../../prisma/prisma.module'; // Pour accéder aux données

@Module({
  imports: [PrismaModule],
  providers: [NotificationsGateway, NotificationsService],
  exports: [NotificationsGateway, NotificationsService], // Exporté si on veut l'utiliser ailleurs
})
export class NotificationsModule {}