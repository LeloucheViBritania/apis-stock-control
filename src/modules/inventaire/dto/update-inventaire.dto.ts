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
 * DTO pour mettre à jour une entrée d'inventaire
 * 
 * Permet de modifier la quantité, l'emplacement, etc.
 * 
 * @class UpdateInventaireDto
 */
export class UpdateInventaireDto {
  /**
   * Nouvelle quantité en stock
   * 
   * @example 150
   * @minimum 0
   */
  @ApiPropertyOptional({
    description: 'Nouvelle quantité en stock',
    example: 150,
    minimum: 0,
  })
  @IsOptional()
  @IsInt({ message: 'La quantité doit être un entier' })
  @Min(0, { message: 'La quantité ne peut pas être négative' })
  @Type(() => Number)
  quantite?: number;

  /**
   * Nouvelle quantité réservée
   * 
   * @example 20
   * @minimum 0
   */
  @ApiPropertyOptional({
    description: 'Nouvelle quantité réservée',
    example: 20,
    minimum: 0,
  })
  @IsOptional()
  @IsInt({ message: 'La quantité réservée doit être un entier' })
  @Min(0, { message: 'La quantité réservée ne peut pas être négative' })
  @Type(() => Number)
  quantiteReservee?: number;

  /**
   * Nouvel emplacement
   * 
   * @example 'B2-C4'
   * @maxLength 50
   */
  @ApiPropertyOptional({
    description: 'Nouvel emplacement dans l\'entrepôt',
    example: 'B2-C4',
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: 'L\'emplacement doit être une chaîne de caractères' })
  @MaxLength(50, { message: 'L\'emplacement ne peut pas dépasser 50 caractères' })
  emplacement?: string;

  /**
   * Date de la dernière vérification physique
   * 
   * @example '2025-11-19T10:30:00.000Z'
   */
  @ApiPropertyOptional({
    description: 'Date de la dernière vérification physique de l\'inventaire',
    example: '2025-11-19T10:30:00.000Z',
    type: String,
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString({}, { message: 'La date de vérification doit être au format ISO 8601' })
  derniereVerification?: string;
}