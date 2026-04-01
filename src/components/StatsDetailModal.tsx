import React, { useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package, DollarSign, Calendar } from "lucide-react";
import type { Item } from "@/lib/types";
import { format } from "date-fns";
import { formatAud } from "@/lib/utils";

interface StatsDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  items: Item[];
  onItemClick: (item: Item) => void;
}

export function StatsDetailModal({ open, onOpenChange, title, items, onItemClick }: StatsDetailModalProps) {
  const getStatusBadge = useCallback((status: string | null) => {
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
  }, []);

  const totalValue = useMemo(() => {
    return items.reduce((sum, item) => {
      if (item.status === "sold") {
        return sum + (item.sale_price || 0);
      }
      return sum + (item.purchase_price || 0);
    }, 0);
  }, [items]);

  const handleItemClick = useCallback(
    (item: Item) => {
      onOpenChange(false);
      onItemClick(item);
    },
    [onOpenChange, onItemClick],
  );

  const renderedItems = useMemo(() => {
    if (items.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>No items in this category</p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => handleItemClick(item)}
            className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors cursor-pointer"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleItemClick(item);
              }
            }}
            aria-label={`View details for ${item.title || "Untitled Item"}`}
          >
            <div className="w-12 h-12 rounded-lg bg-secondary overflow-hidden flex-shrink-0">
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.title || "Item"}
                  className="w-full h-full object-cover"
                  loading="lazy"
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
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate text-sm">{item.title || "Untitled Item"}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                {item.brand && <span>{item.brand}</span>}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {format(new Date(item.created_at), "MMM d")}
                </span>
              </div>
            </div>
            <div className="text-right">
              {getStatusBadge(item.status)}
              <div className="text-sm font-medium mt-1 flex items-center justify-end gap-1">
                <DollarSign className="w-3 h-3" />
                {item.status === "sold" && item.sale_price
                  ? formatAud(item.sale_price)
                  : formatAud(item.purchase_price)}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }, [items, getStatusBadge, handleItemClick]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{title}</span>
            <Badge variant="secondary">{items.length} items</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="p-3 rounded-lg bg-gradient-to-r from-primary/10 to-info/10 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Total Value</span>
            <span className="text-xl font-bold text-primary">{formatAud(totalValue)}</span>
          </div>
        </div>

        <ScrollArea className="h-[400px] pr-4">{renderedItems}</ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
