import { useEffect, useState, useCallback } from "react";
import { FeedbackWidget } from "@/components/FeedbackWidget";

import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Download,
  FileSpreadsheet,
  Search,
  CheckSquare,
  RefreshCw,
  Edit3,
  Sparkles,
  Loader2,
  Send,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useListingDraft } from "@/hooks/useListingDraft";
import { toast } from "sonner";
import type { Item, MarketReport } from "@/lib/types";

import { PageTransition } from "@/components/PageTransition";
import { motion } from "framer-motion";
import { downloadCsvFile } from "@/lib/download";
import { formatAud, formatAudRange } from "@/lib/utils";

import { ListingDraftEditor } from "@/components/listings/ListingDraftEditor";
import { EbaySmartCopy } from "@/components/listings/EbaySmartCopy";
import { EbayBatchCsvFlow } from "@/components/listings/EbayBatchCsvFlow";
import type { ListingDraftData } from "@/hooks/useListingDraft";

interface ListingItem extends Item {
  selected: boolean;
  listingTitle?: string;
  listingPrice?: number;
  listingDescription?: string;
}

const MARKETPLACE_EXPORTS = {
  ebay: {
    label: "eBay",
    filenamePrefix: "ebay-listings",
  },
  facebook: {
    label: "Facebook Marketplace",
    filenamePrefix: "facebook-marketplace-listings",
  },
  etsy: {
    label: "Etsy",
    filenamePrefix: "etsy-listings",
  },
} as const;

type MarketplaceTarget = keyof typeof MARKETPLACE_EXPORTS;

const EBAY_AU_CONDITIONS: Record<string, string> = {
  New: "1000",
  "Like New": "1500",
  Excellent: "2000",
  "Very Good": "2500",
  Good: "3000",
  Acceptable: "4000",
  "For Parts": "7000",
};

export default function Listings() {
  const { user } = useAuth();
  const draftManager = useListingDraft();

  const [items, setItems] = useState<ListingItem[]>([]);
  const [marketReports, setMarketReports] = useState<
    Record<string, MarketReport>
  >({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [marketplaceTarget, setMarketplaceTarget] =
    useState<MarketplaceTarget>("ebay");

  // Draft editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [currentDraft, setCurrentDraft] = useState<ListingDraftData | null>(
    null,
  );
  const [currentItem, setCurrentItem] = useState<Item | null>(null);
  const [currentMarketReport, setCurrentMarketReport] =
    useState<MarketReport | null>(null);

  // Smart copy state (single item)
  const [smartCopyOpen, setSmartCopyOpen] = useState(false);
  const [smartCopyDraft, setSmartCopyDraft] = useState<ListingDraftData | null>(
    null,
  );

  // Batch CSV flow state (multi-item)
  const [batchCsvOpen, setBatchCsvOpen] = useState(false);
  const [batchCsvDrafts, setBatchCsvDrafts] = useState<ListingDraftData[]>([]);

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
        .in("status", ["pending", "listed"])
        .order("created_at", { ascending: false });

      if (itemsError) throw itemsError;

      const listingItems: ListingItem[] = (itemsData || []).map((item) => ({
        ...item,
        selected: false,
        listingTitle: item.title || "",
        listingPrice: undefined,
        listingDescription: "",
      }));

      setItems(listingItems);

      // Fetch market reports for pricing suggestions
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

          // Update items with suggested prices
          setItems((prev) =>
            prev.map((item) => ({
              ...item,
              listingPrice:
                reportsMap[item.id]?.suggested_price ??
                reportsMap[item.id]?.median_price ??
                item.purchase_price ??
                undefined,
              listingTitle:
                reportsMap[item.id]?.suggested_title || item.title || "",
              listingDescription:
                reportsMap[item.id]?.suggested_description || "",
            })),
          );
        }
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    ...new Set(items.map((i) => i.category).filter(Boolean)),
  ];

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      item.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brand?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const selectedItems = items.filter((i) => i.selected);
  const selectedCount = selectedItems.length;

  const toggleSelectAll = () => {
    const allSelected = filteredItems.every((i) => i.selected);
    setItems((prev) =>
      prev.map((item) =>
        filteredItems.some((f) => f.id === item.id)
          ? { ...item, selected: !allSelected }
          : item,
      ),
    );
  };

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, selected: !item.selected } : item,
      ),
    );
  };

  const updateListingField = (
    id: string,
    field: keyof ListingItem,
    value: any,
  ) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );
  };

  // === AI LISTING GENERATION ===

  const handleCreateDraft = useCallback(
    async (item: Item) => {
      const report = marketReports[item.id] ?? null;
      const draft = await draftManager.generateDraft(item, report);

      if (draft) {
        setCurrentDraft(draft);
        setCurrentItem(item);
        setCurrentMarketReport(report);
        setEditorOpen(true);
      }
    },
    [marketReports, draftManager],
  );

  const handleSaveDraft = useCallback(
    async (draft: ListingDraftData): Promise<string | null> => {
      return draftManager.saveDraft(draft);
    },
    [draftManager],
  );

  const handlePublishFromEditor = useCallback(
    async (draft: ListingDraftData) => {
      // Save draft, then open smart copy flow
      const id = await draftManager.saveDraft(draft);
      if (id) {
        const savedDraft = { ...draft, id };
        setSmartCopyDraft(savedDraft);
        setEditorOpen(false);
        setSmartCopyOpen(true);
      }
    },
    [draftManager],
  );

  const handleRegenerateDraftField = useCallback(
    async (field: "title" | "description" | "all") => {
      if (!currentDraft || !currentItem) return null;
      return draftManager.regenerateField(
        currentDraft,
        field,
        currentItem,
        currentMarketReport,
      );
    },
    [currentDraft, currentItem, currentMarketReport, draftManager],
  );

  const handleMarkListed = useCallback(
    async (draft: ListingDraftData) => {
      if (!draft.item_id) return;

      try {
        // Update item status to listed
        await supabase
          .from("items")
          .update({ status: "listed" })
          .eq("id", draft.item_id);

        // Update draft status
        if (draft.id) {
          await draftManager.updateDraft(draft.id, { status: "published" });
        }

        toast.success("Marked as listed on eBay");
        fetchData();
      } catch (err) {
        console.error("Error marking as listed:", err);
      }
    },
    [draftManager],
  );

  // === BATCH: Generate + Smart Copy for first item ===

  const handleBatchList = useCallback(async () => {
    if (selectedCount === 0) {
      toast.error("Select items first");
      return;
    }

    // Single item → AI generate → edit → smart clipboard flow
    if (selectedCount === 1) {
      await handleCreateDraft(selectedItems[0] as Item);
      return;
    }

    // Multi-item → AI generate all → bulk CSV flow (eBay File Exchange)
    const itemsWithReports = selectedItems.map((item) => ({
      item: item as Item,
      marketReport: marketReports[item.id] ?? null,
    }));

    const drafts = await draftManager.generateBatchDrafts(itemsWithReports);

    if (drafts.length > 0) {
      // Save all drafts to database
      const savedDrafts: ListingDraftData[] = [];
      for (const draft of drafts) {
        const id = await draftManager.saveDraft(draft);
        if (id) {
          savedDrafts.push({ ...draft, id });
        } else {
          savedDrafts.push(draft);
        }
      }

      // Open bulk CSV flow
      setBatchCsvDrafts(savedDrafts);
      setBatchCsvOpen(true);
    }
  }, [
    selectedItems,
    selectedCount,
    marketReports,
    draftManager,
    handleCreateDraft,
  ]);

  // Mark all items in a batch as listed (after CSV download)
  const handleBatchMarkListed = useCallback(
    async (drafts: ListingDraftData[]) => {
      try {
        const itemIds = drafts.map((d) => d.item_id).filter(Boolean) as string[];
        if (itemIds.length === 0) return;

        // Update items to listed
        await supabase
          .from("items")
          .update({ status: "listed" })
          .in("id", itemIds);

        // Update drafts to published
        const draftIds = drafts.map((d) => d.id).filter(Boolean) as string[];
        if (draftIds.length > 0) {
          await supabase
            .from("listing_drafts")
            .update({ status: "published" })
            .in("id", draftIds);
        }

        toast.success(`Marked ${itemIds.length} items as listed on eBay`);
        fetchData();
      } catch (err) {
        console.error("Error marking batch as listed:", err);
        toast.error("Failed to update item statuses");
      }
    },
    [],
  );

  // === CSV EXPORT (fallback) ===

  const generateMarketplaceCSV = async () => {
    if (selectedCount === 0) {
      toast.error("Please select at least one item to export");
      return;
    }

    const rows =
      marketplaceTarget === "ebay"
        ? [
            [
              "Action",
              "Title",
              "Description",
              "Category",
              "StartPrice",
              "BuyItNowPrice",
              "Quantity",
              "Duration",
              "Format",
              "ConditionID",
              "Location",
              "Country",
              "Currency",
              "PaymentProfileName",
              "ReturnProfileName",
              "ShippingProfileName",
              "PicURL",
            ],
            ...selectedItems.map((item) => {
              const report = marketReports[item.id];
              const conditionId =
                EBAY_AU_CONDITIONS[item.condition || "Good"] || "3000";

              return [
                "Add",
                (item.listingTitle || item.title || "").slice(0, 80),
                item.listingDescription ||
                  report?.suggested_description ||
                  `${item.brand || ""} ${item.model || ""} - ${item.condition || "Good"} condition`,
                item.category || "",
                item.listingPrice?.toFixed(2) ||
                  report?.suggested_price?.toFixed(2) ||
                  "0.00",
                item.listingPrice?.toFixed(2) ||
                  report?.suggested_price?.toFixed(2) ||
                  "0.00",
                "1",
                "GTC",
                "FixedPrice",
                conditionId,
                "Australia",
                "AU",
                "AUD",
                "PayPal",
                "Returns Accepted",
                "Standard Shipping",
                item.image_url || "",
              ];
            }),
          ]
        : [
            [
              "InventoryId",
              "Marketplace",
              "Title",
              "Description",
              "Price",
              "Category",
              "Condition",
              "Brand",
              "Model",
              "ImageURL",
              "SuggestedMarketplace",
              "Notes",
            ],
            ...selectedItems.map((item) => {
              const report = marketReports[item.id];
              return [
                item.id,
                MARKETPLACE_EXPORTS[marketplaceTarget].label,
                item.listingTitle || item.title || "",
                item.listingDescription ||
                  report?.suggested_description ||
                  "",
                item.listingPrice?.toFixed(2) ||
                  report?.suggested_price?.toFixed(2) ||
                  "0.00",
                item.category || "",
                item.condition || "Good",
                item.brand || "",
                item.model || "",
                item.image_url || "",
                report?.best_marketplace || "",
                item.notes || "",
              ];
            }),
          ];

    await downloadCsvFile(
      `${MARKETPLACE_EXPORTS[marketplaceTarget].filenamePrefix}-${new Date().toISOString().split("T")[0]}.csv`,
      rows,
    );

    toast.success(
      `Exported ${selectedCount} ${MARKETPLACE_EXPORTS[marketplaceTarget].label} listing${selectedCount === 1 ? "" : "s"}.`,
    );
  };

  const markAsListed = async () => {
    if (selectedCount === 0) return;

    try {
      const ids = selectedItems.map((i) => i.id);
      const { error } = await supabase
        .from("items")
        .update({ status: "listed" })
        .in("id", ids);

      if (error) throw error;

      toast.success(`Marked ${selectedCount} items as listed`);
      fetchData();
    } catch (error) {
      console.error("Error updating items:", error);
      toast.error("Failed to update items");
    }
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
              <h1 className="text-3xl font-bold">Listings</h1>
              <p className="text-muted-foreground">
                AI-optimized listings for eBay, Facebook & Etsy
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => fetchData()}
                disabled={loading}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
            </div>
          </motion.div>

          {/* HERO: AI List on eBay — dominant primary CTA */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/30 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent pointer-events-none" />
              <CardContent className="p-5 relative">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/30 flex-shrink-0">
                      <Sparkles className="w-7 h-7 text-primary-foreground" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg sm:text-xl font-bold leading-tight">
                        AI List on eBay Australia
                      </h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {selectedCount === 0
                          ? "Select items — AI writes titles, descriptions, specifics & categories"
                          : selectedCount === 1
                            ? "1 item ready → AI generates → review → copy-paste to eBay"
                            : `${selectedCount} items → AI generates all → bulk CSV for eBay File Exchange`}
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="hero"
                    size="lg"
                    onClick={handleBatchList}
                    disabled={selectedCount === 0 || draftManager.generating}
                    className="w-full lg:w-auto h-14 px-8 text-base font-semibold shadow-lg shadow-primary/30"
                  >
                    {draftManager.generating ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Generating with AI...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        {selectedCount === 0
                          ? "List on eBay"
                          : selectedCount === 1
                            ? "AI Generate & List"
                            : `Bulk List ${selectedCount} on eBay`}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Secondary Action Bar: filters + export */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
                <div className="flex flex-col sm:flex-row gap-3 flex-1 w-full lg:w-auto">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search items..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select
                    value={categoryFilter}
                    onValueChange={setCategoryFilter}
                  >
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
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto flex-wrap">
                  <Badge variant="secondary" className="px-3 py-1">
                    {selectedCount} selected
                  </Badge>

                  {/* CSV Export (fallback) */}
                  <Select
                    value={marketplaceTarget}
                    onValueChange={(value: MarketplaceTarget) =>
                      setMarketplaceTarget(value)
                    }
                  >
                    <SelectTrigger className="w-full sm:w-32">
                      <SelectValue placeholder="CSV" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ebay">eBay CSV</SelectItem>
                      <SelectItem value="facebook">Facebook CSV</SelectItem>
                      <SelectItem value="etsy">Etsy CSV</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void generateMarketplaceCSV()}
                    disabled={selectedCount === 0}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    CSV
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={markAsListed}
                    disabled={selectedCount === 0}
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    Mark Listed
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Listings Table */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative w-16 h-16 mb-4">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                <img
                  src="/ispy-logo.png"
                  alt="Loading..."
                  className="relative w-full h-full object-contain animate-pulse"
                />
              </div>
              <p className="text-muted-foreground mt-4 text-sm">
                Loading items...
              </p>
            </div>
          ) : filteredItems.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <div className="relative w-24 h-24 mx-auto mb-4">
                  <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                  <img
                    src="/ispy-logo.png"
                    alt="No items"
                    className="relative w-full h-full object-contain"
                  />
                </div>
                <h3 className="font-semibold mb-2">
                  No items ready for listing
                </h3>
                <p className="text-muted-foreground mb-4">
                  Scan items and save them to inventory first
                </p>
                <Link to="/scan">
                  <Button variant="hero">
                    <Package className="w-4 h-4 mr-2" />
                    Scan Items
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          filteredItems.length > 0 &&
                          filteredItems.every((i) => i.selected)
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead className="min-w-[200px]">
                      Listing Title
                    </TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead>Market Data</TableHead>
                    <TableHead className="w-28">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item) => {
                    const report = marketReports[item.id];
                    return (
                      <TableRow
                        key={item.id}
                        className={item.selected ? "bg-primary/5" : ""}
                      >
                        <TableCell>
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={() => toggleItem(item.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
                              {item.image_url ? (
                                <img
                                  src={item.image_url}
                                  alt={item.title || "Item"}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="w-5 h-5 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium truncate max-w-[150px]">
                                {item.title || "Untitled"}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.brand} {item.model}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {editingId === item.id ? (
                            <Input
                              value={item.listingTitle || ""}
                              onChange={(e) =>
                                updateListingField(
                                  item.id,
                                  "listingTitle",
                                  e.target.value,
                                )
                              }
                              onBlur={() => setEditingId(null)}
                              className="text-sm"
                              maxLength={80}
                              autoFocus
                            />
                          ) : (
                            <div
                              className="text-sm truncate max-w-[200px] cursor-pointer hover:text-primary"
                              onClick={() => setEditingId(item.id)}
                            >
                              {item.listingTitle ||
                                item.title ||
                                "Click to edit..."}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.listingPrice || ""}
                            onChange={(e) =>
                              updateListingField(
                                item.id,
                                "listingPrice",
                                parseFloat(e.target.value) || undefined,
                              )
                            }
                            className="w-24 text-sm"
                            placeholder="0.00"
                            step="0.01"
                          />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {item.condition || "Good"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {report ? (
                            <div className="text-xs space-y-1">
                              <div className="text-muted-foreground">
                                Range:{" "}
                                {formatAudRange(
                                  report.low_price,
                                  report.high_price,
                                  { decimals: 0 },
                                )}
                              </div>
                              <div className="text-primary font-medium">
                                Suggested:{" "}
                                {formatAud(
                                  report.suggested_price ?? report.median_price,
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              No data
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="AI-generate eBay listing"
                              onClick={() => handleCreateDraft(item)}
                              disabled={draftManager.generating}
                            >
                              {draftManager.generating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Sparkles className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingId(item.id)}
                            >
                              <Edit3 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* Info Card */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
                How it works
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Select items and tap "AI List on eBay" — AI generates an
                optimized title, description, category, and price. Review and
                edit, then copy to eBay's sell page with one tap. CSV export
                still available for bulk upload.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">AI titles & descriptions</Badge>
                <Badge variant="secondary">AUD pricing</Badge>
                <Badge variant="secondary">Smart copy to eBay</Badge>
                <Badge variant="secondary">CSV fallback</Badge>
                <Badge variant="secondary">Facebook package</Badge>
                <Badge variant="secondary">Etsy package</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageTransition>

      {/* Draft Editor Modal */}
      {currentDraft && (
        <ListingDraftEditor
          open={editorOpen}
          onOpenChange={setEditorOpen}
          draft={currentDraft}
          item={currentItem}
          marketReport={currentMarketReport}
          onSave={handleSaveDraft}
          onPublish={handlePublishFromEditor}
          onRegenerate={handleRegenerateDraftField}
          saving={draftManager.saving}
          generating={draftManager.generating}
          ebayConnected={true}
        />
      )}

      {/* Smart Copy Modal (single item) */}
      {smartCopyDraft && (
        <EbaySmartCopy
          open={smartCopyOpen}
          onOpenChange={setSmartCopyOpen}
          draft={smartCopyDraft}
          onMarkListed={handleMarkListed}
        />
      )}

      {/* Bulk CSV Flow (multi-item via eBay File Exchange) */}
      {batchCsvDrafts.length > 0 && (
        <EbayBatchCsvFlow
          open={batchCsvOpen}
          onOpenChange={setBatchCsvOpen}
          drafts={batchCsvDrafts}
          onMarkListed={handleBatchMarkListed}
        />
      )}

      <FeedbackWidget context="listings" />
    </Layout>
  );
}
