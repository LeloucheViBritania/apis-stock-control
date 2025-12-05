import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO pour changer le statut d'un transfert
 *
 * @class ChangerStatutDto
 */
export class ChangerStatutDto {
  /**
   * Nouveau statut du transfert
   *
   * - EN_ATTENTE : Transfert créé mais pas encore expédié
   * - EN_TRANSIT : Transfert en cours d'acheminement
   * - COMPLETE : Transfert réceptionné
   * - ANNULE : Transfert annulé
   *
   * @example 'EN_TRANSIT'
   */
  @ApiProperty({
    description: 'Nouveau statut du transfert',
    enum: ['EN_ATTENTE', 'EN_TRANSIT', 'COMPLETE', 'ANNULE'],
    example: 'EN_TRANSIT',
  })
  @IsEnum(['EN_ATTENTE', 'EN_TRANSIT', 'COMPLETE', 'ANNULE'], {
    message: 'Le statut doit être EN_ATTENTE, EN_TRANSIT, COMPLETE ou ANNULE',
  })
  statut: 'EN_ATTENTE' | 'EN_TRANSIT' | 'COMPLETE' | 'ANNULE';

  /**
   * Raison du changement de statut
   * @example 'Expédition effectuée'
   * @maxLength 255
   */
  @ApiPropertyOptional({
    description: 'Raison du changement de statut',
    example: 'Expédition effectuée',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  raison?: string;
}
