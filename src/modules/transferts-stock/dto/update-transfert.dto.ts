import {
  IsString,
  IsDateString,
  IsOptional,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO pour mettre à jour un transfert
 *
 * Permet de modifier les notes ou la date prévue avant l'expédition.
 * Seulement pour les transferts avec statut EN_ATTENTE.
 *
 * @class UpdateTransfertStockDto
 */
export class UpdateTransfertStockDto {
  /**
   * Nouvelle date prévue du transfert
   * @example '2025-11-21'
   */
  @ApiPropertyOptional({
    description: 'Nouvelle date prévue',
    example: '2025-11-21',
    type: String,
    format: 'date',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La date de transfert doit être au format ISO 8601' })
  dateTransfert?: string;

  /**
   * Notes mises à jour
   * @example 'Date reportée à demain'
   * @maxLength 500
   */
  @ApiPropertyOptional({
    description: 'Notes mises à jour',
    example: 'Date reportée à demain',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'Les notes doivent être une chaîne de caractères' })
  @MaxLength(500, { message: 'Les notes ne peuvent pas dépasser 500 caractères' })
  notes?: string;
}
