import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LigneTransfertDto } from './ligne-transfert.dto';
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO pour réceptionner partiellement un transfert
 *
 * @class ReceptionPartielleDto
 */
export class ReceptionPartielleDto {
  /**
   * Liste des quantités reçues par produit
   * @example [{ "produitId": 42, "quantite": 45 }]
   */
  @ApiProperty({
    description: 'Quantités réellement reçues par produit',
    type: [LigneTransfertDto],
    example: [
      { produitId: 42, quantite: 45 }, // Sur 50 attendus
      { produitId: 15, quantite: 30 }, // Complet
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => LigneTransfertDto)
  lignes: LigneTransfertDto[];

  /**
   * Notes sur la réception
   * @example '5 unités endommagées lors du transport'
   */
  @ApiPropertyOptional({
    description: 'Notes sur la réception (manquants, dommages, etc.)',
    example: '5 unités endommagées lors du transport',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
