import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Store, ExternalLink, ChevronUp, ChevronDown, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatAud } from "@/lib/utils";
import type { SoldComparable } from "@/lib/types";

interface SoldComparablesCardProps {
  comparables: SoldComparable[];
}

export function SoldComparablesCard({ comparables }: SoldComparablesCardProps) {
  const [showComparables, setShowComparables] = useState(false);

  if (comparables.length === 0) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
      <Card className="border-info/30 bg-gradient-to-br from-card via-card to-info/5 shadow-2xl shadow-info/5 overflow-hidden rounded-[2rem]">
        <CardHeader className="p-0 border-b border-border/40">
          <button
            onClick={() => setShowComparables(!showComparables)}
            className="flex items-center justify-between w-full px-8 py-6 text-left group hover:bg-muted/30 transition-all"
          >
            <CardTitle className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-foreground/80">
              <div className="p-2 rounded-xl bg-info/10 shadow-inner border border-info/10">
                <CheckCircle2 className="w-4 h-4 text-info" />
              </div>
              Evidence Log ({comparables.length} Verified)
            </CardTitle>
            <div className="flex items-center gap-2 group-hover:scale-110 transition-transform">
              <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground opacity-60 group-hover:opacity-100 italic">
                {showComparables ? "Collapse Details" : "Inspect Comps"}
              </span>
              <div className="p-1.5 rounded-full bg-background/50 border border-border/40 group-hover:border-info/40 transition-colors">
                {showComparables ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </button>
        </CardHeader>
        
        <AnimatePresence>
          {showComparables && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <CardContent className="p-6 space-y-4">
                <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {comparables.map((comp, idx) => {
                    const searchQuery = encodeURIComponent(comp.title);
                    const mp = comp.marketplace.toLowerCase();
                    const url = comp.url || (mp.includes("amazon")
                      ? `https://www.amazon.com/s?k=${searchQuery}`
                      : mp.includes("etsy")
                        ? `https://www.etsy.com/search?q=${searchQuery}`
                        : mp.includes("poshmark")
                          ? `https://poshmark.com/search?query=${searchQuery}&type=listings`
                          : mp.includes("mercari")
                            ? `https://www.mercari.com/search/?keyword=${searchQuery}`
                            : `https://www.ebay.com.au/sch/i.html?_nkw=${searchQuery}&LH_Complete=1&LH_Sold=1`);

                    return (
                      <motion.a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="flex items-center gap-4 p-3 rounded-2xl bg-background/40 border border-border/30 hover:border-info/30 hover:bg-background/80 hover:shadow-lg transition-all group relative overflow-hidden"
                      >
                        <div className="absolute inset-y-0 left-0 w-1 bg-info/0 group-hover:bg-info/40 transition-all rounded-r" />
                        
                        {(comp.imageUrl || comp.image_url) ? (
                          <div className="w-16 h-16 flex-shrink-0 rounded-xl bg-muted overflow-hidden border border-border/50 group-hover:scale-105 transition-transform">
                            <img src={comp.imageUrl || comp.image_url} alt={comp.title} className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 flex-shrink-0 rounded-xl bg-muted/50 flex items-center justify-center border border-border/50 text-muted-foreground">
                            <Store className="w-6 h-6 opacity-40" />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-foreground/90 truncate leading-tight mb-1.5 group-hover:text-primary transition-colors">
                            {comp.title}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="text-[9px] font-black uppercase px-1.5 py-0 h-4 bg-muted/50 text-muted-foreground border-none">
                              {comp.marketplace}
                            </Badge>
                            <span className="text-[10px] font-bold text-muted-foreground opacity-60 uppercase">{comp.condition}</span>
                            <span className="text-[10px] font-bold text-primary/70 uppercase tracking-tighter">{comp.timeframe}</span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0 px-2">
                          <span className="text-lg font-black text-success tabular-nums tracking-tighter">{formatAud(comp.price)}</span>
                          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                        </div>
                      </motion.a>
                    );
                  })}
                </div>

                {/* Tactical Summary Bar */}
                {comparables.length >= 2 && (() => {
                  const prices = comparables.map(c => c.price);
                  const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
                  const lo = Math.min(...prices);
                  const hi = Math.max(...prices);
                  return (
                    <div className="grid grid-cols-3 gap-3 p-4 bg-muted/5 border border-border/40 rounded-2xl relative overflow-hidden group">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[1px] w-2/3 bg-gradient-to-r from-transparent via-info/20 to-transparent" />
                      <div className="text-center">
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1 opacity-60">Floor</p>
                        <p className="font-black text-sm text-foreground/80 tabular-nums">{formatAud(lo)}</p>
                      </div>
                      <div className="text-center border-x border-border/40">
                        <p className="text-[9px] font-black text-info uppercase tracking-widest mb-1">Median</p>
                        <p className="font-black text-sm text-info tabular-nums">{formatAud(avg)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1 opacity-60">Ceiling</p>
                        <p className="font-black text-sm text-foreground/80 tabular-nums">{formatAud(hi)}</p>
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--info), 0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(var(--info), 0.2); }
      `}} />
    </motion.div>
  );
}
