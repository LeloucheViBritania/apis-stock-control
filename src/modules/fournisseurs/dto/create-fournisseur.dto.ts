import { IsString, IsEmail, IsOptional, IsBoolean, IsNumber, ValidateIf } from 'class-validator';

export class CreateFournisseurDto {
  @IsString()
  nom: string;

  @IsOptional()
  @IsString()
  personneContact?: string;

  @IsOptional()
  @IsString()
  contactPrincipal?: string; // Alias pour personneContact

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
  @IsString()
  siret?: string;

  @IsOptional()
  @IsString()
  conditionsPaiement?: string;

  @IsOptional()
  @IsBoolean()
  estActif?: boolean;

  @IsOptional()
  @IsNumber()
  delaiLivraisonMoyen?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
