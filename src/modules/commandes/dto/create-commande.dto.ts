import { IsInt, IsOptional, IsDateString, IsArray, ValidateNested, Min, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class DetailCommandeDto {
  @IsInt()
  produitId: number;

  @IsInt()
  @Min(1)
  quantite: number;

  @IsOptional()
  @IsNumber()
  prixUnitaire?: number;
}

export class LigneCommandeDto {
  @IsInt()
  produitId: number;

  @IsInt()
  @Min(1)
  quantite: number;

  @IsOptional()
  @IsNumber()
  prixUnitaire?: number;
}

export class CreateCommandeDto {
  @IsOptional()
  @IsInt()
  clientId?: number;

  @IsOptional()
  @IsInt()
  entrepotId?: number;

  @IsOptional()
  @IsDateString()
  dateCommande?: string;

  @IsOptional()
  @IsDateString()
  dateLivraison?: string;

  @IsOptional()
  @IsDateString()
  dateLivraisonPrevue?: string; // Alias pour dateLivraison

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsNumber()
  remise?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetailCommandeDto)
  details?: DetailCommandeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LigneCommandeDto)
  lignes?: LigneCommandeDto[]; // Alias pour details
}
