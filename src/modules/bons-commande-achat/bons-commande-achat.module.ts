import { Module } from '@nestjs/common';
import { BonsCommandeAchatService } from './bons-commande-achat.service';
import { BonsCommandeAchatController } from './bons-commande-achat.controller';

@Module({
  controllers: [BonsCommandeAchatController],
  providers: [BonsCommandeAchatService],
})
export class BonsCommandeAchatModule {}
