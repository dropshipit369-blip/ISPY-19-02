import React, { useCallback, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  FileSpreadsheet,
  Download,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatAud } from "@/lib/utils";
import { downloadCsvFile } from "@/lib/download";
import type { ListingDraftData } from "@/hooks/useListingDraft";

interface EbayBatchCsvFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drafts: ListingDraftData[];
  onMarkListed: (drafts: ListingDraftData[]) => void;
}

const CONDITION_LABELS: Record<string, string> = {
  "1000": "New",
  "1500": "Like New",
  "2000": "Excellent",
  "2500": "Very Good",
  "3000": "Good",
  "4000": "Acceptable",
  "7000": "For Parts",
};

// Convert HTML description to plain text for CSV
function htmlToPlainText(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div|h[1-6]|ul|ol|li)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Build item specifics columns for eBay File Exchange
// Format: C:AttributeName (e.g. C:Brand, C:Model)
function specificsToColumns(
  specifics: Record<string, string>,
): Record<string, string> {
  const cols: Record<string, string> = {};
  for (const [key, value] of Object.entries(specifics)) {
    cols[`C:${key}`] = value;
  }
  return cols;
}

export const EbayBatchCsvFlow: React.FC<EbayBatchCsvFlowProps> = ({
  open,
  onOpenChange,
  drafts,
  onMarkListed,
}) => {
  const [downloaded, setDownloaded] = useState(false);

  const stats = useMemo(() => {
    const total = drafts.length;
    const totalValue = drafts.reduce((sum, d) => sum + (d.price || 0), 0);
    const validCount = drafts.filter(
      (d) =>
        d.title &&
        d.title.length > 0 &&
        d.title.length <= 80 &&
        d.price > 0,
    ).length;
    const invalidCount = total - validCount;
    return { total, totalValue, validCount, invalidCount };
  }, [drafts]);

  const handleDownloadCsv = useCallback(async () => {
    // Collect all unique item specifics keys across drafts for consistent columns
    const allSpecifics = new Set<string>();
    drafts.forEach((d) => {
      Object.keys(d.item_specifics).forEach((k) => allSpecifics.add(k));
    });

    const specificsCols = Array.from(allSpecifics).map((k) => `C:${k}`);

    // eBay File Exchange AU schema
    const baseCols = [
      "Action",
      "Title",
      "Description",
      "Format",
      "Duration",
      "StartPrice",
      "BuyItNowPrice",
      "Quantity",
      "ConditionID",
      "ConditionDescription",
      "Category",
      "Location",
      "PostalCode",
      "Country",
      "Currency",
      "PicURL",
      "PaymentProfileName",
      "ReturnProfileName",
      "ShippingProfileName",
      "DispatchTimeMax",
    ];

    const headers = [...baseCols, ...specificsCols];

    const rows: string[][] = [headers];

    for (const draft of drafts) {
      const format = draft.listing_format === "AUCTION" ? "Auction" : "FixedPrice";
      const startPrice = draft.listing_format === "AUCTION" ? draft.price.toFixed(2) : "";
      const binPrice = draft.listing_format === "FIXED_PRICE" ? draft.price.toFixed(2) : "";
      const plainDesc = htmlToPlainText(draft.description);

      // Keep basic HTML in description for eBay (it renders HTML in listings)
      const htmlDesc = draft.description ?? plainDesc;

      const specCols = specificsToColumns(draft.item_specifics);
      const specValues = specificsCols.map((col) => {
        const key = col.replace(/^C:/, "");
        return specCols[col] ?? draft.item_specifics[key] ?? "";
      });

      const row = [
        "Add", // Action
        draft.title.slice(0, 80), // Title
        htmlDesc, // Description (HTML allowed)
        format, // Format
        draft.duration ?? "GTC", // Duration
        startPrice, // StartPrice (auction only)
        binPrice, // BuyItNowPrice (fixed price only)
        draft.quantity.toString(), // Quantity
        draft.condition_id ?? "3000", // ConditionID
        draft.condition_description ?? "", // ConditionDescription
        draft.category_id ?? draft.category_name ?? "", // Category
        draft.location ?? "Australia", // Location
        draft.postcode ?? "", // PostalCode
        "AU", // Country
        draft.currency, // Currency
        draft.photos[0] ?? "", // PicURL (main image)
        "", // PaymentProfileName (user configures in eBay)
        "", // ReturnProfileName (user configures in eBay)
        "", // ShippingProfileName (user configures in eBay)
        "3", // DispatchTimeMax (3 business days default)
        ...specValues, // Item specifics columns
      ];

      rows.push(row);
    }

    const filename = `ebay-ai-listings-${stats.total}-items-${new Date().toISOString().split("T")[0]}.csv`;
    await downloadCsvFile(filename, rows);

    setDownloaded(true);
    toast.success(
      `CSV downloaded — ${stats.total} listings ready for eBay File Exchange`,
    );
  }, [drafts, stats.total]);

  const handleOpenEbayFileExchange = useCallback(() => {
    window.open(
      "https://www.ebay.com.au/sh/reports/uploads",
      "_blank",
    );
  }, []);

  const handleDone = useCallback(() => {
    onMarkListed(drafts);
    setDownloaded(false);
    onOpenChange(false);
  }, [drafts, onMarkListed, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Bulk Upload to eBay
          </DialogTitle>
          <DialogDescription>
            {stats.total} AI-generated listings ready for eBay File Exchange
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-primary/10 text-center">
              <p className="text-2xl font-bold text-primary">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Listings</p>
            </div>
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/10 text-center">
              <p className="text-2xl font-bold text-green-600">
                {stats.validCount}
              </p>
              <p className="text-xs text-muted-foreground">Ready</p>
            </div>
            <div className="p-3 rounded-lg bg-primary/10 text-center">
              <p className="text-lg font-bold">
                {formatAud(stats.totalValue)}
              </p>
              <p className="text-xs text-muted-foreground">Total value</p>
            </div>
          </div>

          {/* Invalid warning */}
          {stats.invalidCount > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-700 dark:text-amber-400">
                {stats.invalidCount} listing{stats.invalidCount === 1 ? "" : "s"}{" "}
                may fail (title {">"} 80 chars or price $0). Edit before upload.
              </div>
            </div>
          )}

          <Separator />

          {/* Step 1: Download */}
          <div
            className={`p-4 rounded-lg border transition-all ${
              downloaded
                ? "bg-green-50 dark:bg-green-900/10 border-green-200"
                : "bg-secondary/50 border-border"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  downloaded
                    ? "bg-green-600 text-white"
                    : "bg-primary text-primary-foreground"
                }`}
              >
                {downloaded ? <CheckCircle2 className="w-4 h-4" /> : "1"}
              </div>
              <div>
                <p className="font-medium text-sm">
                  Download eBay File Exchange CSV
                </p>
                <p className="text-xs text-muted-foreground">
                  AI-generated titles, descriptions, specifics, categories
                </p>
              </div>
            </div>
            <Button
              onClick={handleDownloadCsv}
              variant={downloaded ? "outline" : "hero"}
              className="w-full"
            >
              <Download className="w-4 h-4 mr-2" />
              {downloaded ? "Download Again" : "Download CSV"}
            </Button>
          </div>

          {/* Step 2: Upload to eBay */}
          <div
            className={`p-4 rounded-lg border transition-all ${
              downloaded ? "bg-secondary/50 border-border" : "opacity-50"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <p className="font-medium text-sm">
                  Upload to eBay Seller Hub
                </p>
                <p className="text-xs text-muted-foreground">
                  Go to Seller Hub → Reports → Uploads → File Exchange
                </p>
              </div>
            </div>
            <Button
              onClick={handleOpenEbayFileExchange}
              variant="outline"
              className="w-full"
              disabled={!downloaded}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Open eBay Seller Hub
            </Button>
          </div>

          {/* Info: File Exchange requirement */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
              <p className="font-medium">
                File Exchange subscription required
              </p>
              <p>
                eBay charges ~A$4.95/month for bulk CSV uploads. Without it, use
                single-item flow (1 item at a time) — free.
              </p>
            </div>
          </div>

          {/* Done button */}
          {downloaded && (
            <Button onClick={handleDone} variant="hero" className="w-full">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Mark All as Listed
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
