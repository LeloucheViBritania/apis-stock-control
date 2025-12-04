import {
  IsInt,
  IsString,
  IsOptional,
  IsDateString,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
/**
 * DTO pour réserver ou libérer du stock
 * 
 * @class ReserverStockDto
 */
export class ReserverStockDto {
  /**
   * Quantité à réserver ou libérer
   * 
   * @example 10
   * @minimum 1
   */
  @ApiProperty({
    description: 'Quantité à réserver ou libérer',
    example: 10,
    minimum: 1,
  })
  @IsInt({ message: 'La quantité doit être un entier' })
  @Min(1, { message: 'La quantité doit être au moins 1' })
  @Type(() => Number)
  quantite: number;

  /**
   * Référence de la réservation (numéro de commande, etc.)
   * 
   * @example 'CMD-2025-001'
   * @maxLength 50
   */
  @ApiPropertyOptional({
    description: 'Référence de la réservation (ex: numéro de commande)',
    example: 'CMD-2025-001',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  reference?: string;
}
