import { IsString, IsInt, IsOptional, IsBoolean, Min } from 'class-validator';

export class CreateEntrepotDto {
  @IsString()
  nom: string;

  @IsString()
  code: string;

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
  @IsInt()
  responsableId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacite?: number;

  @IsOptional()
  @IsBoolean()
  estActif?: boolean;
}