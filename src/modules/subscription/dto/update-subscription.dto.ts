import { IsEnum, IsInt, Min } from 'class-validator';

export class UpdateSubscriptionDto {
  @IsEnum(['GRATUIT', 'PREMIUM'])
  tier: 'GRATUIT' | 'PREMIUM';

  @IsInt()
  @Min(1)
  durationMonths?: number; // Pour PREMIUM
}