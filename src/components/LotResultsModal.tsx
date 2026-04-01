import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Store,
  Clock,
  CheckCircle2,
  Loader2,
  Package,
  ChevronDown,
  ChevronUp,
  Brain,
} from "lucide-react";
import { FeedbackModal } from "@/components/FeedbackModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { MarketReportDraft } from "@/lib/types";
import { buildMarketReportInsertPayload } from "@/lib/market-report";
import { formatAud, formatAudRange } from "@/lib/utils";

interface AnalysisResult {
  title: string;
  brand: string | null;
  model: string | null;
  category: string;
  color: string | null;
  condition: string;
  condition_score: number;
  extracted_text: string | null;
}

interface LotItem {
  analysis: AnalysisResult;
  marketReport: MarketReportDraft;
  purchasePrice?: string;
  listingPrice?: string;
  notes?: string;
  expanded?: boolean;
}

interface LotResultsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: LotItem[];
  imagePreview: string;
  userId: string;
}

export function LotResultsModal({
  open,
  onOpenChange,
  items: initialItems,
  imagePreview,
  userId,
}: LotResultsModalProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<LotItem[]>(
    initialItems.map((item, i) => ({
      ...item,
      expanded: i === 0,
      purchasePrice: "",
      listingPrice: "",
      notes: "",
    }))
  );
  const [saving, setSaving] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Set<number>>(
    new Set(initialItems.map((_, i) => i))
  );
  const [feedbackIndex, setFeedbackIndex] = useState<number | null>(null);

  const toggleExpand = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, expanded: !item.expanded } : item
      )
    );
  };

  const toggleSelect = (index: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const updateItemField = (
    index: number,
    field: "purchasePrice" | "listingPrice" | "notes",
    value: string,
  ) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const handleSaveAll = async () => {
    if (selectedItems.size === 0) {
      toast.error("Please select at least one item to save");
      return;
    }

    setSaving(true);
    try {
      // Upload image once
      const base64Data = imagePreview.split(",")[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/jpeg" });

      const fileName = `${userId}/lot-${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("item-images")
        .upload(fileName, blob, {
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) throw new Error("Failed to upload image");

      const { data: urlData } = supabase.storage
        .from("item-images")
        .getPublicUrl(fileName);
      const imageUrl = urlData.publicUrl;

      let savedCount = 0;
      for (const index of selectedItems) {
        const item = items[index];
        // Clamp condition_score to valid range (1-10)
        const conditionScore = item.analysis.condition_score
          ? Math.max(1, Math.min(10, item.analysis.condition_score))
          : null;

        const { data: savedItem, error: itemError } = await supabase
          .from("items")
          .insert({
            user_id: userId,
            image_url: imageUrl,
            title: item.analysis.title,
            brand: item.analysis.brand,
            model: item.analysis.model,
            category: item.analysis.category,
            color: item.analysis.color,
            condition: item.analysis.condition,
            condition_score: conditionScore,
            extracted_text: item.analysis.extracted_text,
            purchase_price: item.purchasePrice ? parseFloat(item.purchasePrice) : null,
            notes: item.notes?.trim() || null,
            status: "pending",
          })
          .select()
          .single();

        if (itemError) {
          console.error("Error saving item:", itemError);
          continue;
        }

        if (savedItem && item.marketReport) {
          const { error: marketReportError } = await supabase.from("market_reports").insert({
            ...buildMarketReportInsertPayload(item.marketReport, savedItem.id, item.listingPrice),
          });

          if (marketReportError) {
            console.error("Error saving market report:", marketReportError);
            continue;
          }
        }
        savedCount++;
      }

      toast.success(`Saved ${savedCount} items to inventory.`);
      onOpenChange(false);
      navigate("/inventory");
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save items");
    } finally {
      setSaving(false);
    }
  };

  const totalValue = items
    .filter((_, i) => selectedItems.has(i))
    .reduce((sum, item) => sum + (item.marketReport?.suggested_price || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <div className="p-6 pb-2 border-b">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Lot Analysis - {items.length} Items Found
            </DialogTitle>
          </DialogHeader>

          <div className="bg-gradient-to-r from-primary/10 to-info/10 rounded-xl p-4 mt-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-sm text-muted-foreground">Selected Items</div>
                <div className="text-lg font-semibold">{selectedItems.size} of {items.length}</div>
              </div>
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Total Estimated Value</div>
                <div className="text-2xl font-bold text-primary">{formatAud(totalValue)}</div>
              </div>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 px-6">
          <div className="py-4 space-y-3">
            {items.map((item, index) => (
              <Card
                key={index}
                className={`transition-all ${selectedItems.has(index) ? "border-primary/50" : "opacity-60"
                  }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(index)}
                      onChange={() => toggleSelect(index)}
                      className="mt-1 w-4 h-4 rounded border-border"
                    />
                    <div className="flex-1">
                      <div
                        className="flex items-center justify-between cursor-pointer"
                        onClick={() => toggleExpand(index)}
                      >
                        <div>
                          <h4 className="font-medium">{item.analysis.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {item.analysis.category}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {item.analysis.condition}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Suggested</div>
                            <div className="font-bold text-primary">
                              {formatAud(item.marketReport?.suggested_price, { fallback: "N/A" })}
                            </div>
                          </div>
                          {item.expanded ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {item.expanded && (
                        <div className="mt-4 pt-4 border-t space-y-4">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                            {item.analysis.brand && (
                              <div>
                                <span className="text-muted-foreground text-xs">Brand</span>
                                <p className="font-medium">{item.analysis.brand}</p>
                              </div>
                            )}
                            {item.analysis.model && (
                              <div>
                                <span className="text-muted-foreground text-xs">Model</span>
                                <p className="font-medium">{item.analysis.model}</p>
                              </div>
                            )}
                            {item.analysis.color && (
                              <div>
                                <span className="text-muted-foreground text-xs">Color</span>
                                <p className="font-medium">{item.analysis.color}</p>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-3 gap-3 text-sm">
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <div className="text-xs text-muted-foreground">Price Range</div>
                                <div className="font-medium">
                                  {formatAudRange(item.marketReport?.low_price, item.marketReport?.high_price, {
                                    decimals: 0,
                                  })}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Store className="w-4 h-4 text-muted-foreground" />
                              <div>
                                <div className="text-xs text-muted-foreground">Best Platform</div>
                                <div className="font-medium">
                                  {item.marketReport?.best_marketplace || "eBay"}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.marketReport?.price_trend === "up" ? (
                                <TrendingUp className="w-4 h-4 text-success" />
                              ) : (
                                <TrendingDown className="w-4 h-4 text-destructive" />
                              )}
                              <div>
                                <div className="text-xs text-muted-foreground">Trend</div>
                                <div className="font-medium capitalize">
                                  {item.marketReport?.price_trend || "Stable"}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Purchase Price</Label>
                              <div className="relative mt-1">
                                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={item.purchasePrice || ""}
                                  onChange={(e) =>
                                    updateItemField(index, "purchasePrice", e.target.value)
                                  }
                                  className="pl-7 h-8 text-sm"
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-xs">Listing Price</Label>
                              <div className="relative mt-1">
                                <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder={item.marketReport?.suggested_price?.toFixed(2) || "0.00"}
                                  value={item.listingPrice || ""}
                                  onChange={(e) =>
                                    updateItemField(index, "listingPrice", e.target.value)
                                  }
                                  className="pl-7 h-8 text-sm"
                                />
                              </div>
                            </div>
                          </div>

                          <div>
                            <Label className="text-xs">Notes</Label>
                            <Textarea
                              placeholder="Add notes to save with this inventory item."
                              value={item.notes || ""}
                              onChange={(e) => updateItemField(index, "notes", e.target.value)}
                              className="mt-1 min-h-[76px] text-sm"
                            />
                          </div>

                          {/* Feedback Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFeedbackIndex(index);
                            }}
                            className="w-full mt-2 text-xs"
                          >
                            <Brain className="w-3 h-3 mr-1" />
                            Help AI Learn - Provide Feedback
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>

        <div className="p-6 border-t flex gap-3 bg-background">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="success"
            className="flex-1"
            onClick={handleSaveAll}
            disabled={saving || selectedItems.size === 0}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Save {selectedItems.size} Items
              </>
            )}
          </Button>
        </div>

        {/* Feedback Modal */}
        {feedbackIndex !== null && items[feedbackIndex] && (
          <FeedbackModal
            open={feedbackIndex !== null}
            onOpenChange={(open) => !open && setFeedbackIndex(null)}
            item={{
              name: items[feedbackIndex].analysis.title,
              brand: items[feedbackIndex].analysis.brand,
              model: items[feedbackIndex].analysis.model,
              category: items[feedbackIndex].analysis.category,
              condition: items[feedbackIndex].analysis.condition,
              lowPrice: items[feedbackIndex].marketReport?.low_price,
              highPrice: items[feedbackIndex].marketReport?.high_price,
            }}
            userId={userId}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
