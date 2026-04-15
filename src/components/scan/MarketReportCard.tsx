import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, AlertTriangle, Clock, Store, BarChart3, Database, Search } from "lucide-react";
import { motion } from "framer-motion";
import { formatAud } from "@/lib/utils";
import type { MarketReportDraft } from "@/lib/types";

interface MarketReportCardProps {
  marketReport: MarketReportDraft;
  verifiedMarketDataAvailable: boolean;
  marketVerificationMessage: string;
}

export function MarketReportCard({
  marketReport,
  verifiedMarketDataAvailable,
  marketVerificationMessage,
}: MarketReportCardProps) {
  if (!verifiedMarketDataAvailable) {
    const isCache = marketReport?.verification_source === "local_cache";
    
    return (
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card className={`border-2 overflow-hidden relative group transition-all duration-500 rounded-[2rem] shadow-2xl ${isCache ? "border-primary/30 bg-primary/5 shadow-primary/5" : "border-warning/30 bg-warning/5 shadow-warning/5"}`}>
          {/* Tactical Hud Edge */}
          <div className={cn(
            "absolute top-0 left-0 w-1 h-full bg-gradient-to-b",
            isCache ? "from-primary/60 via-primary/20 to-transparent" : "from-warning/60 via-warning/20 to-transparent"
          )} />

          <div className={`absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform ${isCache ? "text-primary" : "text-warning"}`}>
            {isCache ? <Database className="w-20 h-20" /> : <AlertTriangle className="w-20 h-20" />}
          </div>
          
          <CardHeader className="pb-4 border-b border-white/5 bg-background/40 backdrop-blur-md relative">
            <CardTitle className={cn(
              "flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em]",
              isCache ? "text-primary" : "text-warning"
            )}>
              <div className={cn(
                "p-2 rounded-xl shadow-inner border transition-colors",
                isCache ? "bg-primary/10 border-primary/20" : "bg-warning/10 border-warning/20"
              )}>
                {isCache ? <Database className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              </div>
              {isCache ? "History-Based Intelligence" : "Market Data Gap Detected"}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-8 relative">
            <p className="text-sm font-bold text-foreground/80 leading-relaxed mb-8 uppercase tracking-wide">{marketVerificationMessage}</p>
            
            {isCache ? (
              <div className="space-y-8">
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Low Intel", value: marketReport.low_price },
                    { label: "Optimal Cmd", value: marketReport.suggested_price || marketReport.median_price, highlight: true },
                    { label: "High Peak", value: marketReport.high_price },
                  ].map((stat) => (
                    <div key={stat.label} className={cn(
                      "rounded-2xl p-4 border transition-all duration-500",
                      stat.highlight 
                        ? "bg-primary/20 border-primary/40 shadow-[0_0_20px_rgba(14,165,233,0.15)] scale-105" 
                        : "bg-background/60 border-white/5"
                    )}>
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2 truncate">{stat.label}</p>
                      <p className={cn(
                        "font-black text-lg tracking-tighter tabular-nums",
                        stat.highlight ? "text-primary italic" : "text-foreground/90"
                      )}>
                        {formatAud(stat.value)}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex items-start gap-4 p-5 rounded-2xl bg-primary/10 border border-primary/20 shadow-inner">
                  <div className="p-2.5 rounded-xl bg-primary/20">
                    <Search className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-[10px] font-bold text-primary/80 leading-relaxed uppercase tracking-wider">
                    System Alert: Precision will increase with operational volume. Real-time marketplace telemetry will sync once verified signals are acquired.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-4 p-6 rounded-2xl bg-warning/10 border border-warning/20 shadow-inner">
                <div className="p-3 rounded-xl bg-warning/20">
                  <BarChart3 className="w-5 h-5 text-warning" />
                </div>
                <p className="text-[10px] font-bold text-warning/80 leading-relaxed uppercase tracking-widest">
                  Manual Validation Required: Capture asset identification first. Pricing engines require more comparative telemetry to calculate optimal margins.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <Card className="border-primary/30 bg-background/40 backdrop-blur-3xl shadow-2xl overflow-hidden relative rounded-[2rem]">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -mr-32 -mt-32" />
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary/60 via-primary/20 to-transparent" />
        
        <CardHeader className="pb-4 border-b border-white/5 bg-white/5">
          <CardTitle className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.2em] text-foreground">
            <div className="p-2 rounded-xl bg-primary/10 shadow-inner border border-primary/20">
              <BarChart3 className="w-4 h-4 text-primary shadow-[0_0_10px_rgba(14,165,233,0.5)]" />
            </div>
            Market Precision Intel
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-0">
          <div className="p-10 text-center relative border-b border-white/5 bg-gradient-to-b from-transparent to-primary/5">
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <p className="text-[9px] font-black text-primary uppercase tracking-[0.4em] mb-4">Calculated Optimal Price</p>
            <p className="text-7xl font-black text-foreground tracking-tighter tabular-nums mb-6 drop-shadow-2xl font-display italic">
              {formatAud(marketReport.suggested_price ?? marketReport.median_price, { fallback: "N/A" })}
            </p>
            
            <div className="flex justify-center items-center gap-12 mt-6">
              <div className="flex flex-col items-center">
                <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1.5">Cmd: Floor</p>
                <p className="font-black text-base text-foreground/80 tabular-nums">{formatAud(marketReport.low_price)}</p>
              </div>
              <div className="h-10 w-[1px] bg-white/10" />
              <div className="flex flex-col items-center">
                <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest mb-1.5">Cmd: Ceiling</p>
                <p className="font-black text-base text-foreground/80 tabular-nums">{formatAud(marketReport.high_price)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-white/5">
            {[
              { label: "Velocity", value: marketReport.avg_days_to_sell ? `${marketReport.avg_days_to_sell}D` : "---", icon: Clock, color: "text-muted-foreground/60" },
              { label: "Uplink", value: marketReport.best_marketplace || "EBAY", icon: Store, color: "text-primary" },
              { 
                label: "Momentum", 
                value: marketReport.price_trend || "STABLE", 
                icon: marketReport.price_trend === "up" ? TrendingUp : marketReport.price_trend === "down" ? TrendingDown : TrendingUp,
                color: marketReport.price_trend === "up" ? "text-success" : marketReport.price_trend === "down" ? "text-destructive" : "text-muted-foreground/60"
              },
            ].map((stat, i) => (
              <div key={i} className="p-6 flex flex-col items-center justify-center text-center group hover:bg-white/5 transition-all duration-300">
                <stat.icon className={cn("w-4 h-4 mb-3 transition-transform group-hover:scale-125", stat.color)} />
                <p className="text-[8px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-1.5">{stat.label}</p>
                <p className={cn("font-black text-xs uppercase tracking-widest", stat.color)}>{stat.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
