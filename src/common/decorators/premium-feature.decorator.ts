import { SetMetadata } from '@nestjs/common';
import { Feature } from '../enums/features.enum';

export const PREMIUM_FEATURE_KEY = 'premiumFeature';
export const PremiumFeature = (feature: Feature) =>
  SetMetadata(PREMIUM_FEATURE_KEY, feature);