// ============================================
// FICHIER: src/modules/inventaire-physique/dto/inventaire-physique.dto.ts
// DTOs pour le module inventaire physique
// ============================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsOptional,
  IsNotEmpty,
  IsArray,
  IsEnum,
  IsNumber,
  Min,
  Max,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================
// ENUMS
// ============================================

export enum StatutInventairePhysique {
  EN_COURS = 'EN_COURS',
  EN_PAUSE = 'EN_PAUSE',
  TERMINE = 'TERMINE',
  VALIDE = 'VALIDE',
  ANNULE = 'ANNULE',
}

export enum StatutLigneInventaire {
  EN_ATTENTE = 'EN_ATTENTE',
  COMPTE = 'COMPTE',
  VALIDE = 'VALIDE',
  ECART = 'ECART',
}

// ============================================
// DTO: CRÉER UNE SESSION
// ============================================

export class CreateSessionInventaireDto {
  @ApiProperty({
    description: 'Titre de la session d\'inventaire',
    example: 'Inventaire mensuel Janvier 2025',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  titre: string;

  @ApiPropertyOptional({
    description: 'Description détaillée',
    example: 'Inventaire complet de l\'entrepôt principal',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'ID de l\'entrepôt à inventorier',
    example: 1,
  })
  @IsInt()
  @Min(1)
  entrepotId: number;

  @ApiPropertyOptional({
    description: 'ID de la catégorie (pour inventaire partiel)',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  categorieId?: number;

  @ApiPropertyOptional({
    description: 'Zone d\'emplacement spécifique (ex: A1, B2)',
    example: 'A1',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  zoneEmplacement?: string;

  @ApiPropertyOptional({
    description: 'IDs des produits spécifiques à inventorier (sinon tous)',
    example: [1, 2, 3],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  produitsIds?: number[];
}

// ============================================
// DTO: SCANNER/COMPTER UN PRODUIT
// ============================================

export class ScannerProduitDto {
  @ApiProperty({
    description: 'ID du produit ou référence/code-barre',
    example: 1,
  })
  @IsInt()
  @Min(1)
  produitId: number;

  @ApiProperty({
    description: 'Quantité physique comptée',
    example: 45,
  })
  @IsInt()
  @Min(0)
  quantiteComptee: number;

  @ApiPropertyOptional({
    description: 'Emplacement du comptage',
    example: 'A1-B3',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  emplacement?: string;

  @ApiPropertyOptional({
    description: 'Notes sur le comptage',
    example: 'Produits endommagés retirés du comptage',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ============================================
// DTO: SCANNER PAR CODE-BARRE
// ============================================

export class ScannerCodeBarreDto {
  @ApiProperty({
    description: 'Code-barre ou référence du produit',
    example: '1234567890123',
  })
  @IsString()
  @IsNotEmpty()
  codeBarre: string;

  @ApiProperty({
    description: 'Quantité physique comptée',
    example: 45,
  })
  @IsInt()
  @Min(0)
  quantiteComptee: number;

  @ApiPropertyOptional({
    description: 'Emplacement du comptage',
    example: 'A1-B3',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  emplacement?: string;

  @ApiPropertyOptional({
    description: 'Notes sur le comptage',
    example: 'Produits endommagés retirés',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ============================================
// DTO: COMPTAGE EN MASSE
// ============================================

export class ComptageEnMasseItemDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  produitId: number;

  @ApiProperty({ example: 45 })
  @IsInt()
  @Min(0)
  quantiteComptee: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  emplacement?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ComptageEnMasseDto {
  @ApiProperty({
    description: 'Liste des comptages à enregistrer',
    type: [ComptageEnMasseItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComptageEnMasseItemDto)
  comptages: ComptageEnMasseItemDto[];
}

// ============================================
// DTO: RECOMPTAGE
// ============================================

export class RecompterProduitDto {
  @ApiProperty({
    description: 'ID du produit à recompter',
    example: 1,
  })
  @IsInt()
  @Min(1)
  produitId: number;

  @ApiProperty({
    description: 'Nouvelle quantité comptée',
    example: 47,
  })
  @IsInt()
  @Min(0)
  quantiteRecomptee: number;

  @ApiPropertyOptional({
    description: 'Notes sur le recomptage',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ============================================
// DTO: VALIDATION
// ============================================

export class ValiderInventaireDto {
  @ApiPropertyOptional({
    description: 'Raison de la validation (pour le journal d\'audit)',
    example: 'Inventaire mensuel validé par le responsable',
  })
  @IsOptional()
  @IsString()
  raison?: string;

  @ApiPropertyOptional({
    description: 'Appliquer les ajustements de stock',
    example: true,
    default: true,
  })
  @IsOptional()
  appliquerAjustements?: boolean;

  @ApiPropertyOptional({
    description: 'IDs des lignes à exclure de la validation',
    example: [5, 8],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  lignesExclues?: number[];
}

// ============================================
// DTO: ANNULATION
// ============================================

export class AnnulerInventaireDto {
  @ApiProperty({
    description: 'Raison de l\'annulation',
    example: 'Erreur dans la sélection des produits',
  })
  @IsString()
  @IsNotEmpty()
  raison: string;
}

// ============================================
// DTO: FILTRES DE RECHERCHE
// ============================================

export class FiltresSessionsDto {
  @ApiPropertyOptional({ enum: StatutInventairePhysique })
  @IsOptional()
  @IsEnum(StatutInventairePhysique)
  statut?: StatutInventairePhysique;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  entrepotId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateDebut?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dateFin?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

// ============================================
// DTO: RÉPONSES
// ============================================

export class LigneInventaireResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  produitId: number;

  @ApiProperty()
  produit: {
    id: number;
    reference: string;
    nom: string;
    codeBarre?: string;
    categorie?: { id: number; nom: string };
  };

  @ApiProperty()
  emplacement?: string;

  @ApiProperty()
  quantiteTheorique: number;

  @ApiProperty()
  quantiteComptee?: number;

  @ApiProperty()
  ecart?: number;

  @ApiProperty()
  valeurEcart?: number;

  @ApiProperty({ enum: StatutLigneInventaire })
  statut: StatutLigneInventaire;

  @ApiProperty()
  notes?: string;

  @ApiProperty()
  necessiteRecomptage: boolean;

  @ApiProperty()
  dateComptage?: Date;
}

export class SessionInventaireResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  reference: string;

  @ApiProperty()
  titre: string;

  @ApiProperty()
  description?: string;

  @ApiProperty({ enum: StatutInventairePhysique })
  statut: StatutInventairePhysique;

  @ApiProperty()
  entrepot: {
    id: number;
    nom: string;
    code: string;
  };

  @ApiProperty()
  categorie?: {
    id: number;
    nom: string;
  };

  @ApiProperty()
  zoneEmplacement?: string;

  @ApiProperty()
  dateDebut: Date;

  @ApiProperty()
  dateFin?: Date;

  @ApiProperty()
  totalProduits: number;

  @ApiProperty()
  produitsComptes: number;

  @ApiProperty()
  produitsAvecEcart: number;

  @ApiProperty()
  valeurEcartTotal: number;

  @ApiProperty()
  progression: number; // Pourcentage

  @ApiProperty()
  createur: {
    id: number;
    nomComplet: string;
  };
}

export class EcartsResponseDto {
  @ApiProperty()
  sessionId: number;

  @ApiProperty()
  reference: string;

  @ApiProperty()
  totalLignes: number;

  @ApiProperty()
  lignesAvecEcart: number;

  @ApiProperty()
  ecartPositifTotal: number;

  @ApiProperty()
  ecartNegatifTotal: number;

  @ApiProperty()
  valeurEcartPositif: number;

  @ApiProperty()
  valeurEcartNegatif: number;

  @ApiProperty()
  valeurEcartNet: number;

  @ApiProperty({ type: [LigneInventaireResponseDto] })
  lignes: LigneInventaireResponseDto[];

  @ApiProperty()
  resumeParCategorie: {
    categorie: string;
    ecartQuantite: number;
    valeurEcart: number;
    nombreProduits: number;
  }[];
}

export class StatistiquesSessionDto {
  @ApiProperty()
  totalProduits: number;

  @ApiProperty()
  produitsComptes: number;

  @ApiProperty()
  produitsNonComptes: number;

  @ApiProperty()
  produitsAvecEcart: number;

  @ApiProperty()
  produitsSansEcart: number;

  @ApiProperty()
  progression: number;

  @ApiProperty()
  ecartPositifQuantite: number;

  @ApiProperty()
  ecartNegatifQuantite: number;

  @ApiProperty()
  valeurEcartPositif: number;

  @ApiProperty()
  valeurEcartNegatif: number;

  @ApiProperty()
  valeurEcartNet: number;

  @ApiProperty()
  produitsNecessitantRecomptage: number;
}