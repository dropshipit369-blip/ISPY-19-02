import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import {
  ShoppingBag, 
  DollarSign, 
  AlertTriangle, 
  Download, 
  Bookmark,
  Share2,
  X,
  Check,
  TrendingUp,
  Package,
  Layers,
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  Wand2,
  Clock,
  Target,
  LayoutDashboard,
  Camera,
  FileText,
  Sparkles,
  FileSpreadsheet
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useLotManager, Lot, LotItem, saveSession } from '@/hooks/useLotManager';
import { cn, formatAud, formatAudRange } from '@/lib/utils';
import { downloadCsvFile } from '@/lib/download';

/* ───────────────── TYPES ───────────────── */

interface SummaryItem {
  key: string;
  name: string;
  price: number;
  lowPrice: number;
  highPrice: number;
  confidence: number;
  category?: string;
  condition?: string;
  suggestedBuy: number;
  netProfitLow: number;
  netProfitHigh: number;
  isRisky: boolean;
}

interface WalkAwaySummaryProps {
  items: SummaryItem[];
  userId: string;
  onClose: () => void;
  onSaveFinds: () => void;
  onShare: () => void;
  savingFinds?: boolean;
  marketplaceScrapeEnabled?: boolean;
}

/* ───────────────── SUB-COMPONENTS ───────────────── */

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue,
  variant = 'default' 
}: { 
  icon: any;
  label: string;
  value: string | number;
  subValue?: string;
  variant?: 'default' | 'success' | 'warning' | 'primary';
}) {
  const variantStyles = {
    default: 'bg-muted/50 border-border/50',
    success: 'bg-emerald-500/10 border-emerald-500/30',
    warning: 'bg-amber-500/10 border-amber-500/30',
    primary: 'bg-primary/10 border-primary/30',
  };
  
  const iconStyles = {
    default: 'text-muted-foreground',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    primary: 'text-primary',
  };

  return (
    <div className={cn('rounded-xl p-3 border', variantStyles[variant])}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('w-4 h-4', iconStyles[variant])} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
      {subValue && <p className="text-xs text-muted-foreground">{subValue}</p>}
    </div>
  );
}

function LotCard({ 
  lot, 
  items,
  isExpanded,
  onToggle,
  onDelete,
  onRemoveItem,
}: {
  lot: Lot;
  items: SummaryItem[];
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onRemoveItem: (key: string) => void;
}) {
  const lotItems = items.filter(item => lot.items.includes(item.key));

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-card border border-border/50 rounded-xl overflow-hidden"
    >
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Layers className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-sm">{lot.name}</p>
            <p className="text-xs text-muted-foreground">
              {lot.items.length} items • {formatAud(lot.recommendedLotPrice)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn(
            'text-xs',
            lot.combinedRiskScore < 30 ? 'text-emerald-400 border-emerald-500/30' :
            lot.combinedRiskScore < 60 ? 'text-amber-400 border-amber-500/30' :
            'text-red-400 border-red-500/30'
          )}>
            {lot.combinedRiskScore}% risk
          </Badge>
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              {/* Lot Stats */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-2 rounded-lg bg-muted/30">
                  <p className="text-muted-foreground">Value</p>
                  <p className="font-semibold">{formatAud(lot.combinedValue)}</p>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <p className="text-muted-foreground">Profit</p>
                  <p className="font-semibold text-emerald-400">
                    {formatAud(lot.projectedProfit.low, { showPlus: true })}–{formatAud(lot.projectedProfit.high)}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-muted/30">
                  <p className="text-muted-foreground">Sell Time</p>
                  <p className="font-semibold capitalize">{lot.expectedTimeToSell}</p>
                </div>
              </div>

              {/* Items in Lot */}
              <div className="space-y-1.5">
                {lotItems.map(item => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/20 group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatAud(item.price)} • {Math.round((item.price / lot.combinedValue) * 100)}% of lot
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveItem(item.key);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Delete Lot */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 className="w-3 h-3 mr-2" />
                Delete Lot
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ItemSelectable({
  item,
  isSelected,
  onToggle,
  lotName,
}: {
  item: SummaryItem;
  isSelected: boolean;
  onToggle: () => void;
  lotName?: string;
}) {
  return (
    <motion.div
      layout
      whileTap={{ scale: 0.98 }}
      onClick={onToggle}
      className={cn(
        'flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all',
        isSelected 
          ? 'bg-primary/10 border-primary/50' 
          : 'bg-card border-border/50 hover:border-border',
        lotName && 'opacity-50'
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors',
          isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
        )}>
          {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
        </div>
        <div>
          <p className="font-medium text-sm">{item.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatAud(item.suggestedBuy)} → {formatAud(item.price)}
            {lotName && <span className="ml-2 text-primary">• In {lotName}</span>}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className={cn(
          'text-sm font-semibold',
          item.netProfitLow > 0 ? 'text-emerald-400' : 'text-red-400'
        )}>
          {formatAud(item.netProfitLow, { showPlus: true })}
        </p>
        <Badge variant="secondary" className="text-[10px]">
          {item.confidence}%
        </Badge>
      </div>
    </motion.div>
  );
}

/* ───────────────── MAIN COMPONENT ───────────────── */

export function WalkAwaySummary({ 
  items, 
  userId,
  onClose, 
  onSaveFinds, 
  onShare,
  savingFinds = false,
  marketplaceScrapeEnabled = false,
}: WalkAwaySummaryProps) {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'summary' | 'lots'>('summary');
  const [expandedLot, setExpandedLot] = useState<string | null>(null);
  const [showNarrative, setShowNarrative] = useState(false);

  // Lot manager
  const lotManager = useLotManager({ items: items as LotItem[], userId });

  // Auto-save session on item/lot changes
  useEffect(() => {
    saveSession(userId, {
      items: items as LotItem[],
      lots: lotManager.lots,
      lastUpdated: new Date().toISOString(),
    });
  }, [items, lotManager.lots, userId]);

  // Summary calculations
  const summary = useMemo(() => {
    const worthGrabbing = items.filter(i => i.netProfitLow > 10 && i.confidence >= 60);
    const riskyItems = items.filter(i => i.isRisky || i.confidence < 50);
    
    const totalResaleValue = items.reduce((sum, i) => sum + i.price, 0);
    const totalCostBasis = items.reduce((sum, i) => sum + i.suggestedBuy, 0);
    const totalProfitLow = worthGrabbing.reduce((sum, i) => sum + i.netProfitLow, 0);
    const totalProfitHigh = worthGrabbing.reduce((sum, i) => sum + i.netProfitHigh, 0);
    
    // Risk/volatility score (0-100)
    const avgConfidence = items.length > 0 
      ? items.reduce((sum, i) => sum + i.confidence, 0) / items.length 
      : 0;
    const riskScore = Math.round(100 - avgConfidence);

    // Recommended actions
    const actions: string[] = [];
    if (worthGrabbing.length > 0) {
      actions.push(`Buy ${worthGrabbing.length} high-confidence items`);
    }
    if (riskyItems.length > 0 && riskyItems.length <= 2) {
      actions.push('Research risky items before purchasing');
    }
    if (riskyItems.length > 2) {
      actions.push('Skip risky items unless familiar with brand');
    }
    if (items.length >= 5) {
      actions.push('Consider creating lots to maximize profit');
    }
    if (totalProfitLow >= 100) {
      actions.push('List on eBay with auction for fastest sale');
    }

    return {
      totalItems: items.length,
      worthGrabbing,
      riskyItems,
      totalResaleValue,
      totalCostBasis,
      projectedProfit: { low: totalProfitLow, high: totalProfitHigh },
      riskScore,
      roi: totalCostBasis > 0 ? Math.round((totalProfitLow / totalCostBasis) * 100) : 0,
      recommendedActions: actions,
    };
  }, [items]);

  // Pricing narrative
  const narrative = useMemo(() => {
    const { totalItems, worthGrabbing, riskScore, projectedProfit } = summary;
    const { analytics } = lotManager;

    let text = `Scanned ${totalItems} item${totalItems !== 1 ? 's' : ''}. `;
    
    if (worthGrabbing.length > 0) {
      text += `${worthGrabbing.length} item${worthGrabbing.length !== 1 ? 's' : ''} show strong profit potential. `;
    }
    
    text += marketplaceScrapeEnabled
      ? `Pricing used live marketplace scrape data when it was available, then merged that with visual identification. `
      : `Pricing used on-device detection plus the current scan response from iSpy's pricing pipeline. `;
    text += `Each item's value was adjusted for condition, brand recognition, and current market demand. `;
    
    if (riskScore >= 50) {
      text += `Some items have lower confidence scores due to limited sales data or market volatility. `;
    }
    
    if (analytics.totalLots > 0) {
      text += `You've created ${analytics.totalLots} lot${analytics.totalLots !== 1 ? 's' : ''} worth ${formatAud(analytics.totalLotValue)}. `;
      text += `Lots typically sell 10-20% faster than individual items. `;
    }

    if (projectedProfit.low > 0) {
      text += `Expected profit margin accounts for 13% platform fees and shipping estimates.`;
    }

    return text;
  }, [lotManager.analytics, marketplaceScrapeEnabled, summary]);

  // Export enhanced CSV with lots
  const handleExportEnhancedCSV = useCallback(async () => {
    const rows = [
      ['Type', 'Name', 'Items', 'Value', 'Cost', 'Profit Low', 'Profit High', 'Risk', 'Confidence'],
    ];

    // Individual items
    items.forEach(item => {
      rows.push([
        'Item',
        item.name,
        '1',
        item.price.toString(),
        item.suggestedBuy.toString(),
        Math.round(item.netProfitLow).toString(),
        Math.round(item.netProfitHigh).toString(),
        item.isRisky ? 'High' : 'Low',
        item.confidence.toString(),
      ]);
    });

    // Lots
    lotManager.lots.forEach(lot => {
      rows.push([
        'Lot',
        lot.name,
        lot.items.length.toString(),
        lot.combinedValue.toString(),
        lot.totalCostBasis.toString(),
        lot.projectedProfit.low.toString(),
        lot.projectedProfit.high.toString(),
        lot.combinedRiskScore > 50 ? 'High' : 'Low',
        Math.round(100 - lot.combinedRiskScore).toString(),
      ]);
    });

    await downloadCsvFile(`resale-intel-${new Date().toISOString().split('T')[0]}.csv`, rows);
  }, [items, lotManager.lots]);

  const topNavLinks = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/scan', label: 'Scan', icon: Camera },
    { path: '/inventory', label: 'Inventory', icon: Package },
    { path: '/listings', label: 'Listings', icon: FileSpreadsheet },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Header */}
      <div className="border-b border-border/50 bg-background/90 backdrop-blur-sm">
        <div className="flex items-center justify-between p-4 pb-3">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            <span className="font-semibold text-lg">Walk-Away Summary</span>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>
        <nav className="px-4 pb-3 flex items-center gap-2 overflow-x-auto">
          {topNavLinks.map((link) => {
            const active = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border/50 bg-background/60 text-muted-foreground hover:text-foreground hover:bg-muted/60'
                )}
              >
                <link.icon className="w-3.5 h-3.5" />
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/50">
        <button
          onClick={() => setActiveTab('summary')}
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors relative',
            activeTab === 'summary' ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          Summary
          {activeTab === 'summary' && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('lots')}
          className={cn(
            'flex-1 py-3 text-sm font-medium transition-colors relative',
            activeTab === 'lots' ? 'text-foreground' : 'text-muted-foreground'
          )}
        >
          Lots ({lotManager.lots.length})
          {activeTab === 'lots' && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
            />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'summary' ? (
            <motion.div
              key="summary"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 space-y-4"
            >
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  icon={Package}
                  label="Items Processed"
                  value={summary.totalItems}
                  variant="default"
                />
                <StatCard
                  icon={DollarSign}
                  label="Total Resale Value"
                  value={formatAud(summary.totalResaleValue)}
                  variant="primary"
                />
                <StatCard
                  icon={Target}
                  label="Cost Basis"
                  value={formatAud(summary.totalCostBasis)}
                  subValue="Buy under total"
                  variant="default"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Projected Profit"
                  value={`${formatAud(summary.projectedProfit.low, { showPlus: true })}–${formatAud(summary.projectedProfit.high)}`}
                  subValue={`${summary.roi}% ROI`}
                  variant="success"
                />
              </div>

              {/* Risk Score */}
              <div className="bg-muted/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Risk/Volatility Score</span>
                  <span className={cn(
                    'text-sm font-bold',
                    summary.riskScore < 30 ? 'text-emerald-400' :
                    summary.riskScore < 60 ? 'text-amber-400' : 'text-red-400'
                  )}>
                    {summary.riskScore}%
                  </span>
                </div>
                <Progress 
                  value={summary.riskScore} 
                  className={cn(
                    'h-2',
                    summary.riskScore < 30 ? '[&>div]:bg-emerald-500' :
                    summary.riskScore < 60 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'
                  )}
                />
                <p className="text-xs text-muted-foreground mt-2">
                  {summary.riskScore < 30 ? 'Low risk - high confidence items' :
                   summary.riskScore < 60 ? 'Moderate risk - some uncertainty in pricing' :
                   'High risk - limited market data available'}
                </p>
              </div>

              {/* Lot Analytics */}
              {lotManager.analytics.totalLots > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Lot Summary</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Total Lots</p>
                      <p className="font-semibold">{lotManager.analytics.totalLots}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Combined Value</p>
                      <p className="font-semibold">{formatAud(lotManager.analytics.totalLotValue)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Highest Lot</p>
                      <p className="font-semibold">
                        {lotManager.analytics.highestValueLot?.name || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Lot Profit</p>
                      <p className="font-semibold text-emerald-400">
                        {formatAud(lotManager.analytics.totalLotProfit.low, { showPlus: true })}–{formatAud(lotManager.analytics.totalLotProfit.high)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Recommended Actions */}
              {summary.recommendedActions.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Recommended Actions
                  </h3>
                  <div className="space-y-2">
                    {summary.recommendedActions.map((action, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                          {idx + 1}
                        </div>
                        <p className="text-sm">{action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pricing Narrative */}
              <Collapsible open={showNarrative} onOpenChange={setShowNarrative}>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <FileText className="w-4 h-4 text-primary" />
                    How Pricing Was Determined
                  </span>
                  <ChevronDown className={cn(
                    'w-4 h-4 transition-transform',
                    showNarrative && 'rotate-180'
                  )} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <p className="text-sm text-muted-foreground leading-relaxed p-3 bg-muted/20 rounded-lg">
                    {narrative}
                  </p>
                </CollapsibleContent>
              </Collapsible>

              {/* Worth Grabbing List */}
              {summary.worthGrabbing.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Check className="w-4 h-4 text-emerald-400" />
                    Worth Grabbing ({summary.worthGrabbing.length})
                  </h3>
                  <div className="space-y-2">
                    {summary.worthGrabbing.map((item, idx) => (
                      <motion.div
                        key={item.key}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-center justify-between bg-card rounded-xl p-3 border border-border/50"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Buy under {formatAud(item.suggestedBuy)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-emerald-400">
                            {formatAud(item.netProfitLow, { showPlus: true })}–{formatAud(item.netProfitHigh)}
                          </p>
                          <Badge variant="secondary" className="text-[10px]">
                            {item.confidence}% conf
                          </Badge>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Risky Items */}
              {summary.riskyItems.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    High Risk ({summary.riskyItems.length})
                  </h3>
                  <div className="space-y-2">
                    {summary.riskyItems.map(item => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{item.name}</p>
                          <p className="text-xs text-amber-400">Low confidence</p>
                        </div>
                        <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                          {item.confidence}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  All Reviewed Items ({items.length})
                </h3>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between bg-card rounded-xl p-3 border border-border/50"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Buy under {formatAud(item.suggestedBuy)} • Range {formatAudRange(item.lowPrice, item.highPrice)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          'text-sm font-semibold',
                          item.netProfitLow > 0 ? 'text-emerald-400' : 'text-red-400'
                        )}>
                          {formatAud(item.netProfitLow, { showPlus: true })}–{formatAud(item.netProfitHigh)}
                        </p>
                        <Badge variant="secondary" className="text-[10px]">
                          {item.confidence}% conf
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="lots"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-4 space-y-4"
            >
              {/* Lot Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => lotManager.autoGroupByCategory()}
                  className="flex-1"
                >
                  <Wand2 className="w-3 h-3 mr-2" />
                  By Category
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => lotManager.autoGroupByCondition()}
                  className="flex-1"
                >
                  <Wand2 className="w-3 h-3 mr-2" />
                  By Condition
                </Button>
              </div>

              {/* Selection Info */}
              {lotManager.selectedItems.size > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-3 bg-primary/10 border border-primary/30 rounded-xl"
                >
                  <span className="text-sm">
                    {lotManager.selectedItems.size} item{lotManager.selectedItems.size !== 1 ? 's' : ''} selected
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => lotManager.clearSelection()}
                    >
                      Clear
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => lotManager.createLotFromSelection()}
                      disabled={lotManager.selectedItems.size < 2}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Create Lot
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* Existing Lots */}
              {lotManager.lots.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Your Lots</h3>
                  <AnimatePresence>
                    {lotManager.lots.map(lot => (
                      <LotCard
                        key={lot.id}
                        lot={lot}
                        items={items}
                        isExpanded={expandedLot === lot.id}
                        onToggle={() => setExpandedLot(expandedLot === lot.id ? null : lot.id)}
                        onDelete={() => lotManager.deleteLot(lot.id)}
                        onRemoveItem={(key) => lotManager.removeItemsFromLot(lot.id, [key])}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Unassigned Items */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">
                    {lotManager.lots.length > 0 ? 'Unassigned Items' : 'All Items'}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (lotManager.selectedItems.size === items.length) {
                        lotManager.clearSelection();
                      } else {
                        lotManager.selectAll();
                      }
                    }}
                  >
                    {lotManager.selectedItems.size === items.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="space-y-2">
                  {items.map(item => {
                    const itemLot = lotManager.getLotByItemKey(item.key);
                    return (
                      <ItemSelectable
                        key={item.key}
                        item={item}
                        isSelected={lotManager.selectedItems.has(item.key)}
                        onToggle={() => lotManager.toggleItemSelection(item.key)}
                        lotName={itemLot?.name}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Empty State */}
              {items.length === 0 && (
                <div className="text-center py-12">
                  <Package className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                  <p className="text-muted-foreground">No items to group</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-border/50 bg-background/80 backdrop-blur-sm space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleExportEnhancedCSV()}
            className="flex-col h-14 gap-1"
          >
            <Download className="w-4 h-4" />
            <span className="text-xs">Export</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onSaveFinds}
            disabled={savingFinds}
            className="flex-col h-14 gap-1"
          >
            {savingFinds ? <Clock className="w-4 h-4 animate-pulse" /> : <Bookmark className="w-4 h-4" />}
            <span className="text-xs">{savingFinds ? 'Saving' : 'Save'}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onShare}
            className="flex-col h-14 gap-1"
          >
            <Share2 className="w-4 h-4" />
            <span className="text-xs">Share</span>
          </Button>
        </div>
        
        <Button 
          variant="default"
          className="w-full"
          onClick={onClose}
        >
          Continue Scanning
        </Button>
      </div>
    </motion.div>
  );
}
