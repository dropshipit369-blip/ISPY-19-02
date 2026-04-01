import { motion } from 'framer-motion';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Loader2,
  Clock,
  AlertTriangle,
  Check
} from 'lucide-react';
import { formatAud } from '@/lib/utils';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ProfitOverlayItem {
  key: string;
  name: string;
  price: number;
  lowPrice: number;
  highPrice: number;
  confidence: number;
  trend?: 'up' | 'down' | 'stable';
  rarity?: 'common' | 'uncommon' | 'rare' | 'very-rare';
  bestMarketplace?: string | null;
  smoothedBox: Box;
  isPriced: boolean;
  isLocked: boolean;
  suggestedBuyUnder?: number;
  estimatedProfit?: {
    low: number;
    high: number;
  };
  timeToSell?: 'fast' | 'medium' | 'slow';
}

interface ProfitOverlayProps {
  items: ProfitOverlayItem[];
  onSelect: (item: ProfitOverlayItem) => void;
}

// Calculate profit signal: green (>30%), yellow (10-30%), red (<10%)
function getProfitSignal(profit: number, price: number): 'green' | 'yellow' | 'red' {
  const margin = price > 0 ? (profit / price) * 100 : 0;
  if (margin >= 30) return 'green';
  if (margin >= 10) return 'yellow';
  return 'red';
}

function getSignalColors(signal: 'green' | 'yellow' | 'red') {
  switch (signal) {
    case 'green':
      return {
        bg: 'from-emerald-500/90 to-emerald-600/90',
        border: 'border-emerald-400',
        text: 'text-emerald-400',
        glow: 'shadow-emerald-500/30'
      };
    case 'yellow':
      return {
        bg: 'from-amber-500/90 to-amber-600/90',
        border: 'border-amber-400',
        text: 'text-amber-400',
        glow: 'shadow-amber-500/30'
      };
    case 'red':
      return {
        bg: 'from-red-500/90 to-red-600/90',
        border: 'border-red-400',
        text: 'text-red-400',
        glow: 'shadow-red-500/30'
      };
  }
}

function getTimeToSellIcon(speed?: 'fast' | 'medium' | 'slow') {
  switch (speed) {
    case 'fast':
      return <Clock className="w-3 h-3 text-emerald-400" />;
    case 'slow':
      return <Clock className="w-3 h-3 text-red-400" />;
    default:
      return <Clock className="w-3 h-3 text-amber-400" />;
  }
}

function getRarityBadge(rarity?: 'common' | 'uncommon' | 'rare' | 'very-rare') {
  if (!rarity || rarity === 'common') return null;
  const styles = {
    'uncommon': 'bg-blue-500/80 text-white',
    'rare': 'bg-amber-500/80 text-white',
    'very-rare': 'bg-purple-600/90 text-white',
  }[rarity];
  const label = { 'uncommon': 'Uncommon', 'rare': 'Rare', 'very-rare': 'RARE' }[rarity];
  return (
    <span className={`absolute -top-5 right-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wide ${styles}`}>
      {label}
    </span>
  );
}

export function ProfitOverlay({ items, onSelect }: ProfitOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {items.map((item) => {
        // Calculate profit metrics
        const platformFees = item.price * 0.13; // ~13% average fees
        const suggestedBuy = item.suggestedBuyUnder || Math.round(item.lowPrice * 0.6);
        const netProfitLow = item.lowPrice - suggestedBuy - platformFees;
        const netProfitHigh = item.highPrice - suggestedBuy - platformFees;
        
        const profitSignal = getProfitSignal(netProfitLow, suggestedBuy);
        const colors = getSignalColors(profitSignal);
        
        return (
          <motion.div
            key={item.key}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => item.isPriced && onSelect(item)}
            className={`absolute pointer-events-auto cursor-pointer transition-all duration-100 ${
              item.isLocked ? 'opacity-100' : 'opacity-80'
            }`}
            style={{
              left: `${item.smoothedBox.x * 100}%`,
              top: `${item.smoothedBox.y * 100}%`,
              width: `${item.smoothedBox.w * 100}%`,
              height: `${item.smoothedBox.h * 100}%`,
            }}
          >
            {/* Bounding Box with corner brackets */}
            <div className={`absolute inset-0 border-2 rounded-lg ${colors.border}`}>
              {/* Corner brackets - larger for mobile */}
              <div className={`absolute -top-0.5 -left-0.5 w-4 h-4 border-t-2 border-l-2 ${colors.border} rounded-tl`} />
              <div className={`absolute -top-0.5 -right-0.5 w-4 h-4 border-t-2 border-r-2 ${colors.border} rounded-tr`} />
              <div className={`absolute -bottom-0.5 -left-0.5 w-4 h-4 border-b-2 border-l-2 ${colors.border} rounded-bl`} />
              <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 border-b-2 border-r-2 ${colors.border} rounded-br`} />
              
              {/* Glow effect for locked items */}
              {item.isLocked && (
                <div className={`absolute inset-0 rounded-lg shadow-lg ${colors.glow}`} />
              )}
            </div>

            {/* Main Price Card - Floating above item */}
            <div 
              className={`absolute -top-16 left-1/2 -translate-x-1/2 min-w-[120px] px-3 py-2 rounded-xl backdrop-blur-md bg-gradient-to-r ${colors.bg} border border-white/20 shadow-xl`}
            >
              {item.isPriced ? (
                <div className="text-white">
                  {/* Top row: Price + Trend */}
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-lg font-bold">{formatAud(item.price, { decimals: 0 })}</span>
                    {item.trend === 'up' && <TrendingUp className="w-4 h-4 text-white/80" />}
                    {item.trend === 'down' && <TrendingDown className="w-4 h-4 text-white/80" />}
                  </div>
                  
                  {/* Bottom row: Buy-under hint */}
                  <div className="text-[10px] text-white/80 text-center mt-0.5 flex items-center justify-center gap-1">
                    <span>Buy under {formatAud(suggestedBuy, { decimals: 0 })}</span>
                    {getTimeToSellIcon(item.timeToSell)}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-white py-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Pricing...</span>
                </div>
              )}
            </div>

            {/* Profit Indicator Badge */}
            {item.isPriced && netProfitLow > 0 && (
              <div className="absolute -top-20 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-[10px] font-medium flex items-center gap-1">
                <Check className="w-3 h-3" />
                {formatAud(netProfitLow, { decimals: 0, showPlus: true })}–{formatAud(netProfitHigh, { decimals: 0 })}
              </div>
            )}

            {/* Rarity Badge */}
            {getRarityBadge(item.rarity)}

            {/* Item Name - Below box */}
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-3 py-1 rounded-lg bg-background/90 backdrop-blur-sm text-xs text-foreground font-medium truncate max-w-[160px] text-center shadow-md">
              {item.name}
            </div>

            {/* Best Marketplace - Below name */}
            {item.isPriced && item.bestMarketplace && (
              <div className="absolute -bottom-[52px] left-1/2 -translate-x-1/2 text-[9px] text-primary/80 font-semibold tracking-wide uppercase">
                {item.bestMarketplace}
              </div>
            )}

            {/* Confidence indicator */}
            {item.isLocked && (
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground flex items-center gap-1">
                {item.confidence >= 80 ? (
                  <span className="text-emerald-400">High confidence</span>
                ) : item.confidence >= 60 ? (
                  <span className="text-amber-400">Estimate</span>
                ) : (
                  <span className="text-slate-400">Category guess</span>
                )}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
