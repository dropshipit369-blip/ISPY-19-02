import { useEffect, useRef, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Loader2,
  X,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Zap,
  RefreshCw,
  Eye,
  Pause,
  Play,
  SwitchCamera,
  Package,
  Tag,
  History,
  Save,
  Check,
  Brain,
  Globe,
  ExternalLink,
} from "lucide-react";
import { FeedbackModal } from "@/components/FeedbackModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTensorFlow, LocalDetection } from "@/hooks/useTensorFlow";
import { ScanLogModal } from "@/components/ScanLogModal";

/* ───────────────── TYPES ───────────────── */

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface PricingSource {
  marketplace: string;
  title: string;
  price: number;
  condition: string;
  soldDate: string;
  url?: string;
}

interface MarketplaceData {
  source: string;
  listingsFound: number;
  avgPrice: number;
}

interface TrackedItem {
  key: string;
  localId: string;
  name: string;
  brand?: string;
  model?: string;
  category?: string;
  condition?: string;
  price: number;
  lowPrice: number;
  highPrice: number;
  confidence: number;
  trend?: "up" | "down" | "stable";
  box: Box;
  smoothedBox: Box;
  velocity: { x: number; y: number; w: number; h: number };
  lastSeen: number;
  frames: number;
  confidenceHistory: number[];
  priceHistory: number[];
  pricingSources?: PricingSource[];
  isPriced: boolean;
  isLocked: boolean;
  marketplaceData?: MarketplaceData | null;
}

/* ───────────────── CONSTANTS ───────────────── */

// PERFORMANCE MODE - Maximum responsiveness
const SMOOTHING = 0.35; // Faster box tracking
const VELOCITY_SMOOTHING = 0.5; // Snappier velocity response
const SERVER_SCAN_INTERVAL = 800; // Much faster server scans (was 1500ms)
const TARGET_FPS = 60; // Higher FPS target
const FRAME_INTERVAL = 1000 / TARGET_FPS; // ~16ms for 60 FPS
const CONFIDENCE_LOCK_FRAMES = 3; // Lock faster (was 5)
const STALE_THRESHOLD = 2000; // Remove stale items faster
const IOU_THRESHOLD = 0.25; // More sensitive matching
const IMAGE_QUALITY = 0.75; // Higher quality captures (was 0.65)

/* ───────────────── HELPERS ───────────────── */

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function calculateIoU(box1: Box, box2: Box): number {
  const x1 = Math.max(box1.x, box2.x);
  const y1 = Math.max(box1.y, box2.y);
  const x2 = Math.min(box1.x + box1.w, box2.x + box2.w);
  const y2 = Math.min(box1.y + box1.h, box2.y + box2.h);

  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const area1 = box1.w * box1.h;
  const area2 = box2.w * box2.h;
  const union = area1 + area2 - intersection;

  return union > 0 ? intersection / union : 0;
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return "from-emerald-500/90 to-emerald-600/90";
  if (confidence >= 60) return "from-amber-500/90 to-amber-600/90";
  return "from-slate-500/90 to-slate-600/90";
}

function getConfidenceBorder(confidence: number): string {
  if (confidence >= 80) return "border-emerald-400";
  if (confidence >= 60) return "border-amber-400";
  return "border-slate-400";
}

/* ───────────────── COMPONENT ───────────────── */

export function LiveScanner({
  onClose,
  userId,
}: {
  onClose: () => void;
  userId: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const lastServerScan = useRef(0);
  const serverScanLock = useRef(false);

  const [items, setItems] = useState<Record<string, TrackedItem>>({});
  const [selected, setSelected] = useState<TrackedItem | null>(null);
  const [isServerScanning, setIsServerScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [itemCount, setItemCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [feedbackItem, setFeedbackItem] = useState<TrackedItem | null>(null);
  const [marketplaceScrapeEnabled, setMarketplaceScrapeEnabled] = useState(false);
  const [scrapedItemsCount, setScrapedItemsCount] = useState(0);

  const { detect, isLoading: modelLoading, isReady: modelReady, error: modelError } = useTensorFlow();

  /* ───────── CAMERA ───────── */

  const startCamera = useCallback(async (facing: "environment" | "user") => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 60, min: 30 },
          facingMode: facing,
        },
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera error:", err);
      toast.error("Failed to access camera");
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [facingMode, startCamera]);

  /* ───────── SWITCH CAMERA ───────── */

  const switchCamera = () => {
    const newMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(newMode);
    toast.info(`Switched to ${newMode === "environment" ? "back" : "front"} camera`);
  };

  /* ───────── FRAME CAPTURE FOR SERVER (OPTIMIZED) ───────── */

  const captureFrame = useCallback((): string | null => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !v.videoWidth) return null;
    
    // Optimize: capture at 1280px max width for faster processing while maintaining quality
    const maxWidth = 1280;
    const scale = Math.min(1, maxWidth / v.videoWidth);
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);
    
    const ctx = c.getContext("2d", { alpha: false, willReadFrequently: false });
    if (!ctx) return null;
    
    // Use high-quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(v, 0, 0, c.width, c.height);
    
    return c.toDataURL("image/webp", IMAGE_QUALITY);
  }, []);

  /* ───────── SERVER PRICING SCAN ───────── */

  const serverScan = useCallback(async () => {
    if (serverScanLock.current || isPaused) return;
    if (Date.now() - lastServerScan.current < SERVER_SCAN_INTERVAL) return;

    const frame = captureFrame();
    if (!frame) return;

    serverScanLock.current = true;
    lastServerScan.current = Date.now();
    setIsServerScanning(true);

    try {
      const { data, error } = await supabase.functions.invoke("live-scan", {
        body: { image: frame, userId },
      });

      if (error) {
        console.error("Server scan error:", error);
        return;
      }

      if (data?.creditsExhausted) {
        toast.error("AI credits exhausted. Please add credits in Settings → Workspace → Usage.");
        return;
      }

      // Update marketplace scrape status
      if (data?.marketplaceScrapeEnabled !== undefined) {
        setMarketplaceScrapeEnabled(data.marketplaceScrapeEnabled);
      }
      if (data?.scrapedItems !== undefined) {
        setScrapedItemsCount(data.scrapedItems);
      }

      if (Array.isArray(data?.items)) {
        setItems((prev) => {
          const next = { ...prev };

          data.items.forEach((serverItem: any) => {
            const serverBox: Box = {
              x: serverItem.boundingBox?.x ?? 0.1,
              y: serverItem.boundingBox?.y ?? 0.1,
              w: serverItem.boundingBox?.width ?? 0.2,
              h: serverItem.boundingBox?.height ?? 0.2,
            };

            // Find matching local detection by IoU
            let bestMatch: string | null = null;
            let bestIoU = 0;

            Object.entries(next).forEach(([key, item]) => {
              const iou = calculateIoU(item.box, serverBox);
              if (iou > IOU_THRESHOLD && iou > bestIoU) {
                bestIoU = iou;
                bestMatch = key;
              }
            });

            const key = bestMatch || `server-${Date.now()}-${Math.random()}`;

            if (next[key]) {
              // Update existing item with server pricing
              next[key].name = serverItem.name || next[key].name;
              next[key].brand = serverItem.brand;
              next[key].model = serverItem.model;
              next[key].category = serverItem.category;
              next[key].condition = serverItem.condition;
              next[key].price = serverItem.medianPrice || 0;
              next[key].lowPrice = serverItem.lowPrice || 0;
              next[key].highPrice = serverItem.highPrice || 0;
              next[key].confidence = serverItem.confidence || 50;
              next[key].trend = serverItem.trend;
              next[key].pricingSources = serverItem.pricingSources || [];
              next[key].marketplaceData = serverItem.marketplaceData || null;
              next[key].isPriced = true;
              next[key].priceHistory.push(serverItem.medianPrice || 0);
              next[key].confidenceHistory.push(serverItem.confidence || 50);
              next[key].lastSeen = Date.now();
              next[key].frames++;
              const wasLocked = next[key].isLocked;
              next[key].isLocked = next[key].frames >= CONFIDENCE_LOCK_FRAMES;
              
              // Auto-save when item becomes locked (confident identification)
              if (!wasLocked && next[key].isLocked && next[key].isPriced) {
                autoSaveItem(next[key]);
              }
            } else {
              // Create new item from server
              next[key] = {
                key,
                localId: key,
                name: serverItem.name || "Unknown",
                brand: serverItem.brand,
                model: serverItem.model,
                category: serverItem.category,
                condition: serverItem.condition,
                price: serverItem.medianPrice || 0,
                lowPrice: serverItem.lowPrice || 0,
                highPrice: serverItem.highPrice || 0,
                confidence: serverItem.confidence || 50,
                trend: serverItem.trend,
                box: serverBox,
                smoothedBox: serverBox,
                velocity: { x: 0, y: 0, w: 0, h: 0 },
                lastSeen: Date.now(),
                frames: 1,
                confidenceHistory: [serverItem.confidence || 50],
                priceHistory: [serverItem.medianPrice || 0],
                pricingSources: serverItem.pricingSources || [],
                marketplaceData: serverItem.marketplaceData || null,
                isPriced: true,
                isLocked: false,
              };
            }
          });

          return next;
        });
      }
    } catch (err) {
      console.error("Server scan failed:", err);
    } finally {
      serverScanLock.current = false;
      setIsServerScanning(false);
    }
  }, [captureFrame, isPaused, userId]);

  /* ───────── LOCAL DETECTION LOOP ───────── */

  const localDetect = useCallback(async () => {
    if (!modelReady || !videoRef.current || isPaused) return;

    const video = videoRef.current;
    const detections = await detect(video);

    if (detections.length > 0) {
      setItems((prev) => {
        const next = { ...prev };
        const now = Date.now();

        detections.forEach((det: LocalDetection) => {
          // Convert pixel bbox to normalized coordinates
          const box: Box = {
            x: det.bbox[0] / video.videoWidth,
            y: det.bbox[1] / video.videoHeight,
            w: det.bbox[2] / video.videoWidth,
            h: det.bbox[3] / video.videoHeight,
          };

          // Find matching item by IoU
          let bestMatch: string | null = null;
          let bestIoU = 0;

          Object.entries(next).forEach(([key, item]) => {
            const iou = calculateIoU(item.box, box);
            if (iou > IOU_THRESHOLD && iou > bestIoU) {
              bestIoU = iou;
              bestMatch = key;
            }
          });

          if (bestMatch && next[bestMatch]) {
            const item = next[bestMatch];
            
            // Calculate velocity for prediction
            const newVelocity = {
              x: lerp(item.velocity.x, box.x - item.box.x, VELOCITY_SMOOTHING),
              y: lerp(item.velocity.y, box.y - item.box.y, VELOCITY_SMOOTHING),
              w: lerp(item.velocity.w, box.w - item.box.w, VELOCITY_SMOOTHING),
              h: lerp(item.velocity.h, box.h - item.box.h, VELOCITY_SMOOTHING),
            };

            // Smooth the box
            const smoothed = {
              x: lerp(item.smoothedBox.x, box.x, SMOOTHING),
              y: lerp(item.smoothedBox.y, box.y, SMOOTHING),
              w: lerp(item.smoothedBox.w, box.w, SMOOTHING),
              h: lerp(item.smoothedBox.h, box.h, SMOOTHING),
            };

            item.box = box;
            item.smoothedBox = smoothed;
            item.velocity = newVelocity;
            item.lastSeen = now;
            item.frames++;
            item.isLocked = item.frames >= CONFIDENCE_LOCK_FRAMES;
          } else {
            // New local detection (not yet priced by server)
            const key = `local-${det.class}-${now}`;
            next[key] = {
              key,
              localId: det.id,
              name: det.class.charAt(0).toUpperCase() + det.class.slice(1),
              price: 0,
              lowPrice: 0,
              highPrice: 0,
              confidence: Math.round(det.score * 100),
              box,
              smoothedBox: box,
              velocity: { x: 0, y: 0, w: 0, h: 0 },
              lastSeen: now,
              frames: 1,
              confidenceHistory: [Math.round(det.score * 100)],
              priceHistory: [],
              isPriced: false,
              isLocked: false,
            };
          }
        });

        // Remove stale items
        Object.keys(next).forEach((key) => {
          if (now - next[key].lastSeen > STALE_THRESHOLD) {
            delete next[key];
          }
        });

        return next;
      });
    }
  }, [detect, modelReady, isPaused]);

  /* ───────── MAIN LOOP ───────── */

  useEffect(() => {
    let lastFrameTime = 0;
    let frameCount = 0;
    let lastFpsUpdate = performance.now();

    const loop = (timestamp: number) => {
      const elapsed = timestamp - lastFrameTime;

      // Throttle to target FPS
      if (elapsed >= FRAME_INTERVAL) {
        lastFrameTime = timestamp - (elapsed % FRAME_INTERVAL);
        
        // Run local detection (async, won't block)
        localDetect();

        // Server scan at lower frequency (handled internally)
        serverScan();

        // Update FPS counter
        frameCount++;
        const fpsElapsed = timestamp - lastFpsUpdate;
        if (fpsElapsed >= 1000) {
          setFps(Math.round((frameCount * 1000) / fpsElapsed));
          frameCount = 0;
          lastFpsUpdate = timestamp;
        }
      }

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [localDetect, serverScan]);

  // Update item count
  useEffect(() => {
    setItemCount(Object.keys(items).length);
  }, [items]);

  /* ───────── COMPUTED VALUES ───────── */

  const avgConfidence = (item: TrackedItem) =>
    item.confidenceHistory.length > 0
      ? Math.round(item.confidenceHistory.reduce((a, b) => a + b, 0) / item.confidenceHistory.length)
      : item.confidence;

  const avgPrice = (item: TrackedItem) =>
    item.priceHistory.length > 0
      ? item.priceHistory.reduce((a, b) => a + b, 0) / item.priceHistory.length
      : item.price;

  /* ───────── AUTO-SAVE TO LOG ───────── */

  const autoSaveItem = useCallback(async (item: TrackedItem) => {
    if (!item.isPriced || savedItems.has(item.key)) return;
    
    // Mark as saved immediately to prevent duplicates
    setSavedItems((prev) => new Set([...prev, item.key]));
    
    try {
      const { error } = await (supabase.from("scan_logs") as any).insert({
        user_id: userId,
        name: item.name,
        brand: item.brand || null,
        model: item.model || null,
        category: item.category || null,
        condition: item.condition || null,
        low_price: item.lowPrice,
        median_price: item.priceHistory.length > 0 
          ? Math.round(item.priceHistory.reduce((a, b) => a + b, 0) / item.priceHistory.length)
          : item.price,
        high_price: item.highPrice,
        confidence: item.confidenceHistory.length > 0
          ? Math.round(item.confidenceHistory.reduce((a, b) => a + b, 0) / item.confidenceHistory.length)
          : item.confidence,
        trend: item.trend || null,
        pricing_sources: item.pricingSources || null,
      });

      if (error) {
        console.error("Auto-save failed:", error);
        // Remove from saved set if failed
        setSavedItems((prev) => {
          const next = new Set(prev);
          next.delete(item.key);
          return next;
        });
      }
    } catch (err) {
      console.error("Auto-save failed:", err);
      setSavedItems((prev) => {
        const next = new Set(prev);
        next.delete(item.key);
        return next;
      });
    }
  }, [userId, savedItems]);

  const saveToLog = useCallback(async (item: TrackedItem) => {
    if (!item.isPriced || savedItems.has(item.key)) return;
    
    setSavingItem(item.key);
    try {
      const { error } = await (supabase.from("scan_logs") as any).insert({
        user_id: userId,
        name: item.name,
        brand: item.brand || null,
        model: item.model || null,
        category: item.category || null,
        condition: item.condition || null,
        low_price: item.lowPrice,
        median_price: Math.round(avgPrice(item)),
        high_price: item.highPrice,
        confidence: avgConfidence(item),
        trend: item.trend || null,
        pricing_sources: item.pricingSources || null,
      });

      if (error) throw error;
      
      setSavedItems((prev) => new Set([...prev, item.key]));
      toast.success(`${item.name} saved to history`);
    } catch (err) {
      console.error("Failed to save to log:", err);
      toast.error("Failed to save item");
    } finally {
      setSavingItem(null);
    }
  }, [userId, savedItems]);

  const saveAllPriced = useCallback(async () => {
    const pricedItems = Object.values(items).filter(
      (item) => item.isPriced && !savedItems.has(item.key)
    );
    
    if (pricedItems.length === 0) {
      toast.info("No new items to save");
      return;
    }

    for (const item of pricedItems) {
      await saveToLog(item);
    }
  }, [items, savedItems, saveToLog]);

  /* ───────── RENDER ───────── */

  return (
    <div className="fixed inset-0 bg-background z-50 overflow-hidden">
      {/* Video Feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Scan Overlay Effect */}
      {!isPaused && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan opacity-50" />
        </div>
      )}

      {/* Detected Items Overlays */}
      {Object.values(items).map((item) => (
        <div
          key={item.key}
          onClick={() => item.isPriced && setSelected(item)}
          className={`absolute transition-all duration-75 ease-out cursor-pointer ${
            item.isLocked ? "opacity-100" : "opacity-70"
          }`}
          style={{
            left: `${item.smoothedBox.x * 100}%`,
            top: `${item.smoothedBox.y * 100}%`,
            width: `${item.smoothedBox.w * 100}%`,
            height: `${item.smoothedBox.h * 100}%`,
          }}
        >
          {/* Bounding Box */}
          <div
            className={`absolute inset-0 border-2 rounded-lg ${getConfidenceBorder(avgConfidence(item))} ${
              item.isLocked ? "shadow-lg" : ""
            }`}
            style={{
              boxShadow: item.isLocked
                ? `0 0 20px hsl(var(--primary) / 0.3)`
                : undefined,
            }}
          >
            {/* Corner Brackets */}
            <div className="absolute -top-0.5 -left-0.5 w-3 h-3 border-t-2 border-l-2 border-primary rounded-tl" />
            <div className="absolute -top-0.5 -right-0.5 w-3 h-3 border-t-2 border-r-2 border-primary rounded-tr" />
            <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 border-b-2 border-l-2 border-primary rounded-bl" />
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-b-2 border-r-2 border-primary rounded-br" />
          </div>

          {/* Price Badge - Glass Morphism */}
          <div
            className={`absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full backdrop-blur-md bg-gradient-to-r ${getConfidenceColor(
              avgConfidence(item)
            )} border border-white/20 shadow-lg transform transition-all duration-200 hover:scale-105 min-w-max`}
          >
            <div className="flex items-center gap-1.5 text-white font-semibold text-sm">
              {item.isPriced ? (
                <>
                  {item.marketplaceData ? (
                    <Globe className="w-3.5 h-3.5 text-blue-300" />
                  ) : (
                    <DollarSign className="w-3.5 h-3.5" />
                  )}
                  <span>{Math.round(avgPrice(item))}</span>
                  {item.trend === "up" && <TrendingUp className="w-3 h-3 text-green-300" />}
                  {item.trend === "down" && <TrendingDown className="w-3 h-3 text-red-300" />}
                </>
              ) : (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-xs">Pricing...</span>
                </>
              )}
            </div>
          </div>

          {/* Item Name Badge */}
          <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-background/80 backdrop-blur-sm text-xs text-foreground font-medium truncate max-w-[150px]">
            {item.name}
          </div>
        </div>
      ))}

      {/* Top Status Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-background/80 to-transparent">
        <div className="flex items-center gap-3">
          <Badge
            variant="secondary"
            className="bg-background/80 backdrop-blur-sm border-border"
          >
            <Eye className="w-3 h-3 mr-1" />
            {itemCount} Items • {savedItems.size} Saved
          </Badge>

          {modelReady && (
            <Badge
              variant="secondary"
              className="bg-success/20 text-success border-success/30"
            >
              <Zap className="w-3 h-3 mr-1" />
              {fps} FPS
            </Badge>
          )}

          {isServerScanning && (
            <Badge
              variant="secondary"
              className="bg-primary/20 text-primary border-primary/30"
            >
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Pricing
            </Badge>
          )}

          {marketplaceScrapeEnabled && (
            <Badge
              variant="secondary"
              className="bg-blue-500/20 text-blue-400 border-blue-500/30"
            >
              <Globe className="w-3 h-3 mr-1" />
              Live eBay Data
              {scrapedItemsCount > 0 && <span className="ml-1">({scrapedItemsCount})</span>}
            </Badge>
          )}

          {modelLoading && (
            <Badge
              variant="secondary"
              className="bg-amber-500/20 text-amber-400 border-amber-500/30"
            >
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Loading AI...
            </Badge>
          )}
        </div>

        {/* History button in top bar - more prominent */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowHistory(true)}
            variant="secondary"
            size="sm"
            className="bg-primary/90 hover:bg-primary text-primary-foreground backdrop-blur-sm shadow-lg border-0 gap-2"
          >
            <History className="w-4 h-4" />
            <span className="font-medium">History</span>
            {savedItems.size > 0 && (
              <Badge variant="outline" className="ml-1 bg-background/20 text-primary-foreground border-primary-foreground/30 text-xs px-1.5 py-0">
                {savedItems.size}
              </Badge>
            )}
          </Button>
          <Button
            onClick={onClose}
            size="icon"
            variant="ghost"
            className="bg-background/50 backdrop-blur-sm hover:bg-background/80"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background/90 to-transparent">
        <div className="flex items-center justify-center gap-3">
          <Button
            onClick={() => setIsPaused(!isPaused)}
            variant="secondary"
            size="lg"
            className="rounded-full w-14 h-14 bg-background/80 backdrop-blur-sm"
          >
            {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
          </Button>


          <Button
            onClick={saveAllPriced}
            variant="hero"
            size="lg"
            className="rounded-full w-16 h-16 shadow-lg"
            disabled={Object.values(items).filter(i => i.isPriced && !savedItems.has(i.key)).length === 0}
          >
            <Save className="w-7 h-7" />
          </Button>

          <Button
            onClick={switchCamera}
            variant="secondary"
            size="lg"
            className="rounded-full w-14 h-14 bg-background/80 backdrop-blur-sm"
          >
            <SwitchCamera className="w-6 h-6" />
          </Button>

          <Button
            onClick={() => {
              setItems({});
              setSavedItems(new Set());
              toast.success("Scanner reset");
            }}
            variant="secondary"
            size="lg"
            className="rounded-full w-14 h-14 bg-background/80 backdrop-blur-sm"
          >
            <RefreshCw className="w-6 h-6" />
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-3">
          {isPaused ? "Paused" : "Point camera at items • Items auto-save when identified • Tap for details"}
        </p>
      </div>

      {/* Item Detail Modal */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        {selected && (
          <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="w-5 h-5 text-primary" />
                {selected.name}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Item Details */}
              {(selected.brand || selected.model || selected.category) && (
                <div className="flex flex-wrap gap-2">
                  {selected.brand && (
                    <Badge variant="outline">
                      <Tag className="w-3 h-3 mr-1" />
                      {selected.brand}
                    </Badge>
                  )}
                  {selected.model && (
                    <Badge variant="outline">{selected.model}</Badge>
                  )}
                  {selected.category && (
                    <Badge variant="secondary">{selected.category}</Badge>
                  )}
                  {selected.condition && (
                    <Badge
                      variant="outline"
                      className="bg-success/10 text-success border-success/30"
                    >
                      {selected.condition}
                    </Badge>
                  )}
                </div>
              )}

              {/* Price Summary */}
              <div className="bg-muted/50 rounded-xl p-4 text-center">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <DollarSign className="w-8 h-8 text-primary" />
                  <span className="text-4xl font-bold text-foreground">
                    {Math.round(avgPrice(selected))}
                  </span>
                  {selected.trend === "up" && (
                    <TrendingUp className="w-6 h-6 text-success" />
                  )}
                  {selected.trend === "down" && (
                    <TrendingDown className="w-6 h-6 text-destructive" />
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Estimated Market Value
                </p>

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="bg-background/50 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">Low</p>
                    <p className="font-semibold">${selected.lowPrice}</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">Median</p>
                    <p className="font-semibold">${Math.round(avgPrice(selected))}</p>
                  </div>
                  <div className="bg-background/50 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">High</p>
                    <p className="font-semibold">${selected.highPrice}</p>
                  </div>
                </div>

                <Badge className="mt-3" variant="secondary">
                  {avgConfidence(selected)}% Confidence • {selected.frames} frames
                </Badge>
              </div>

              {/* Pricing Sources */}
              {selected.pricingSources && selected.pricingSources.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-muted-foreground">
                    Recent Sales Data
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selected.pricingSources.map((source, idx) => {
                      const content = (
                        <>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`marketplace-badge marketplace-${source.marketplace.toLowerCase()}`}>
                                {source.marketplace}
                              </span>
                              <Badge variant="outline" className="text-xs">
                                {source.condition}
                              </Badge>
                              {source.url && (
                                <ExternalLink className="w-3 h-3 text-primary" />
                              )}
                            </div>
                            <p className="text-sm truncate">{source.title}</p>
                          </div>
                          <div className="text-right ml-3">
                            <p className="font-bold text-lg">${source.price}</p>
                            <p className="text-xs text-muted-foreground">
                              {source.soldDate}
                            </p>
                          </div>
                        </>
                      );
                      
                      return source.url ? (
                        <a
                          key={idx}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between bg-muted/30 rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                        >
                          {content}
                        </a>
                      ) : (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-muted/30 rounded-lg p-3"
                        >
                          {content}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={() => {
                    saveToLog(selected);
                    setSelected(null);
                  }}
                  disabled={savedItems.has(selected.key) || savingItem === selected.key}
                  className="flex-1"
                >
                  {savedItems.has(selected.key) ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Saved
                    </>
                  ) : savingItem === selected.key ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setFeedbackItem(selected);
                    setSelected(null);
                  }}
                  className="flex-1"
                >
                  <Brain className="w-4 h-4 mr-2" />
                  Feedback
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* Feedback Modal */}
      <FeedbackModal
        open={!!feedbackItem}
        onOpenChange={(open) => !open && setFeedbackItem(null)}
        item={feedbackItem ? {
          name: feedbackItem.name,
          brand: feedbackItem.brand,
          model: feedbackItem.model,
          category: feedbackItem.category,
          condition: feedbackItem.condition,
          lowPrice: feedbackItem.lowPrice,
          highPrice: feedbackItem.highPrice,
        } : null}
        userId={userId}
      />

      {/* Scan History Modal */}
      <ScanLogModal
        open={showHistory}
        onClose={() => setShowHistory(false)}
        userId={userId}
      />
    </div>
  );
}
