import { IsString, IsEmail, MinLength, IsOptional, IsEnum } from 'class-validator';

export class UpdateUtilisateurDto {
  @IsString()
  @MinLength(3)
  nomUtilisateur: string;

  @IsEmail()
  email: string;
  
  @IsOptional()
  @IsString()
  nomComplet?: string;

  @IsOptional()
  @IsEnum(['ADMIN', 'GESTIONNAIRE', 'EMPLOYE'])
  role?: 'ADMIN' | 'GESTIONNAIRE' | 'EMPLOYE';
}