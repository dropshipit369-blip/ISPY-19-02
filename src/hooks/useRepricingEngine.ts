import { useState, useCallback, useMemo } from 'react';

/* ───────────────── CONDITION TYPES ───────────────── */

export type StandardCondition = 'new' | 'like-new' | 'very-good' | 'good' | 'acceptable' | 'poor';

export interface ConditionProfile {
  condition: StandardCondition;
  priceFloor: number;
  priceCeiling: number;
  expectedTimeToSell: 'fast' | 'medium' | 'slow';
  riskFactor: number; // 0-1, higher = more risk
}

export interface ConfidenceProfile {
  authenticityLikelihood: number; // 0-100
  conditionConfidence: number; // 0-100
  marketVolatilityScore: number; // 0-100 (higher = more volatile)
  recommendedPricingBand: {
    floor: number;
    ceiling: number;
    optimal: number;
  };
}

export interface RepricingResult {
  originalPrices: {
    low: number;
    median: number;
    high: number;
  };
  adjustedPrices: {
    low: number;
    median: number;
    high: number;
  };
  percentageChange: number;
  buyUnder: number;
  estimatedProfit: {
    low: number;
    high: number;
  };
  timeToSell: 'fast' | 'medium' | 'slow';
  riskLevel: 'low' | 'medium' | 'high';
  platformFees: number;
  confidenceProfile: ConfidenceProfile;
}

/* ───────────────── CONDITION MODIFIERS ───────────────── */

const CONDITION_MODIFIERS: Record<StandardCondition, {
  multiplier: number;
  timeToSell: 'fast' | 'medium' | 'slow';
  riskFactor: number;
}> = {
  'new': {
    multiplier: 1.25,
    timeToSell: 'fast',
    riskFactor: 0.1,
  },
  'like-new': {
    multiplier: 1.10,
    timeToSell: 'fast',
    riskFactor: 0.15,
  },
  'very-good': {
    multiplier: 1.0,
    timeToSell: 'medium',
    riskFactor: 0.2,
  },
  'good': {
    multiplier: 0.85,
    timeToSell: 'medium',
    riskFactor: 0.3,
  },
  'acceptable': {
    multiplier: 0.65,
    timeToSell: 'slow',
    riskFactor: 0.5,
  },
  'poor': {
    multiplier: 0.35,
    timeToSell: 'slow',
    riskFactor: 0.8,
  },
};

/* ───────────────── REPRICING ENGINE HOOK ───────────────── */

interface UseRepricingEngineProps {
  baseLowPrice: number | null | undefined;
  baseMedianPrice: number | null | undefined;
  baseHighPrice: number | null | undefined;
  baseConfidence?: number | null | undefined;
  authenticityScore?: number | null | undefined;
  volatilityScore?: number | null | undefined;
  platformFeeRate?: number | null | undefined;
}

export function useRepricingEngine({
  baseLowPrice,
  baseMedianPrice,
  baseHighPrice,
  baseConfidence = 75,
  authenticityScore = 85,
  volatilityScore = 30,
  platformFeeRate = 0.13,
}: UseRepricingEngineProps) {
  // Coerce nulls/undefined to 0 so calculations are always numeric
  const safeBaseLow = baseLowPrice ?? 0;
  const safeBaseMedian = baseMedianPrice ?? 0;
  const safeBaseHigh = baseHighPrice ?? 0;
  const safeConfidence = baseConfidence ?? 75;
  const safeAuthenticity = authenticityScore ?? 85;
  const safeVolatility = volatilityScore ?? 30;
  const safePlatformFee = platformFeeRate ?? 0.13;

  const [condition, setCondition] = useState<StandardCondition>('good');

  const calculateRepricing = useCallback((selectedCondition: StandardCondition): RepricingResult => {
    const modifier = CONDITION_MODIFIERS[selectedCondition];

    const adjustedLow = Math.round(safeBaseLow * modifier.multiplier);
    const adjustedMedian = Math.round(safeBaseMedian * modifier.multiplier);
    const adjustedHigh = Math.round(safeBaseHigh * modifier.multiplier);

    const percentageChange = Math.round((modifier.multiplier - 1) * 100);
    const buyUnder = Math.round(adjustedLow * 0.6);
    const platformFees = Math.round(adjustedMedian * safePlatformFee);

    const profitLow = adjustedLow - buyUnder - platformFees;
    const profitHigh = adjustedHigh - buyUnder - platformFees;

    const combinedRisk = (modifier.riskFactor * 0.5) + ((100 - safeConfidence) / 100 * 0.5);
    const riskLevel: 'low' | 'medium' | 'high' =
      combinedRisk < 0.3 ? 'low' :
      combinedRisk < 0.6 ? 'medium' : 'high';

    const conditionConfidence = Math.round(safeConfidence * (1 - modifier.riskFactor * 0.3));
    const confidenceProfile: ConfidenceProfile = {
      authenticityLikelihood: safeAuthenticity,
      conditionConfidence,
      marketVolatilityScore: safeVolatility,
      recommendedPricingBand: {
        floor: adjustedLow,
        ceiling: adjustedHigh,
        optimal: adjustedMedian,
      },
    };

    return {
      originalPrices: {
        low: safeBaseLow,
        median: safeBaseMedian,
        high: safeBaseHigh,
      },
      adjustedPrices: {
        low: adjustedLow,
        median: adjustedMedian,
        high: adjustedHigh,
      },
      percentageChange,
      buyUnder,
      estimatedProfit: {
        low: profitLow,
        high: profitHigh,
      },
      timeToSell: modifier.timeToSell,
      riskLevel,
      platformFees,
      confidenceProfile,
    };
  }, [safeBaseLow, safeBaseMedian, safeBaseHigh, safeConfidence, safeAuthenticity, safeVolatility, safePlatformFee]);

  const repricingResult = useMemo(() => calculateRepricing(condition), [condition, calculateRepricing]);

  return {
    condition,
    setCondition,
    repricingResult,
    calculateRepricing,
    conditionOptions: Object.keys(CONDITION_MODIFIERS) as StandardCondition[],
    CONDITION_MODIFIERS,
  };
}
