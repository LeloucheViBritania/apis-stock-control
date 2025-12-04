import { IsString, IsEmail, IsOptional, IsBoolean } from 'class-validator';

export class CreateClientDto {
  @IsString()
  nom: string;

  @IsOptional()
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
}