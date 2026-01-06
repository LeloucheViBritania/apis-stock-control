import { IsString, IsEmail, IsOptional, IsBoolean, IsNumber, ValidateIf } from 'class-validator';

export class CreateClientDto {
  @IsString()
  nom: string;

  @IsOptional()
  @ValidateIf((o) => o.email !== '' && o.email !== null)
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

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
  numeroFiscal?: string;

  @IsOptional()
  @IsBoolean()
  estActif?: boolean;

  // Champs additionnels du frontend
  @IsOptional()
  @IsString()
  entreprise?: string;

  @IsOptional()
  @IsString()
  segment?: string;

  @IsOptional()
  @IsNumber()
  limiteCredit?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
