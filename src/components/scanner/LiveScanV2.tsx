import { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Brain,
  Globe,
  ShoppingBag,
  Settings,
  ChevronDown,
  Clock,
  Search,
  BatteryLow,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTensorFlow, LocalDetection } from '@/hooks/useTensorFlow';
import { IntentSelector, ScanIntent } from './IntentSelector';
import { ProfitOverlay } from './ProfitOverlay';
import { WalkAwaySummary } from './WalkAwaySummary';
import { ItemDetailModal } from './ItemDetailModal';
import { invokeSupabaseFunction, parseSupabaseFunctionError } from '@/lib/supabase-functions';
import { formatAud } from '@/lib/utils';
import {
  attachCameraStream,
  getCameraErrorMessage,
  isCameraPermissionDenied,
  requestBestEffortCameraStream,
  stopCameraStream,
} from '@/lib/camera';

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

interface MarketplaceDataStatus {
  source?: string | null;
  verificationStatus?: 'verified' | 'manual_required';
  message?: string;
  listingsFound?: number;
  avgPrice?: number;
}

interface TrackedItem {
  key: string;
  localId: string;
  name: string;
  brand?: string;
  model?: string;
  manufacturer?: string;
  category?: string;
  condition?: string;
  rarity?: 'common' | 'uncommon' | 'rare' | 'very-rare';
  yearMade?: string;
  originStory?: string;
  salesStrategy?: string;
  bestMarketplace?: string | null;
  optimalSearchTerms?: string[];
  price: number;
  lowPrice: number;
  highPrice: number;
  confidence: number;
  trend?: 'up' | 'down' | 'stable';
  box: Box;
  smoothedBox: Box;
  velocity: { x: number; y: number; w: number; h: number };
  lastSeen: number;
  frames: number;
  confidenceHistory: number[];
  priceHistory: number[];
  pricingSources?: PricingSource[];
  marketplaceData?: MarketplaceDataStatus | null;
  isPriced: boolean;
  isLocked: boolean;
  suggestedBuyUnder?: number;
  estimatedProfit?: { low: number; high: number };
  timeToSell?: 'fast' | 'medium' | 'slow';
}

interface VisionPlusItem {
  key: string;
  label: string;
  boundingBox: Box;
}

/* ───────────────── CONSTANTS ───────────────── */

const SMOOTHING = 0.35;
const VELOCITY_SMOOTHING = 0.5;
const SERVER_SCAN_INTERVAL = 650;
const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;
const CONFIDENCE_LOCK_FRAMES = 3;
const STALE_THRESHOLD = 2000;
const IOU_THRESHOLD = 0.25;
const CAPTURE_MAX_WIDTH = 960;
const IMAGE_QUALITY = 0.62;
const VISION_PLUS_INTERVAL = 3200;
const VISION_PLUS_MAX_WIDTH = 1280;
const VISION_PLUS_QUALITY = 0.82;

// SES §5 — Power-State Polling: when OS power-saving mode is active drop frame
// rate by 50% and disable heavy edge-rendering to prevent thermal throttling.
const TARGET_FPS_POWER_SAVE = TARGET_FPS / 2; // 15 FPS
const FRAME_INTERVAL_POWER_SAVE = 1000 / TARGET_FPS_POWER_SAVE;

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

function dataUrlToBlob(dataUrl: string) {
  const [header, base64Data] = dataUrl.split(',');
  const mimeType = header.match(/data:(.*?);base64/)?.[1] || 'image/webp';
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i += 1) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

/* ───────────────── COMPONENT ───────────────── */

interface LiveScanV2Props {
  onClose: () => void;
  userId: string;
}

export function LiveScanV2({ onClose, userId }: LiveScanV2Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>(0);
  const lastServerScan = useRef(0);
  const serverScanLock = useRef(false);
  const localDetectLock = useRef(false);

  // UI States
  const [showIntentSelector, setShowIntentSelector] = useState(true);
  const [selectedIntent, setSelectedIntent] = useState<ScanIntent | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showItemDetail, setShowItemDetail] = useState<TrackedItem | null>(null);

  // Scanner States
  const [items, setItems] = useState<Record<string, TrackedItem>>({});
  const [isServerScanning, setIsServerScanning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [itemCount, setItemCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [savedItems, setSavedItems] = useState<Set<string>>(new Set());
  const [savedInventoryItems, setSavedInventoryItems] = useState<Set<string>>(new Set());
  const [isSavingFinds, setIsSavingFinds] = useState(false);
  const [marketplaceScrapeEnabled, setMarketplaceScrapeEnabled] = useState(false);
  const [visionPlusEnabled, setVisionPlusEnabled] = useState(false);
  const [isVisionPlusScanning, setIsVisionPlusScanning] = useState(false);
  const [lastServerDurationMs, setLastServerDurationMs] = useState<number | null>(null);
  const [averageServerDurationMs, setAverageServerDurationMs] = useState(2300);
  const [serverScanElapsedMs, setServerScanElapsedMs] = useState(0);
  const [serverScanEtaMs, setServerScanEtaMs] = useState<number | null>(null);
  const visionPlusScanLock = useRef(false);
  const lastVisionPlusScan = useRef(0);
  const serverScanStartedAt = useRef<number | null>(null);
  const serverScanTicker = useRef<number | null>(null);
  const lastScanErrorToast = useRef(0);

  // SES §5 — Power-State Polling
  const [isPowerSaving, setIsPowerSaving] = useState(false);
  // SES §5 — Permission denied fallback
  const [permissionDenied, setPermissionDenied] = useState(false);

  const { detect, isLoading: modelLoading, isReady: modelReady } = useTensorFlow();

  /* ───────── INTENT HANDLERS ───────── */

  const handleIntentSelect = (intent: ScanIntent) => {
    setSelectedIntent(intent);
    setShowIntentSelector(false);
    toast.success(`Focused on ${intent.replace('-', ' & ')}`);
  };

  const handleIntentSkip = () => {
    setShowIntentSelector(false);
  };

  /* ───────── SES §5: POWER-STATE POLLING ───────── */

  useEffect(() => {
    // Battery Status API (Chrome/Android). Falls back gracefully when unavailable.
    type BatteryManager = EventTarget & {
      charging: boolean;
      level: number;
      addEventListener(type: string, listener: () => void): void;
      removeEventListener(type: string, listener: () => void): void;
    };

    let battery: BatteryManager | null = null;

    const updatePowerSave = () => {
      if (!battery) return;
      // Power saving if battery is discharging AND level is at or below 20 %
      const saving = !battery.charging && battery.level <= 0.20;
      setIsPowerSaving(saving);
      if (saving) {
        console.info('[iSpy] Power-saving mode active — frame rate reduced to 15 FPS, heavy rendering disabled.');
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    if (typeof nav.getBattery === 'function') {
      nav.getBattery().then((b: BatteryManager) => {
        battery = b;
        updatePowerSave();
        b.addEventListener('chargingchange', updatePowerSave);
        b.addEventListener('levelchange', updatePowerSave);
      }).catch(() => {
        // Battery API unavailable — no power-save degradation
      });
    }

    return () => {
      if (battery) {
        battery.removeEventListener('chargingchange', updatePowerSave);
        battery.removeEventListener('levelchange', updatePowerSave);
      }
    };
  }, []);

  /* ───────── SES §5: PERMISSION DENIED DETECTION ───────── */

  useEffect(() => {
    isCameraPermissionDenied().then(setPermissionDenied).catch(() => {});
  }, [cameraError]);

  /* ───────── CAMERA ───────── */

  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    try {
      setCameraError(null);
      stopCameraStream(streamRef.current);
      streamRef.current = null;

      const stream = await requestBestEffortCameraStream(facing);
      const video = videoRef.current;
      if (!video) {
        stopCameraStream(stream);
        throw new Error('Camera preview could not be attached.');
      }

      streamRef.current = stream;
      await attachCameraStream(video, stream);
    } catch (err) {
      console.error('Camera error:', err);
      const message = getCameraErrorMessage(err);
      setCameraError(message);
      toast.error(message);
    }
  }, []);

  useEffect(() => {
    if (!showIntentSelector) {
      void startCamera(facingMode);
    }
    return () => {
      stopCameraStream(streamRef.current);
      streamRef.current = null;
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [facingMode, startCamera, showIntentSelector]);

  const switchCamera = () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setCameraError(null);
    setFacingMode(newMode);
    toast.info(`Switched to ${newMode === 'environment' ? 'back' : 'front'} camera`);
  };

  const retryCamera = useCallback(() => {
    void startCamera(facingMode);
  }, [facingMode, startCamera]);

  /* ───────── FRAME CAPTURE ───────── */

  const captureFrame = useCallback((options?: { maxWidth?: number; quality?: number }): string | null => {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c || !v.videoWidth) return null;

    const maxWidth = options?.maxWidth ?? 1280;
    const scale = Math.min(1, maxWidth / v.videoWidth);
    c.width = Math.round(v.videoWidth * scale);
    c.height = Math.round(v.videoHeight * scale);

    const ctx = c.getContext('2d', { alpha: false, willReadFrequently: false });
    if (!ctx) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(v, 0, 0, c.width, c.height);

    const quality = options?.quality ?? IMAGE_QUALITY;
    // Use JPEG for broad mobile compatibility — iOS Safari does not support
    // image/webp on canvas and silently falls back to lossless PNG, which
    // produces files far larger than our 5 MB server limit.
    return c.toDataURL('image/jpeg', quality);
  }, []);

  /* ───────── SERVER PRICING SCAN ───────── */

  const serverScan = useCallback(async () => {
    if (serverScanLock.current || isPaused || showIntentSelector || cameraError) return;
    if (Date.now() - lastServerScan.current < SERVER_SCAN_INTERVAL) return;

    const frame = captureFrame({ maxWidth: CAPTURE_MAX_WIDTH, quality: IMAGE_QUALITY });
    if (!frame) return;

    serverScanLock.current = true;
    lastServerScan.current = Date.now();
    const startedAt = Date.now();
    serverScanStartedAt.current = startedAt;
    setServerScanElapsedMs(0);
    setServerScanEtaMs(Math.max(800, averageServerDurationMs));
    setIsServerScanning(true);

    try {
      const { data, error } = await invokeSupabaseFunction<{
        creditsExhausted?: boolean;
        items?: any[];
        marketplaceScrapeEnabled?: boolean;
      }>('live-scan', {
        image: frame,
        userId,
        intent: selectedIntent,
        enableMarketplaceScrape: true,
      });

      if (error) {
        console.error('Server scan error:', error);
        // Surface the error — critical on mobile where silent failures look like
        // a broken scanner. Throttle to once per 30 s to avoid toast spam.
        const now = Date.now();
        if (now - lastScanErrorToast.current > 30_000) {
          lastScanErrorToast.current = now;
          parseSupabaseFunctionError(error, 'Scan failed. Check your connection and try again.').then((msg) => {
            if (msg.includes('too large') || msg.includes('5MB')) {
              toast.error('Frame too large to process. Move back slightly and retry.');
            } else if (msg.includes('credits') || msg.includes('402')) {
              toast.error('AI credits exhausted. Please upgrade your plan.');
            } else {
              toast.error(`Scan error: ${msg.slice(0, 100)}`);
            }
          });
        }
        return;
      }

      if (data?.creditsExhausted) {
        toast.error('AI credits exhausted. Please upgrade your plan.');
        return;
      }

      setMarketplaceScrapeEnabled(Boolean(data?.marketplaceScrapeEnabled));

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
            
            // Calculate profit metrics
            const price = serverItem.medianPrice || 0;
            const lowPrice = serverItem.lowPrice || 0;
            const highPrice = serverItem.highPrice || 0;
            const platformFees = price * 0.13;
            const suggestedBuy = Math.round(lowPrice * 0.6);
            const incomingPricingSources = serverItem.pricingSources || [];
            const incomingMarketplaceData = (serverItem.marketplaceData || null) as MarketplaceDataStatus | null;
            const incomingVerified =
              incomingMarketplaceData?.verificationStatus === 'verified' ||
              incomingPricingSources.length > 0;
            
            if (next[key]) {
              next[key].name = serverItem.name || next[key].name;
              next[key].brand = serverItem.brand;
              next[key].model = serverItem.model;
              next[key].manufacturer = serverItem.manufacturer;
              next[key].category = serverItem.category;
              next[key].condition = serverItem.condition;
              next[key].rarity = serverItem.rarity;
              next[key].yearMade = serverItem.yearMade;
              next[key].originStory = serverItem.originStory;
              next[key].salesStrategy = serverItem.salesStrategy;
              next[key].bestMarketplace = serverItem.bestMarketplace;
              next[key].optimalSearchTerms = serverItem.optimalSearchTerms;
              next[key].confidence = serverItem.confidence || 50;
              const existingVerified =
                next[key].marketplaceData?.verificationStatus === 'verified' ||
                (next[key].pricingSources?.length || 0) > 0;

              next[key].marketplaceData =
                incomingVerified || !existingVerified
                  ? incomingMarketplaceData ?? next[key].marketplaceData ?? null
                  : next[key].marketplaceData ?? null;

              if (incomingVerified || !existingVerified) {
                next[key].price = price;
                next[key].lowPrice = lowPrice;
                next[key].highPrice = highPrice;
                next[key].trend = incomingVerified ? serverItem.trend : undefined;
                next[key].pricingSources = incomingPricingSources;
                next[key].isPriced = incomingVerified;
                next[key].suggestedBuyUnder = suggestedBuy;
                next[key].estimatedProfit = {
                  low: incomingVerified ? lowPrice - suggestedBuy - platformFees : 0,
                  high: incomingVerified ? highPrice - suggestedBuy - platformFees : 0,
                };
                next[key].timeToSell = incomingVerified
                  ? serverItem.avgDaysToSell <= 7 ? 'fast' : serverItem.avgDaysToSell <= 21 ? 'medium' : 'slow'
                  : undefined;
              }
              next[key].priceHistory.push(next[key].price);
              next[key].confidenceHistory.push(serverItem.confidence || 50);
              next[key].lastSeen = Date.now();
              next[key].frames++;
              const wasLocked = next[key].isLocked;
              next[key].isLocked = next[key].frames >= CONFIDENCE_LOCK_FRAMES;

              if (!wasLocked && next[key].isLocked && next[key].isPriced) {
                autoSaveItem(next[key]);
              }
            } else {
              next[key] = {
                key,
                localId: key,
                name: serverItem.name || 'Unknown',
                brand: serverItem.brand,
                model: serverItem.model,
                manufacturer: serverItem.manufacturer,
                category: serverItem.category,
                condition: serverItem.condition,
                rarity: serverItem.rarity,
                yearMade: serverItem.yearMade,
                originStory: serverItem.originStory,
                salesStrategy: serverItem.salesStrategy,
                bestMarketplace: serverItem.bestMarketplace,
                optimalSearchTerms: serverItem.optimalSearchTerms,
                price,
                lowPrice,
                highPrice,
                confidence: serverItem.confidence || 50,
                trend: incomingVerified ? serverItem.trend : undefined,
                box: serverBox,
                smoothedBox: serverBox,
                velocity: { x: 0, y: 0, w: 0, h: 0 },
                lastSeen: Date.now(),
                frames: 1,
                confidenceHistory: [serverItem.confidence || 50],
                priceHistory: [price],
                pricingSources: incomingPricingSources,
                marketplaceData: incomingMarketplaceData,
                isPriced: incomingVerified,
                isLocked: false,
                suggestedBuyUnder: incomingVerified ? suggestedBuy : undefined,
                estimatedProfit: {
                  low: incomingVerified ? lowPrice - suggestedBuy - platformFees : 0,
                  high: incomingVerified ? highPrice - suggestedBuy - platformFees : 0
                },
                timeToSell: incomingVerified
                  ? serverItem.avgDaysToSell <= 7 ? 'fast' : serverItem.avgDaysToSell <= 21 ? 'medium' : 'slow'
                  : undefined,
              };
            }
          });

          return next;
        });
      }
    } catch (err) {
      console.error('Server scan failed:', err);
    } finally {
      const duration = Date.now() - startedAt;
      setLastServerDurationMs(duration);
      setAverageServerDurationMs((prev) => Math.round(prev * 0.7 + duration * 0.3));
      serverScanStartedAt.current = null;
      setServerScanEtaMs(null);
      setServerScanElapsedMs(0);
      serverScanLock.current = false;
      setIsServerScanning(false);
    }
  }, [averageServerDurationMs, cameraError, captureFrame, isPaused, userId, selectedIntent, showIntentSelector]);

  useEffect(() => {
    if (!isServerScanning) {
      if (serverScanTicker.current) {
        window.clearInterval(serverScanTicker.current);
        serverScanTicker.current = null;
      }
      setServerScanElapsedMs(0);
      setServerScanEtaMs(null);
      return;
    }

    const tick = () => {
      if (!serverScanStartedAt.current) return;
      const elapsed = Date.now() - serverScanStartedAt.current;
      setServerScanElapsedMs(elapsed);
      setServerScanEtaMs(Math.max(0, averageServerDurationMs - elapsed));
    };

    tick();
    serverScanTicker.current = window.setInterval(tick, 120);

    return () => {
      if (serverScanTicker.current) {
        window.clearInterval(serverScanTicker.current);
        serverScanTicker.current = null;
      }
    };
  }, [averageServerDurationMs, isServerScanning]);

  /* ───────────────── VISION+ REFINEMENT ───────────────── */

  const mergeVisionPlusResults = useCallback((visionItems: VisionPlusItem[]) => {
    if (!visionItems || visionItems.length === 0) return;
    setItems((prev) => {
      const next = { ...prev };
      const now = Date.now();

      visionItems.forEach((vItem) => {
        const vBox: Box = {
          x: vItem.boundingBox.x,
          y: vItem.boundingBox.y,
          w: vItem.boundingBox.width,
          h: vItem.boundingBox.height,
        };

        let bestMatch: string | null = null;
        let bestIoU = 0;

        Object.entries(next).forEach(([key, item]) => {
          const iou = calculateIoU(item.box, vBox);
          if (iou > IOU_THRESHOLD && iou > bestIoU) {
            bestIoU = iou;
            bestMatch = key;
          }
        });

        if (bestMatch && next[bestMatch]) {
          const item = next[bestMatch];
          const shouldRename = item.name === 'Unknown' || item.confidence < 60;
          next[bestMatch] = {
            ...item,
            name: shouldRename ? vItem.label : item.name,
            box: vBox,
            smoothedBox: vBox,
            lastSeen: now,
          };
        } else {
          const key = `vision-${Date.now()}-${Math.random()}`;
          next[key] = {
            key,
            localId: key,
            name: vItem.label || 'Unknown',
            price: 0,
            lowPrice: 0,
            highPrice: 0,
            confidence: 60,
            box: vBox,
            smoothedBox: vBox,
            velocity: { x: 0, y: 0, w: 0, h: 0 },
            lastSeen: now,
            frames: 1,
            confidenceHistory: [60],
            priceHistory: [],
            isPriced: false,
            isLocked: false,
          };
        }
      });

      return next;
    });
  }, []);

  const visionPlusScan = useCallback(async () => {
    if (!visionPlusEnabled || visionPlusScanLock.current || isPaused || showIntentSelector || cameraError) return;
    if (Date.now() - lastVisionPlusScan.current < VISION_PLUS_INTERVAL) return;

    const frame = captureFrame({ maxWidth: VISION_PLUS_MAX_WIDTH, quality: VISION_PLUS_QUALITY });
    if (!frame) return;

    visionPlusScanLock.current = true;
    lastVisionPlusScan.current = Date.now();
    setIsVisionPlusScanning(true);

    try {
      const { data, error } = await invokeSupabaseFunction<{ items?: VisionPlusItem[] }>('vision-plus', {
        image: frame,
      });

      if (error) {
        console.error('Vision+ error:', error);
        return;
      }

      if (Array.isArray(data?.items)) {
        mergeVisionPlusResults(data.items);
      }
    } catch (err) {
      console.error('Vision+ scan failed:', err);
    } finally {
      visionPlusScanLock.current = false;
      setIsVisionPlusScanning(false);
    }
  }, [cameraError, captureFrame, isPaused, mergeVisionPlusResults, showIntentSelector, visionPlusEnabled]);

  /* ───────── AUTO-SAVE ───────── */

  const autoSaveItem = useCallback(async (item: TrackedItem) => {
    if (!item.isPriced || savedItems.has(item.key)) return;

    setSavedItems((prev) => new Set([...prev, item.key]));

    try {
      await (supabase.from('scan_logs') as any).insert({
        user_id: userId,
        name: item.name,
        brand: item.brand || null,
        model: item.model || null,
        category: item.category || null,
        condition: item.condition || null,
        low_price: item.lowPrice,
        median_price: Math.round(item.priceHistory.reduce((a, b) => a + b, 0) / item.priceHistory.length),
        high_price: item.highPrice,
        confidence: Math.round(item.confidenceHistory.reduce((a, b) => a + b, 0) / item.confidenceHistory.length),
        trend: item.trend || null,
        pricing_sources: item.pricingSources || null,
      });
    } catch (err) {
      console.error('Auto-save failed:', err);
      setSavedItems((prev) => {
        const next = new Set(prev);
        next.delete(item.key);
        return next;
      });
    }
  }, [userId, savedItems]);

  /* ───────── LOCAL DETECTION LOOP ───────── */

  const localDetect = useCallback(async () => {
    if (!modelReady || !videoRef.current || isPaused || showIntentSelector || cameraError) return;
    if (localDetectLock.current) return;
    localDetectLock.current = true;

    try {
      const video = videoRef.current;
      if (!video.videoWidth || !video.videoHeight) return;
      const detections = await detect(video);

      if (detections.length > 0) {
        setItems((prev) => {
          const next = { ...prev };
          const now = Date.now();

          detections.forEach((det: LocalDetection) => {
            const box: Box = {
              x: det.bbox[0] / video.videoWidth,
              y: det.bbox[1] / video.videoHeight,
              w: det.bbox[2] / video.videoWidth,
              h: det.bbox[3] / video.videoHeight,
            };

            let bestMatch: string | null = null;
            let bestIoU = 0;

            Object.entries(next).forEach(([key, item]) => {
              const iou = calculateIoU(item.box, box);
              if (iou > IOU_THRESHOLD && iou > bestIoU) {
                bestIoU = iou;
                bestMatch = key;
              }
            });

            // Only update position of server-identified items — never create new items
            // from COCO-SSD class names (e.g. "person", "book") as they are inaccurate
            // for resale identification. Gemini (server scan) is the sole source of truth
            // for item names and categories.
            if (bestMatch && next[bestMatch]) {
              const item = next[bestMatch];

              const newVelocity = {
                x: lerp(item.velocity.x, box.x - item.box.x, VELOCITY_SMOOTHING),
                y: lerp(item.velocity.y, box.y - item.box.y, VELOCITY_SMOOTHING),
                w: lerp(item.velocity.w, box.w - item.box.w, VELOCITY_SMOOTHING),
                h: lerp(item.velocity.h, box.h - item.box.h, VELOCITY_SMOOTHING),
              };

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
    } finally {
      localDetectLock.current = false;
    }
  }, [cameraError, detect, modelReady, isPaused, showIntentSelector]);

  /* ───────── MAIN LOOP (SES §5: Power-State Aware) ───────── */

  useEffect(() => {
    if (showIntentSelector || cameraError) return;

    let lastFrameTime = 0;
    let frameCount = 0;
    let lastFpsUpdate = performance.now();

    const loop = (timestamp: number) => {
      // SES §5: Use reduced frame interval when power-saving mode is active.
      const activeFrameInterval = isPowerSaving ? FRAME_INTERVAL_POWER_SAVE : FRAME_INTERVAL;
      const elapsed = timestamp - lastFrameTime;

      if (elapsed >= activeFrameInterval) {
        lastFrameTime = timestamp - (elapsed % activeFrameInterval);
        localDetect();
        serverScan();
        // SES §5: Disable Vision+ heavy edge-rendering in power-save mode.
        if (!isPowerSaving) {
          visionPlusScan();
        }

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
  }, [cameraError, isPowerSaving, localDetect, serverScan, showIntentSelector, visionPlusScan]);

  useEffect(() => {
    setItemCount(Object.keys(items).length);
  }, [items]);

  /* ───────── SUMMARY HELPERS ───────── */

  const getSummaryItems = useCallback(() => {
    return Object.values(items)
      .filter(i => i.isPriced)
      .map(item => {
        const platformFees = item.price * 0.13;
        const suggestedBuy = item.suggestedBuyUnder || Math.round(item.lowPrice * 0.6);
        return {
          key: item.key,
          name: item.name,
          price: item.price,
          lowPrice: item.lowPrice,
          highPrice: item.highPrice,
          confidence: item.confidence,
          suggestedBuy,
          netProfitLow: item.lowPrice - suggestedBuy - platformFees,
          netProfitHigh: item.highPrice - suggestedBuy - platformFees,
          isRisky: item.confidence < 50
        };
      });
  }, [items]);

  const saveSummaryItemsToInventory = useCallback(async () => {
    const trackedItems = Object.values(items).filter(
      (item) => item.isPriced && !savedInventoryItems.has(item.key),
    );

    if (trackedItems.length === 0) {
      toast.info('All priced finds from this session are already saved to inventory.');
      return;
    }

    const frame = captureFrame({ maxWidth: CAPTURE_MAX_WIDTH, quality: IMAGE_QUALITY });
    if (!frame) {
      toast.error('Unable to capture the current scan frame.');
      return;
    }

    setIsSavingFinds(true);
    try {
      const blob = dataUrlToBlob(frame);
      const fileName = `${userId}/live-scan-${Date.now()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from('item-images')
        .upload(fileName, blob, {
          contentType: blob.type,
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('item-images').getPublicUrl(fileName);
      const imageUrl = urlData.publicUrl;
      const newlySavedKeys: string[] = [];
      let savedCount = 0;

      for (const item of trackedItems) {
        const suggestedBuy = item.suggestedBuyUnder || Math.round(item.lowPrice * 0.6);
        const notes = `Saved from live scan summary. Suggested buy under ${formatAud(suggestedBuy, { decimals: 0 })}. Confidence ${Math.round(item.confidence)}%.`;

        const { data: savedItem, error: itemError } = await supabase
          .from('items')
          .insert({
            user_id: userId,
            image_url: imageUrl,
            title: item.name,
            brand: item.brand || null,
            model: item.model || null,
            category: item.category || null,
            condition: item.condition || null,
            condition_score: null,
            purchase_price: null,
            notes,
            status: 'pending',
          })
          .select()
          .single();

        if (itemError || !savedItem) {
          console.error('Failed to save live-scan item to inventory:', itemError);
          continue;
        }

        const soldComparables = (item.pricingSources || []).map((source) => ({
          title: source.title,
          price: source.price,
          marketplace: source.marketplace,
          condition: source.condition,
          timeframe: source.soldDate,
          url: source.url,
        }));
        const hasVerifiedPricing = soldComparables.length > 0;

        const { error: marketReportError } = await supabase.from('market_reports').insert({
          item_id: savedItem.id,
          low_price: hasVerifiedPricing ? item.lowPrice || null : null,
          median_price: hasVerifiedPricing ? item.price || null : null,
          high_price: hasVerifiedPricing ? item.highPrice || null : null,
          avg_days_to_sell: hasVerifiedPricing
            ? item.timeToSell === 'fast' ? 7 : item.timeToSell === 'medium' ? 14 : item.timeToSell === 'slow' ? 30 : null
            : null,
          confidence_score: hasVerifiedPricing ? Math.round(item.confidence) : null,
          best_marketplace: hasVerifiedPricing ? item.pricingSources?.[0]?.marketplace || null : null,
          suggested_price: hasVerifiedPricing ? item.price || null : null,
          price_trend: hasVerifiedPricing ? item.trend || null : null,
          data_sources: hasVerifiedPricing
            ? { ebay: { listings: item.pricingSources.length, avgPrice: item.price } }
            : {},
          sold_comparables: hasVerifiedPricing ? soldComparables : [],
          verification_status: hasVerifiedPricing ? 'verified' : 'manual_required',
          verification_source: hasVerifiedPricing ? item.marketplaceData?.source || 'scrapingbee' : null,
          verification_message: hasVerifiedPricing ? null : item.marketplaceData?.message || 'Insufficient Market Data - Manual Entry Required.',
          verified_comps_count: hasVerifiedPricing ? soldComparables.length : 0,
        } as any);

        if (marketReportError) {
          console.error('Failed to save live-scan market report:', marketReportError);
          toast.error(`Saved ${item.name}, but its market report could not be stored.`);
          continue;
        }

        newlySavedKeys.push(item.key);
        savedCount += 1;
      }

      if (newlySavedKeys.length > 0) {
        setSavedInventoryItems((prev) => new Set([...prev, ...newlySavedKeys]));
      }

      if (savedCount === 0) {
        toast.error('No live-scan finds were saved to inventory.');
        return;
      }

      toast.success(`Saved ${savedCount} live-scan find${savedCount === 1 ? '' : 's'} to inventory.`);
    } catch (err) {
      console.error('Failed to save live-scan summary:', err);
      toast.error('Unable to save these finds to inventory right now.');
    } finally {
      setIsSavingFinds(false);
    }
  }, [captureFrame, items, savedInventoryItems, userId]);

  const handleShare = useCallback(async () => {
    const summaryItems = getSummaryItems();
    const worthGrabbing = summaryItems.filter(i => i.netProfitLow > 10);
    const totalProfit = worthGrabbing.reduce((sum, i) => sum + i.netProfitLow, 0);

    const text = `🔍 Found ${worthGrabbing.length} items worth grabbing!\n💰 Est. profit: ${formatAud(totalProfit, { decimals: 0 })}`;

    if (navigator.share) {
      await navigator.share({ text });
    } else {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    }
  }, [getSummaryItems]);

  /* ───────── RENDER ───────── */

  // Intent Selector Screen
  if (showIntentSelector) {
    return (
      <IntentSelector
        onSelect={handleIntentSelect}
        onSkip={handleIntentSkip}
      />
    );
  }

  // Walk-Away Summary Screen
  if (showSummary) {
    return (
      <WalkAwaySummary
        items={getSummaryItems()}
        userId={userId}
        onClose={() => setShowSummary(false)}
        onSaveFinds={() => void saveSummaryItemsToInventory()}
        onShare={handleShare}
        savingFinds={isSavingFinds}
        marketplaceScrapeEnabled={marketplaceScrapeEnabled}
      />
    );
  }

  // Main Scanner UI
  const etaSeconds = serverScanEtaMs !== null ? Math.max(1, Math.ceil(serverScanEtaMs / 1000)) : null;
  const lastServerSeconds = lastServerDurationMs ? (lastServerDurationMs / 1000).toFixed(1) : null;

  return (
    <div className="fixed inset-0 bg-black z-50 overflow-hidden touch-none">
      {/* Video Feed */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="hidden" />

      {cameraError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 p-6">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-black/70 p-5 text-white shadow-2xl backdrop-blur">
            <h2 className="text-lg font-semibold">Camera unavailable</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/75">{cameraError}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {!permissionDenied && (
                <Button onClick={retryCamera} className="min-w-32">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry camera
                </Button>
              )}
              {!permissionDenied && (
                <Button onClick={switchCamera} variant="secondary" className="min-w-32">
                  <SwitchCamera className="mr-2 h-4 w-4" />
                  Try other camera
                </Button>
              )}
              {/* SES §5: Manual Search fallback when camera hardware is locked */}
              <Button
                onClick={onClose}
                variant={permissionDenied ? 'default' : 'outline'}
                className="min-w-32"
              >
                <Search className="mr-2 h-4 w-4" />
                Manual Search
              </Button>
            </div>
            <p className="mt-4 text-xs text-white/50">
              Allow camera access in your browser or phone settings. iSpy requires HTTPS or the Android app shell for camera access.
            </p>
          </div>
        </div>
      )}

      {/* SES §5: Power-save mode banner */}
      {isPowerSaving && !cameraError && (
        <div className="absolute top-16 left-0 right-0 z-20 flex justify-center pointer-events-none">
          <div className="flex items-center gap-2 rounded-full bg-amber-500/20 border border-amber-500/30 px-3 py-1 backdrop-blur">
            <BatteryLow className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[11px] text-amber-300 font-medium">Power-saving mode · 15 FPS</span>
          </div>
        </div>
      )}

      {/* Scan Effect */}
      {!isPaused && !cameraError && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan opacity-50" />
        </div>
      )}

      {/* Profit Overlays */}
      <AnimatePresence>
        <ProfitOverlay
          items={Object.values(items)}
          onSelect={(item) => setShowItemDetail(item as any)}
        />
      </AnimatePresence>

      {/* Top Status Bar - Mobile optimized */}
      <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent safe-area-inset-top">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Intent Badge */}
          {selectedIntent && (
            <Badge
              variant="secondary"
              className="bg-primary/20 text-primary border-primary/30 cursor-pointer"
              onClick={() => setShowIntentSelector(true)}
            >
              {selectedIntent.replace('-', ' & ')}
              <ChevronDown className="w-3 h-3 ml-1" />
            </Badge>
          )}

          <button onClick={() => setVisionPlusEnabled((prev) => !prev)}>
            <Badge
              variant="secondary"
              className={`${
                visionPlusEnabled
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                  : 'bg-white/10 text-white/60 border-white/10'
              }`}
            >
              <Brain className="w-3 h-3 mr-1" />
              Vision+
            </Badge>
          </button>

          <Badge
            variant="secondary"
            className="bg-black/60 backdrop-blur-sm border-white/10"
          >
            <Eye className="w-3 h-3 mr-1" />
            {itemCount}
          </Badge>

          {savedItems.size > 0 && (
            <Badge
              variant="secondary"
              className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
            >
              <Save className="w-3 h-3 mr-1" />
              {savedItems.size}
            </Badge>
          )}

          {isServerScanning && (
            <Badge
              variant="secondary"
              className="bg-primary/20 text-primary border-primary/30"
            >
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              {etaSeconds ? `AI ~${etaSeconds}s` : "AI"}
            </Badge>
          )}

          {!isServerScanning && lastServerSeconds && (
            <Badge
              variant="secondary"
              className="bg-black/60 backdrop-blur-sm border-white/10"
            >
              <Clock className="w-3 h-3 mr-1" />
              {lastServerSeconds}s
            </Badge>
          )}

          {visionPlusEnabled && isVisionPlusScanning && (
            <Badge
              variant="secondary"
              className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
            >
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Vision+
            </Badge>
          )}

          {modelLoading && (
            <Badge
              variant="secondary"
              className="bg-amber-500/20 text-amber-400 border-amber-500/30"
            >
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              Loading...
            </Badge>
          )}
        </div>

        {/* Close Button */}
        <Button
          onClick={() => {
            if (Object.keys(items).length > 0) {
              setShowSummary(true);
            } else {
              onClose();
            }
          }}
          size="icon"
          variant="ghost"
          className="bg-black/50 backdrop-blur-sm hover:bg-black/70 text-white h-10 w-10"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Bottom Controls - Large touch targets for mobile */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent safe-area-inset-bottom">
        {/* Hint Text */}
        <p className="text-center text-xs text-white/60 mb-4">
          {cameraError
            ? 'Camera unavailable. Retry or switch cameras to continue scanning.'
            : isPaused
            ? 'Paused — tap play to continue'
            : isServerScanning
              ? `Analyzing frame... ${Math.ceil(serverScanElapsedMs / 1000)}s elapsed${etaSeconds ? `, about ${etaSeconds}s left` : ""}`
              : 'Point at items • Auto-saves when identified'}
        </p>

        {/* Control Buttons */}
        <div className="flex items-center justify-center gap-4">
          {/* Pause/Play */}
          <Button
            onClick={() => setIsPaused(!isPaused)}
            variant="ghost"
            size="lg"
            disabled={!!cameraError}
            className="rounded-full w-14 h-14 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white"
          >
            {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
          </Button>

          {/* Summary Button (Main Action) */}
          <Button
            onClick={() => setShowSummary(true)}
            size="lg"
            disabled={!!cameraError}
            className="rounded-full w-18 h-18 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30"
            style={{ width: 72, height: 72 }}
          >
            <ShoppingBag className="w-7 h-7" />
          </Button>

          {/* Switch Camera */}
          <Button
            onClick={switchCamera}
            variant="ghost"
            size="lg"
            className="rounded-full w-14 h-14 bg-white/10 backdrop-blur-sm hover:bg-white/20 text-white"
          >
            <SwitchCamera className="w-6 h-6" />
          </Button>
        </div>

        {/* Secondary Actions */}
        <div className="flex items-center justify-center gap-6 mt-4">
          <button
            onClick={() => {
              setItems({});
              setSavedItems(new Set());
              setSavedInventoryItems(new Set());
              toast.success('Reset');
            }}
            className="text-xs text-white/50 hover:text-white/80 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            Reset
          </button>

          <button
            onClick={() => setShowIntentSelector(true)}
            className="text-xs text-white/50 hover:text-white/80 flex items-center gap-1"
          >
            <Settings className="w-3 h-3" />
            Category
          </button>
        </div>
      </div>

      {/* Item Detail Modal with Deep-Scan */}
      <ItemDetailModal
        item={showItemDetail}
        onClose={() => setShowItemDetail(null)}
        onSave={(item, condition) => {
          // Update item with new condition and trigger auto-save
          setItems(prev => {
            const updated = { ...prev };
            if (updated[item.key]) {
              updated[item.key] = {
                ...updated[item.key],
                condition,
              };
            }
            return updated;
          });
          toast.success(`Saved ${item.name} as ${condition.replace('-', ' ')}`);
        }}
      />
    </div>
  );
}
