import React, { useState, useCallback, useMemo, useEffect } from "react";
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
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  ChevronRight,
  Image,
  ClipboardCopy,
  CircleDot,
} from "lucide-react";
import { toast } from "sonner";
import { formatAud } from "@/lib/utils";
import type { ListingDraftData } from "@/hooks/useListingDraft";

interface EbaySmartCopyProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ListingDraftData;
  onMarkListed: (draft: ListingDraftData) => void;
}

const STEPS = [
  { id: "title", label: "Copy title", field: "title" as const },
  { id: "price", label: "Copy price", field: "price" as const },
  { id: "description", label: "Copy description", field: "description" as const },
  { id: "open", label: "Open eBay Sell page", field: null },
] as const;

const CONDITION_LABELS: Record<string, string> = {
  "1000": "New",
  "1500": "Like New",
  "2000": "Excellent",
  "2500": "Very Good",
  "3000": "Good",
  "4000": "Acceptable",
  "7000": "For Parts",
};

export const EbaySmartCopy: React.FC<EbaySmartCopyProps> = ({
  open,
  onOpenChange,
  draft,
  onMarkListed,
}) => {
  const [copiedFields, setCopiedFields] = useState<Set<string>>(new Set());
  const [currentStep, setCurrentStep] = useState(0);
  const [ebayOpened, setEbayOpened] = useState(false);

  const conditionLabel = CONDITION_LABELS[draft.condition_id] ?? "Good";

  // Auto-copy title to clipboard when modal opens so user can paste immediately
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard
          .writeText(draft.title)
          .then(() => {
            setCopiedFields((prev) => new Set(prev).add("title"));
            setCurrentStep(1);
          })
          .catch(() => {
            // Clipboard API blocked — user will tap manually
          });
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [open, draft.title]);

  const specificsText = useMemo(() => {
    return Object.entries(draft.item_specifics)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
  }, [draft.item_specifics]);

  const plainDescription = useMemo(() => {
    // Strip HTML tags for plain-text clipboard
    if (!draft.description) return "";
    return draft.description
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/?(p|div|h[1-6]|ul|ol|li)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }, [draft.description]);

  const handleCopy = useCallback(
    async (text: string, field: string) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        setCopiedFields((prev) => new Set(prev).add(field));
        toast.success(`${field} copied`);

        // Auto-advance step
        const stepIdx = STEPS.findIndex((s) => s.id === field);
        if (stepIdx >= 0 && stepIdx >= currentStep) {
          setCurrentStep(stepIdx + 1);
        }
      } catch {
        toast.error("Failed to copy");
      }
    },
    [currentStep],
  );

  const handleCopyAll = useCallback(async () => {
    const allText = [
      `Title: ${draft.title}`,
      `Price: A$${draft.price.toFixed(2)}`,
      `Condition: ${conditionLabel}`,
      draft.category_name ? `Category: ${draft.category_name}` : "",
      specificsText ? `\nItem Specifics:\n${specificsText}` : "",
      `\nDescription:\n${plainDescription}`,
    ]
      .filter(Boolean)
      .join("\n");

    await handleCopy(allText, "all");
    setCopiedFields(new Set(["title", "price", "description", "all"]));
    setCurrentStep(3);
    toast.success("All listing details copied!");
  }, [draft, conditionLabel, specificsText, plainDescription, handleCopy]);

  const handleOpenEbay = useCallback(async () => {
    // Auto-copy title first so paste is ready immediately
    if (!copiedFields.has("title")) {
      await handleCopy(draft.title, "title");
    }

    // eBay's prelist flow accepts a title param and kicks off product matching —
    // this is the closest thing to prefill eBay AU offers without API access.
    const prelistUrl = `https://www.ebay.com.au/sl/prelist/suggest?title=${encodeURIComponent(draft.title)}`;
    window.open(prelistUrl, "_blank");
    setEbayOpened(true);
    setCurrentStep(4);
    toast.success("Title copied & eBay opened — paste or continue in-page");
  }, [draft.title, copiedFields, handleCopy]);

  const handleDone = useCallback(() => {
    onMarkListed(draft);
    setCopiedFields(new Set());
    setCurrentStep(0);
    setEbayOpened(false);
    onOpenChange(false);
  }, [draft, onMarkListed, onOpenChange]);

  const handleClose = useCallback(() => {
    setCopiedFields(new Set());
    setCurrentStep(0);
    setEbayOpened(false);
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            List on eBay Australia
          </DialogTitle>
          <DialogDescription>
            AI-optimized listing ready. Copy each field and paste into eBay.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Quick Copy All */}
          <Button
            onClick={handleCopyAll}
            variant="hero"
            className="w-full"
            size="lg"
          >
            {copiedFields.has("all") ? (
              <>
                <Check className="w-4 h-4 mr-2 text-green-300" />
                All Copied!
              </>
            ) : (
              <>
                <ClipboardCopy className="w-4 h-4 mr-2" />
                Copy Everything
              </>
            )}
          </Button>

          <Separator />

          {/* Step-by-step copy fields */}
          <div className="space-y-3">
            {/* Title */}
            <CopyField
              label="Title"
              sublabel={`${draft.title.length}/80 chars`}
              value={draft.title}
              copied={copiedFields.has("title")}
              isActive={currentStep === 0}
              onCopy={() => handleCopy(draft.title, "title")}
            />

            {/* Price */}
            <CopyField
              label="Price"
              sublabel={conditionLabel}
              value={`${draft.price.toFixed(2)}`}
              displayValue={formatAud(draft.price)}
              copied={copiedFields.has("price")}
              isActive={currentStep === 1}
              onCopy={() => handleCopy(draft.price.toFixed(2), "price")}
            />

            {/* Description */}
            <CopyField
              label="Description"
              sublabel={
                draft.ai_generated ? "AI-generated" : "From scan data"
              }
              value={plainDescription}
              preview={
                plainDescription.length > 80
                  ? plainDescription.slice(0, 80) + "..."
                  : plainDescription
              }
              copied={copiedFields.has("description")}
              isActive={currentStep === 2}
              onCopy={() => handleCopy(plainDescription, "description")}
            />

            {/* Item Specifics (bonus) */}
            {specificsText && (
              <CopyField
                label="Item Specifics"
                sublabel={`${Object.keys(draft.item_specifics).length} fields`}
                value={specificsText}
                preview={specificsText.split("\n").slice(0, 2).join(", ")}
                copied={copiedFields.has("specifics")}
                isActive={false}
                onCopy={() => handleCopy(specificsText, "specifics")}
              />
            )}
          </div>

          <Separator />

          {/* Photos reminder */}
          {draft.photos.length > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
              <Image className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {draft.photos.length} photo{draft.photos.length === 1 ? "" : "s"} ready
                </p>
                <p className="text-xs text-muted-foreground">
                  Upload from your camera roll when creating the eBay listing
                </p>
              </div>
            </div>
          )}

          {/* Category hint */}
          {draft.category_name && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <CircleDot className="w-3 h-3" />
              <span>
                Suggested category: <strong>{draft.category_name}</strong>
                {draft.category_id && ` (${draft.category_id})`}
              </span>
            </div>
          )}

          {/* Open eBay + Done */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              variant={ebayOpened ? "outline" : "hero"}
              className="flex-1"
              onClick={handleOpenEbay}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {ebayOpened ? "Open eBay Again" : "Open eBay Sell Page"}
            </Button>
            {ebayOpened && (
              <Button variant="hero" className="flex-1" onClick={handleDone}>
                <Check className="w-4 h-4 mr-2" />
                Mark as Listed
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// === Reusable copy field row ===

interface CopyFieldProps {
  label: string;
  sublabel?: string;
  value: string;
  displayValue?: string;
  preview?: string;
  copied: boolean;
  isActive: boolean;
  onCopy: () => void;
}

const CopyField: React.FC<CopyFieldProps> = ({
  label,
  sublabel,
  value,
  displayValue,
  preview,
  copied,
  isActive,
  onCopy,
}) => (
  <button
    type="button"
    onClick={onCopy}
    className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all
      ${isActive ? "bg-primary/10 ring-1 ring-primary/30" : "bg-secondary/50 hover:bg-secondary"}
      ${copied ? "bg-green-50 dark:bg-green-900/10" : ""}`}
  >
    <div className="flex-shrink-0">
      {copied ? (
        <Check className="w-5 h-5 text-green-600" />
      ) : isActive ? (
        <ChevronRight className="w-5 h-5 text-primary" />
      ) : (
        <Copy className="w-5 h-5 text-muted-foreground" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        {sublabel && (
          <span className="text-xs text-muted-foreground">{sublabel}</span>
        )}
        {copied && (
          <Badge variant="secondary" className="text-xs py-0">
            copied
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground truncate">
        {preview ?? displayValue ?? value}
      </p>
    </div>
  </button>
);
