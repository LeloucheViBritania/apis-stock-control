// ============================================
// FICHIER: src/modules/clients/clients-avances.module.ts
// Module NestJS pour les fonctionnalités avancées clients
// ============================================

import { Module } from '@nestjs/common';
import { ClientsAvancesController } from './clients-avances.controller';
import { ClientsAvancesService } from './clients-avances.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ClientsAvancesController],
  providers: [ClientsAvancesService],
  exports: [ClientsAvancesService],
})
export class ClientsAvancesModule {}