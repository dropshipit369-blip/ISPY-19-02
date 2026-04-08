import { useEffect, useState } from "react";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { ShareFindButton } from "@/components/ShareFindButton";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  Plus,
  Search,
  Filter,
  Grid,
  List,
  DollarSign,
  Calendar,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Item, MarketReport } from "@/lib/types";
import { format } from "date-fns";
import { ItemDetailModal } from "@/components/ItemDetailModal";
import { formatAud } from "@/lib/utils";

import { PageTransition } from "@/components/PageTransition";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

export default function Inventory() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [items, setItems] = useState<Item[]>([]);
  const [marketReports, setMarketReports] = useState<Record<string, MarketReport>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Modal state
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const { data: itemsData, error: itemsError } = await supabase
        .from("items")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (itemsError) throw itemsError;
      setItems(itemsData || []);

      // Fetch market reports
      if (itemsData && itemsData.length > 0) {
        const itemIds = itemsData.map(i => i.id);
        const { data: reportsData, error: reportsError } = await supabase
          .from("market_reports")
          .select("*")
          .in("item_id", itemIds);

        if (!reportsError && reportsData) {
          const reportsMap: Record<string, MarketReport> = {};
          reportsData.forEach(report => {
            reportsMap[report.item_id] = report as MarketReport;
          });
          setMarketReports(reportsMap);
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const categories = [...new Set(items.map((i) => i.category).filter(Boolean))];

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.model?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;
    const matchesCategory =
      categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "listed":
        return <Badge variant="secondary">Listed</Badge>;
      case "sold":
        return (
          <Badge className="bg-success/20 text-success border-success/30">
            Sold
          </Badge>
        );
      case "pending":
        return <Badge variant="outline">Pending</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const handleItemClick = (item: Item) => {
    setSelectedItem(item);
    setShowItemModal(true);
  };

  // Calculate totals
  const totalCost = filteredItems.reduce((sum, item) => sum + (item.purchase_price || 0), 0);
  const totalSales = filteredItems.filter(i => i.status === "sold").reduce((sum, item) => sum + (item.sale_price || 0), 0);
  const totalMarketValue = filteredItems.reduce((sum, item) => {
    const report = marketReports[item.id];
    return sum + (report?.median_price || item.purchase_price || 0);
  }, 0);
  const totalProfit = totalSales - filteredItems.filter(i => i.status === "sold").reduce((sum, item) => sum + (item.purchase_price || 0), 0);

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
              <h1 className="text-3xl font-bold">Inventory</h1>
              <p className="text-muted-foreground">
                {filteredItems.length} of {items.length} items
              </p>
            </div>
            <div className="flex items-center gap-2">
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
                  Add Item
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="bg-gradient-to-r from-primary/10 to-info/10 border-primary/20">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Total Cost</div>
                <div className="text-2xl font-bold text-primary">{formatAud(totalCost)}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-info/10 to-primary/10 border-info/20">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Est. Market Value</div>
                <div className="text-2xl font-bold text-info">{formatAud(totalMarketValue)}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-success/10 to-info/10 border-success/20">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Total Sales</div>
                <div className="text-2xl font-bold text-success">{formatAud(totalSales)}</div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-warning/10 to-success/10 border-warning/20">
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Realized Profit</div>
                <div className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatAud(totalProfit, { showPlus: true })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search items..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="listed">Listed</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat!}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-1 bg-secondary rounded-lg p-1">
                  <Button
                    variant={viewMode === "grid" ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setViewMode("grid")}
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setViewMode("list")}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative w-16 h-16 mb-4">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                <img src="/ispy-logo.png" alt="Loading..." className="relative w-full h-full object-contain animate-pulse" />
              </div>
              <p className="text-muted-foreground mt-4 text-sm">Loading inventory...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                  <img src="/ispy-logo.png" alt="No items found" className="relative w-full h-full object-contain" />
                </div>
                <h3 className="font-semibold mb-2">No items found</h3>
                <p className="text-muted-foreground mb-4">
                  {items.length === 0
                    ? "Start by scanning your first item"
                    : "Try adjusting your filters"}
                </p>
                {items.length === 0 && (
                  <Link to="/scan">
                    <Button variant="hero">
                      <Plus className="w-4 h-4 mr-2" />
                      Scan Item
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : viewMode === "grid" ? (
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              initial="initial"
              animate="animate"
              variants={{ animate: { transition: { staggerChildren: 0.05 } } }}
            >
              <AnimatePresence>
                {filteredItems.map((item) => (
                  <motion.div
                    key={item.id}
                    variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }}
                  >
                    <Card
                      onClick={() => handleItemClick(item)}
                      className="card-interactive group overflow-hidden cursor-pointer"
                    >
                      <div className="aspect-square relative bg-secondary">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.title || "Item"}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.error("Image load error:", item.image_url);
                              e.currentTarget.src = "/placeholder.svg";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-12 h-12 text-muted-foreground" />
                          </div>
                        )}
                        <div className="absolute top-2 right-2">
                          {getStatusBadge(item.status)}
                        </div>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                          <ChevronRight className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold truncate">
                          {item.title || "Untitled Item"}
                        </h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {item.brand && `${item.brand} • `}
                          {item.category || "Uncategorized"}
                        </p>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-1 text-sm">
                            <DollarSign className="w-3 h-3 text-muted-foreground" />
                            <span className="font-medium">
                              {formatAud(item.purchase_price)}
                            </span>
                          </div>
                          {item.sale_price && (
                            <div className="text-sm font-medium text-success">
                              Sold: {formatAud(item.sale_price)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(item.created_at), "MMM d, yyyy")}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Sale</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => (
                    <TableRow
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className="cursor-pointer"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
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
                                <Package className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate max-w-[200px]">
                              {item.title || "Untitled"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {item.brand} {item.model}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{item.category || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.condition || "—"}</Badge>
                      </TableCell>
                      <TableCell>
                        {item.purchase_price
                          ? formatAud(item.purchase_price)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {item.sale_price ? (
                          <span className="text-success">
                            {formatAud(item.sale_price)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(item.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(item.created_at), "MMM d")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </PageTransition>

      {/* Item Detail Modal */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          marketReport={marketReports[selectedItem.id]}
          open={showItemModal}
          onOpenChange={setShowItemModal}
          onUpdate={fetchData}
          onDelete={fetchData}
          fullScreen={isMobile}
        />
      )}
            <FeedbackWidget context="inventory" />
      {selectedItem && <ShareFindButton item={selectedItem} autoShow={showItemModal} />}
    </Layout>
  );
}
