import { Controller } from '@nestjs/common';
import { RapportsService } from './rapports.service';

@Controller('rapports')
export class RapportsController {
  constructor(private readonly rapportsService: RapportsService) {}
}
