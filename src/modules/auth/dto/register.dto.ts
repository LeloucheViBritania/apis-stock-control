import { IsString, IsEmail, MinLength, IsOptional, IsEnum } from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  nomUtilisateur: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  motDePasse: string;

  @IsOptional()
  @IsString()
  nomComplet?: string;

  @IsOptional()
  @IsEnum(['ADMIN', 'GESTIONNAIRE', 'EMPLOYE'])
  role?: 'ADMIN' | 'GESTIONNAIRE' | 'EMPLOYE';
}