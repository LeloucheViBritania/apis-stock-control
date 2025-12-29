// ============================================
// FICHIER: src/modules/fournisseurs/dto/fournisseurs-avances.dto.ts
// DTOs pour les fonctionnalités avancées fournisseurs
// ============================================

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsInt,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsEnum,
  IsDateString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================
// ENUMS
// ============================================

export enum TypeIncident {
  RETARD = 'RETARD',
  NON_CONFORMITE = 'NON_CONFORMITE',
  PRODUIT_DEFECTUEUX = 'PRODUIT_DEFECTUEUX',
  QUANTITE_INCORRECTE = 'QUANTITE_INCORRECTE',
  DOCUMENTATION_MANQUANTE = 'DOCUMENTATION_MANQUANTE',
  PRIX_DIFFERENT = 'PRIX_DIFFERENT',
  AUTRE = 'AUTRE',
}

export enum ImpactIncident {
  FAIBLE = 'FAIBLE',
  MOYEN = 'MOYEN',
  ELEVE = 'ELEVE',
  CRITIQUE = 'CRITIQUE',
}

export enum StatutIncident {
  OUVERT = 'OUVERT',
  EN_COURS = 'EN_COURS',
  RESOLU = 'RESOLU',
  FERME = 'FERME',
}

export enum CategorieFournisseur {
  A = 'A',  // Excellent
  B = 'B',  // Bon
  C = 'C',  // Acceptable
  D = 'D',  // À surveiller
}

// ============================================
// DTO: NOTER UN FOURNISSEUR
// ============================================

export class NoterFournisseurDto {
  @ApiPropertyOptional({
    description: 'ID du bon de commande évalué',
    example: 15,
  })
  @IsOptional()
  @IsInt()
  bonCommandeId?: number;

  @ApiProperty({
    description: 'Note qualité des produits (1-5)',
    example: 4.5,
    minimum: 1,
    maximum: 5,
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  noteQualite: number;

  @ApiProperty({
    description: 'Note respect des délais (1-5)',
    example: 4.0,
    minimum: 1,
    maximum: 5,
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  noteDelai: number;

  @ApiProperty({
    description: 'Note compétitivité prix (1-5)',
    example: 3.5,
    minimum: 1,
    maximum: 5,
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  notePrix: number;

  @ApiProperty({
    description: 'Note communication/réactivité (1-5)',
    example: 4.0,
    minimum: 1,
    maximum: 5,
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  noteCommunication: number;

  @ApiProperty({
    description: 'Note conformité de la commande (1-5)',
    example: 5.0,
    minimum: 1,
    maximum: 5,
  })
  @IsNumber()
  @Min(1)
  @Max(5)
  noteConformite: number;

  @ApiPropertyOptional({
    description: 'Commentaire général',
    example: 'Très bonne collaboration, produits de qualité.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  commentaire?: string;

  @ApiPropertyOptional({
    description: 'Points forts identifiés',
    example: 'Réactivité, qualité des emballages',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pointsForts?: string;

  @ApiPropertyOptional({
    description: 'Points à améliorer',
    example: 'Délais parfois justes',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  pointsAmeliorer?: string;

  @ApiPropertyOptional({
    description: 'Recommandez-vous ce fournisseur?',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  recommande?: boolean;
}

// ============================================
// DTO: FILTRES COMMANDES FOURNISSEUR
// ============================================

export class FiltresCommandesFournisseurDto {
  @ApiPropertyOptional({
    description: 'Statut de la commande',
    example: 'LIVREE',
  })
  @IsOptional()
  @IsString()
  statut?: string;

  @ApiPropertyOptional({
    description: 'Date de début',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  dateDebut?: string;

  @ApiPropertyOptional({
    description: 'Date de fin',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  dateFin?: string;

  @ApiPropertyOptional({
    description: 'Numéro de page',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: 'Nombre d\'éléments par page',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

// ============================================
// DTO: FILTRES PRODUITS FOURNISSEUR
// ============================================

export class FiltresProduitsFournisseurDto {
  @ApiPropertyOptional({
    description: 'ID de la catégorie',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  categorieId?: number;

  @ApiPropertyOptional({
    description: 'Recherche par nom ou référence',
    example: 'clavier',
  })
  @IsOptional()
  @IsString()
  recherche?: string;

  @ApiPropertyOptional({
    description: 'Uniquement les produits préférés',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  preferesUniquement?: boolean;

  @ApiPropertyOptional({
    description: 'Uniquement les produits en stock',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  enStockUniquement?: boolean;

  @ApiPropertyOptional({
    description: 'Numéro de page',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: 'Nombre d\'éléments par page',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

// ============================================
// DTO: SIGNALER UN INCIDENT
// ============================================

export class SignalerIncidentDto {
  @ApiPropertyOptional({
    description: 'ID du bon de commande concerné',
    example: 15,
  })
  @IsOptional()
  @IsInt()
  bonCommandeId?: number;

  @ApiProperty({
    description: 'Type d\'incident',
    enum: TypeIncident,
    example: TypeIncident.RETARD,
  })
  @IsEnum(TypeIncident)
  typeIncident: TypeIncident;

  @ApiProperty({
    description: 'Description détaillée de l\'incident',
    example: 'Livraison reçue avec 5 jours de retard sans préavis.',
  })
  @IsString()
  @MaxLength(2000)
  description: string;

  @ApiProperty({
    description: 'Impact de l\'incident',
    enum: ImpactIncident,
    example: ImpactIncident.MOYEN,
  })
  @IsEnum(ImpactIncident)
  impact: ImpactIncident;

  @ApiPropertyOptional({
    description: 'Montant de l\'impact financier',
    example: 150000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  montantImpact?: number;
}

// ============================================
// DTO: RÉPONSES
// ============================================

export class EvaluationResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  fournisseurId: number;

  @ApiProperty()
  bonCommandeId?: number;

  @ApiProperty()
  notes: {
    qualite: number;
    delai: number;
    prix: number;
    communication: number;
    conformite: number;
    globale: number;
  };

  @ApiProperty()
  commentaire?: string;

  @ApiProperty()
  pointsForts?: string;

  @ApiProperty()
  pointsAmeliorer?: string;

  @ApiProperty()
  recommande: boolean;

  @ApiProperty()
  evaluateur?: {
    id: number;
    nom: string;
  };

  @ApiProperty()
  dateEvaluation: Date;
}

export class StatistiquesFournisseurResponseDto {
  @ApiProperty()
  fournisseurId: number;

  @ApiProperty()
  fournisseur: {
    id: number;
    nom: string;
    email?: string;
    telephone?: string;
  };

  @ApiProperty()
  notes: {
    qualite: number;
    delai: number;
    prix: number;
    communication: number;
    conformite: number;
    globale: number;
  };

  @ApiProperty()
  nombreEvaluations: number;

  @ApiProperty()
  tauxRecommandation: number;

  @ApiProperty()
  commandes: {
    total: number;
    livrees: number;
    enRetard: number;
    montantTotal: number;
  };

  @ApiProperty()
  performance: {
    delaiMoyen: number;
    tauxRespectDelai: number;
    tauxConformite: number;
    nombreLitiges: number;
  };

  @ApiProperty()
  classement: {
    rang?: number;
    categorie: CategorieFournisseur;
    totalFournisseurs?: number;
  };

  @ApiProperty()
  tendance: 'HAUSSE' | 'STABLE' | 'BAISSE';

  @ApiProperty()
  dernieresEvaluations: EvaluationResponseDto[];
}

export class CommandeFournisseurResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  numeroCommande: string;

  @ApiProperty()
  dateCommande: Date;

  @ApiProperty()
  dateLivraisonPrevue?: Date;

  @ApiProperty()
  dateLivraisonReelle?: Date;

  @ApiProperty()
  statut: string;

  @ApiProperty()
  montantTotal: number;

  @ApiProperty()
  nombreLignes: number;

  @ApiProperty()
  entrepot: {
    id: number;
    nom: string;
  };

  @ApiProperty()
  retard?: number; // Jours de retard (si applicable)

  @ApiProperty()
  aEteEvalue: boolean;
}

export class HistoriqueCommandesResponseDto {
  @ApiProperty()
  fournisseurId: number;

  @ApiProperty()
  fournisseur: {
    nom: string;
    email?: string;
  };

  @ApiProperty()
  resume: {
    nombreCommandes: number;
    montantTotal: number;
    commandesLivrees: number;
    commandesEnCours: number;
    tauxLivraison: number;
  };

  @ApiProperty()
  commandes: CommandeFournisseurResponseDto[];

  @ApiProperty()
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ProduitFournisseurResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  produit: {
    id: number;
    reference: string;
    nom: string;
    description?: string;
    categorie?: string;
    stockActuel: number;
  };

  @ApiProperty()
  prixUnitaire: number;

  @ApiProperty()
  delaiLivraisonJours?: number;

  @ApiProperty()
  quantiteMinimale?: number;

  @ApiProperty()
  estPrefere: boolean;

  @ApiProperty()
  referenceExterne?: string;

  @ApiProperty()
  dernierAchat?: {
    date: Date;
    quantite: number;
    prix: number;
  };
}

export class CatalogueFournisseurResponseDto {
  @ApiProperty()
  fournisseurId: number;

  @ApiProperty()
  fournisseur: {
    nom: string;
    email?: string;
    conditionsPaiement?: string;
  };

  @ApiProperty()
  resume: {
    nombreProduits: number;
    nombreCategories: number;
    produitsPreferés: number;
  };

  @ApiProperty()
  produits: ProduitFournisseurResponseDto[];

  @ApiProperty()
  categories: {
    id: number;
    nom: string;
    nombreProduits: number;
  }[];

  @ApiProperty()
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class ComparaisonFournisseursDto {
  @ApiProperty()
  produitId: number;

  @ApiProperty()
  produit: {
    reference: string;
    nom: string;
  };

  @ApiProperty()
  fournisseurs: {
    fournisseur: {
      id: number;
      nom: string;
      noteGlobale: number;
      categorie: string;
    };
    prixUnitaire: number;
    delaiLivraison: number;
    estPrefere: boolean;
    dernierAchat?: Date;
  }[];

  @ApiProperty()
  meilleurPrix: number;

  @ApiProperty()
  meilleurDelai: number;
}