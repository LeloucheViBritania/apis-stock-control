import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LigneTransfertDto } from './ligne-transfert.dto';

/**
 * DTO pour créer un transfert de stock
 */
export class CreateTransfertStockDto {
  @ApiProperty({
    description: "ID de l'entrepôt source",
    example: 1,
    type: Number,
  })
  @IsOptional()
  @IsInt({ message: "L'ID de l'entrepôt source doit être un entier" })
  @Type(() => Number)
  entrepotSourceId?: number;

  @ApiPropertyOptional({
    description: "ID de l'entrepôt source (alias)",
    example: 1,
    type: Number,
  })
  @IsOptional()
  @IsInt({ message: "L'ID de l'entrepôt origine doit être un entier" })
  @Type(() => Number)
  entrepotOrigineId?: number; // Alias pour entrepotSourceId

  @ApiProperty({
    description: "ID de l'entrepôt destination",
    example: 2,
    type: Number,
  })
  @IsOptional()
  @IsInt({ message: "L'ID de l'entrepôt destination doit être un entier" })
  @Type(() => Number)
  entrepotDestinationId?: number;

  @ApiPropertyOptional({
    description: 'Date prévue du transfert',
    example: '2025-11-20',
    type: String,
    format: 'date',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'La date de transfert doit être au format ISO 8601' },
  )
  dateTransfert?: string;

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

  @ApiProperty({
    description: 'Liste des produits à transférer avec leurs quantités',
    type: [LigneTransfertDto],
    example: [
      { produitId: 42, quantite: 50 },
      { produitId: 15, quantite: 30 },
    ],
  })
  @IsOptional()
  @IsArray({ message: 'Les lignes doivent être un tableau' })
  @ValidateNested({ each: true })
  @Type(() => LigneTransfertDto)
  lignes?: LigneTransfertDto[];

  @ApiPropertyOptional({
    description: 'Liste des produits (alias)',
    type: [LigneTransfertDto],
  })
  @IsOptional()
  @IsArray({ message: 'Les produits doivent être un tableau' })
  @ValidateNested({ each: true })
  @Type(() => LigneTransfertDto)
  produits?: LigneTransfertDto[]; // Alias pour lignes
}
