import { IsString, IsOptional, IsInt } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  nom: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  categorieParenteId?: number;

  @IsOptional()
  @IsInt()
  parentId?: number; // Alias pour compatibilité frontend
}
