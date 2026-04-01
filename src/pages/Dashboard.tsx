import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Package,
  TrendingUp,
  DollarSign,
  BarChart3,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  Boxes,
  RefreshCw,
  Target,
  BellRing,
  Flame,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Item, MarketReport } from "@/lib/types";
import { ItemDetailModal } from "@/components/ItemDetailModal";
import { StatsDetailModal } from "@/components/StatsDetailModal";
import type { Tables } from "@/integrations/supabase/types";

import { PageTransition } from "@/components/PageTransition";
import { StreakDisplay, generateAchievements } from "@/components/GamificationBadge";
import { motion, AnimatePresence } from "framer-motion";
import { formatAud } from "@/lib/utils";

type ScanLog = Tables<"scan_logs">;
type PriceAlert = Tables<"price_alerts">;

interface DashboardNotification {
  id: string;
  title: string;
  detail: string;
  tone: "default" | "success" | "warning" | "primary";
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

/**
 * Returns a local-timezone YYYY-MM-DD date key for a given ISO timestamp.
 * Using local dates ensures the streak is not broken by UTC timezone offsets
 * (e.g. an Australian user scanning at 11pm AEST would be the previous UTC day).
 */
const getDateKey = (value: string) => {
  const d = new Date(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const calculateCurrentStreak = (scanDates: string[]) => {
  if (scanDates.length === 0) return 0;

  const uniqueDays = Array.from(new Set(scanDates.map(getDateKey))).sort((a, b) => b.localeCompare(a));

  // Use local-date today to avoid timezone-induced streak resets
  const now = new Date();
  const todayKey = getDateKey(now.toISOString());
  const yesterdayDate = new Date(now.getTime() - DAY_IN_MS);
  const yesterdayKey = getDateKey(yesterdayDate.toISOString());

  // Streak is valid only if the user has scanned today or yesterday
  if (uniqueDays[0] !== todayKey && uniqueDays[0] !== yesterdayKey) return 0;

  let streak = 0;
  // Walk backwards through unique days, counting consecutive days
  let expectedDate = new Date(
    uniqueDays[0].slice(0, 4) + "-" + uniqueDays[0].slice(5, 7) + "-" + uniqueDays[0].slice(8, 10) + "T12:00:00"
  );

  for (const day of uniqueDays) {
    const expectedKey = getDateKey(expectedDate.toISOString());
    if (day !== expectedKey) break;
    streak += 1;
    expectedDate = new Date(expectedDate.getTime() - DAY_IN_MS);
  }

  return streak;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [marketReports, setMarketReports] = useState<Record<string, MarketReport>>({});
  const [scanLogs, setScanLogs] = useState<ScanLog[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal states
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [statsModal, setStatsModal] = useState<{
    open: boolean;
    title: string;
    filter: "all" | "listed" | "sold" | "profit";
  }>({ open: false, title: "", filter: "all" });

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const [
        { data: itemsData, error: itemsError },
        { data: scanLogsData, error: scanLogsError },
        { data: priceAlertsData, error: priceAlertsError },
      ] = await Promise.all([
        supabase
          .from("items")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("scan_logs")
          .select("*")
          .eq("user_id", user.id)
          .order("scanned_at", { ascending: false })
          .limit(100),
        supabase
          .from("price_alerts")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(25),
      ]);

      if (itemsError) throw itemsError;
      if (scanLogsError) throw scanLogsError;
      if (priceAlertsError) throw priceAlertsError;

      setItems(itemsData || []);
      setScanLogs(scanLogsData || []);
      setPriceAlerts(priceAlertsData || []);

      if (itemsData && itemsData.length > 0) {
        const itemIds = itemsData.map((i) => i.id);
        const { data: reportsData, error: reportsError } = await supabase
          .from("market_reports")
          .select("*")
          .in("item_id", itemIds);

        if (!reportsError && reportsData) {
          const reportsMap: Record<string, MarketReport> = {};
          reportsData.forEach((report) => {
            reportsMap[report.item_id] = report as MarketReport;
          });
          setMarketReports(reportsMap);
        }
      } else {
        setMarketReports({});
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`dashboard-live-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const item = payload.new as Tables<"items">;
          if (payload.eventType === "INSERT") {
            toast.success(`${item.title || "New item"} added to inventory.`);
          }
          if (payload.eventType === "UPDATE" && item.status === "sold") {
            toast.success(`${item.title || "Item"} marked as sold.`);
          }
          void fetchData();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scan_logs", filter: `user_id=eq.${user.id}` },
        () => {
          void fetchData();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "price_alerts", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const alert = payload.new as Tables<"price_alerts">;
          if (alert.triggered) {
            toast.info(`Price alert triggered for one of your tracked items.`);
          }
          void fetchData();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchData, user?.id]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const totalItems = items.length;
  const listedItems = items.filter(i => i.status === "listed");
  const soldItems = items.filter(i => i.status === "sold");

  const totalCost = items.reduce((sum, i) => sum + (i.purchase_price || 0), 0);
  const totalRevenue = soldItems.reduce((sum, i) => sum + (i.sale_price || 0), 0);
  const totalProfit = totalRevenue - soldItems.reduce((sum, i) => sum + (i.purchase_price || 0), 0);
  const roi = totalCost > 0 ? ((totalProfit / totalCost) * 100).toFixed(1) : "0";
  const daysActive = useMemo(() => Array.from(new Set(scanLogs.map((scan) => getDateKey(scan.scanned_at)))).length, [scanLogs]);
  const currentStreak = useMemo(() => calculateCurrentStreak(scanLogs.map((scan) => scan.scanned_at)), [scanLogs]);

  // Gamification — achievements track in the background and surface as pop-ups on unlock.
  const achievements = generateAchievements({
    totalScans: scanLogs.length,
    totalItems,
    totalSold: soldItems.length,
    totalProfit,
    daysActive,
    currentStreak,
  });

  // Track which achievements have already triggered a pop-up toast this session.
  const notifiedAchievementIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    achievements
      .filter((a) => a.unlocked && !notifiedAchievementIds.current.has(a.id))
      .forEach((a) => {
        notifiedAchievementIds.current.add(a.id);
        toast(`Achievement unlocked: ${a.title}`, {
          description: a.description,
          duration: 6000,
        });
      });
  }, [achievements]);
  const triggeredAlerts = priceAlerts.filter((alert) => alert.triggered);
  const notifications = useMemo<DashboardNotification[]>(() => {
    const next: DashboardNotification[] = [];
    const pendingItems = items.filter((item) => item.status === "pending");
    const recentSoldItems = [...soldItems]
      .sort((a, b) => (b.sold_at || "").localeCompare(a.sold_at || ""))
      .slice(0, 2);

    if (triggeredAlerts.length > 0) {
      next.push({
        id: "alerts",
        title: "Triggered price alerts",
        detail: `${triggeredAlerts.length} tracked item${triggeredAlerts.length === 1 ? "" : "s"} hit your target price.`,
        tone: "warning",
      });
    }

    if (recentSoldItems.length > 0) {
      next.push({
        id: "sales",
        title: "Recent sales activity",
        detail: recentSoldItems.map((item) => item.title || "Untitled item").join(", "),
        tone: "success",
      });
    }

    if (pendingItems.length > 0) {
      next.push({
        id: "pending",
        title: "Listings ready to publish",
        detail: `${pendingItems.length} item${pendingItems.length === 1 ? "" : "s"} are still pending in inventory.`,
        tone: "primary",
      });
    }

    if (currentStreak > 1) {
      next.push({
        id: "streak",
        title: "Current scan streak",
        detail: `You're on a ${currentStreak}-day streak with ${daysActive} active scan day${daysActive === 1 ? "" : "s"} total.`,
        tone: "default",
      });
    }

    if (next.length === 0) {
      next.push({
        id: "quiet",
        title: "Quiet dashboard",
        detail: "Scan or list an item to start generating activity notifications here.",
        tone: "default",
      });
    }

    return next.slice(0, 4);
  }, [currentStreak, daysActive, items, soldItems, triggeredAlerts]);

  const stats = [
    {
      title: "Total Items",
      value: totalItems,
      icon: Package,
      trend: null as string | null,
      color: "text-primary",
      filter: "all" as const
    },
    {
      title: "Listed",
      value: listedItems.length,
      icon: Clock,
      trend: null as string | null,
      color: "text-info",
      filter: "listed" as const
    },
    {
      title: "Sold",
      value: soldItems.length,
      icon: TrendingUp,
      trend: null as string | null,
      color: "text-success",
      filter: "sold" as const
    },
    {
      title: "Total Profit",
      value: formatAud(totalProfit),
      icon: DollarSign,
      trend: totalProfit >= 0 ? "up" : "down",
      color: totalProfit >= 0 ? "text-success" : "text-destructive",
      filter: "profit" as const
    },
  ];

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "listed":
        return <Badge variant="secondary">Listed</Badge>;
      case "sold":
        return <Badge className="bg-success/20 text-success border-success/30">Sold</Badge>;
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const handleStatClick = (filter: "all" | "listed" | "sold" | "profit") => {
    const titles: Record<string, string> = {
      all: "All Items",
      listed: "Listed Items",
      sold: "Sold Items",
      profit: "Items with Sales",
    };
    setStatsModal({ open: true, title: titles[filter], filter });
  };

  const getFilteredItems = () => {
    switch (statsModal.filter) {
      case "listed":
        return listedItems;
      case "sold":
        return soldItems;
      case "profit":
        return soldItems;
      default:
        return items;
    }
  };

  const handleItemClick = (item: Item) => {
    setSelectedItem(item);
    setShowItemModal(true);
  };

  return (
    <Layout>
      <PageTransition>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8"
          >
            <div>
              <h1 className="text-3xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground">Track your inventory and profits</p>
            </div>
            <div className="flex items-center gap-2">
              <StreakDisplay count={currentStreak} />
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
              <Link to="/scan">
                <Button variant="hero">
                  <Plus className="w-4 h-4 mr-2" />
                  Scan New Item
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Stats Grid - Animated */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {stats.map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
              >
                <Card
                  className="card-interactive group"
                  onClick={() => handleStatClick(stat.filter)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                      <div className="flex items-center gap-1">
                        {stat.trend && (
                          stat.trend === "up"
                            ? <ArrowUpRight className="w-4 h-4 text-success" />
                            : <ArrowDownRight className="w-4 h-4 text-destructive" />
                        )}
                        <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="text-2xl font-bold font-data">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.title}</div>
                </CardContent>
              </Card>
            </motion.div>
            ))}
          </div>

          {/* ROI Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className="mb-8 bg-gradient-to-r from-primary/10 to-info/10 border-primary/20 overflow-hidden relative">
              <div className="absolute inset-0 overflow-hidden">
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <CardContent className="p-6 flex items-center justify-between relative">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Return on Investment</div>
                  <div className="text-4xl font-bold text-primary font-data">{roi}%</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Based on {formatAud(totalCost)} invested &bull; {formatAud(totalRevenue)} revenue
                  </div>
                </div>
                <BarChart3 className="w-12 h-12 text-primary/50" />
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38 }}
          >
            <Card className="mb-8 border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BellRing className="w-5 h-5 text-primary" />
                  Activity Notifications
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {notifications.map((notification) => {
                  const Icon =
                    notification.tone === "success"
                      ? CheckCircle2
                      : notification.tone === "warning"
                        ? AlertTriangle
                        : notification.tone === "primary"
                          ? Target
                          : Flame;
                  const iconColor =
                    notification.tone === "success"
                      ? "text-success"
                      : notification.tone === "warning"
                        ? "text-warning"
                        : notification.tone === "primary"
                          ? "text-primary"
                          : "text-orange-400";

                  return (
                    <div
                      key={notification.id}
                      className="flex items-start gap-3 rounded-xl border border-border/50 bg-secondary/20 p-4"
                    >
                      <div className="rounded-lg bg-background/70 p-2">
                        <Icon className={`w-4 h-4 ${iconColor}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{notification.title}</p>
                        <p className="text-sm text-muted-foreground">{notification.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </motion.div>

          {/* Achievements are now background trackers that pop up as toasts when unlocked */}

          {/* Items List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Recent Items
                </CardTitle>
                <Link to="/inventory">
                  <Button variant="ghost" size="sm">
                    <Boxes className="w-4 h-4 mr-2" />
                    View All
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="relative w-16 h-16 mb-4">
                      <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                      <img src="/mascot.png" alt="Loading..." className="relative w-full h-full object-contain animate-float" />
                    </div>
                    <p className="text-muted-foreground mt-4 text-sm">Loading your inventory...</p>
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="relative w-24 h-24 mx-auto mb-4">
                      <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                      <img src="/mascot.png" alt="No items yet" className="relative w-full h-full object-contain animate-float" />
                    </div>
                    <h3 className="font-semibold mb-2">No items yet</h3>
                    <p className="text-muted-foreground mb-4">Start by scanning your first item</p>
                    <Link to="/scan">
                      <Button variant="hero">
                        <Plus className="w-4 h-4 mr-2" />
                        Scan Item
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <AnimatePresence>
                      {items.slice(0, 5).map((item, index) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => handleItemClick(item)}
                          className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-all duration-200 cursor-pointer group active:scale-[0.99]"
                        >
                          <div className="w-14 h-14 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.title || "Item"}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = "/placeholder.svg";
                                }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-6 h-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{item.title || "Untitled Item"}</div>
                            <div className="text-sm text-muted-foreground">
                              {item.brand && <span>{item.brand} &bull; </span>}
                              {item.category || "Uncategorized"}
                            </div>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div>
                              {getStatusBadge(item.status)}
                              {item.sale_price ? (
                                <div className="text-sm font-medium text-success mt-1 font-data">
                                  {formatAud(item.sale_price)}
                                </div>
                              ) : item.purchase_price ? (
                                <div className="text-sm font-medium text-muted-foreground mt-1 font-data">
                                  {formatAud(item.purchase_price)}
                                </div>
                              ) : null}
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {items.length > 5 && (
                      <Link to="/inventory" className="block">
                        <div className="text-center py-3 text-primary hover:text-primary/80 transition-colors text-sm font-medium">
                          View {items.length - 5} more items &rarr;
                        </div>
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </PageTransition>

      {/* Stats Detail Modal */}
      <StatsDetailModal
        open={statsModal.open}
        onOpenChange={(open) => setStatsModal({ ...statsModal, open })}
        title={statsModal.title}
        items={getFilteredItems()}
        onItemClick={handleItemClick}
      />

      {/* Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          marketReport={marketReports[selectedItem.id]}
          open={showItemModal}
          onOpenChange={setShowItemModal}
          onUpdate={fetchData}
          onDelete={fetchData}
        />
      )}
            <FeedbackWidget context="dashboard" />
    </Layout>
  );
}
