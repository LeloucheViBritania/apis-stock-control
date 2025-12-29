// ============================================
// FICHIER: src/modules/commandes/dto/commandes-avancees.dto.ts
// DTOs pour les fonctionnalités avancées de commandes
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
  IsBoolean,
  IsDateString,
  IsEmail,
  Min,
  Max,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============================================
// ENUMS
// ============================================

export enum StatutDevis {
  BROUILLON = 'BROUILLON',
  ENVOYE = 'ENVOYE',
  ACCEPTE = 'ACCEPTE',
  REFUSE = 'REFUSE',
  EXPIRE = 'EXPIRE',
  CONVERTI = 'CONVERTI',
}

export enum StatutSuiviLivraison {
  EN_PREPARATION = 'EN_PREPARATION',
  EXPEDIE = 'EXPEDIE',
  EN_TRANSIT = 'EN_TRANSIT',
  EN_LIVRAISON = 'EN_LIVRAISON',
  LIVRE = 'LIVRE',
  ECHEC_LIVRAISON = 'ECHEC_LIVRAISON',
  RETOURNE = 'RETOURNE',
}

// ============================================
// DTO: DUPLIQUER UNE COMMANDE
// ============================================

export class DupliquerCommandeDto {
  @ApiPropertyOptional({
    description: 'Nouveau client (si différent)',
    example: 5,
  })
  @IsOptional()
  @IsInt()
  clientId?: number;

  @ApiPropertyOptional({
    description: 'Nouvel entrepôt (si différent)',
    example: 2,
  })
  @IsOptional()
  @IsInt()
  entrepotId?: number;

  @ApiPropertyOptional({
    description: 'Nouvelle date de commande (défaut: aujourd\'hui)',
    example: '2025-02-01',
  })
  @IsOptional()
  @IsDateString()
  dateCommande?: string;

  @ApiPropertyOptional({
    description: 'Ajuster les quantités (multiplicateur)',
    example: 1.0,
    default: 1.0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @Max(10)
  multiplicateurQuantite?: number;

  @ApiPropertyOptional({
    description: 'Exclure certains produits de la duplication',
    example: [5, 8],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  produitsExclus?: number[];

  @ApiPropertyOptional({
    description: 'Mettre à jour les prix depuis le catalogue',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  mettreAJourPrix?: boolean;

  @ApiPropertyOptional({
    description: 'Notes pour la nouvelle commande',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ============================================
// DTO: MODIFIER UNE LIGNE
// ============================================

export class ModifierLigneCommandeDto {
  @ApiProperty({
    description: 'ID de la ligne à modifier',
    example: 15,
  })
  @IsInt()
  ligneId: number;

  @ApiPropertyOptional({
    description: 'Nouvelle quantité',
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  quantite?: number;

  @ApiPropertyOptional({
    description: 'Nouveau prix unitaire',
    example: 25000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  prixUnitaire?: number;

  @ApiPropertyOptional({
    description: 'Remise en pourcentage',
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  remise?: number;

  @ApiPropertyOptional({
    description: 'Raison de la modification',
    example: 'Ajustement suite à demande client',
  })
  @IsOptional()
  @IsString()
  raison?: string;
}

export class AjouterLigneCommandeDto {
  @ApiProperty({
    description: 'ID du produit',
    example: 42,
  })
  @IsInt()
  produitId: number;

  @ApiProperty({
    description: 'Quantité',
    example: 5,
  })
  @IsInt()
  @Min(1)
  quantite: number;

  @ApiPropertyOptional({
    description: 'Prix unitaire (défaut: prix catalogue)',
    example: 25000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  prixUnitaire?: number;

  @ApiPropertyOptional({
    description: 'Remise en pourcentage',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  remise?: number;
}

export class SupprimerLigneCommandeDto {
  @ApiProperty({
    description: 'ID de la ligne à supprimer',
    example: 15,
  })
  @IsInt()
  ligneId: number;

  @ApiPropertyOptional({
    description: 'Raison de la suppression',
  })
  @IsOptional()
  @IsString()
  raison?: string;
}

// ============================================
// DTO: SUIVI DE LIVRAISON
// ============================================

export class CreerSuiviLivraisonDto {
  @ApiPropertyOptional({
    description: 'Nom du transporteur',
    example: 'DHL Express',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transporteur?: string;

  @ApiPropertyOptional({
    description: 'Numéro de suivi',
    example: 'DHL1234567890',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  numeroSuivi?: string;

  @ApiPropertyOptional({
    description: 'URL de suivi externe',
    example: 'https://www.dhl.com/track?num=DHL1234567890',
  })
  @IsOptional()
  @IsString()
  urlSuivi?: string;

  @ApiPropertyOptional({
    description: 'Adresse de livraison',
  })
  @IsOptional()
  @IsString()
  adresseLivraison?: string;

  @ApiPropertyOptional({
    description: 'Ville de livraison',
  })
  @IsOptional()
  @IsString()
  villeLivraison?: string;

  @ApiPropertyOptional({
    description: 'Pays de livraison',
    default: 'Côte d\'Ivoire',
  })
  @IsOptional()
  @IsString()
  paysLivraison?: string;

  @ApiPropertyOptional({
    description: 'Contact pour la livraison',
  })
  @IsOptional()
  @IsString()
  contactLivraison?: string;

  @ApiPropertyOptional({
    description: 'Téléphone du contact',
  })
  @IsOptional()
  @IsString()
  telephoneLivraison?: string;

  @ApiPropertyOptional({
    description: 'Date de livraison prévue',
    example: '2025-02-10',
  })
  @IsOptional()
  @IsDateString()
  dateLivraisonPrevue?: string;

  @ApiPropertyOptional({
    description: 'Poids total en kg',
    example: 15.5,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  poidsTotalKg?: number;

  @ApiPropertyOptional({
    description: 'Nombre de colis',
    example: 2,
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  nombreColis?: number;

  @ApiPropertyOptional({
    description: 'Instructions spéciales',
  })
  @IsOptional()
  @IsString()
  instructionsLivraison?: string;

  @ApiPropertyOptional({
    description: 'Signature requise à la livraison',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  signatureRequise?: boolean;
}

export class MettreAJourSuiviDto {
  @ApiProperty({
    description: 'Nouveau statut',
    enum: StatutSuiviLivraison,
  })
  @IsEnum(StatutSuiviLivraison)
  statut: StatutSuiviLivraison;

  @ApiPropertyOptional({
    description: 'Description de l\'événement',
    example: 'Colis arrivé au centre de tri',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Localisation',
    example: 'Abidjan - Centre de tri',
  })
  @IsOptional()
  @IsString()
  localisation?: string;

  @ApiPropertyOptional({
    description: 'Numéro de suivi (si mise à jour)',
  })
  @IsOptional()
  @IsString()
  numeroSuivi?: string;

  @ApiPropertyOptional({
    description: 'Date de livraison réelle (si livré)',
    example: '2025-02-08',
  })
  @IsOptional()
  @IsDateString()
  dateLivraisonReelle?: string;
}

// ============================================
// DTO: DEVIS
// ============================================

export class LigneDevisDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  produitId: number;

  @ApiPropertyOptional({
    description: 'Description personnalisée',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 5 })
  @IsInt()
  @Min(1)
  quantite: number;

  @ApiPropertyOptional({
    description: 'Prix unitaire (défaut: prix catalogue)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  prixUnitaire?: number;

  @ApiPropertyOptional({
    description: 'Remise en % sur cette ligne',
    example: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  remise?: number;
}

export class CreerDevisDto {
  @ApiPropertyOptional({
    description: 'ID du client existant',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  clientId?: number;

  @ApiPropertyOptional({
    description: 'Nom du client (si pas de client existant)',
    example: 'Société ABC',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nomClient?: string;

  @ApiPropertyOptional({
    description: 'Email du client',
    example: 'contact@societeabc.ci',
  })
  @IsOptional()
  @IsEmail()
  emailClient?: string;

  @ApiPropertyOptional({
    description: 'Téléphone du client',
  })
  @IsOptional()
  @IsString()
  telephoneClient?: string;

  @ApiPropertyOptional({
    description: 'Adresse du client',
  })
  @IsOptional()
  @IsString()
  adresseClient?: string;

  @ApiPropertyOptional({
    description: 'ID de l\'entrepôt',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  entrepotId?: number;

  @ApiProperty({
    description: 'Date de validité du devis',
    example: '2025-02-28',
  })
  @IsDateString()
  dateValidite: string;

  @ApiPropertyOptional({
    description: 'Remise globale en %',
    example: 5,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  remiseGlobale?: number;

  @ApiPropertyOptional({
    description: 'Conditions de paiement',
    example: '30 jours fin de mois',
  })
  @IsOptional()
  @IsString()
  conditionsPaiement?: string;

  @ApiPropertyOptional({
    description: 'Délai de livraison',
    example: '5-7 jours ouvrés',
  })
  @IsOptional()
  @IsString()
  delaiLivraison?: string;

  @ApiPropertyOptional({
    description: 'Notes visibles sur le devis',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Notes internes (non visibles)',
  })
  @IsOptional()
  @IsString()
  notesInternes?: string;

  @ApiProperty({
    description: 'Lignes du devis',
    type: [LigneDevisDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LigneDevisDto)
  lignes: LigneDevisDto[];
}

export class ModifierDevisDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  clientId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nomClient?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  emailClient?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telephoneClient?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateValidite?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  remiseGlobale?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conditionsPaiement?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  delaiLivraison?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Remplacer toutes les lignes',
    type: [LigneDevisDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LigneDevisDto)
  lignes?: LigneDevisDto[];
}

export class ConvertirDevisDto {
  @ApiPropertyOptional({
    description: 'Date de commande (défaut: aujourd\'hui)',
    example: '2025-02-01',
  })
  @IsOptional()
  @IsDateString()
  dateCommande?: string;

  @ApiPropertyOptional({
    description: 'Date de livraison souhaitée',
    example: '2025-02-15',
  })
  @IsOptional()
  @IsDateString()
  dateLivraison?: string;

  @ApiPropertyOptional({
    description: 'Vérifier la disponibilité du stock',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  verifierStock?: boolean;

  @ApiPropertyOptional({
    description: 'Réserver le stock',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  reserverStock?: boolean;

  @ApiPropertyOptional({
    description: 'Notes supplémentaires',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class EnvoyerDevisDto {
  @ApiProperty({
    description: 'Email du destinataire',
    example: 'client@example.com',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Objet de l\'email',
    example: 'Devis N°DEV-202501-0001',
  })
  @IsOptional()
  @IsString()
  objet?: string;

  @ApiPropertyOptional({
    description: 'Message personnalisé',
  })
  @IsOptional()
  @IsString()
  message?: string;
}

// ============================================
// DTO: RÉPONSES
// ============================================

export class CommandeDupliqueeResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  commandeOriginale: {
    id: number;
    numeroCommande: string;
  };

  @ApiProperty()
  nouvelleCommande: {
    id: number;
    numeroCommande: string;
    montantTotal: number;
    nombreLignes: number;
  };

  @ApiProperty()
  message: string;
}

export class SuiviLivraisonResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  commandeId: number;

  @ApiProperty()
  numeroCommande: string;

  @ApiProperty()
  transporteur?: string;

  @ApiProperty()
  numeroSuivi?: string;

  @ApiProperty()
  urlSuivi?: string;

  @ApiProperty({ enum: StatutSuiviLivraison })
  statut: StatutSuiviLivraison;

  @ApiProperty()
  adresseLivraison?: string;

  @ApiProperty()
  dateLivraisonPrevue?: Date;

  @ApiProperty()
  dateLivraisonReelle?: Date;

  @ApiProperty()
  evenements: {
    statut: string;
    description: string;
    localisation?: string;
    date: Date;
  }[];

  @ApiProperty()
  progression: number; // Pourcentage
}

export class DevisResponseDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  numeroDevis: string;

  @ApiProperty({ enum: StatutDevis })
  statut: StatutDevis;

  @ApiProperty()
  client?: {
    id: number;
    nom: string;
    email?: string;
  };

  @ApiProperty()
  dateDevis: Date;

  @ApiProperty()
  dateValidite: Date;

  @ApiProperty()
  montantHT: number;

  @ApiProperty()
  montantTaxe: number;

  @ApiProperty()
  montantTTC: number;

  @ApiProperty()
  remiseGlobale: number;

  @ApiProperty()
  lignes: {
    id: number;
    produit: { reference: string; nom: string };
    quantite: number;
    prixUnitaire: number;
    remise: number;
    montantHT: number;
    montantTTC: number;
  }[];

  @ApiProperty()
  estExpire: boolean;

  @ApiProperty()
  joursRestants: number;
}

export class ConversionDevisResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  devis: {
    id: number;
    numeroDevis: string;
    ancienStatut: string;
  };

  @ApiProperty()
  commande: {
    id: number;
    numeroCommande: string;
    montantTotal: number;
    statut: string;
  };

  @ApiProperty()
  alertesStock?: {
    produitId: number;
    reference: string;
    stockDisponible: number;
    quantiteDemandee: number;
  }[];

  @ApiProperty()
  message: string;
}