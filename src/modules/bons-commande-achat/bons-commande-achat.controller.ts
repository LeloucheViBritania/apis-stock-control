import { Controller } from '@nestjs/common';
import { BonsCommandeAchatService } from './bons-commande-achat.service';

@Controller('bons-commande-achat')
export class BonsCommandeAchatController {
  constructor(private readonly bonsCommandeAchatService: BonsCommandeAchatService) {}
}
