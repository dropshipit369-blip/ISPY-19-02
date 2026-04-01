import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { TrendingUp, ShieldCheck, ExternalLink } from "lucide-react";
import { formatAud } from "@/lib/utils";

export const ItemDetailDrawer = ({ item, open, onOpenChange }: any) => {
  if (!item) return null;
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl bg-background/95 backdrop-blur-xl">
        <SheetHeader className="pb-4">
          <div className="space-y-1">
            <p className="text-xs text-primary font-medium uppercase tracking-wider">{item.analysis.brand}</p>
            <SheetTitle className="text-xl">{item.analysis.title}</SheetTitle>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <p className="text-4xl font-bold text-foreground">{formatAud(item.marketReport.median_price)}</p>
            <div className="flex items-center gap-1 bg-success/20 text-success px-2 py-1 rounded-full text-xs">
              <TrendingUp className="w-3 h-3" />
              High Demand
            </div>
          </div>
        </SheetHeader>
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between bg-muted/50 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">AI Appraisal Verified</p>
                <p className="text-xs text-muted-foreground">Based on recent marketplace sales</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Condition</p>
              <p className="text-sm font-medium text-foreground">{item.analysis.condition}</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3">
              <p className="text-xs text-muted-foreground mb-1">Category</p>
              <p className="text-sm font-medium text-foreground">{item.analysis.category}</p>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
