import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatAud, formatAudRange } from "@/lib/utils";
import {
  Package,
  Edit2,
  Save,
  X,
  Trash2,
  Loader2,
  Calendar,
  Camera,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  Barcode,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface ItemDetailModalProps {
  item: Tables<"items">;
  marketReport?: Tables<"market_reports"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  onDelete: () => void;
  fullScreen?: boolean;
}

export function ItemDetailModal({
  item,
  marketReport,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
  fullScreen = false,
}: ItemDetailModalProps) {
  const resolvedStatus = item.status || "pending";
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: item.title || "",
    brand: item.brand || "",
    model: item.model || "",
    category: item.category || "",
    condition: item.condition || "",
    purchase_price: item.purchase_price?.toString() || "",
    sale_price: item.sale_price?.toString() || "",
    status: resolvedStatus,
    notes: item.notes || "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Reset form when item changes
  useEffect(() => {
    setFormData({
      title: item.title || "",
      brand: item.brand || "",
      model: item.model || "",
      category: item.category || "",
      condition: item.condition || "",
      purchase_price: item.purchase_price?.toString() || "",
      sale_price: item.sale_price?.toString() || "",
      status: item.status || "pending",
      notes: item.notes || "",
    });
    setFormErrors({});
    setHasUnsavedChanges(false);
  }, [item]);

  // Track unsaved changes
  useEffect(() => {
    const originalData = {
      title: item.title || "",
      brand: item.brand || "",
      model: item.model || "",
      category: item.category || "",
      condition: item.condition || "",
      purchase_price: item.purchase_price?.toString() || "",
      sale_price: item.sale_price?.toString() || "",
      status: item.status || "pending",
      notes: item.notes || "",
    };
    const hasChanges = Object.keys(formData).some(
      (key) => formData[key as keyof typeof formData] !== originalData[key as keyof typeof originalData],
    );
    setHasUnsavedChanges(hasChanges);
  }, [formData, item]);

  // Form validation
  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};

    if (!formData.title.trim()) {
      errors.title = "Title is required";
    }

    if (formData.purchase_price && isNaN(parseFloat(formData.purchase_price))) {
      errors.purchase_price = "Purchase price must be a valid number";
    }

    if (formData.sale_price && isNaN(parseFloat(formData.sale_price))) {
      errors.sale_price = "Sale price must be a valid number";
    }

    const purchasePrice = parseFloat(formData.purchase_price || "0");
    const salePrice = parseFloat(formData.sale_price || "0");

    if (salePrice > 0 && purchasePrice > salePrice) {
      errors.sale_price = "Sale price should be higher than purchase price";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error("Please fix the form errors before saving");
      return;
    }

    setSaving(true);
    try {
      const updateData: any = {
        title: formData.title || null,
        brand: formData.brand || null,
        model: formData.model || null,
        category: formData.category || null,
        condition: formData.condition || null,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
        status: formData.status,
        notes: formData.notes || null,
        updated_at: new Date().toISOString(),
      };

      // Set sold_at timestamp if status changed to sold
      if (formData.status === "sold" && item.status !== "sold") {
        updateData.sold_at = new Date().toISOString();
      }

      const { error } = await supabase.from("items").update(updateData).eq("id", item.id);

      if (error) throw error;

      toast.success("Item updated successfully");
      setIsEditing(false);
      setHasUnsavedChanges(false);
      onUpdate();
    } catch (error: any) {
      console.error("Update error:", error);
      toast.error(error.message || "Failed to update item");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm("Are you sure you want to delete this item? This action cannot be undone.");
    if (!confirmed) return;

    setDeleting(true);
    try {
      const { error } = await supabase.from("items").delete().eq("id", item.id);

      if (error) throw error;

      toast.success("Item deleted successfully");
      onOpenChange(false);
      onDelete();
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error(error.message || "Failed to delete item");
    } finally {
      setDeleting(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type and size
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size should be less than 5MB");
      return;
    }

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please log in to upload images");
        return;
      }
      
      const fileExt = file.name.split(".").pop();
      const fileName = `${item.id}-${Date.now()}.${fileExt}`;
      // Use user_id as first folder for RLS compatibility
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage.from("item-images").upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("item-images").getPublicUrl(filePath);

      const { error: updateError } = await supabase.from("items").update({ image_url: publicUrl }).eq("id", item.id);

      if (updateError) throw updateError;

      toast.success("Image uploaded successfully");
      onUpdate();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm("You have unsaved changes. Are you sure you want to cancel?");
      if (!confirmed) return;
    }
    setIsEditing(false);
    setFormErrors({});
    setFormData({
      title: item.title || "",
      brand: item.brand || "",
      model: item.model || "",
      category: item.category || "",
      condition: item.condition || "",
      purchase_price: item.purchase_price?.toString() || "",
      sale_price: item.sale_price?.toString() || "",
      status: item.status || "pending",
      notes: item.notes || "",
    });
    setHasUnsavedChanges(false);
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "listed":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Listed
          </Badge>
        );
      case "sold":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Sold</Badge>;
      case "pending":
        return (
          <Badge variant="outline" className="border-yellow-200 text-yellow-800">
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  const profit =
    (parseFloat(formData.sale_price || "0") || item.sale_price || 0) -
    (parseFloat(formData.purchase_price || "0") || item.purchase_price || 0);
  const profitMargin = profit > 0 && (item.purchase_price || 0) > 0 ? (profit / (item.purchase_price || 1)) * 100 : 0;

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === "Escape" && isEditing) {
        handleCancel();
      } else if (e.key === "s" && (e.ctrlKey || e.metaKey) && isEditing) {
        e.preventDefault();
        handleSave();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, isEditing]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          fullScreen
            ? "w-screen max-w-none h-[100dvh] max-h-[100dvh] rounded-none border-0 overflow-y-auto p-6"
            : "max-w-2xl max-h-[90vh] overflow-y-auto"
        }
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Item Details
              {hasUnsavedChanges && <AlertTriangle className="w-4 h-4 text-yellow-500" />}
            </span>
            <div className="flex items-center gap-2">
              {!isEditing ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" size="sm" onClick={handleCancel}>
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                  <Button variant="default" size="sm" onClick={handleSave} disabled={saving || !hasUnsavedChanges}>
                    {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                    Save
                  </Button>
                </>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Image & Status */}
          <div className="flex gap-4">
            <div className="relative w-32 h-32 rounded-lg bg-secondary overflow-hidden flex-shrink-0 group">
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
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              {isEditing && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      disabled={uploading}
                    />
                    {uploading ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <Camera className="w-6 h-6 text-white" />
                    )}
                  </label>
                </div>
              )}
            </div>
            <div className="flex-1">
              {isEditing ? (
                <div>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Item title"
                    className={`text-lg font-semibold mb-2 ${formErrors.title ? "border-red-500" : ""}`}
                  />
                  {formErrors.title && <p className="text-red-500 text-xs">{formErrors.title}</p>}
                </div>
              ) : (
                <h3 className="text-lg font-semibold mb-2">{item.title || "Untitled Item"}</h3>
              )}
              <div className="flex items-center gap-2 mb-2">
                {isEditing ? (
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="listed">Listed</SelectItem>
                      <SelectItem value="sold">Sold</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  getStatusBadge(item.status)
                )}
                {item.sold_at && (
                  <span className="text-xs text-muted-foreground">
                    Sold {format(new Date(item.sold_at), "MMM d, yyyy")}
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Added {format(new Date(item.created_at), "MMM d, yyyy")}
                {item.updated_at && item.updated_at !== item.created_at && (
                  <span className="ml-2">• Updated {format(new Date(item.updated_at), "MMM d, yyyy")}</span>
                )}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">Brand</Label>
              {isEditing ? (
                <Input
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  placeholder="Brand"
                />
              ) : (
                <p className="font-medium">{item.brand || "—"}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Model</Label>
              {isEditing ? (
                <Input
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="Model"
                />
              ) : (
                <p className="font-medium">{item.model || "—"}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Category</Label>
              {isEditing ? (
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Category"
                />
              ) : (
                <p className="font-medium">{item.category || "—"}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Condition</Label>
              {isEditing ? (
                <Select
                  value={formData.condition}
                  onValueChange={(value) => setFormData({ ...formData, condition: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="like new">Like New</SelectItem>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="very good">Very Good</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="acceptable">Acceptable</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="outline" className="capitalize">
                  {item.condition || "—"}
                </Badge>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 border">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <Label className="text-muted-foreground text-xs">Purchase Price</Label>
                {isEditing ? (
                  <div>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.purchase_price}
                      onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                      placeholder="0.00"
                      className={`text-center ${formErrors.purchase_price ? "border-red-500" : ""}`}
                    />
                    {formErrors.purchase_price && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.purchase_price}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xl font-bold">{formatAud(item.purchase_price ?? 0)}</p>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Sale Price</Label>
                {isEditing ? (
                  <div>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.sale_price}
                      onChange={(e) => setFormData({ ...formData, sale_price: e.target.value })}
                      placeholder="0.00"
                      className={`text-center ${formErrors.sale_price ? "border-red-500" : ""}`}
                    />
                    {formErrors.sale_price && <p className="text-red-500 text-xs mt-1">{formErrors.sale_price}</p>}
                  </div>
                ) : (
                  <p className="text-xl font-bold text-green-600">{formatAud(item.sale_price ?? 0)}</p>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Profit</Label>
                <p className={`text-xl font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatAud(profit, { showPlus: true })}
                </p>
                {profitMargin > 0 && <p className="text-xs text-muted-foreground">{profitMargin.toFixed(0)}% ROI</p>}
              </div>
            </div>
          </div>

          {/* Market Report */}
          {marketReport && (
            <div className="p-4 rounded-lg bg-secondary/50 border">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Market Analysis
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Price Range:</span>
                  <p className="font-medium">{formatAudRange(marketReport.low_price, marketReport.high_price)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Suggested Price:</span>
                  <p className="font-medium text-green-600">{formatAud(marketReport.suggested_price)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Best Marketplace:</span>
                  <p className="font-medium">{marketReport.best_marketplace || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Trend:</span>
                  <p className="font-medium flex items-center gap-1">
                    {marketReport.price_trend === "up" ? (
                      <TrendingUp className="w-4 h-4 text-green-500" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    )}
                    {marketReport.trend_percentage}%
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Avg. Days to Sell:</span>
                  <p className="font-medium">{marketReport.avg_days_to_sell || "—"} days</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Confidence:</span>
                  <p className="font-medium">{marketReport.confidence_score}%</p>
                </div>
              </div>
              {marketReport.suggested_title && (
                <div className="mt-3 pt-3 border-t">
                  <span className="text-muted-foreground text-xs">Suggested Title:</span>
                  <p className="text-sm font-medium">{marketReport.suggested_title}</p>
                </div>
              )}
            </div>
          )}

          {/* Barcode */}
          {item.barcode && (
            <div className="flex items-center gap-2 text-sm">
              <Barcode className="w-4 h-4 text-muted-foreground" />
              <span className="text-muted-foreground">Barcode:</span>
              <code className="bg-secondary px-2 py-1 rounded text-xs">{item.barcode}</code>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label className="text-muted-foreground text-xs">Notes</Label>
            {isEditing ? (
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add notes about this item..."
                rows={3}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{item.notes || "No notes"}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
