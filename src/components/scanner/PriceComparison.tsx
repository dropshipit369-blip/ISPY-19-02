import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, TrendingUp, TrendingDown, Minus, DollarSign, Clock, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RepricingResult } from '@/hooks/useRepricingEngine';
import { formatAud } from '@/lib/utils';

interface PriceComparisonProps {
  result: RepricingResult;
  showComparison?: boolean;
}

export function PriceComparison({ result, showComparison = true }: PriceComparisonProps) {
  const hasChange = result.percentageChange !== 0;
  const isIncrease = result.percentageChange > 0;

  const timeToSellColors = {
    fast: 'text-success bg-success/10',
    medium: 'text-warning bg-warning/10',
    slow: 'text-destructive bg-destructive/10',
  };

  const riskColors = {
    low: 'text-success',
    medium: 'text-warning',
    high: 'text-destructive',
  };

  const timeToSellLabels = {
    fast: '< 7 days',
    medium: '7-21 days',
    slow: '21+ days',
  };

  return (
    <div className="space-y-4">
      {/* Before vs After Comparison */}
      {showComparison && hasChange && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-muted/30 rounded-xl p-3 border border-border/50"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Price Adjustment</span>
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                isIncrease
                  ? "bg-success/10 text-success border-success/30"
                  : "bg-warning/10 text-warning border-warning/30"
              )}
            >
              {isIncrease ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
              {isIncrease ? '+' : ''}{result.percentageChange}%
            </Badge>
          </div>

          <div className="flex items-center justify-center gap-3">
            {/* Before */}
            <div className="text-center opacity-50">
              <p className="text-[10px] text-muted-foreground uppercase">Before</p>
              <p className="text-sm line-through">{formatAud(result.originalPrices.median)}</p>
            </div>

            <ArrowRight className="w-4 h-4 text-muted-foreground" />

            {/* After */}
            <div className="text-center">
              <p className="text-[10px] text-muted-foreground uppercase">After</p>
              <p className={cn("text-lg font-bold", isIncrease ? "text-success" : "text-warning")}>
                {formatAud(result.adjustedPrices.median)}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Pricing Display */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`prices-${result.adjustedPrices.median}`}
          initial={{ opacity: 0.5, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.15 }}
          className="bg-muted/50 rounded-xl p-4"
        >
          {/* Buy Under & Profit */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <DollarSign className="w-3 h-3 text-primary" />
                <p className="text-xs text-muted-foreground">Buy Under</p>
              </div>
              <p className="text-2xl font-bold text-primary">
                {formatAud(result.buyUnder)}
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-1">
                <TrendingUp className="w-3 h-3 text-success" />
                <p className="text-xs text-muted-foreground">Est. Profit</p>
              </div>
              <p className={cn(
                "text-2xl font-bold",
                result.estimatedProfit.low > 10 ? "text-success" :
                result.estimatedProfit.low > 0 ? "text-warning" : "text-destructive"
              )}>
                {formatAud(result.estimatedProfit.low, { decimals: 0, showPlus: true })}–{formatAud(result.estimatedProfit.high, { decimals: 0 })}
              </p>
            </div>
          </div>

          {/* Price Range */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="bg-background/50 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">Low</p>
              <p className="font-semibold">{formatAud(result.adjustedPrices.low)}</p>
            </div>
            <div className="bg-background/50 rounded-lg p-2 text-center border border-primary/20">
              <p className="text-xs text-muted-foreground">Median</p>
              <p className="font-semibold text-primary">{formatAud(result.adjustedPrices.median)}</p>
            </div>
            <div className="bg-background/50 rounded-lg p-2 text-center">
              <p className="text-xs text-muted-foreground">High</p>
              <p className="font-semibold">{formatAud(result.adjustedPrices.high)}</p>
            </div>
          </div>

          {/* Meta Info */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Badge variant="secondary" className={cn("text-xs", timeToSellColors[result.timeToSell])}>
              <Clock className="w-3 h-3 mr-1" />
              {timeToSellLabels[result.timeToSell]}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Fees: {formatAud(result.platformFees)}
            </Badge>
            <Badge variant="secondary" className={cn("text-xs", riskColors[result.riskLevel])}>
              {result.riskLevel === 'high' && <AlertTriangle className="w-3 h-3 mr-1" />}
              {result.riskLevel.charAt(0).toUpperCase() + result.riskLevel.slice(1)} Risk
            </Badge>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
