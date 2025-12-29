// ============================================
// FICHIER: src/modules/previsions/dto/previsions.dto.ts
// DTOs pour le module de prévisions
// ============================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsEnum,
  IsDateString,
  Min,
  Max,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================
// ENUMS
// ============================================

export enum PeriodeAnalyse {
  SEMAINE = 'SEMAINE',
  MOIS = 'MOIS',
  TRIMESTRE = 'TRIMESTRE',
  ANNEE = 'ANNEE',
}

export enum MethodePrevision {
  MOYENNE_MOBILE = 'MOYENNE_MOBILE',
  MOYENNE_PONDEREE = 'MOYENNE_PONDEREE',
  TENDANCE_LINEAIRE = 'TENDANCE_LINEAIRE',
  LISSAGE_EXPONENTIEL = 'LISSAGE_EXPONENTIEL',
}

// ============================================
// DTO: PRÉVISION STOCK PRODUIT
// ============================================

export class PrevisionStockQueryDto {
  @ApiPropertyOptional({
    description: 'ID de l\'entrepôt (tous si non spécifié)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  entrepotId?: number;

  @ApiPropertyOptional({
    description: 'Nombre de jours de prévision',
    example: 30,
    default: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(365)
  @Type(() => Number)
  joursPrevisison?: number;

  @ApiPropertyOptional({
    description: 'Méthode de prévision à utiliser',
    enum: MethodePrevision,
    default: MethodePrevision.MOYENNE_MOBILE,
  })
  @IsOptional()
  @IsEnum(MethodePrevision)
  methode?: MethodePrevision;
}

// ============================================
// DTO: PRÉVISIONS COMMANDES
// ============================================

export class PrevisionsCommandesQueryDto {
  @ApiPropertyOptional({
    description: 'Période d\'analyse historique',
    enum: PeriodeAnalyse,
    default: PeriodeAnalyse.TRIMESTRE,
  })
  @IsOptional()
  @IsEnum(PeriodeAnalyse)
  periodeAnalyse?: PeriodeAnalyse;

  @ApiPropertyOptional({
    description: 'ID de l\'entrepôt',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  entrepotId?: number;

  @ApiPropertyOptional({
    description: 'ID de la catégorie',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  categorieId?: number;

  @ApiPropertyOptional({
    description: 'Nombre de jours de prévision',
    example: 30,
    default: 30,
  })
  @IsOptional()
  @IsInt()
  @Min(7)
  @Max(90)
  @Type(() => Number)
  joursPrevision?: number;
}

// ============================================
// DTO: RÉPONSES
// ============================================

export class PrevisionRuptureDto {
  @ApiProperty()
  produitId: number;

  @ApiProperty()
  reference: string;

  @ApiProperty()
  nom: string;

  @ApiProperty()
  stockActuel: number;

  @ApiProperty()
  stockMinimum: number;

  @ApiProperty()
  consommationMoyenneJour: number;

  @ApiProperty()
  joursAvantRupture: number | null;

  @ApiProperty()
  dateRupturePrevue: Date | null;

  @ApiProperty()
  niveauUrgence: 'CRITIQUE' | 'URGENT' | 'ATTENTION' | 'OK';

  @ApiProperty()
  quantiteSuggereCommande: number;

  @ApiProperty()
  tendance: 'HAUSSE' | 'STABLE' | 'BAISSE';

  @ApiProperty()
  fiabilite: number; // Pourcentage de fiabilité de la prévision
}

export class PrevisionStockResponseDto {
  @ApiProperty()
  produitId: number;

  @ApiProperty()
  produit: {
    reference: string;
    nom: string;
    categorie?: string;
  };

  @ApiProperty()
  stockActuel: number;

  @ApiProperty()
  stockMinimum: number;

  @ApiProperty()
  pointCommande: number | null;

  @ApiProperty()
  analyse: {
    consommationMoyenneJour: number;
    consommationMoyenneSemaine: number;
    consommationMoyenneMois: number;
    ecartType: number;
    tendance: 'HAUSSE' | 'STABLE' | 'BAISSE';
    coefficientVariation: number;
  };

  @ApiProperty()
  prevision: {
    joursAvantRupture: number | null;
    dateRupturePrevue: Date | null;
    stockPrevuJ7: number;
    stockPrevuJ14: number;
    stockPrevuJ30: number;
  };

  @ApiProperty()
  recommandation: {
    niveauUrgence: 'CRITIQUE' | 'URGENT' | 'ATTENTION' | 'OK';
    quantiteSuggereCommande: number;
    dateCommandeSuggeree: Date | null;
    message: string;
  };

  @ApiProperty()
  historique: {
    date: string;
    quantite: number;
  }[];

  @ApiProperty()
  fiabilite: number;
}

export class PrevisionCommandesResponseDto {
  @ApiProperty()
  periode: {
    debut: Date;
    fin: Date;
    joursAnalyses: number;
  };

  @ApiProperty()
  resume: {
    totalProduitsAnalyses: number;
    produitsEnRupture: number;
    produitsEnAlerte: number;
    valeurStockActuel: number;
    valeurCommandesSuggeres: number;
  };

  @ApiProperty()
  previsions: PrevisionRuptureDto[];

  @ApiProperty()
  tendancesCategories: {
    categorie: string;
    tendance: 'HAUSSE' | 'STABLE' | 'BAISSE';
    variationPourcentage: number;
    produitsEnAlerte: number;
  }[];

  @ApiProperty()
  alertes: {
    type: 'RUPTURE_IMMINENTE' | 'STOCK_FAIBLE' | 'SURCONSOMMATION' | 'SAISONNALITE';
    produitId: number;
    message: string;
    priorite: number;
  }[];
}

export class HistoriqueConsommationDto {
  @ApiProperty()
  date: Date;

  @ApiProperty()
  quantiteSortie: number;

  @ApiProperty()
  quantiteEntree: number;

  @ApiProperty()
  solde: number;
}