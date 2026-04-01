import { useState, useEffect } from "react";
import { Share2, X, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import type { Item } from "@/lib/types";

interface ShareFindButtonProps {
    item: Item;
    autoShow?: boolean;
}

export function ShareFindButton({ item, autoShow = false }: ShareFindButtonProps) {
    const [visible, setVisible] = useState(false);
    const [shown, setShown] = useState(false);

  useEffect(() => {
        if (autoShow && !shown) {
                const timer = setTimeout(() => { setVisible(true); setShown(true); }, 1500);
                return () => clearTimeout(timer);
        }
  }, [autoShow, shown]);

  const handleShare = () => {
        const title = item.title || "Check out this find";
        const price = item.purchase_price ? " Picked up for $" + item.purchase_price.toFixed(2) + "!" : "";
        const quote = "iSpy Find: " + title + price + " Found with iSpy Profit Tool!";
        const url = "https://ispy-ai.vercel.app";
        const fbUrl = "https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(url) + "&quote=" + encodeURIComponent(quote);
        window.open(fbUrl, "_blank", "noopener,noreferrer,width=620,height=400");
        setVisible(false);
  };

  return (
        <>
              <button onClick={() => setVisible(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-[#1877F2] transition-colors px-2 py-1 rounded" title="Share on Facebook">
                      <Share2 className="w-3 h-3" /> Share Find
              </button>
              <AnimatePresence>
                {visible && (
                    <>
                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" onClick={() => setVisible(false)} />
                                <motion.div initial={{ opacity: 0, scale: 0.92, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 24 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-80 max-w-[90vw] bg-card border border-border rounded-2xl shadow-2xl p-5">
                                              <button onClick={() => setVisible(false)} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"><X className="w-4 h-4" /></button>
                                              <div className="text-center">
                                                              <h3 className="font-semibold text-sm mb-1">Share Your Find!</h3>
                                                              <p className="text-xs text-muted-foreground mb-4">Found a great deal? Let the community know!</p>
                                                              <p className="text-xs font-medium text-foreground mb-4 truncate px-2">{item.title || "Untitled Item"}</p>
                                                              <Button onClick={handleShare} className="w-full bg-[#1877F2] hover:bg-[#166fe5] text-white gap-2 text-sm"><Facebook className="w-4 h-4" />Post to Facebook</Button>
                                                              <button onClick={() => setVisible(false)} className="mt-3 w-full text-xs text-muted-foreground hover:text-foreground transition-colors">Maybe later</button>
                                              </div>
                                </motion.div>
                    </>
                  )}
              </AnimatePresence>
        </>
      );
}
