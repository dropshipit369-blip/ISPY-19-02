import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Loader2, Camera, Package, Store, BarChart3, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatAud } from "@/lib/utils";
import { invokeSupabaseFunction, parseSupabaseFunctionError } from "@/lib/supabase-functions";

interface AssistantSnapshot {
  totalItems: number;
  pendingItems: number;
  listedItems: number;
  soldItems: number;
  totalProfit: number;
  recentScanName: string | null;
  triggeredAlerts: number;
}

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
}

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/scan": "Scan",
  "/inventory": "Inventory",
  "/listings": "Listings",
  "/membership": "Membership",
};

const buildWelcomeMessage = (pathname: string, snapshot: AssistantSnapshot | null) => {
  if (pathname === "/scan") {
    return "Hi there! I'm scanning the market for you. Upload an item, run a live scan, or ask me where to go next.";
  }

  if (pathname === "/inventory" && snapshot) {
    return `Inventory is tracking ${snapshot.totalItems} item${snapshot.totalItems === 1 ? "" : "s"} right now. Ask about saved items, listing prep, or what still needs attention.`;
  }

  if (pathname === "/listings" && snapshot) {
    return `${snapshot.pendingItems} item${snapshot.pendingItems === 1 ? "" : "s"} are ready for listing work. I can point you to eBay, Facebook Marketplace, or Etsy prep.`;
  }

  if (pathname === "/dashboard" && snapshot) {
    return `You currently have ${snapshot.soldItems} sold item${snapshot.soldItems === 1 ? "" : "s"} and ${formatAud(snapshot.totalProfit)} in realized profit. Ask for a quick summary or next step.`;
  }

  return "I can help with scanning, inventory review, listings, pricing workflow, and dashboard activity.";
};

const buildAssistantFallbackReply = (
  input: string,
  pathname: string,
  snapshot: AssistantSnapshot | null,
) => {
  const normalized = input.toLowerCase();

  if (/(scan|barcode|camera|analy)/.test(normalized)) {
    return pathname === "/scan"
      ? "You're already on the scan workspace. Use Single Item for deep analysis, Live Scan for real-time finds, or tap Barcode to open the scanner immediately."
      : "Open the Scan page to run single-item analysis, lot uploads, live scans, or direct barcode scanning.";
  }

  if (/(inventory|saved|save)/.test(normalized)) {
    if (!snapshot) return "Open Inventory to review saved items, notes, status, and market data.";
    return `Inventory currently has ${snapshot.totalItems} item${snapshot.totalItems === 1 ? "" : "s"}, with ${snapshot.pendingItems} pending, ${snapshot.listedItems} listed, and ${snapshot.soldItems} sold.`;
  }

  if (/(listing|sell|ebay|facebook|etsy|marketplace)/.test(normalized)) {
    if (!snapshot) {
      return "The Listings page prepares exports for eBay and listing-ready CSV packages for Facebook Marketplace and Etsy.";
    }
    return `${snapshot.pendingItems} item${snapshot.pendingItems === 1 ? "" : "s"} are ready for listing prep. iSpy can export an eBay CSV and mobile-friendly listing packages for Facebook Marketplace and Etsy.`;
  }

  if (/(profit|sales|dashboard|money|roi)/.test(normalized)) {
    if (!snapshot) return "The dashboard tracks realized sales, profit, streaks, and listing activity.";
    return `Realized profit is ${formatAud(snapshot.totalProfit)} across ${snapshot.soldItems} sold item${snapshot.soldItems === 1 ? "" : "s"}.`;
  }

  if (/(alert|notification|bid)/.test(normalized)) {
    if (!snapshot || snapshot.triggeredAlerts === 0) {
      return "There are no triggered price alerts right now. The dashboard notification card will update when new sales activity or alerts come in.";
    }
    return `${snapshot.triggeredAlerts} price alert${snapshot.triggeredAlerts === 1 ? " is" : "s are"} currently triggered on your dashboard.`;
  }

  if (/(recent|latest|last scan)/.test(normalized) && snapshot?.recentScanName) {
    return `Your most recent scan log was "${snapshot.recentScanName}". Open the dashboard or scan history panel if you want to review it.`;
  }

  if (/(help|what can you do|how do i use)/.test(normalized)) {
    return "Ask me about scan flow, inventory status, listing prep, pricing workflow, or dashboard activity. I can also jump you straight to the right page.";
  }

  if (pathname === "/scan") {
    return "On the scan page, the fastest path is: upload or scan, review the analysis, then save the result to inventory once pricing looks right.";
  }

  if (pathname === "/inventory") {
    return "Tap any inventory item to open the full detail view. On mobile it now opens full-screen for easier review and editing.";
  }

  if (pathname === "/listings") {
    return "Select items in Listings, pick the marketplace target, then export the CSV package for mobile or desktop listing work.";
  }

  return "Use the quick actions below or ask a more specific question about scanning, inventory, listings, or dashboard activity.";
};

export function FloatingMascot() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [snapshot, setSnapshot] = useState<AssistantSnapshot | null>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const shouldRender =
    !!user && !["/", "/login", "/signup"].includes(location.pathname);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const loadSnapshot = async () => {
    if (!user?.id) return;

    setLoadingSnapshot(true);
    try {
      const [
        { data: itemsData },
        { data: scanLogsData },
        { count: triggeredAlertsCount },
      ] = await Promise.all([
        supabase
          .from("items")
          .select("status,purchase_price,sale_price")
          .eq("user_id", user.id),
        supabase
          .from("scan_logs")
          .select("name,scanned_at")
          .eq("user_id", user.id)
          .order("scanned_at", { ascending: false })
          .limit(1),
        supabase
          .from("price_alerts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("triggered", true),
      ]);

      const items = itemsData || [];
      const soldItems = items.filter((item) => item.status === "sold");
      const totalProfit = soldItems.reduce(
        (sum, item) => sum + ((item.sale_price || 0) - (item.purchase_price || 0)),
        0,
      );

      setSnapshot({
        totalItems: items.length,
        pendingItems: items.filter((item) => item.status === "pending" || !item.status).length,
        listedItems: items.filter((item) => item.status === "listed").length,
        soldItems: soldItems.length,
        totalProfit,
        recentScanName: scanLogsData?.[0]?.name || null,
        triggeredAlerts: triggeredAlertsCount || 0,
      });
    } finally {
      setLoadingSnapshot(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !user?.id) return;
    void loadSnapshot();
  }, [isOpen, location.pathname, user?.id]);

  useEffect(() => {
    if (!isOpen) return;
    setMessages((prev) => {
      if (prev.length > 0) return prev;
      return [
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: buildWelcomeMessage(location.pathname, snapshot),
        },
      ];
    });
  }, [isOpen, location.pathname, snapshot]);

  const quickActions = useMemo(
    () => [
      { label: "Scan", path: "/scan", icon: Camera },
      { label: "Inventory", path: "/inventory", icon: Package },
      { label: "Listings", path: "/listings", icon: Store },
      { label: "Dashboard", path: "/dashboard", icon: BarChart3 },
    ],
    [],
  );

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: trimmed,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");

    setIsSending(true);
    try {
      const { data, error } = await invokeSupabaseFunction<{ reply?: string }>("assistant-chat", {
        message: trimmed,
        pathname: location.pathname,
        chatHistory: nextMessages.map(({ role, text }) => ({ role, text })),
        snapshot,
      });

      if (error) {
        throw new Error(
          await parseSupabaseFunctionError(error, "The assistant is temporarily unavailable."),
        );
      }

      const reply = data?.reply?.trim();
      if (!reply) {
        throw new Error("The assistant returned an empty response.");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: reply,
        },
      ]);
    } catch (error) {
      console.error("assistant-chat failed:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: buildAssistantFallbackReply(trimmed, location.pathname, snapshot),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  if (!shouldRender) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4 pointer-events-none">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="pointer-events-auto"
          >
            <Card className="w-[min(24rem,calc(100vw-2rem))] shadow-2xl border-primary/20 backdrop-blur-xl bg-background/95">
              <CardHeader className="pb-3 bg-gradient-to-r from-primary/10 to-transparent rounded-t-xl">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="relative w-9 h-9 rounded-full overflow-hidden border border-primary/30">
                      <img
                        src="/mascot-transparent.png"
                        alt="iSpy assistant"
                        className="object-cover w-full h-full"
                        onError={(e) => {
                          e.currentTarget.src = "/mascot.png";
                          e.currentTarget.onerror = null;
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-sm font-bold">iSpy Assistant</CardTitle>
                      <CardDescription className="text-xs flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {routeLabels[location.pathname] || "Workspace"}
                        </Badge>
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setIsOpen(false)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-3 space-y-3">
                {loadingSnapshot && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Refreshing your iSpy context...
                  </div>
                )}

                {snapshot && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
                      <div className="text-muted-foreground">Inventory</div>
                      <div className="font-semibold">{snapshot.totalItems} items</div>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
                      <div className="text-muted-foreground">Profit</div>
                      <div className="font-semibold">{formatAud(snapshot.totalProfit)}</div>
                    </div>
                  </div>
                )}

                <div className="max-h-72 overflow-y-auto space-y-3 rounded-xl border border-border/50 p-3 bg-background/30">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                          message.role === "user"
                            ? "bg-primary/10 text-foreground"
                            : "bg-secondary/30 text-foreground/80"
                        }`}
                      >
                        {message.text}
                      </div>
                    </div>
                  ))}
                  {isSending && (
                    <div className="flex justify-start">
                      <div className="inline-flex items-center gap-2 rounded-xl bg-secondary/30 px-3 py-2 text-sm text-foreground/80">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Thinking...
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {quickActions.map((action) => (
                    <Button
                      key={action.path}
                      variant="outline"
                      size="sm"
                      className="justify-start"
                      onClick={() => {
                        navigate(action.path);
                        setIsOpen(false);
                      }}
                    >
                      <action.icon className="w-3.5 h-3.5 mr-2" />
                      {action.label}
                    </Button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Ask about scans, listings, profit, or inventory..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    className="text-sm"
                  />
                  <Button size="icon" onClick={() => void handleSend()} disabled={!input.trim() || isSending}>
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isVisible && !isOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setIsOpen(true)}
            className="relative group pointer-events-auto"
          >
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg animate-pulse-glow group-hover:bg-primary/40 transition-colors" />
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-primary/50 shadow-2xl bg-background/50 backdrop-blur-sm transition-transform duration-300 group-hover:-translate-y-1">
              <img
                src="/mascot-transparent.png"
                alt="Open iSpy assistant"
                className="w-full h-full object-cover p-1"
                onError={(e) => {
                  e.currentTarget.src = "/mascot.png";
                  e.currentTarget.onerror = null;
                }}
              />
            </div>
            <span className="absolute top-0 right-0 flex h-5 w-5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-5 w-5 bg-primary text-[10px] items-center justify-center text-primary-foreground font-bold">
                <BellRing className="w-2.5 h-2.5" />
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
