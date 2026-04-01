import { motion } from 'framer-motion';
import { Shield, Activity, TrendingUp, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatAud } from '@/lib/utils';

interface ConfidenceProfileProps {
  authenticityLikelihood: number;
  conditionConfidence: number;
  marketVolatilityScore: number;
  recommendedPricingBand: {
    floor: number;
    ceiling: number;
    optimal: number;
  };
}

export function ConfidenceProfile({
  authenticityLikelihood,
  conditionConfidence,
  marketVolatilityScore,
  recommendedPricingBand,
}: ConfidenceProfileProps) {
  const getScoreColor = (score: number, invert = false) => {
    const effectiveScore = invert ? 100 - score : score;
    if (effectiveScore >= 70) return 'text-success';
    if (effectiveScore >= 40) return 'text-warning';
    return 'text-destructive';
  };

  const getScoreBg = (score: number, invert = false) => {
    const effectiveScore = invert ? 100 - score : score;
    if (effectiveScore >= 70) return 'bg-success/20';
    if (effectiveScore >= 40) return 'bg-warning/20';
    return 'bg-destructive/20';
  };

  const getVolatilityLabel = (score: number) => {
    if (score <= 30) return 'Stable';
    if (score <= 60) return 'Moderate';
    return 'Volatile';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      <h4 className="text-sm font-medium flex items-center gap-2 text-foreground">
        <Shield className="w-4 h-4 text-primary" />
        Item Confidence Profile
      </h4>

      <div className="grid grid-cols-3 gap-2">
        {/* Authenticity */}
        <div className={cn("rounded-lg p-3 text-center", getScoreBg(authenticityLikelihood))}>
          <div className="flex items-center justify-center gap-1 mb-1">
            {authenticityLikelihood >= 70 ? (
              <CheckCircle className={cn("w-3 h-3", getScoreColor(authenticityLikelihood))} />
            ) : (
              <AlertTriangle className={cn("w-3 h-3", getScoreColor(authenticityLikelihood))} />
            )}
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Auth</span>
          </div>
          <p className={cn("text-lg font-bold", getScoreColor(authenticityLikelihood))}>
            {authenticityLikelihood}%
          </p>
        </div>

        {/* Condition Confidence */}
        <div className={cn("rounded-lg p-3 text-center", getScoreBg(conditionConfidence))}>
          <div className="flex items-center justify-center gap-1 mb-1">
            <Info className={cn("w-3 h-3", getScoreColor(conditionConfidence))} />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Cond</span>
          </div>
          <p className={cn("text-lg font-bold", getScoreColor(conditionConfidence))}>
            {conditionConfidence}%
          </p>
        </div>

        {/* Market Volatility */}
        <div className={cn("rounded-lg p-3 text-center", getScoreBg(marketVolatilityScore, true))}>
          <div className="flex items-center justify-center gap-1 mb-1">
            <Activity className={cn("w-3 h-3", getScoreColor(marketVolatilityScore, true))} />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Mkt</span>
          </div>
          <p className={cn("text-xs font-semibold", getScoreColor(marketVolatilityScore, true))}>
            {getVolatilityLabel(marketVolatilityScore)}
          </p>
        </div>
      </div>

      {/* Recommended Pricing Band */}
      <div className="bg-muted/40 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">Recommended Pricing</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Floor</p>
            <p className="text-sm font-semibold">{formatAud(recommendedPricingBand.floor)}</p>
          </div>
          <div className="flex-1 mx-3 h-1 rounded-full bg-gradient-to-r from-destructive/30 via-success to-warning/30 relative">
            <div 
              className="absolute w-2 h-2 rounded-full bg-primary border-2 border-background top-1/2 -translate-y-1/2 shadow-lg"
              style={{ 
                left: `${Math.min(100, Math.max(0, ((recommendedPricingBand.optimal - recommendedPricingBand.floor) / (recommendedPricingBand.ceiling - recommendedPricingBand.floor)) * 100))}%` 
              }}
            />
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground uppercase">Ceiling</p>
            <p className="text-sm font-semibold">{formatAud(recommendedPricingBand.ceiling)}</p>
          </div>
        </div>
        <p className="text-center mt-2 text-xs text-muted-foreground">
          Optimal: <span className="font-semibold text-primary">{formatAud(recommendedPricingBand.optimal)}</span>
        </p>
      </div>
    </motion.div>
  );
}
