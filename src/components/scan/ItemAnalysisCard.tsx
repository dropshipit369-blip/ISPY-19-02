import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, Zap, Copy, ExternalLink, PenTool, Radar, Target, Cpu, Palette, Info, Tag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { AnalysisResult, OptimizedListing } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface ItemAnalysisCardProps {
  analysis: AnalysisResult | null;
}

const containerVars = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVars = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 }
};

export function ItemAnalysisCard({ analysis }: ItemAnalysisCardProps) {
  if (!analysis) {
    return (
      <Card className="border-dashed border-2 border-primary/20 bg-background/40 backdrop-blur-md overflow-hidden relative group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
        <CardContent className="flex flex-col items-center justify-center py-16 text-center relative">
          <div className="relative">
            <Radar className="w-12 h-12 text-primary/20 mb-4 animate-pulse" />
            <motion.div 
              animate={{ rotate: 360, scale: [1, 1.1, 1] }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 border-2 border-primary/10 rounded-full scale-150 border-t-primary/40"
            />
          </div>
          <p className="font-black text-foreground tracking-widest uppercase text-xs mt-6">Target Search Active</p>
          <p className="text-[10px] font-bold text-muted-foreground mt-2 max-w-[200px] uppercase tracking-wider">Awaiting optical data payload for full system identification</p>
        </CardContent>
      </Card>
    );
  }

  const fields = [
    { label: "Designation", value: analysis.title, icon: Target },
    { label: "Origin/Brand", value: analysis.brand, icon: Tag },
    { label: "Hardware/Model", value: analysis.model, icon: Cpu },
    { label: "Classification", value: analysis.category, icon: Info },
    { label: "Surface/Color", value: analysis.color, icon: Palette },
    { label: "Integrity", value: analysis.condition, badge: true },
  ];

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVars}
    >
      <Card className="border-white/10 bg-background/40 backdrop-blur-xl shadow-2xl overflow-hidden relative group">
        {/* Tactical UI accents */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-[80px]" />
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary/40 via-primary/10 to-transparent" />
        
        <CardHeader className="pb-4 border-b border-white/5 bg-white/5">
          <CardTitle className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 shadow-inner">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            </div>
            <div>
              <p className="text-[11px] font-black tracking-widest uppercase text-foreground">Core Target Intel</p>
              <p className="text-[9px] font-bold text-muted-foreground tracking-wide uppercase">AI Object Identification Pipeline</p>
            </div>
          </CardTitle>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {fields.map((field) => (
              <motion.div 
                key={field.label} 
                variants={itemVars}
                className="group relative bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary/30 rounded-2xl p-4 transition-all duration-500"
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest group-hover:text-primary transition-colors">{field.label}</p>
                  {field.icon && <field.icon className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />}
                </div>
                
                {field.badge ? (
                  <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30 font-black text-[10px] px-3 py-0.5 uppercase tracking-tighter">
                    {field.value || "Analyzing..."}
                  </Badge>
                ) : (
                  <p className="font-bold text-sm line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                    {field.value || "---"}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
          
          {analysis.extracted_text && (
            <motion.div 
              variants={itemVars}
              className="relative group bg-primary/5 border border-primary/20 rounded-2xl p-5 overflow-hidden shadow-inner"
            >
              <p className="text-[10px] font-black text-primary/80 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Radar className="w-3 h-3" />
                OCR Signal Intercepted
              </p>
              <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                <p className="text-sm font-medium leading-relaxed italic text-white/90 font-mono">
                  "{analysis.extracted_text}"
                </p>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
