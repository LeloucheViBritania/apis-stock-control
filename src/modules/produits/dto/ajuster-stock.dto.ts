import { IsEnum, IsInt, Min, IsOptional, IsString } from 'class-validator';

export class AjusterStockDto {
  @IsInt()
  @Min(1)
  quantite: number;

  @IsEnum(['entree', 'sortie'])
  type: 'entree' | 'sortie';

  @IsOptional()
  @IsString()
  raison?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}