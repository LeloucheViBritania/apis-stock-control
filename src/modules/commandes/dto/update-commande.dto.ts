import { IsEnum, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DetailCommandeDto} from './create-commande.dto'

export class UpdateCommandeDto {
  @IsOptional()
  @IsEnum(['EN_ATTENTE', 'EN_TRAITEMENT', 'EXPEDIE', 'LIVRE', 'ANNULE'])
  statut?: 'EN_ATTENTE' | 'EN_TRAITEMENT' | 'EXPEDIE' | 'LIVRE' | 'ANNULE';
}