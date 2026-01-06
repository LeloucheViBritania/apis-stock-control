import { IsString, IsEmail, IsOptional, IsEnum, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUtilisateurDto {
  @ApiProperty({ example: 'jdupont' })
  @IsString()
  nomUtilisateur: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  motDePasse: string;

  @ApiProperty({ example: 'Jean Dupont' })
  @IsString()
  nomComplet: string;

  @ApiPropertyOptional({ example: 'EMPLOYE', enum: ['ADMIN', 'GESTIONNAIRE', 'EMPLOYE'] })
  @IsOptional()
  @IsString()
  role?: string;

  @ApiPropertyOptional({ example: 'GRATUIT', enum: ['GRATUIT', 'PREMIUM', 'ENTREPRISE'] })
  @IsOptional()
  @IsString()
  tierAbonnement?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  telephone?: string;
}
