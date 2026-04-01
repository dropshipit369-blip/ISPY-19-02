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
  baseLowPrice: number;
  baseMedianPrice: number;
  baseHighPrice: number;
  baseConfidence?: number;
  authenticityScore?: number;
  volatilityScore?: number;
  platformFeeRate?: number;
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
  const [condition, setCondition] = useState<StandardCondition>('good');

  const calculateRepricing = useCallback((selectedCondition: StandardCondition): RepricingResult => {
    const modifier = CONDITION_MODIFIERS[selectedCondition];
    
    // Adjust prices based on condition
    const adjustedLow = Math.round(baseLowPrice * modifier.multiplier);
    const adjustedMedian = Math.round(baseMedianPrice * modifier.multiplier);
    const adjustedHigh = Math.round(baseHighPrice * modifier.multiplier);
    
    // Calculate percentage change from base
    const percentageChange = Math.round((modifier.multiplier - 1) * 100);
    
    // Calculate buy-under price (60% of low to ensure profit margin)
    const buyUnder = Math.round(adjustedLow * 0.6);
    
    // Calculate platform fees on median
    const platformFees = Math.round(adjustedMedian * platformFeeRate);
    
    // Calculate profit range
    const profitLow = adjustedLow - buyUnder - platformFees;
    const profitHigh = adjustedHigh - buyUnder - platformFees;
    
    // Determine risk level based on condition and confidence
    const combinedRisk = (modifier.riskFactor * 0.5) + ((100 - baseConfidence) / 100 * 0.5);
    const riskLevel: 'low' | 'medium' | 'high' = 
      combinedRisk < 0.3 ? 'low' : 
      combinedRisk < 0.6 ? 'medium' : 'high';
    
    // Build confidence profile
    const conditionConfidence = Math.round(baseConfidence * (1 - modifier.riskFactor * 0.3));
    const confidenceProfile: ConfidenceProfile = {
      authenticityLikelihood: authenticityScore,
      conditionConfidence,
      marketVolatilityScore: volatilityScore,
      recommendedPricingBand: {
        floor: adjustedLow,
        ceiling: adjustedHigh,
        optimal: adjustedMedian,
      },
    };
    
    return {
      originalPrices: {
        low: baseLowPrice,
        median: baseMedianPrice,
        high: baseHighPrice,
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
  }, [baseLowPrice, baseMedianPrice, baseHighPrice, baseConfidence, authenticityScore, volatilityScore, platformFeeRate]);

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
