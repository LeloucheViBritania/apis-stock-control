// ============================================
// FICHIER: src/modules/reapprovisionnement/dto/reapprovisionnement.dto.ts
// DTOs pour le module de réapprovisionnement
// ============================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsEnum,
  IsArray,
  IsBoolean,
  IsString,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================
// ENUMS
// ============================================

export enum StrategieReapprovisionnement {
  POINT_COMMANDE = 'POINT_COMMANDE',        // Commander quand stock <= point de commande
  PERIODICITE_FIXE = 'PERIODICITE_FIXE',    // Commander à intervalles réguliers
  JUSTE_A_TEMPS = 'JUSTE_A_TEMPS',          // Minimiser le stock
  STOCK_SECURITE = 'STOCK_SECURITE',        // Maximiser la sécurité
}

export enum PrioriteSuggestion {
  CRITIQUE = 'CRITIQUE',
  HAUTE = 'HAUTE',
  MOYENNE = 'MOYENNE',
  BASSE = 'BASSE',
}

// ============================================
// DTO: DEMANDE DE SUGGESTIONS
// ============================================

export class SuggererReapprovisionnementDto {
  @ApiPropertyOptional({
    description: 'ID de l\'entrepôt (tous si non spécifié)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  entrepotId?: number;

  @ApiPropertyOptional({
    description: 'ID de la catégorie (toutes si non spécifié)',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  categorieId?: number;

  @ApiPropertyOptional({
    description: 'IDs des fournisseurs à considérer',
    example: [1, 2],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  fournisseursIds?: number[];

  @ApiPropertyOptional({
    description: 'Stratégie de réapprovisionnement',
    enum: StrategieReapprovisionnement,
    default: StrategieReapprovisionnement.POINT_COMMANDE,
  })
  @IsOptional()
  @IsEnum(StrategieReapprovisionnement)
  strategie?: StrategieReapprovisionnement;

  @ApiPropertyOptional({
    description: 'Horizon de prévision en jours',
    example: 30,
    default: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(90)
  @Type(() => Number)
  horizonJours?: number;

  @ApiPropertyOptional({
    description: 'Inclure uniquement les produits en alerte',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  alertesUniquement?: boolean;

  @ApiPropertyOptional({
    description: 'Grouper par fournisseur',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  grouperParFournisseur?: boolean;

  @ApiPropertyOptional({
    description: 'Budget maximum (FCFA)',
    example: 5000000,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  budgetMax?: number;
}

// ============================================
// DTO: CRÉATION DE BON DE COMMANDE AUTO
// ============================================

export class LigneCommandeAutoDto {
  @ApiProperty({ description: 'ID du produit', example: 1 })
  @IsInt()
  produitId: number;

  @ApiProperty({ description: 'Quantité à commander', example: 100 })
  @IsInt()
  @Min(1)
  quantite: number;

  @ApiPropertyOptional({ description: 'Prix unitaire forcé' })
  @IsOptional()
  @IsInt()
  @Min(0)
  prixUnitaire?: number;
}

export class CommanderAutoDto {
  @ApiProperty({
    description: 'ID du fournisseur',
    example: 1,
  })
  @IsInt()
  fournisseurId: number;

  @ApiProperty({
    description: 'ID de l\'entrepôt de destination',
    example: 1,
  })
  @IsInt()
  entrepotId: number;

  @ApiPropertyOptional({
    description: 'Lignes de commande (si vide, utilise les suggestions)',
    type: [LigneCommandeAutoDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LigneCommandeAutoDto)
  lignes?: LigneCommandeAutoDto[];

  @ApiPropertyOptional({
    description: 'Utiliser les suggestions automatiques',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  utiliserSuggestions?: boolean;

  @ApiPropertyOptional({
    description: 'Notes pour le bon de commande',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Date de livraison souhaitée',
    example: '2025-02-15',
  })
  @IsOptional()
  @IsString()
  dateLivraisonSouhaitee?: string;
}

// ============================================
// DTO: RÉPONSES
// ============================================

export class SuggestionProduitDto {
  @ApiProperty()
  produitId: number;

  @ApiProperty()
  reference: string;

  @ApiProperty()
  nom: string;

  @ApiProperty()
  categorie?: string;

  @ApiProperty()
  stockActuel: number;

  @ApiProperty()
  stockMinimum: number;

  @ApiProperty()
  pointCommande: number | null;

  @ApiProperty()
  quantiteSuggere: number;

  @ApiProperty()
  consommationMoyenneJour: number;

  @ApiProperty()
  joursAvantRupture: number | null;

  @ApiProperty({ enum: PrioriteSuggestion })
  priorite: PrioriteSuggestion;

  @ApiProperty()
  fournisseurPrefere?: {
    id: number;
    nom: string;
    prixUnitaire: number;
    delaiLivraison: number;
  };

  @ApiProperty()
  coutEstime: number;

  @ApiProperty()
  justification: string;
}

export class SuggestionFournisseurDto {
  @ApiProperty()
  fournisseur: {
    id: number;
    nom: string;
    email?: string;
    conditionsPaiement?: string;
  };

  @ApiProperty()
  nombreProduits: number;

  @ApiProperty()
  montantTotal: number;

  @ApiProperty()
  delaiLivraisonMoyen: number;

  @ApiProperty({ type: [SuggestionProduitDto] })
  produits: SuggestionProduitDto[];
}

export class SuggestionsReapprovisionnementResponseDto {
  @ApiProperty()
  parametres: {
    strategie: StrategieReapprovisionnement;
    horizonJours: number;
    entrepotId?: number;
    categorieId?: number;
  };

  @ApiProperty()
  resume: {
    totalProduits: number;
    produitsEnAlerte: number;
    produitsEnRupture: number;
    montantTotalSuggere: number;
    nombreFournisseurs: number;
  };

  @ApiProperty({ type: [SuggestionFournisseurDto] })
  parFournisseur: SuggestionFournisseurDto[];

  @ApiProperty({ type: [SuggestionProduitDto] })
  toutesLesSuggestions: SuggestionProduitDto[];

  @ApiProperty()
  produitsSansFournisseur: {
    produitId: number;
    reference: string;
    nom: string;
    quantiteSuggere: number;
  }[];

  @ApiProperty()
  dateGeneration: Date;
}

export class ResultatCommandeAutoDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  bonCommande: {
    id: number;
    numeroCommande: string;
    fournisseur: string;
    entrepot: string;
    montantTotal: number;
    nombreLignes: number;
    dateLivraisonPrevue?: Date;
  };

  @ApiProperty()
  lignesCreees: {
    produitId: number;
    reference: string;
    quantite: number;
    prixUnitaire: number;
    montantLigne: number;
  }[];

  @ApiProperty()
  message: string;
}