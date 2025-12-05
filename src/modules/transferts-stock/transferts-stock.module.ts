import { Module } from '@nestjs/common';
import { TransfertsStockService } from './transferts-stock.service';
import { TransfertsStockController } from './transferts-stock.controller';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * Module de gestion des transferts de stock entre entrepôts
 *
 * ️ Fonctionnalité PREMIUM - Nécessite un abonnement premium
 *
 * Ce module fournit :
 * - Création de transferts inter-entrepôts
 * - Gestion des expéditions et réceptions
 * - Support de la réception partielle
 * - Annulation avec recrédit automatique
 * - Traçabilité complète des mouvements
 *
 * @module TransfertsStockModule
 */
@Module({
  imports: [PrismaModule],
  controllers: [TransfertsStockController],
  providers: [TransfertsStockService],
  exports: [TransfertsStockService], // Pour utiliser dans d'autres modules
})
export class TransfertsStockModule {}
