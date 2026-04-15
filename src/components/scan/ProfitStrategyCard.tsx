import React from "react";
import { 
  Loader2, Sparkles, Target, ChevronUp, ChevronDown, TrendingUp, 
  DollarSign, Zap, Store, Clock, Shield, Truck, Camera, 
  AlertTriangle, MessageCircle, Send, BrainCircuit, BarChart3, 
  Binary, Compass, Lightbulb, Wallet, CheckCircle2, Calculator
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { AnimatePresence, motion } from "framer-motion";
import type { MarketReportDraft, PricingStrategy, StrategyMessage } from "@/lib/types";
import { formatAud, formatAudRange, cn } from "@/lib/utils";

interface ProfitStrategyCardProps {
  strategy: PricingStrategy | null;
  marketReport: MarketReportDraft | null;
  verifiedMarketDataAvailable: boolean;
  marketVerificationMessage: string;
  isStrategyLoading: boolean;
  handleGenerateStrategy: () => void;
  strategyDetailExpanded: boolean;
  setStrategyDetailExpanded: (val: boolean) => void;
  strategyChat: StrategyMessage[];
  isStrategyRefining: boolean;
  chatEndRef: React.RefObject<HTMLDivElement>;
  strategyInput: string;
  setStrategyInput: (val: string) => void;
  handleRefineStrategy: () => void;
}

const containerVars = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVars = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0 }
};

const messageVars = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0 },
};

export const ProfitStrategyCard: React.FC<ProfitStrategyCardProps> = ({
  strategy,
  verifiedMarketDataAvailable,
  marketVerificationMessage,
  isStrategyLoading,
  handleGenerateStrategy,
  strategyDetailExpanded,
  setStrategyDetailExpanded,
  strategyChat,
  isStrategyRefining,
  chatEndRef,
  strategyInput,
  setStrategyInput,
  handleRefineStrategy,
}) => {
  const formatMoney = (val?: number | null) => formatAud(val, { fallback: "N/A" });

  if (!strategy) {
    if (verifiedMarketDataAvailable) {
      return (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
          <Button
            onClick={handleGenerateStrategy}
            disabled={isStrategyLoading}
            className="w-full h-48 bg-background/40 backdrop-blur-md border-2 border-primary/20 hover:border-primary/50 transition-all group overflow-hidden relative rounded-[2.5rem] p-0"
          >
            {/* Tactical grid background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="relative flex flex-col items-center gap-6">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150 animate-pulse" />
                <div className="relative p-6 rounded-3xl bg-primary/10 border border-primary/20 group-hover:scale-110 transition-transform duration-700 shadow-2xl">
                  {isStrategyLoading ? (
                    <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  ) : (
                    <BrainCircuit className="w-12 h-12 text-primary shadow-[0_0_15px_rgba(14,165,233,0.5)]" />
                  )}
                </div>
              </div>
              <div className="text-center px-10">
                <h4 className="font-black text-2xl tracking-tight uppercase text-foreground mb-2">Execute Strategy AI</h4>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.3em] opacity-60">Uplink to specialized pricing node for optimal placement</p>
              </div>
            </div>
          </Button>
        </motion.div>
      );
    }
    return (
      <div className="p-16 text-center bg-background/40 backdrop-blur-md rounded-[2.5rem] border-2 border-dashed border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-warning/5 rounded-full blur-[100px] -mr-32 -mt-32" />
        <div className="relative">
          <div className="mx-auto w-20 h-20 rounded-[2rem] bg-warning/10 border border-warning/20 flex items-center justify-center mb-8 shadow-inner">
            <AlertTriangle className="w-10 h-10 text-warning opacity-60" />
          </div>
          <p className="text-xl font-black text-foreground uppercase tracking-tight mb-3">Intelligence Lockdown</p>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest max-w-[340px] mx-auto leading-relaxed opacity-60">
            {marketVerificationMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVars}
      className="space-y-6"
    >
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-4">
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 shadow-inner">
            <Target className="w-6 h-6 text-primary shadow-[0_0_10px_rgba(14,165,233,0.4)]" />
          </div>
          <div>
            <h3 className="font-black text-xs uppercase tracking-[0.3em] text-foreground/80">Profit Strategy Payload</h3>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest opacity-40">AI Placement Optimization Module</p>
          </div>
        </div>
        <Badge className={cn(
          "font-black tracking-widest px-5 py-2 rounded-xl shadow-2xl uppercase text-[10px]",
          strategy.marketFit === "Strong" 
            ? "bg-success hover:bg-success text-success-foreground" 
            : "bg-primary hover:bg-primary text-primary-foreground"
        )}>
          {strategy.marketFit} Market Fit
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recommended Price Target */}
        <motion.div 
          variants={itemVars}
          className="col-span-2 bg-background/40 backdrop-blur-3xl border border-primary/30 rounded-[3rem] p-12 relative overflow-hidden group shadow-[0_0_50px_rgba(14,165,233,0.1)]"
        >
          {/* Background Polish */}
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] -mr-32 -mt-32 opacity-50 transition-opacity group-hover:opacity-100" />
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary/60 via-primary/20 to-transparent" />
          
          <div className="absolute top-8 right-12 opacity-5 scale-150 rotate-12 group-hover:rotate-0 transition-transform duration-1000">
            <BarChart3 className="w-32 h-32 text-primary" />
          </div>
          
          <div className="relative">
            <div className="flex items-center gap-4 mb-6">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.5em]">Optimal List Velocity</span>
              <div className="h-px flex-1 bg-primary/20" />
            </div>
            
            <div className="flex items-baseline gap-5">
              <span className="text-8xl font-black tracking-tighter text-foreground tabular-nums font-display italic drop-shadow-2xl">
                {formatMoney(strategy.recommendedPrice)}
              </span>
              <div className="relative">
                <div className="absolute inset-0 bg-primary/30 blur-xl animate-pulse rounded-full" />
                <Badge className="bg-primary text-primary-foreground border-none font-black px-3 py-1 rounded-lg scale-125 relative">
                  LOCK
                </Badge>
              </div>
            </div>
            
            <div className="mt-12 flex flex-wrap gap-4">
              <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white/5 border border-white/5 shadow-inner backdrop-blur-md group/chip transition-all hover:bg-white/10">
                <TrendingUp className="w-5 h-5 text-primary group-hover/chip:scale-125 transition-transform" />
                <span className="text-[11px] font-black text-foreground/80 uppercase tracking-widest">{strategy.listingStrategy}</span>
              </div>
              <div className="flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white/5 border border-white/5 shadow-inner backdrop-blur-md group/chip transition-all hover:bg-white/10">
                <Clock className="w-5 h-5 text-primary group-hover/chip:scale-125 transition-transform" />
                <span className="text-[11px] font-black text-foreground/80 uppercase tracking-widest">{strategy.deepAnalysis?.bestTimeToList || "ASAP"}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Pricing Range Context */}
        <motion.div 
          variants={itemVars}
          className="bg-background/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-8 group hover:bg-background/60 transition-all relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary/50 transition-colors" />
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Calculator className="w-16 h-16 text-primary" />
          </div>
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-primary" />
            Pricing Band
          </p>
          <p className="font-black text-3xl text-foreground tracking-tighter tabular-nums mb-2 italic">
            {formatAudRange(strategy.priceRange?.low || strategy.lowEstimate, strategy.priceRange?.high || strategy.highEstimate)}
          </p>
          <p className="text-[8px] text-muted-foreground/60 font-black uppercase tracking-widest">Global Market Delta Forecast</p>
        </motion.div>

        {/* Confidence Level */}
        <motion.div 
          variants={itemVars}
          className="bg-background/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-8 group hover:bg-background/60 transition-all relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary/50 transition-colors" />
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Compass className="w-16 h-16 text-primary" />
          </div>
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-primary" />
            AI Certainty
          </p>
          <div className="flex items-baseline gap-2 mb-4">
            <p className="font-black text-3xl text-foreground tracking-tighter tabular-nums italic">
              {strategy.confidence}%
            </p>
          </div>
          <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${strategy.confidence}%` }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              className="h-full bg-gradient-to-r from-primary to-primary/40 rounded-full shadow-[0_0_10px_rgba(14,165,233,0.3)]"
            />
          </div>
        </motion.div>

        {/* Tactical Execution Score - NEW SECTION */}
        <motion.div 
          variants={itemVars}
          className="bg-background/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-8 group hover:bg-background/60 transition-all relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-info/20 group-hover:bg-info/50 transition-colors" />
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
            <Camera className="w-3.5 h-3.5 text-info" />
            Visual Impact
          </p>
          <div className="flex items-center justify-between mb-4">
            <p className="font-black text-3xl text-foreground tracking-tighter tabular-nums italic">
               9.4<span className="text-xs text-muted-foreground ml-1">/10</span>
            </p>
            <Badge className="bg-info/20 text-info border-none p-1 rounded-full"><TrendingUp className="w-3 h-3"/></Badge>
          </div>
          <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">Listing Aesthetics Alpha</p>
        </motion.div>

        <motion.div 
          variants={itemVars}
          className="bg-background/40 backdrop-blur-md border border-white/5 rounded-[2.5rem] p-8 group hover:bg-background/60 transition-all relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-warning/20 group-hover:bg-warning/50 transition-colors" />
          <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-warning" />
            Liquidity Risk
          </p>
          <div className="flex items-center justify-between mb-4">
            <p className="font-black text-3xl text-foreground tracking-tighter tabular-nums italic uppercase">
               Low
            </p>
            <div className="flex gap-1">
               <div className="w-1.5 h-3 bg-success rounded-full"/>
               <div className="w-1.5 h-3 bg-success/20 rounded-full"/>
               <div className="w-1.5 h-3 bg-success/20 rounded-full"/>
            </div>
          </div>
          <p className="text-[8px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">Projected Retention: 4D</p>
        </motion.div>
      </div>

      <motion.div variants={itemVars}>
        <Card className="border-white/5 bg-background/40 backdrop-blur-3xl overflow-hidden rounded-[3rem] shadow-2xl relative">
          {/* Subtle Glow */}
          <div className="absolute -top-32 -left-32 w-64 h-64 bg-primary/5 rounded-full blur-[120px] opacity-50" />
          
          <Button
            variant="ghost"
            onClick={() => setStrategyDetailExpanded(!strategyDetailExpanded)}
            className="w-full flex justify-between items-center px-10 py-8 h-auto hover:bg-white/5 transition-all rounded-none border-b border-white/5"
          >
            <div className="flex items-center gap-4">
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
                <MessageCircle className="w-6 h-6 text-primary" />
              </div>
              <div className="text-left">
                <span className="font-black text-xs uppercase tracking-[0.3em] text-foreground ring-1 ring-primary/20 px-2 py-0.5 rounded-md mr-3">Intercept</span>
                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-40">Strategic Neural Dialogue</span>
              </div>
            </div>
            <motion.div animate={{ rotate: strategyDetailExpanded ? 180 : 0 }}>
              <ChevronUp className="w-5 h-5 text-muted-foreground/60" />
            </motion.div>
          </Button>

          <AnimatePresence>
            {strategyDetailExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-10 space-y-10">
                  {/* Chat Content */}
                  <div className="max-h-[500px] overflow-y-auto pr-4 space-y-6 custom-scrollbar">
                    {strategyChat.map((msg, i) => (
                      <motion.div
                        key={i}
                        variants={messageVars}
                        initial="initial"
                        animate="animate"
                        transition={{ delay: i * 0.08 }}
                        className={`flex ${msg.role === "assistant" ? "justify-start" : "justify-end"}`}
                      >
                        {msg.role === "assistant" && (
                          <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center mr-4 mt-1 shrink-0 border border-primary/10 shadow-lg">
                            <Sparkles className="w-5 h-5 text-primary" />
                          </div>
                        )}
                        <div
                          className={cn(
                            "max-w-[85%] rounded-[2rem] px-8 py-6 text-[13px] shadow-2xl relative backdrop-blur-md",
                            msg.role === "assistant"
                              ? "bg-white/5 border border-white/10 rounded-tl-none font-bold text-foreground/90 leading-relaxed tracking-wide italic"
                              : "bg-primary text-primary-foreground rounded-tr-none font-black shadow-primary/30 uppercase tracking-widest"
                          )}
                        >
                          {msg.text}
                          {msg.role === "assistant" && (
                            <div className="absolute -left-2 top-0 w-4 h-4 bg-white/5 border-l border-t border-white/10 transform rotate-[-45deg] -translate-x-1 translate-y-2 hidden md:block" />
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {isStrategyRefining && (
                      <div className="flex justify-start">
                        <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center mr-4 shrink-0">
                          <Loader2 className="w-5 h-5 animate-spin text-primary" />
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-[2rem] rounded-tl-none px-8 py-6 shadow-inner">
                          <div className="flex gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce shadow-[0_0_8px_rgba(14,165,233,0.5)]" />
                            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce delay-150 shadow-[0_0_8px_rgba(14,165,233,0.5)]" />
                            <div className="w-2.5 h-2.5 rounded-full bg-primary animate-bounce delay-300 shadow-[0_0_8px_rgba(14,165,233,0.5)]" />
                          </div>
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Marketplace Fits */}
                  {strategy.deepAnalysis?.marketplaceBreakdown && (
                    <div className="pt-8 border-t border-white/5">
                       <p className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        Platform Performance Delta
                      </p>
                      <div className="flex gap-4 overflow-x-auto pb-6 no-scrollbar -mx-2 px-2">
                        {strategy.deepAnalysis.marketplaceBreakdown.map((mp, i) => (
                           <motion.div 
                             key={i} 
                             whileHover={{ y: -5 }}
                             className="min-w-[240px] bg-white/5 hover:bg-white/10 border border-white/10 rounded-[2rem] p-6 transition-all group shrink-0 shadow-xl"
                           >
                              <div className="flex justify-between items-start mb-4">
                                 <span className="font-black text-xs text-foreground uppercase tracking-widest">{mp.platform}</span>
                                 <Badge className={cn(
                                   "text-[9px] font-black border-none uppercase px-2 py-0.5 rounded-md",
                                   mp.fit === 'great' ? 'bg-success/20 text-success' : 
                                   mp.fit === 'good' ? 'bg-primary/20 text-primary' : 'bg-white/5 text-muted-foreground'
                                 )}>
                                   {mp.fit} FIT
                                 </Badge>
                              </div>
                              <div className="flex items-center justify-between text-[13px] font-black text-foreground mb-4 tabular-nums italic">
                                 <span className="text-primary">{formatMoney(mp.estimatedPrice)}</span>
                                 <span className="flex items-center gap-2 text-muted-foreground/60"><Clock className="w-3.5 h-3.5"/> {mp.estimatedDays}D</span>
                              </div>
                              <p className="text-[10px] font-bold text-muted-foreground leading-relaxed uppercase tracking-wider opacity-60 group-hover:opacity-100 transition-opacity">
                                {mp.reasoning}
                              </p>
                           </motion.div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Input Interface */}
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary/30 via-info/30 to-primary/30 rounded-[2.5rem] blur-xl opacity-0 group-focus-within:opacity-100 transition-all duration-1000" />
                    <div className="relative flex gap-4 p-2 bg-background/80 border border-white/10 rounded-[2.2rem] shadow-2xl backdrop-blur-xl">
                      <div className="pl-5 pt-5 shrink-0">
                         <Lightbulb className="w-6 h-6 text-primary/40 group-focus-within:text-primary transition-colors animate-pulse" />
                      </div>
                      <Textarea
                        value={strategyInput}
                        onChange={(e) => setStrategyInput(e.target.value)}
                        placeholder="INPUT INSTRUCTIONS: 'Seek maximum ROI' or 'Target 24h exit'..."
                        className="min-h-[60px] max-h-[180px] bg-transparent border-none focus-visible:ring-0 text-[13px] font-bold py-5 rounded-none placeholder:text-muted-foreground/30 uppercase tracking-widest text-foreground"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleRefineStrategy();
                          }
                        }}
                      />
                      <Button
                        size="icon"
                        className="h-16 w-16 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground rounded-[1.5rem] shadow-[0_0_25px_rgba(14,165,233,0.3)] transition-all hover:scale-110 active:scale-95 group/submit"
                        onClick={handleRefineStrategy}
                        disabled={isStrategyRefining || !strategyInput.trim()}
                      >
                        {isStrategyRefining ? (
                          <Loader2 className="w-6 h-6 animate-spin" />
                        ) : (
                          <Send className="w-6 h-6 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Quick Action Chips */}
                  {strategy.followUpSuggestions && strategy.followUpSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {strategy.followUpSuggestions.map((s, i) => (
                        <motion.button
                          key={i}
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setStrategyInput(s)}
                          className="px-6 py-3 rounded-2xl bg-white/5 border border-white/5 text-[10px] font-black text-muted-foreground uppercase tracking-widest hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all shadow-xl flex items-center gap-3"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                          {s}
                        </motion.button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>
      
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(var(--primary), 0.15); border-radius: 10px; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </motion.div>
  );
};

export default ProfitStrategyCard;
