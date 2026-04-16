import React, { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Sparkles,
  RefreshCw,
  Save,
  Send,
  Image,
  Tag,
  Package,
  Truck,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  X,
  Plus,
  GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import { formatAud } from "@/lib/utils";
import type { ListingDraftData } from "@/hooks/useListingDraft";
import type { Item, MarketReport } from "@/lib/types";

interface ListingDraftEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: ListingDraftData;
  item: Item | null;
  marketReport: MarketReport | null;
  onSave: (draft: ListingDraftData) => Promise<string | null>;
  onPublish: (draft: ListingDraftData) => void;
  onRegenerate: (
    field: "title" | "description" | "all",
  ) => Promise<Partial<ListingDraftData> | null>;
  saving: boolean;
  generating: boolean;
  ebayConnected: boolean;
}

export const ListingDraftEditor: React.FC<ListingDraftEditorProps> = ({
  open,
  onOpenChange,
  draft: initialDraft,
  item,
  marketReport,
  onSave,
  onPublish,
  onRegenerate,
  saving,
  generating,
  ebayConnected,
}) => {
  const [draft, setDraft] = useState<ListingDraftData>(initialDraft);
  const [activeTab, setActiveTab] = useState("details");
  const [hasChanges, setHasChanges] = useState(false);
  const [newSpecificKey, setNewSpecificKey] = useState("");
  const [newSpecificValue, setNewSpecificValue] = useState("");

  // Sync draft when prop changes
  useEffect(() => {
    setDraft(initialDraft);
    setHasChanges(false);
  }, [initialDraft]);

  const updateField = useCallback(
    <K extends keyof ListingDraftData>(
      field: K,
      value: ListingDraftData[K],
    ) => {
      setDraft((prev) => ({ ...prev, [field]: value }));
      setHasChanges(true);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    const id = await onSave(draft);
    if (id) {
      setDraft((prev) => ({ ...prev, id }));
      setHasChanges(false);
      toast.success("Draft saved");
    }
  }, [draft, onSave]);

  const handleRegenerate = useCallback(
    async (field: "title" | "description" | "all") => {
      const updates = await onRegenerate(field);
      if (updates) {
        setDraft((prev) => ({ ...prev, ...updates }));
        setHasChanges(true);
        toast.success(
          `${field === "all" ? "Listing" : field.charAt(0).toUpperCase() + field.slice(1)} regenerated`,
        );
      }
    },
    [onRegenerate],
  );

  const addItemSpecific = useCallback(() => {
    if (!newSpecificKey.trim()) return;
    setDraft((prev) => ({
      ...prev,
      item_specifics: {
        ...prev.item_specifics,
        [newSpecificKey.trim()]: newSpecificValue.trim(),
      },
    }));
    setNewSpecificKey("");
    setNewSpecificValue("");
    setHasChanges(true);
  }, [newSpecificKey, newSpecificValue]);

  const removeItemSpecific = useCallback((key: string) => {
    setDraft((prev) => {
      const updated = { ...prev.item_specifics };
      delete updated[key];
      return { ...prev, item_specifics: updated };
    });
    setHasChanges(true);
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            {draft.id ? "Edit Listing Draft" : "New eBay Listing"}
            {draft.ai_generated && (
              <Badge variant="secondary" className="ml-2 text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                AI Generated
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Review and edit before publishing to eBay Australia
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="specifics">Specifics</TabsTrigger>
            <TabsTrigger value="shipping">Shipping</TabsTrigger>
          </TabsList>

          {/* === DETAILS TAB === */}
          <TabsContent value="details" className="space-y-5 mt-4">
            {/* Title */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="title">
                  Listing Title{" "}
                  <span className="text-muted-foreground">(max 80 chars)</span>
                </Label>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs ${draft.title.length > 80 ? "text-red-500 font-semibold" : "text-muted-foreground"}`}
                  >
                    {draft.title.length}/80
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRegenerate("title")}
                    disabled={generating}
                  >
                    {generating ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    <span className="ml-1 text-xs">Regenerate</span>
                  </Button>
                </div>
              </div>
              <Input
                id="title"
                value={draft.title}
                onChange={(e) => updateField("title", e.target.value)}
                maxLength={80}
                placeholder="e.g. Apple iPhone 14 Pro 128GB Space Black Excellent Condition"
              />
              {draft.title.length > 80 && (
                <p className="text-xs text-red-500">
                  Title exceeds 80 characters — eBay will reject it
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="description">Description</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRegenerate("description")}
                  disabled={generating}
                >
                  {generating ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span className="ml-1 text-xs">Regenerate</span>
                </Button>
              </div>
              <Textarea
                id="description"
                value={draft.description ?? ""}
                onChange={(e) => updateField("description", e.target.value)}
                rows={8}
                placeholder="Item description (HTML supported)"
                className="font-mono text-sm"
              />
            </div>

            <Separator />

            {/* Price, Format, Condition */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price (AUD)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={draft.price || ""}
                  onChange={(e) =>
                    updateField("price", parseFloat(e.target.value) || 0)
                  }
                />
                {marketReport?.suggested_price && (
                  <p className="text-xs text-muted-foreground">
                    Suggested:{" "}
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() =>
                        updateField("price", marketReport.suggested_price!)
                      }
                    >
                      {formatAud(marketReport.suggested_price)}
                    </button>
                    {marketReport.low_price && marketReport.high_price && (
                      <span>
                        {" "}
                        (range: {formatAud(marketReport.low_price)} –{" "}
                        {formatAud(marketReport.high_price)})
                      </span>
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Format</Label>
                <Select
                  value={draft.listing_format}
                  onValueChange={(v) =>
                    updateField(
                      "listing_format",
                      v as "FIXED_PRICE" | "AUCTION",
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FIXED_PRICE">
                      Buy It Now (Fixed)
                    </SelectItem>
                    <SelectItem value="AUCTION">Auction</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Condition</Label>
                <Select
                  value={draft.condition_id}
                  onValueChange={(v) => updateField("condition_id", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1000">New</SelectItem>
                    <SelectItem value="1500">Like New</SelectItem>
                    <SelectItem value="2000">Excellent</SelectItem>
                    <SelectItem value="2500">Very Good</SelectItem>
                    <SelectItem value="3000">Good</SelectItem>
                    <SelectItem value="4000">Acceptable</SelectItem>
                    <SelectItem value="7000">For Parts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Duration</Label>
                <Select
                  value={draft.duration}
                  onValueChange={(v) => updateField("duration", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GTC">Good 'Til Cancelled</SelectItem>
                    <SelectItem value="DAYS_3">3 Days</SelectItem>
                    <SelectItem value="DAYS_5">5 Days</SelectItem>
                    <SelectItem value="DAYS_7">7 Days</SelectItem>
                    <SelectItem value="DAYS_10">10 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Quantity & Category */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  value={draft.quantity}
                  onChange={(e) =>
                    updateField("quantity", parseInt(e.target.value) || 1)
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={draft.category_name ?? ""}
                  onChange={(e) => updateField("category_name", e.target.value)}
                  placeholder="e.g. Cell Phones & Smartphones"
                />
                {draft.category_id && (
                  <p className="text-xs text-muted-foreground">
                    ID: {draft.category_id}
                  </p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* === PHOTOS TAB === */}
          <TabsContent value="photos" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label>
                Photos{" "}
                <span className="text-muted-foreground">
                  ({draft.photos.length}/12)
                </span>
              </Label>
              <p className="text-xs text-muted-foreground">
                First photo is the main image. Drag to reorder.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {draft.photos.map((url, index) => (
                <div
                  key={index}
                  className="relative aspect-square rounded-lg border bg-secondary overflow-hidden group"
                >
                  <img
                    src={url}
                    alt={`Photo ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:text-white hover:bg-white/20"
                      onClick={() => {
                        const updated = draft.photos.filter(
                          (_, i) => i !== index,
                        );
                        updateField("photos", updated);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  {index === 0 && (
                    <Badge className="absolute top-2 left-2 text-xs">
                      Main
                    </Badge>
                  )}
                  <div className="absolute top-2 right-2 cursor-grab">
                    <GripVertical className="w-4 h-4 text-white drop-shadow" />
                  </div>
                </div>
              ))}

              {draft.photos.length < 12 && (
                <button
                  type="button"
                  className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors"
                  onClick={() => {
                    // Photos come from the scanned item — add from item
                    if (item?.image_url && !draft.photos.includes(item.image_url)) {
                      updateField("photos", [...draft.photos, item.image_url]);
                    }
                  }}
                >
                  <Plus className="w-6 h-6 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Add Photo
                  </span>
                </button>
              )}
            </div>
          </TabsContent>

          {/* === ITEM SPECIFICS TAB === */}
          <TabsContent value="specifics" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <Label>Item Specifics</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRegenerate("all")}
                disabled={generating}
              >
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                AI Fill
              </Button>
            </div>

            <div className="space-y-2">
              {Object.entries(draft.item_specifics).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <Input
                    value={key}
                    readOnly
                    className="w-32 text-sm bg-secondary"
                  />
                  <Input
                    value={value}
                    onChange={(e) => {
                      setDraft((prev) => ({
                        ...prev,
                        item_specifics: {
                          ...prev.item_specifics,
                          [key]: e.target.value,
                        },
                      }));
                      setHasChanges(true);
                    }}
                    className="flex-1 text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeItemSpecific(key)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add new specific */}
            <div className="flex items-center gap-2">
              <Input
                value={newSpecificKey}
                onChange={(e) => setNewSpecificKey(e.target.value)}
                placeholder="Name (e.g. Material)"
                className="w-32 text-sm"
              />
              <Input
                value={newSpecificValue}
                onChange={(e) => setNewSpecificValue(e.target.value)}
                placeholder="Value (e.g. Leather)"
                className="flex-1 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addItemSpecific();
                }}
              />
              <Button variant="outline" size="icon" onClick={addItemSpecific}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </TabsContent>

          {/* === SHIPPING TAB === */}
          <TabsContent value="shipping" className="space-y-5 mt-4">
            {/* Domestic Shipping */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Truck className="w-4 h-4" />
                Domestic Shipping
              </Label>
              <div className="flex items-center gap-3">
                <Label htmlFor="free-shipping" className="text-sm">
                  Free shipping
                </Label>
                <Switch
                  id="free-shipping"
                  checked={draft.shipping.domestic.free}
                  onCheckedChange={(checked) =>
                    updateField("shipping", {
                      ...draft.shipping,
                      domestic: {
                        ...draft.shipping.domestic,
                        free: checked,
                        cost: checked ? 0 : draft.shipping.domestic.cost,
                      },
                    })
                  }
                />
              </div>
              {!draft.shipping.domestic.free && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Shipping Cost (AUD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={draft.shipping.domestic.cost}
                      onChange={(e) =>
                        updateField("shipping", {
                          ...draft.shipping,
                          domestic: {
                            ...draft.shipping.domestic,
                            cost: parseFloat(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Shipping Service</Label>
                    <Select
                      value={draft.shipping.domestic.service}
                      onValueChange={(v) =>
                        updateField("shipping", {
                          ...draft.shipping,
                          domestic: { ...draft.shipping.domestic, service: v },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AU_StandardDelivery">
                          Standard
                        </SelectItem>
                        <SelectItem value="AU_Express">Express</SelectItem>
                        <SelectItem value="AU_RegisteredPost">
                          Registered Post
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Location */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={draft.location ?? ""}
                  onChange={(e) => updateField("location", e.target.value)}
                  placeholder="e.g. Melbourne, VIC"
                />
              </div>
              <div className="space-y-2">
                <Label>Postcode</Label>
                <Input
                  value={draft.postcode ?? ""}
                  onChange={(e) => updateField("postcode", e.target.value)}
                  placeholder="e.g. 3000"
                />
              </div>
            </div>

            <Separator />

            {/* Return Policy */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4" />
                Return Policy
              </Label>
              <div className="flex items-center gap-3">
                <Label htmlFor="returns-accepted" className="text-sm">
                  Returns accepted
                </Label>
                <Switch
                  id="returns-accepted"
                  checked={draft.return_policy.accepted}
                  onCheckedChange={(checked) =>
                    updateField("return_policy", {
                      ...draft.return_policy,
                      accepted: checked,
                    })
                  }
                />
              </div>
              {draft.return_policy.accepted && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Return Period</Label>
                    <Select
                      value={draft.return_policy.period}
                      onValueChange={(v) =>
                        updateField("return_policy", {
                          ...draft.return_policy,
                          period: v,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="14_DAYS">14 Days</SelectItem>
                        <SelectItem value="30_DAYS">30 Days</SelectItem>
                        <SelectItem value="60_DAYS">60 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Refund Method</Label>
                    <Select
                      value={draft.return_policy.refund_method}
                      onValueChange={(v) =>
                        updateField("return_policy", {
                          ...draft.return_policy,
                          refund_method: v,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MONEY_BACK">Money Back</SelectItem>
                        <SelectItem value="EXCHANGE">
                          Exchange / Replace
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* === ACTION BAR === */}
        <div className="flex items-center justify-between pt-4 border-t mt-4">
          <div className="flex items-center gap-2 text-sm">
            {draft.status === "failed" && (
              <div className="flex items-center gap-1 text-red-500">
                <AlertCircle className="w-4 h-4" />
                <span>Failed to publish</span>
              </div>
            )}
            {draft.status === "published" && (
              <div className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="w-4 h-4" />
                <span>Published</span>
              </div>
            )}
            {hasChanges && (
              <Badge variant="outline" className="text-xs">
                Unsaved changes
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={saving || !hasChanges}
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Draft
            </Button>
            <Button
              variant="hero"
              onClick={() => onPublish(draft)}
              disabled={
                draft.title.length === 0 ||
                draft.title.length > 80 ||
                draft.price <= 0 ||
                generating
              }
            >
              <Send className="w-4 h-4 mr-2" />
              Copy & List on eBay
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
