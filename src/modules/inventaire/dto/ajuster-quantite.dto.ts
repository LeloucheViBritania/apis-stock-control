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
 * DTO pour ajuster la quantité en stock
 * 
 * Utilisé pour les entrées/sorties simples sans créer de mouvement de stock complet.
 * 
 * @class AjusterQuantiteDto
 */
export class AjusterQuantiteDto {
  /**
   * Type d'ajustement
   * 
   * - 'ajouter' : Augmente la quantité
   * - 'retirer' : Diminue la quantité
   * - 'definir' : Définit une quantité absolue
   * 
   * @example 'ajouter'
   */
  @ApiProperty({
    description: 'Type d\'ajustement',
    enum: ['ajouter', 'retirer', 'definir'],
    example: 'ajouter',
  })
  @IsString()
  type: 'ajouter' | 'retirer' | 'definir';

  /**
   * Quantité à ajouter, retirer ou définir
   * 
   * @example 50
   * @minimum 0
   */
  @ApiProperty({
    description: 'Quantité',
    example: 50,
    minimum: 0,
  })
  @IsInt({ message: 'La quantité doit être un entier' })
  @Min(0, { message: 'La quantité ne peut pas être négative' })
  @Type(() => Number)
  quantite: number;

  /**
   * Raison de l'ajustement
   * 
   * @example 'Inventaire physique'
   * @maxLength 255
   */
  @ApiPropertyOptional({
    description: 'Raison de l\'ajustement',
    example: 'Inventaire physique',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  raison?: string;
}