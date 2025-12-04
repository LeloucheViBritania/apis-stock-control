import { IsEnum, IsOptional } from 'class-validator';

export class UpdateCommandeDto {
  @IsOptional()
  @IsEnum(['EN_ATTENTE', 'EN_TRAITEMENT', 'EXPEDIE', 'LIVRE', 'ANNULE'])
  statut?: 'EN_ATTENTE' | 'EN_TRAITEMENT' | 'EXPEDIE' | 'LIVRE' | 'ANNULE';
}