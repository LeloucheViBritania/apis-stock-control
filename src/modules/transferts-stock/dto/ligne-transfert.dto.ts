import {
  IsInt,
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO pour une ligne de transfert
 */
export class LigneTransfertDto {
  /**
   * ID du produit à transférer
   * @example 42
   */
  @ApiProperty({
    description: 'ID du produit',
    example: 42,
    type: Number,
  })
  @IsInt({ message: "L'ID du produit doit être un entier" })
  @Type(() => Number)
  produitId: number;

  /**
   * Quantité à transférer
   * @example 50
   * @minimum 1
   */
  @ApiProperty({
    description: 'Quantité à transférer',
    example: 50,
    minimum: 1,
  })
  @IsInt({ message: 'La quantité doit être un entier' })
  @Min(1, { message: 'La quantité doit être au moins 1' })
  @Type(() => Number)
  quantite: number;
}

/**
 * DTO pour créer un transfert de stock
 *
 * @class CreateTransfertStockDto
 */
export class CreateTransfertStockDto {
  /**
   * ID de l'entrepôt source
   * @example 1
   */
  @ApiProperty({
    description: "ID de l'entrepôt source",
    example: 1,
    type: Number,
  })
  @IsInt({ message: "L'ID de l'entrepôt source doit être un entier" })
  @Type(() => Number)
  entrepotSourceId: number;

  /**
   * ID de l'entrepôt destination
   * @example 2
   */
  @ApiProperty({
    description: "ID de l'entrepôt destination",
    example: 2,
    type: Number,
  })
  @IsInt({ message: "L'ID de l'entrepôt destination doit être un entier" })
  @Type(() => Number)
  entrepotDestinationId: number;

  /**
   * Date prévue du transfert
   * @example '2025-11-20'
   */
  @ApiProperty({
    description: 'Date prévue du transfert',
    example: '2025-11-20',
    type: String,
    format: 'date',
  })
  @IsDateString(
    {},
    { message: 'La date de transfert doit être au format ISO 8601' },
  )
  dateTransfert: string;

  /**
   * Notes ou commentaires sur le transfert
   * @example 'Transfert urgent pour réapprovisionnement'
   * @maxLength 500
   */
  @ApiPropertyOptional({
    description: 'Notes ou commentaires',
    example: 'Transfert urgent pour réapprovisionnement',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'Les notes doivent être une chaîne de caractères' })
  @MaxLength(500, {
    message: 'Les notes ne peuvent pas dépasser 500 caractères',
  })
  notes?: string;

  /**
   * Liste des produits à transférer
   * @example [{ "produitId": 42, "quantite": 50 }]
   */
  @ApiProperty({
    description: 'Liste des produits à transférer avec leurs quantités',
    type: [LigneTransfertDto],
    example: [
      { produitId: 42, quantite: 50 },
      { produitId: 15, quantite: 30 },
    ],
  })
  @IsArray({ message: 'Les lignes doivent être un tableau' })
  @ArrayMinSize(1, { message: 'Au moins une ligne de transfert est requise' })
  @ValidateNested({ each: true })
  @Type(() => LigneTransfertDto)
  lignes: LigneTransfertDto[];
}
