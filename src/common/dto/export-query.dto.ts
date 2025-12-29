// ============================================
// FICHIER: src/common/dto/export-query.dto.ts
// DTO pour les paramètres d'export
// ============================================

import { IsEnum, IsOptional, IsDateString, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum ExportFormat {
  CSV = 'csv',
  XLSX = 'xlsx',
  PDF = 'pdf',
}

export class ExportQueryDto {
  @ApiProperty({
    enum: ExportFormat,
    description: 'Format d\'export souhaité',
    example: 'xlsx',
  })
  @IsEnum(ExportFormat, {
    message: 'Le format doit être csv, xlsx ou pdf',
  })
  format: ExportFormat;

  @ApiPropertyOptional({
    description: 'Date de début pour filtrer les données',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @ApiPropertyOptional({
    description: 'Date de fin pour filtrer les données',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  dateFin?: string;
}

export class ExportProduitsQueryDto extends ExportQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrer par catégorie',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categorieId?: number;

  @ApiPropertyOptional({
    description: 'Filtrer par statut actif',
    example: true,
  })
  @IsOptional()
  estActif?: string;

  @ApiPropertyOptional({
    description: 'Inclure uniquement les produits en stock faible',
    example: false,
  })
  @IsOptional()
  stockFaible?: string;
}

export class ExportCommandesQueryDto extends ExportQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrer par statut de commande',
    example: 'LIVRE',
  })
  @IsOptional()
  statut?: string;

  @ApiPropertyOptional({
    description: 'Filtrer par client',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  clientId?: number;
}

export class ExportMouvementsQueryDto extends ExportQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrer par type de mouvement',
    example: 'ENTREE',
  })
  @IsOptional()
  typeMouvement?: string;

  @ApiPropertyOptional({
    description: 'Filtrer par produit',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  produitId?: number;

  @ApiPropertyOptional({
    description: 'Filtrer par entrepôt',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  entrepotId?: number;
}

export class ExportInventaireQueryDto extends ExportQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrer par entrepôt',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  entrepotId?: number;

  @ApiPropertyOptional({
    description: 'Inclure uniquement les stocks faibles',
    example: false,
  })
  @IsOptional()
  stockFaible?: string;

  @ApiPropertyOptional({
    description: 'Inclure uniquement les ruptures',
    example: false,
  })
  @IsOptional()
  ruptures?: string;
}

export class ExportRapportInventaireQueryDto extends ExportQueryDto {
  @ApiPropertyOptional({
    description: 'Filtrer par entrepôt',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  entrepotId?: number;

  @ApiPropertyOptional({
    description: 'Filtrer par catégorie',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categorieId?: number;

  @ApiPropertyOptional({
    description: 'Méthode de valorisation (FIFO, LIFO, CMP)',
    example: 'CMP',
  })
  @IsOptional()
  methodeValorisation?: 'FIFO' | 'LIFO' | 'CMP';
}