import { IsInt, IsOptional, IsDateString, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DetailCommandeDto {
  @IsInt()
  produitId: number;

  @IsInt()
  @Min(1)
  quantite: number;

  @IsOptional()
  prixUnitaire?: number;
}

export class CreateCommandeDto {
  @IsOptional()
  @IsInt()
  clientId?: number;

  @IsDateString()
  dateCommande: string;

  @IsOptional()
  @IsDateString()
  dateLivraison?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DetailCommandeDto)
  details: DetailCommandeDto[];
}