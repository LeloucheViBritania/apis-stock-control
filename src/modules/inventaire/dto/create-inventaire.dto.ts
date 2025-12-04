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
 * DTO pour créer une entrée d'inventaire
 * 
 * Utilisé pour initialiser l'inventaire d'un produit dans un entrepôt.
 * 
 * @class CreateInventaireDto
 */
export class CreateInventaireDto {
  /**
   * ID du produit
   * 
   * @example 42
   */
  @ApiProperty({
    description: 'ID du produit',
    example: 42,
    type: Number,
  })
  @IsInt({ message: 'L\'ID du produit doit être un entier' })
  @Type(() => Number)
  produitId: number;

  /**
   * ID de l'entrepôt
   * 
   * @example 1
   */
  @ApiProperty({
    description: 'ID de l\'entrepôt',
    example: 1,
    type: Number,
  })
  @IsInt({ message: 'L\'ID de l\'entrepôt doit être un entier' })
  @Type(() => Number)
  entrepotId: number;

  /**
   * Quantité initiale en stock
   * 
   * @example 100
   * @minimum 0
   */
  @ApiProperty({
    description: 'Quantité en stock',
    example: 100,
    minimum: 0,
    default: 0,
  })
  @IsInt({ message: 'La quantité doit être un entier' })
  @Min(0, { message: 'La quantité ne peut pas être négative' })
  @Type(() => Number)
  quantite: number;

  /**
   * Quantité réservée (commandes en cours)
   * 
   * @example 10
   * @minimum 0
   * @default 0
   */
  @ApiPropertyOptional({
    description: 'Quantité réservée pour des commandes',
    example: 10,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsInt({ message: 'La quantité réservée doit être un entier' })
  @Min(0, { message: 'La quantité réservée ne peut pas être négative' })
  @Type(() => Number)
  quantiteReservee?: number;

  /**
   * Emplacement physique dans l'entrepôt
   * 
   * Exemples : "A1-B3", "Rayon 5-Étagère 2", "Zone Froide-1"
   * 
   * @example 'A1-B3'
   * @maxLength 50
   */
  @ApiPropertyOptional({
    description: 'Emplacement physique dans l\'entrepôt (ex: "A1-B3", "Rayon 5")',
    example: 'A1-B3',
    maxLength: 50,
  })
  @IsOptional()
  @IsString({ message: 'L\'emplacement doit être une chaîne de caractères' })
  @MaxLength(50, { message: 'L\'emplacement ne peut pas dépasser 50 caractères' })
  emplacement?: string;
}