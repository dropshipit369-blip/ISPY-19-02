import { Card } from "@/components/ui/card";
import { TrendingUp, DollarSign, Target } from "lucide-react";
import { formatAud } from "@/lib/utils";

export const DailyAnalytics = ({ scans }: { scans: any[] }) => {
  const totalValue = scans.reduce((acc, item) => acc + (item.median_price || 0), 0);
  const avgConfidence = scans.length > 0 ? Math.round(scans.reduce((acc, i) => acc + (i.confidence || 0), 0) / scans.length) : 0;

  return (
    <div className="grid grid-cols-3 gap-3 p-4">
      <Card className="bg-glass-dark backdrop-blur-lg border-white/10 p-3 text-center">
        <DollarSign className="w-5 h-5 mx-auto text-primary mb-1" />
        <p className="text-xs text-muted-foreground">Est. Value</p>
        <p className="text-lg font-bold text-foreground">{formatAud(totalValue, { decimals: 0 })}</p>
      </Card>
      <Card className="bg-glass-dark backdrop-blur-lg border-white/10 p-3 text-center">
        <Target className="w-5 h-5 mx-auto text-primary mb-1" />
        <p className="text-xs text-muted-foreground">Confidence</p>
        <p className="text-lg font-bold text-foreground">{avgConfidence}%</p>
      </Card>
      <Card className="bg-glass-dark backdrop-blur-lg border-white/10 p-3">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="w-4 h-4 text-success" />
          <span className="text-xs text-foreground">{scans.length} Items Scouted</span>
        </div>
        <p className="text-xs text-success font-medium">LIVE SESSION ACTIVE</p>
      </Card>
    </div>
  );
};
