import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Package,
  Tag,
  Globe,
  Loader2,
  Save,
  Sparkles,
  Zap,
  Star,
  Copy,
  Check as CheckIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRepricingEngine, StandardCondition } from '@/hooks/useRepricingEngine';
import { ConditionSelector } from './ConditionSelector';
import { PriceComparison } from './PriceComparison';
import { ConfidenceProfile } from './ConfidenceProfile';
import { InningsGallery, InningItem } from './InningsGallery';
import { formatAud } from '@/lib/utils';

/* ───────────────── TYPES ───────────────── */

interface PricingSource {
  marketplace: string;
  title: string;
  price: number;
  condition: string;
  soldDate: string;
  url?: string;
}

interface TrackedItem {
  key: string;
  localId: string;
  name: string;
  brand?: string;
  model?: string;
  manufacturer?: string;
  category?: string;
  condition?: string;
  rarity?: 'common' | 'uncommon' | 'rare' | 'very-rare';
  yearMade?: string;
  originStory?: string;
  salesStrategy?: string;
  bestMarketplace?: string | null;
  optimalSearchTerms?: string[];
  price: number;
  lowPrice: number;
  highPrice: number;
  confidence: number;
  trend?: 'up' | 'down' | 'stable';
  pricingSources?: PricingSource[];
  isPriced: boolean;
  isLocked: boolean;
  suggestedBuyUnder?: number;
  estimatedProfit?: { low: number; high: number };
  timeToSell?: 'fast' | 'medium' | 'slow';
}

interface ItemDetailModalProps {
  item: TrackedItem | null;
  onClose: () => void;
  onSave?: (item: TrackedItem, condition: StandardCondition) => void;
}

/* ───────────────── DEEP SCAN ANALYSIS ───────────────── */

interface DeepScanAnalysis {
  authenticityScore: number;
  anomalies: string[];
  historicalPatterns: string;
  metadataExtracted: string[];
}

function useDeepScanAnalysis(item: TrackedItem | null): DeepScanAnalysis & { isAnalyzing: boolean } {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<DeepScanAnalysis>({
    authenticityScore: 85,
    anomalies: [],
    historicalPatterns: 'stable',
    metadataExtracted: [],
  });

  useEffect(() => {
    if (!item) return;

    // Simulate deep scan analysis
    setIsAnalyzing(true);
    const timer = setTimeout(() => {
      // Generate analysis based on item properties
      const authenticityScore = item.confidence >= 80 ? 95 :
        item.confidence >= 60 ? 85 :
        item.confidence >= 40 ? 70 : 55;

      const anomalies: string[] = [];
      if (item.confidence < 50) anomalies.push('Low identification confidence');
      if (item.trend === 'down') anomalies.push('Declining market demand');
      if (!item.brand) anomalies.push('Brand not identified');

      const patterns = item.trend === 'up' ? 'rising demand' :
        item.trend === 'down' ? 'declining prices' : 'stable market';

      const metadata: string[] = [];
      if (item.brand) metadata.push(`Brand: ${item.brand}`);
      if (item.model) metadata.push(`Model: ${item.model}`);
      if (item.category) metadata.push(`Category: ${item.category}`);

      setAnalysis({
        authenticityScore,
        anomalies,
        historicalPatterns: patterns,
        metadataExtracted: metadata,
      });
      setIsAnalyzing(false);
    }, 800);

    return () => clearTimeout(timer);
  }, [item?.key]);

  return { ...analysis, isAnalyzing };
}

/* ───────────────── MAIN COMPONENT ───────────────── */

export function ItemDetailModal({ item, onClose, onSave }: ItemDetailModalProps) {
  const [showSources, setShowSources] = useState(false);
  const deepScan = useDeepScanAnalysis(item);

  // Parse initial condition from item
  const parseInitialCondition = useCallback((condition?: string): StandardCondition => {
    if (!condition) return 'good';
    const lower = condition.toLowerCase();
    if (lower.includes('new') && !lower.includes('like')) return 'new';
    if (lower.includes('like new') || lower.includes('mint')) return 'like-new';
    if (lower.includes('very good') || lower.includes('excellent')) return 'very-good';
    if (lower.includes('acceptable') || lower.includes('fair')) return 'acceptable';
    if (lower.includes('poor') || lower.includes('worn')) return 'poor';
    return 'good';
  }, []);

  const {
    condition,
    setCondition,
    repricingResult,
  } = useRepricingEngine({
    baseLowPrice: item?.lowPrice || 0,
    baseMedianPrice: item?.price || 0,
    baseHighPrice: item?.highPrice || 0,
    baseConfidence: item?.confidence || 75,
    authenticityScore: deepScan.authenticityScore,
    volatilityScore: item?.trend === 'down' ? 60 : item?.trend === 'up' ? 40 : 30,
  });

  // Reset condition when item changes
  useEffect(() => {
    if (item) {
      setCondition(parseInitialCondition(item.condition));
    }
  }, [item?.key, setCondition, parseInitialCondition]);

  if (!item) return null;

  return (
    <Dialog open={!!item} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <DialogHeader className="p-4 pb-2 sticky top-0 bg-background/95 backdrop-blur-sm z-10 border-b border-border/50">
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            <span className="truncate">{item.name}</span>
          </DialogTitle>
          
          {/* Item Meta */}
          {(item.brand || item.model || item.category || item.yearMade) && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {item.brand && (
                <Badge variant="outline" className="text-xs">
                  <Tag className="w-2.5 h-2.5 mr-1" />
                  {item.brand}
                </Badge>
              )}
              {item.model && <Badge variant="outline" className="text-xs">{item.model}</Badge>}
              {item.yearMade && <Badge variant="outline" className="text-xs">{item.yearMade}</Badge>}
              {item.category && <Badge variant="secondary" className="text-xs capitalize">{item.category}</Badge>}
            </div>
          )}
        </DialogHeader>

        <div className="p-4 space-y-5">
          {/* ── Rich Item Intelligence Panel ── */}
          {(item.rarity || item.manufacturer || item.yearMade || item.originStory || item.salesStrategy || (item.optimalSearchTerms?.length)) && (
            <div className="rounded-xl border border-border/60 bg-muted/20 overflow-hidden divide-y divide-border/40">
              {/* Rarity + Year row */}
              {(item.rarity || item.yearMade || item.manufacturer) && (
                <div className="flex items-start gap-3 px-3 py-2.5 flex-wrap">
                  {item.rarity && item.rarity !== 'common' && (
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide ${
                      item.rarity === 'very-rare' ? 'bg-purple-600/20 text-purple-400 border border-purple-500/40' :
                      item.rarity === 'rare' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                      'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                    }`}>
                      <Star className="w-2.5 h-2.5" />
                      {item.rarity === 'very-rare' ? 'Very Rare' : item.rarity === 'rare' ? 'Rare' : 'Uncommon'}
                    </span>
                  )}
                  {item.yearMade && (
                    <span className="text-xs text-muted-foreground">{item.yearMade}</span>
                  )}
                  {item.manufacturer && item.manufacturer !== item.brand && (
                    <span className="text-xs text-muted-foreground truncate">by {item.manufacturer}</span>
                  )}
                </div>
              )}

              {/* Origin Story */}
              {item.originStory && (
                <div className="flex gap-2 px-3 py-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary/70 mt-0.5 shrink-0" />
                  <p className="text-xs text-foreground/80 leading-relaxed">{item.originStory}</p>
                </div>
              )}

              {/* Sales Strategy */}
              {item.salesStrategy && (
                <div className="flex gap-2 px-3 py-2.5 bg-emerald-500/5">
                  <Zap className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed font-medium">{item.salesStrategy}</p>
                </div>
              )}

              {/* Best Marketplace + Optimal Search Terms */}
              {(item.bestMarketplace || item.optimalSearchTerms?.length) && (
                <div className="px-3 py-2.5 space-y-1.5">
                  {item.bestMarketplace && (
                    <div className="flex items-center gap-1.5">
                      <Globe className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground">Best on</span>
                      <span className="text-[11px] font-semibold text-primary">{item.bestMarketplace}</span>
                    </div>
                  )}
                  {item.optimalSearchTerms && item.optimalSearchTerms.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.optimalSearchTerms.map((term, i) => (
                        <button
                          key={i}
                          onClick={() => navigator.clipboard.writeText(term)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background border border-border/60 text-[10px] text-foreground/70 hover:text-foreground hover:border-primary/50 transition-colors"
                          title="Copy search term"
                        >
                          {term}
                          <Copy className="w-2.5 h-2.5 opacity-50" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Deep Scan Status */}
          <AnimatePresence mode="wait">
            {deepScan.isAnalyzing ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20"
              >
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-sm text-primary font-medium">Performing deep-scan analysis...</span>
              </motion.div>
            ) : deepScan.anomalies.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-warning/10 rounded-lg border border-warning/30"
              >
                <p className="text-xs font-medium text-warning mb-1">Anomalies Detected</p>
                <ul className="text-xs text-warning/80 space-y-0.5">
                  {deepScan.anomalies.map((a, i) => (
                    <li key={i}>• {a}</li>
                  ))}
                </ul>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Confidence Profile */}
          <ConfidenceProfile
            authenticityLikelihood={repricingResult.confidenceProfile.authenticityLikelihood}
            conditionConfidence={repricingResult.confidenceProfile.conditionConfidence}
            marketVolatilityScore={repricingResult.confidenceProfile.marketVolatilityScore}
            recommendedPricingBand={repricingResult.confidenceProfile.recommendedPricingBand}
          />

          {/* Condition Selector */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
            <ConditionSelector
              condition={condition}
              onConditionChange={setCondition}
            />
          </div>

          {/* Price Comparison & Results */}
          <PriceComparison result={repricingResult} showComparison />

          {/* SES §4: Innings Evidence-Based Pricing Gallery */}
          {item.isPriced && (
            (() => {
              // Map PricingSource[] → InningItem[] (Completed/Sold listings only)
              const innings: InningItem[] = (item.pricingSources ?? []).map((src) => ({
                title: src.title,
                final_price: src.price,
                sale_date: src.soldDate,
                thumbnail_url: undefined,
                url: src.url,
                marketplace: src.marketplace,
                condition: src.condition,
              }));

              const prices = innings.map((i) => i.final_price).sort((a, b) => a - b);
              const mid = Math.floor(prices.length / 2);
              const target = prices.length === 0
                ? item.price
                : prices.length % 2 !== 0
                  ? prices[mid]
                  : (prices[mid - 1] + prices[mid]) / 2;

              return (
                <InningsGallery
                  priceSpread={{
                    floor: prices.length > 0 ? prices[0] : item.lowPrice,
                    target,
                    ceiling: prices.length > 0 ? prices[prices.length - 1] : item.highPrice,
                    isLive: innings.length > 0,
                  }}
                  innings={innings}
                  itemTitle={item.name}
                />
              );
            })()
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => {
                if (onSave) {
                  onSave(item, condition);
                }
                onClose();
              }}
              className="flex-1"
            >
              <Save className="w-4 h-4 mr-2" />
              Save with Adjustments
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
