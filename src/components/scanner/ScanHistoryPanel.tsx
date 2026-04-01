import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Clock,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowUpDown,
  Package,
  Calendar,
  Wallet,
  Target,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, startOfWeek, startOfMonth, subDays, subWeeks, subMonths } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { formatAud } from "@/lib/utils";

interface ScanLog {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  condition: string | null;
  median_price: number | null;
  low_price: number | null;
  high_price: number | null;
  confidence: number | null;
  trend: string | null;
  scanned_at: string;
}

interface InventoryItem {
  id: string;
  title: string | null;
  purchase_price: number | null;
  status: string | null;
  created_at: string;
}

interface MarketReportData {
  item_id: string;
  suggested_price: number | null;
  median_price: number | null;
}

type SortOption = "recent" | "price-high" | "price-low";
type TimeSpan = "day" | "week" | "month" | "lifetime";

interface ScanHistoryPanelProps {
  userId: string;
  refreshTrigger?: number;
}

export function ScanHistoryPanel({ userId, refreshTrigger }: ScanHistoryPanelProps) {
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [marketReports, setMarketReports] = useState<Record<string, MarketReportData>>({});
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [profitTimeSpan, setProfitTimeSpan] = useState<TimeSpan>("day");
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchData();
    }
  }, [userId, refreshTrigger]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get today's start
      const todayStart = startOfDay(new Date()).toISOString();

      // Fetch today's scan logs
      const { data: logs, error: logsError } = await supabase
        .from("scan_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("scanned_at", todayStart)
        .order("scanned_at", { ascending: false });

      if (logsError) throw logsError;
      setScanLogs(logs || []);

      // Fetch all inventory items for profit calculation
      const { data: items, error: itemsError } = await supabase
        .from("items")
        .select("id, title, purchase_price, status, created_at")
        .eq("user_id", userId);

      if (itemsError) throw itemsError;
      setInventoryItems(items || []);

      // Fetch market reports for inventory items
      if (items && items.length > 0) {
        const itemIds = items.map(i => i.id);
        const { data: reports, error: reportsError } = await supabase
          .from("market_reports")
          .select("item_id, suggested_price, median_price")
          .in("item_id", itemIds);

        if (!reportsError && reports) {
          const reportsMap: Record<string, MarketReportData> = {};
          reports.forEach(r => { reportsMap[r.item_id] = r; });
          setMarketReports(reportsMap);
        }
      }
    } catch (error) {
      console.error("Error fetching scan history:", error);
    } finally {
      setLoading(false);
    }
  };

  // Sort scan logs
  const sortedLogs = useMemo(() => {
    const sorted = [...scanLogs];
    switch (sortBy) {
      case "recent":
        return sorted.sort((a, b) => new Date(b.scanned_at).getTime() - new Date(a.scanned_at).getTime());
      case "price-high":
        return sorted.sort((a, b) => (b.median_price || 0) - (a.median_price || 0));
      case "price-low":
        return sorted.sort((a, b) => (a.median_price || 0) - (b.median_price || 0));
      default:
        return sorted;
    }
  }, [scanLogs, sortBy]);

  // Calculate profit metrics based on time span
  const profitMetrics = useMemo(() => {
    let cutoffDate: Date;
    const now = new Date();

    switch (profitTimeSpan) {
      case "day":
        cutoffDate = startOfDay(now);
        break;
      case "week":
        cutoffDate = startOfWeek(now, { weekStartsOn: 1 });
        break;
      case "month":
        cutoffDate = startOfMonth(now);
        break;
      case "lifetime":
        cutoffDate = new Date(0);
        break;
    }

    const filteredItems = inventoryItems.filter(item => 
      new Date(item.created_at) >= cutoffDate && item.purchase_price
    );

    let totalCost = 0;
    let totalPotentialValue = 0;
    let itemsWithPricing = 0;

    filteredItems.forEach(item => {
      if (item.purchase_price) {
        totalCost += item.purchase_price;
        const report = marketReports[item.id];
        const recommendedPrice = report?.suggested_price || report?.median_price;
        if (recommendedPrice) {
          totalPotentialValue += recommendedPrice;
          itemsWithPricing++;
        }
      }
    });

    const potentialProfit = totalPotentialValue - totalCost;
    const profitMargin = totalCost > 0 ? (potentialProfit / totalCost) * 100 : 0;

    return {
      totalCost,
      totalPotentialValue,
      potentialProfit,
      profitMargin,
      itemCount: filteredItems.length,
      itemsWithPricing,
    };
  }, [inventoryItems, marketReports, profitTimeSpan]);

  const timeSpanLabels: Record<TimeSpan, string> = {
    day: "Today",
    week: "This Week",
    month: "This Month",
    lifetime: "All Time",
  };

  const totalScannedValue = scanLogs.reduce((sum, log) => sum + (log.median_price || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="space-y-4"
    >
      {/* Profit Calculator Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Wallet className="w-4 h-4 text-primary" />
              </div>
              Profit Potential
            </CardTitle>
            <Select value={profitTimeSpan} onValueChange={(v) => setProfitTimeSpan(v as TimeSpan)}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <Calendar className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="lifetime">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-background/50 rounded-xl p-3 text-center">
              <DollarSign className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
              <p className="text-xs text-muted-foreground">Total Cost</p>
              <p className="font-bold text-foreground">{formatAud(profitMetrics.totalCost, { decimals: 0 })}</p>
            </div>
            <div className="bg-background/50 rounded-xl p-3 text-center">
              <Target className="w-4 h-4 mx-auto text-info mb-1" />
              <p className="text-xs text-muted-foreground">Est. Value</p>
              <p className="font-bold text-info">{formatAud(profitMetrics.totalPotentialValue, { decimals: 0 })}</p>
            </div>
            <div className="bg-background/50 rounded-xl p-3 text-center">
              <TrendingUp className="w-4 h-4 mx-auto text-success mb-1" />
              <p className="text-xs text-muted-foreground">Potential</p>
              <p className={`font-bold ${profitMetrics.potentialProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatAud(profitMetrics.potentialProfit, { decimals: 0, showPlus: true })}
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-success/10 via-primary/10 to-info/10 rounded-xl p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">{timeSpanLabels[profitTimeSpan]} ROI Potential</p>
            <p className={`text-3xl font-bold ${profitMetrics.profitMargin >= 0 ? 'text-success' : 'text-destructive'}`}>
              {profitMetrics.profitMargin >= 0 ? '+' : ''}{profitMetrics.profitMargin.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {profitMetrics.itemsWithPricing} of {profitMetrics.itemCount} items with pricing
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Today's Scans Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-lg bg-info/10">
                  <Clock className="w-4 h-4 text-info" />
                </div>
                Today's Scans
                <Badge variant="secondary" className="ml-1">{scanLogs.length}</Badge>
              </CardTitle>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            {isExpanded && (
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <ArrowUpDown className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Most Recent</SelectItem>
                  <SelectItem value="price-high">Price: High → Low</SelectItem>
                  <SelectItem value="price-low">Price: Low → High</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          {isExpanded && scanLogs.length > 0 && (
            <div className="flex items-center gap-4 mt-2 text-sm">
              <span className="text-muted-foreground">
                Total Value: <span className="font-semibold text-primary">{formatAud(totalScannedValue, { decimals: 0 })}</span>
              </span>
            </div>
          )}
        </CardHeader>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <CardContent className="pt-2">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                  </div>
                ) : sortedLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">No scans today</p>
                    <p className="text-xs text-muted-foreground/70">Start scanning to see items here</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[280px] pr-3">
                    <div className="space-y-2">
                      {sortedLogs.map((log, index) => (
                        <motion.div
                          key={log.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="flex items-center gap-3 p-3 rounded-xl bg-background/50 hover:bg-background/80 transition-colors group"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{log.name}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {log.brand && <span>{log.brand}</span>}
                              {log.category && (
                                <>
                                  <span>•</span>
                                  <span>{log.category}</span>
                                </>
                              )}
                              <span>•</span>
                              <span>{format(new Date(log.scanned_at), "h:mm a")}</span>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-primary">
                              {formatAud(log.median_price, { decimals: 0 })}
                            </p>
                            {log.trend && (
                              <div className="flex items-center justify-end gap-1">
                                {log.trend === "up" ? (
                                  <TrendingUp className="w-3 h-3 text-success" />
                                ) : log.trend === "down" ? (
                                  <TrendingDown className="w-3 h-3 text-destructive" />
                                ) : null}
                                {log.confidence && (
                                  <span className="text-xs text-muted-foreground">
                                    {log.confidence}%
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
