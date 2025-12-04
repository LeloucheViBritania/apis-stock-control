import { IsOptional, IsString, IsBoolean, IsNumber, IsInt, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class ModifierFournisseurDto {
  @IsOptional()
  @IsString({ message: 'La référence fournisseur doit être une chaîne de caractères' })
  @MaxLength(50, { message: 'La référence fournisseur ne peut pas dépasser 50 caractères' })
  referenceFournisseur?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Le prix unitaire doit être un nombre' })
  @Min(0, { message: 'Le prix unitaire doit être positif' })
  @Type(() => Number)
  prixUnitaire?: number;

  @IsOptional()
  @IsInt({ message: 'Le délai de livraison doit être un entier' })
  @Min(0, { message: 'Le délai de livraison doit être positif' })
  @Type(() => Number)
  delaiLivraisonJours?: number;

  @IsOptional()
  @IsInt({ message: 'La quantité minimum doit être un entier' })
  @Min(1, { message: 'La quantité minimum doit être au moins 1' })
  @Type(() => Number)
  quantiteMinimumCommande?: number;

  @IsOptional()
  @IsBoolean({ message: 'estPrefere doit être un booléen' })
  estPrefere?: boolean;
}