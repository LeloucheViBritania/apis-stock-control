import { IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  nomUtilisateur: string;

  @IsString()
  @MinLength(6)
  motDePasse: string;
}