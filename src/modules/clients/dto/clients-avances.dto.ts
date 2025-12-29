// ============================================
// FICHIER: src/modules/clients/dto/clients-avances.dto.ts
// DTOs pour les fonctionnalités avancées clients
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

export enum StatutClient {
  ACTIF = 'ACTIF',
  INACTIF = 'INACTIF',
  BLOQUE = 'BLOQUE',
  SUSPENDU = 'SUSPENDU',
  VIP = 'VIP',
}

export enum SegmentClient {
  NOUVEAU = 'NOUVEAU',
  OCCASIONNEL = 'OCCASIONNEL',
  REGULIER = 'REGULIER',
  FIDELE = 'FIDELE',
  VIP = 'VIP',
  INACTIF = 'INACTIF',
  A_RISQUE = 'A_RISQUE',
}

export enum RaisonBlocage {
  IMPAYE = 'IMPAYE',
  LITIGE = 'LITIGE',
  FRAUDE = 'FRAUDE',
  INACTIF = 'INACTIF',
  DEMANDE_CLIENT = 'DEMANDE_CLIENT',
  AUTRE = 'AUTRE',
}

export enum PrioriteNote {
  BASSE = 'BASSE',
  NORMALE = 'NORMALE',
  HAUTE = 'HAUTE',
  URGENTE = 'URGENTE',
}

// ============================================
// DTO: FILTRES HISTORIQUE ACHATS
// ============================================

export class FiltresHistoriqueAchatsDto {
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
    description: 'Statut des commandes',
    example: 'LIVREE',
  })
  @IsOptional()
  @IsString()
  statut?: string;

  @ApiPropertyOptional({
    description: 'ID de l\'entrepôt',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  entrepotId?: number;

  @ApiPropertyOptional({
    description: 'Inclure les détails des lignes',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  inclureLignes?: boolean;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}

// ============================================
// DTO: BLOQUER CLIENT
// ============================================

export class BloquerClientDto {
  @ApiProperty({
    description: 'Raison du blocage',
    enum: RaisonBlocage,
    example: RaisonBlocage.IMPAYE,
  })
  @IsEnum(RaisonBlocage)
  raison: RaisonBlocage;

  @ApiProperty({
    description: 'Description détaillée',
    example: 'Client avec 3 factures impayées depuis plus de 90 jours',
  })
  @IsString()
  @MaxLength(1000)
  description: string;

  @ApiPropertyOptional({
    description: 'Montant impayé',
    example: 1500000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  montantImpaye?: number;
}

export class DebloquerClientDto {
  @ApiProperty({
    description: 'Raison du déblocage',
    example: 'Factures réglées intégralement',
  })
  @IsString()
  @MaxLength(1000)
  raison: string;
}

// ============================================
// DTO: MODIFIER LIMITE CRÉDIT
// ============================================

export class ModifierLimiteCreditDto {
  @ApiProperty({
    description: 'Nouvelle limite de crédit',
    example: 5000000,
  })
  @IsNumber()
  @Min(0)
  limiteCredit: number;

  @ApiPropertyOptional({
    description: 'Raison de la modification',
  })
  @IsOptional()
  @IsString()
  raison?: string;
}

// ============================================
// DTO: FILTRES SEGMENTATION
// ============================================

export class FiltresSegmentationDto {
  @ApiPropertyOptional({
    description: 'Segment spécifique',
    enum: SegmentClient,
  })
  @IsOptional()
  @IsEnum(SegmentClient)
  segment?: SegmentClient;

  @ApiPropertyOptional({
    description: 'CA minimum',
    example: 1000000,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  caMin?: number;

  @ApiPropertyOptional({
    description: 'CA maximum',
    example: 10000000,
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  caMax?: number;

  @ApiPropertyOptional({
    description: 'Inclure les clients bloqués',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  inclureBloques?: boolean;
}

// ============================================
// DTO: AJOUTER NOTE
// ============================================

export class AjouterNoteClientDto {
  @ApiProperty({
    description: 'Titre de la note',
    example: 'Appel de relance effectué',
  })
  @IsString()
  @MaxLength(100)
  titre: string;

  @ApiProperty({
    description: 'Contenu de la note',
    example: 'Client contacté par téléphone. Promet de régler sous 15 jours.',
  })
  @IsString()
  @MaxLength(2000)
  contenu: string;

  @ApiPropertyOptional({
    description: 'Priorité',
    enum: PrioriteNote,
    default: PrioriteNote.NORMALE,
  })
  @IsOptional()
  @IsEnum(PrioriteNote)
  priorite?: PrioriteNote;

  @ApiPropertyOptional({
    description: 'Catégorie',
    example: 'COMPTABILITE',
  })
  @IsOptional()
  @IsString()
  categorie?: string;

  @ApiPropertyOptional({
    description: 'Date de rappel',
    example: '2025-02-15',
  })
  @IsOptional()
  @IsDateString()
  dateRappel?: string;
}

// ============================================
// DTO: RÉPONSES
// ============================================

export class AchatClientResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  numeroCommande: string;

  @ApiProperty()
  dateCommande: Date;

  @ApiProperty()
  dateLivraison?: Date;

  @ApiProperty()
  statut: string;

  @ApiProperty()
  montantHT: number;

  @ApiProperty()
  montantTTC: number;

  @ApiProperty()
  nombreArticles: number;

  @ApiProperty()
  entrepot?: { id: number; nom: string };

  @ApiProperty()
  lignes?: {
    produit: { reference: string; nom: string };
    quantite: number;
    prixUnitaire: number;
    montant: number;
  }[];
}

export class HistoriqueAchatsResponseDto {
  @ApiProperty()
  clientId: number;

  @ApiProperty()
  client: {
    nom: string;
    email?: string;
    segment: string;
  };

  @ApiProperty()
  resume: {
    nombreCommandes: number;
    montantTotal: number;
    panierMoyen: number;
    derniereCommande?: Date;
  };

  @ApiProperty()
  commandes: AchatClientResponseDto[];

  @ApiProperty()
  produitsFrequents: {
    produitId: number;
    reference: string;
    nom: string;
    quantiteTotale: number;
    nombreCommandes: number;
  }[];

  @ApiProperty()
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export class SoldeClientResponseDto {
  @ApiProperty()
  clientId: number;

  @ApiProperty()
  client: {
    nom: string;
    statut: string;
    conditionsPaiement?: string;
  };

  @ApiProperty()
  limiteCredit: number;

  @ApiProperty()
  solde: {
    factureTotal: number;
    paye: number;
    soldeActuel: number;    // Montant dû
    creditDisponible: number;
    tauxUtilisation: number;
  };

  @ApiProperty()
  echeancier: {
    nonEchu: number;
    echu0_30: number;
    echu31_60: number;
    echu61_90: number;
    echuPlus90: number;
    totalEchu: number;
  };

  @ApiProperty()
  indicateurs: {
    scoreCredit: number;
    risque: 'FAIBLE' | 'MOYEN' | 'ELEVE' | 'CRITIQUE';
    tendance: 'AMELIORATION' | 'STABLE' | 'DEGRADATION';
  };

  @ApiProperty()
  dernieresFactures: {
    id: number;
    numero: string;
    date: Date;
    montant: number;
    solde: number;
    echeance: Date;
    statut: string;
  }[];

  @ApiProperty()
  derniersPaiements: {
    id: number;
    date: Date;
    montant: number;
    reference?: string;
  }[];
}

export class StatistiquesClientResponseDto {
  @ApiProperty()
  clientId: number;

  @ApiProperty()
  client: {
    nom: string;
    dateCreation: Date;
    segment: string;
    statut: string;
  };

  @ApiProperty()
  commandes: {
    total: number;
    annee: number;
    mois: number;
    frequence: number;  // par mois
  };

  @ApiProperty()
  chiffreAffaires: {
    total: number;
    annee: number;
    mois: number;
    panierMoyen: number;
    valeurClient: number;  // Lifetime value
  };

  @ApiProperty()
  evolution: {
    mois: string;
    ca: number;
    commandes: number;
  }[];

  @ApiProperty()
  paiements: {
    delaiMoyen: number;
    tauxPaiementATemps: number;
    nombreRetards: number;
  };

  @ApiProperty()
  produits: {
    nombreDistincts: number;
    categoriePreferee?: string;
    topProduits: {
      reference: string;
      nom: string;
      quantite: number;
      montant: number;
    }[];
  };

  @ApiProperty()
  segmentation: {
    segment: string;
    potentielCroissance: string;
    recommandations: string[];
  };
}

export class SegmentationResponseDto {
  @ApiProperty()
  resume: {
    totalClients: number;
    clientsActifs: number;
    clientsBloques: number;
    caTotal: number;
  };

  @ApiProperty()
  segments: {
    segment: string;
    nombreClients: number;
    pourcentage: number;
    caTotal: number;
    caMoyen: number;
    panierMoyen: number;
    description: string;
  }[];

  @ApiProperty()
  repartition: {
    parStatut: { statut: string; nombre: number }[];
    parRegion: { region: string; nombre: number; ca: number }[];
  };

  @ApiProperty()
  alertes: {
    clientsARisque: number;
    clientsInactifs: number;
    clientsDepassementCredit: number;
  };

  @ApiProperty()
  topClients: {
    id: number;
    nom: string;
    segment: string;
    ca: number;
    commandes: number;
  }[];
}

export class BlocageResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  client: {
    id: number;
    nom: string;
    statut: string;
  };

  @ApiProperty()
  blocage?: {
    id: number;
    raison: string;
    dateDebut: Date;
    montantImpaye?: number;
  };

  @ApiProperty()
  message: string;
}