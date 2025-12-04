import { IsString, IsNumber, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreateProduitDto {
  @IsString()
  reference: string;

  @IsString()
  nom: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  categorieId?: number;

  @IsOptional()
  @IsString()
  marque?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  coutUnitaire?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prixVente?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantiteStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  niveauStockMin?: number;

  @IsOptional()
  @IsBoolean()
  estActif?: boolean;
}