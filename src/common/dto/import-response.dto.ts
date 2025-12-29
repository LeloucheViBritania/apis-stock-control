// ============================================
// FICHIER: src/common/dto/import-response.dto.ts
// DTOs pour les réponses d'import
// ============================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportErrorDto {
  @ApiProperty({ description: 'Numéro de la ligne en erreur', example: 5 })
  row: number;

  @ApiPropertyOptional({ description: 'Nom de la colonne concernée', example: 'email' })
  column?: string;

  @ApiPropertyOptional({ description: 'Valeur qui a causé l\'erreur', example: 'invalid-email' })
  value?: any;

  @ApiProperty({ description: 'Message d\'erreur', example: 'Email invalide' })
  message: string;
}

export class ImportResultDto {
  @ApiProperty({ description: 'Import réussi sans erreurs', example: true })
  success: boolean;

  @ApiProperty({ description: 'Nombre total de lignes dans le fichier', example: 100 })
  totalRows: number;

  @ApiProperty({ description: 'Nombre de lignes importées avec succès', example: 95 })
  importedRows: number;

  @ApiProperty({ description: 'Nombre de lignes en erreur', example: 5 })
  errorRows: number;

  @ApiProperty({ 
    description: 'Liste des erreurs rencontrées',
    type: [ImportErrorDto],
  })
  errors: ImportErrorDto[];

  @ApiPropertyOptional({ 
    description: 'Avertissements (non bloquants)',
    type: [String],
    example: ['Import limité aux 1000 premières lignes'],
  })
  warnings?: string[];

  @ApiPropertyOptional({
    description: 'Résumé des actions effectuées',
  })
  summary?: {
    created?: number;
    updated?: number;
    skipped?: number;
  };
}

export class ImportPreviewDto {
  @ApiProperty({ description: 'Aperçu des premières lignes du fichier' })
  preview: any[];

  @ApiProperty({ description: 'Colonnes détectées dans le fichier' })
  detectedColumns: string[];

  @ApiProperty({ description: 'Colonnes attendues' })
  expectedColumns: {
    name: string;
    required: boolean;
    found: boolean;
  }[];

  @ApiProperty({ description: 'Nombre total de lignes', example: 150 })
  totalRows: number;

  @ApiProperty({ description: 'Le fichier semble valide', example: true })
  isValid: boolean;

  @ApiPropertyOptional({ description: 'Problèmes détectés' })
  issues?: string[];
}