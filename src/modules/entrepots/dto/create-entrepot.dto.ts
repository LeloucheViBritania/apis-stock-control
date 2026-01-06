import { IsString, IsInt, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreateEntrepotDto {
  @IsString()
  nom: string;

  @IsOptional()
  @IsString()
  code?: string; // Rendu optionnel - sera auto-généré si absent

  @IsOptional()
  @IsString()
  adresse?: string;

  @IsOptional()
  @IsString()
  ville?: string;

  @IsOptional()
  @IsString()
  pays?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsInt()
  responsableId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacite?: number;

  @IsOptional()
  @IsBoolean()
  estActif?: boolean;

  @IsOptional()
  @IsBoolean()
  estPrincipal?: boolean;
}
