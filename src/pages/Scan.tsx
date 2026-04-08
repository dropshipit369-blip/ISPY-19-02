import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { FeedbackWidget } from "@/components/FeedbackWidget";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  Upload,
  Loader2,
  Sparkles,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Clock,
  Store,
  Tag,
  FileText,
  CheckCircle2,
  Barcode,
  ExternalLink,
  Eye,
  RefreshCw,
  Package,
  Layers,
  Zap,
  ArrowRight,
  Brain,
  Plus,
  Lock,
  Crown,
  MessageCircle,
  Send,
  Target,
  Shield,
  Truck,
  CameraIcon,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Star
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { MarketReportDraft } from "@/lib/types";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { EbayDraftModal } from "@/components/EbayDraftModal";
import { LiveScanV2 } from "@/components/scanner/LiveScanV2";
import { LotResultsModal } from "@/components/LotResultsModal";
import { Textarea } from "@/components/ui/textarea";
import { AnalysisProgress } from "@/components/AnalysisProgress";
import { ProfitCalculator } from "@/components/ProfitCalculator";
import { ScanHistoryPanel } from "@/components/scanner/ScanHistoryPanel";
import { useSubscription } from "@/hooks/useSubscription";
import { motion, AnimatePresence } from "framer-motion";
import { invokeSupabaseFunction, parseSupabaseFunctionError } from "@/lib/supabase-functions";
import {
  buildMarketReportInsertPayload,
  getMarketVerificationMessage,
  getVerifiedSoldComparables,
  hasVerifiedMarketData,
} from "@/lib/market-report";
import { formatAud, formatAudRange } from "@/lib/utils";

interface AnalysisResult {
  title: string;
  brand: string | null;
  model: string | null;
  category: string;
  color: string | null;
  condition: string;
  condition_score: number;
  extracted_text: string | null;
}

interface LotItem {
  analysis: AnalysisResult;
  marketReport: MarketReportDraft;
}

interface VisionPlusItem {
  key: string;
  label: string;
  boundingBox: { x: number; y: number; width: number; height: number };
}

interface MarketplaceBreakdown {
  platform: string;
  fit: "great" | "good" | "okay" | "poor";
  reasoning: string;
  estimatedPrice: number;
  estimatedDays: number;
}

interface DeepAnalysis {
  marketInsight: string;
  pricingRationale: string;
  salesTactics: string[];
  marketplaceBreakdown: MarketplaceBreakdown[];
  bestTimeToList: string;
  negotiationTips: string;
  shippingAdvice: string;
  photographyTips: string;
  riskAssessment: string;
  flipScore: number;
}

interface PricingStrategy {
  recommendedPrice: number;
  listingType: "Auction" | "Fixed Price";
  reasoning: string;
  lowEstimate: number;
  highEstimate: number;
  lotStrategy?: {
    isLot: boolean;
    individualSum: number;
    bundlePrice: number;
    recommendation: "Sell as Lot" | "Sell Individually";
  } | null;
  deepAnalysis?: DeepAnalysis;
  followUpSuggestions?: string[];
}

interface StrategyMessage {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

interface OptimizedListing {
  titles: string[];
  description: string;
  keywords: string[];
  itemSpecifics?: Record<string, string>;
}

type UploadMode = "single" | "lot" | "barcode";

const MAX_UPLOAD_FILE_SIZE_MB = 20;
const SINGLE_UPLOAD_MAX_DIMENSION = 1700;
const LOT_UPLOAD_MAX_DIMENSION = 1400;
const BARCODE_UPLOAD_MAX_DIMENSION = 1900;
const SINGLE_UPLOAD_QUALITY = 0.84;
const LOT_UPLOAD_QUALITY = 0.72;
const BARCODE_UPLOAD_QUALITY = 0.88;
const SINGLE_MAX_DATA_URL_SIZE = 5_400_000;
const LOT_MAX_DATA_URL_SIZE = 3_600_000;
const BARCODE_MAX_DATA_URL_SIZE = 4_800_000;

const scanMethods = [
  {
    id: "single",
    icon: Camera,
    label: "Single Item",
    description: "Detailed AI analysis",
    gradient: "from-primary/20 to-info/20",
    iconColor: "text-primary",
  },
  {
    id: "lot",
    icon: Layers,
    label: "Lot Upload",
    description: "Multiple items at once",
    gradient: "from-info/20 to-primary/20",
    iconColor: "text-info",
  },
  {
    id: "live",
    icon: Zap,
    label: "Live Scan",
    description: "Real-time detection",
    gradient: "from-success/20 to-info/20",
    iconColor: "text-success",
  },
  {
    id: "barcode",
    icon: Barcode,
    label: "Barcode",
    description: "Quick product lookup",
    gradient: "from-warning/20 to-success/20",
    iconColor: "text-warning",
  },
];

export default function Scan() {
  const { user } = useAuth();
  const { planType, canUseLiveScanner, incrementScanUsage, getRemainingScans } = useSubscription();
  const navigate = useNavigate();
  // Single item refs
  const singleCameraInputRef = useRef<HTMLInputElement>(null);
  const singleFileInputRef = useRef<HTMLInputElement>(null);
  // Lot refs
  const lotCameraInputRef = useRef<HTMLInputElement>(null);
  const lotFileInputRef = useRef<HTMLInputElement>(null);
  // Barcode refs
  const barcodeCameraInputRef = useRef<HTMLInputElement>(null);
  const barcodeFileInputRef = useRef<HTMLInputElement>(null);

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [singleAnalysisStartTime, setSingleAnalysisStartTime] = useState<number | undefined>(undefined);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [marketReport, setMarketReport] = useState<MarketReportDraft | null>(null);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [listingPrice, setListingPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [showEbayModal, setShowEbayModal] = useState(false);
  const [showLiveScanner, setShowLiveScanner] = useState(false);
  const [additionalContext, setAdditionalContext] = useState("");
  const [isRethinking, setIsRethinking] = useState(false);

  const [lotImagePreview, setLotImagePreview] = useState<string | null>(null);
  const [analyzingLot, setAnalyzingLot] = useState(false);
  const [lotAnalysisStartTime, setLotAnalysisStartTime] = useState<number | undefined>(undefined);
  const [lotItems, setLotItems] = useState<LotItem[]>([]);
  const [showLotResults, setShowLotResults] = useState(false);
  const [strategy, setStrategy] = useState<PricingStrategy | null>(null);
  const [strategyChat, setStrategyChat] = useState<StrategyMessage[]>([]);
  const [strategyInput, setStrategyInput] = useState("");
  const [isStrategyLoading, setIsStrategyLoading] = useState(false);
  const [isStrategyRefining, setIsStrategyRefining] = useState(false);
  const [lotBuilderItems, setLotBuilderItems] = useState<string[]>([]);
  const [lotBuilderInput, setLotBuilderInput] = useState("");
  const [visionPlusSingleEnabled, setVisionPlusSingleEnabled] = useState(true);
  const [isVisionPlusSingleScanning, setIsVisionPlusSingleScanning] = useState(false);
  const [optimizedListing, setOptimizedListing] = useState<OptimizedListing | null>(null);
  const [isListingOptimizing, setIsListingOptimizing] = useState(false);
  const [selectedTitleIndex, setSelectedTitleIndex] = useState(0);
  const [strategyDetailExpanded, setStrategyDetailExpanded] = useState(true);
  const [showComparables, setShowComparables] = useState(true);
  const [uploadNotes, setUploadNotes] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Source picker states for each scan type
  const [showSingleSourcePicker, setShowSingleSourcePicker] = useState(false);
  const [showLotSourcePicker, setShowLotSourcePicker] = useState(false);
  const [showBarcodeSourcePicker, setShowBarcodeSourcePicker] = useState(false);
  const [historyRefreshTrigger, setHistoryRefreshTrigger] = useState(0);

  const refreshHistory = useCallback(() => {
    setHistoryRefreshTrigger(prev => prev + 1);
  }, []);

  const scrollViewportToTop = useCallback((behavior: ScrollBehavior = "auto") => {
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0, left: 0, behavior });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  useEffect(() => {
    if (
      showSingleSourcePicker ||
      showLotSourcePicker ||
      showBarcodeSourcePicker ||
      showBarcodeScanner ||
      showLiveScanner
    ) {
      scrollViewportToTop("auto");
    }
  }, [
    scrollViewportToTop,
    showSingleSourcePicker,
    showLotSourcePicker,
    showBarcodeSourcePicker,
    showBarcodeScanner,
    showLiveScanner,
  ]);

  useEffect(() => {
    if (imagePreview) {
      scrollViewportToTop("smooth");
    }
  }, [imagePreview, scrollViewportToTop]);

  const loadImageFromObjectUrl = (objectUrl: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to process image. Please try another photo."));
      img.src = objectUrl;
    });

  const prepareImageForUpload = async (file: File, mode: UploadMode): Promise<string> => {
    const maxDimension =
      mode === "lot"
        ? LOT_UPLOAD_MAX_DIMENSION
        : mode === "barcode"
          ? BARCODE_UPLOAD_MAX_DIMENSION
          : SINGLE_UPLOAD_MAX_DIMENSION;
    const initialQuality =
      mode === "lot"
        ? LOT_UPLOAD_QUALITY
        : mode === "barcode"
          ? BARCODE_UPLOAD_QUALITY
          : SINGLE_UPLOAD_QUALITY;
    const maxDataUrlSize =
      mode === "lot"
        ? LOT_MAX_DATA_URL_SIZE
        : mode === "barcode"
          ? BARCODE_MAX_DATA_URL_SIZE
          : SINGLE_MAX_DATA_URL_SIZE;

    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await loadImageFromObjectUrl(objectUrl);
      const longestEdge = Math.max(img.width, img.height);
      const scale = Math.min(1, maxDimension / longestEdge);
      const targetWidth = Math.max(1, Math.round(img.width * scale));
      const targetHeight = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Unable to process image. Please try again.");
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      let quality = initialQuality;
      let dataUrl = canvas.toDataURL("image/webp", quality);

      while (dataUrl.length > maxDataUrlSize && quality > 0.45) {
        quality = Math.max(0.45, quality - 0.08);
        dataUrl = canvas.toDataURL("image/webp", quality);
      }

      return dataUrl;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const handleSingleLikeFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, mode: UploadMode) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`Image is too large. Please use a file under ${MAX_UPLOAD_FILE_SIZE_MB}MB.`);
      return;
    }

    try {
      setImageFile(file);
      const preparedImage = await prepareImageForUpload(file, mode);
      setImagePreview(preparedImage);
      setAnalysis(null);
      setMarketReport(null);
      setStrategy(null);
      setStrategyChat([]);
      setStrategyInput("");
      setOptimizedListing(null);
      setSelectedTitleIndex(0);
      setLotBuilderItems([]);
      setLotBuilderInput("");
      setUploadNotes("");
      setSingleAnalysisStartTime(undefined);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Unable to process this image on your device.";
      toast.error(message);
    }
  };

  const handleSingleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) =>
    handleSingleLikeFileSelect(e, "single");

  const handleBarcodeFileSelect = (e: React.ChangeEvent<HTMLInputElement>) =>
    handleSingleLikeFileSelect(e, "barcode");

  const handleBarcodeDetected = (code: string, format: string, snapshotDataUrl?: string) => {
    setScannedBarcode(code);
    setShowBarcodeScanner(false);
    setAnalysis(null);
    setMarketReport(null);
    setStrategy(null);
    setStrategyChat([]);
    setStrategyInput("");
    setOptimizedListing(null);
    setSelectedTitleIndex(0);
    setUploadNotes("");
    toast.success(`Barcode detected: ${code} (${format})`);

    if (snapshotDataUrl) {
      setImageFile(null);
      setImagePreview(snapshotDataUrl);
      void handleAnalyze(undefined, snapshotDataUrl, code);
      return;
    }

    toast.info("Barcode captured. Add a photo to run full analysis.");
  };

  const handleLotFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024) {
      toast.error(`Lot photo is too large. Please use a file under ${MAX_UPLOAD_FILE_SIZE_MB}MB.`);
      return;
    }

    setLotAnalysisStartTime(Date.now());
    setAnalyzingLot(true);
    try {
      const preparedImage = await prepareImageForUpload(file, "lot");
      setLotImagePreview(preparedImage);
      await handleAnalyzeLot(preparedImage, true);
    } catch (error) {
      console.error("Lot upload preparation failed:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Unable to complete lot upload due to memory limits. Try a closer photo with fewer items.";
      toast.error(message);
      setAnalyzingLot(false);
      setLotAnalysisStartTime(undefined);
    }
  };

  const handleAnalyzeLot = async (imageData: string, preserveStartTime: boolean = false) => {
    if (!user) {
      setAnalyzingLot(false);
      setLotAnalysisStartTime(undefined);
      return;
    }

    if (!preserveStartTime) {
      setLotAnalysisStartTime(Date.now());
    }
    setAnalyzingLot(true);
    try {
      const { data, error } = await invokeSupabaseFunction<{ items: LotItem[]; totalItems: number }>("analyze-lot", { image: imageData });

      if (error) throw error;
      if (!data) throw new Error("No data returned from analyze-lot");

      const items = data.items || [];
      let savedCount = 0;
      for (const item of items) {
        try {
          await supabase.from("scan_logs").insert({
            user_id: user.id,
            name: item.analysis?.title || "Unknown Item",
            brand: item.analysis?.brand || null,
            model: item.analysis?.model || null,
            category: item.analysis?.category || null,
            condition: item.analysis?.condition || null,
            low_price: item.marketReport?.low_price || null,
            median_price: item.marketReport?.median_price || null,
            high_price: item.marketReport?.high_price || null,
            confidence: item.marketReport?.confidence_score || null,
            trend: item.marketReport?.price_trend || null,
            pricing_sources: null,
          });
          savedCount++;
        } catch (err) {
          console.error("Failed to auto-save lot item:", err);
        }
      }

      setLotItems(items);
      setShowLotResults(true);
      refreshHistory();
      toast.success(`Found ${data.totalItems} items in lot! (${savedCount} auto-saved to history)`);
    } catch (error: any) {
      console.error("Lot analysis error:", error);
      const message = await parseSupabaseFunctionError(error, "Failed to analyze lot image");
      toast.error(message);
    } finally {
      setAnalyzingLot(false);
      setLotAnalysisStartTime(undefined);
    }
  };

  const handleGenerateStrategy = async () => {
    if (!analysis || !marketReport) return;
    if (!hasVerifiedMarketData(marketReport)) {
      toast.error(getMarketVerificationMessage(marketReport));
      return;
    }
    setIsStrategyLoading(true);
    try {
      const { data, error } = await invokeSupabaseFunction<{ strategy?: PricingStrategy }>("pricing-strategy", {
        analysis: {
          title: analysis.title,
          brand: analysis.brand,
          model: analysis.model,
          category: analysis.category,
          condition: analysis.condition,
        },
        marketReport,
        additionalItems: lotBuilderItems.map((name) => ({ name })),
      });

      if (error) throw error;
      if (!data?.strategy) throw new Error("No strategy returned");

      setStrategy(data.strategy);
      setStrategyChat([
        {
          role: "assistant",
          text: data.strategy.reasoning || "Strategy generated.",
          timestamp: Date.now(),
        },
      ]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (error: unknown) {
      console.error("Strategy error:", error);
      const message = await parseSupabaseFunctionError(error, "Failed to generate strategy");
      toast.error(message);
    } finally {
      setIsStrategyLoading(false);
    }
  };

  const handleRefineStrategy = async () => {
    if (!analysis || !strategy || !strategyInput.trim()) return;
    const userMessage: StrategyMessage = {
      role: "user",
      text: strategyInput.trim(),
      timestamp: Date.now(),
    };

    setStrategyInput("");
    setStrategyChat((prev) => [...prev, userMessage]);
    setIsStrategyRefining(true);

    try {
      const { data, error } = await invokeSupabaseFunction<{ strategy?: PricingStrategy }>("refine-pricing", {
        analysis: {
          title: analysis.title,
          brand: analysis.brand,
          model: analysis.model,
          category: analysis.category,
          condition: analysis.condition,
        },
        currentStrategy: strategy,
        userFeedback: userMessage.text,
        chatHistory: [...strategyChat, userMessage],
        marketReport,
      });

      if (error) throw error;
      if (!data?.strategy) throw new Error("No strategy returned");

      // Merge: keep deep analysis from initial generation, overlay refined pricing/suggestions
      setStrategy((prev) => ({
        ...prev,
        ...data.strategy,
        deepAnalysis: data.strategy!.deepAnalysis || prev?.deepAnalysis,
      } as PricingStrategy));
      setStrategyChat((prev) => [
        ...prev,
        {
          role: "assistant",
          text: data.strategy?.reasoning || "Strategy updated.",
          timestamp: Date.now(),
        },
      ]);
      // Auto-scroll to bottom
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (error: unknown) {
      console.error("Refine error:", error);
      const message = await parseSupabaseFunctionError(error, "Failed to refine strategy");
      toast.error(message);
    } finally {
      setIsStrategyRefining(false);
    }
  };

  const formatMoney = (value?: number | null) => {
    return formatAud(value, { fallback: "N/A" });
  };

  const soldComparableExamples = useMemo(() => {
    return getVerifiedSoldComparables(marketReport).slice(0, 8);
  }, [marketReport]);

  const verifiedMarketDataAvailable = useMemo(
    () => hasVerifiedMarketData(marketReport),
    [marketReport],
  );

  const marketVerificationMessage = useMemo(
    () => getMarketVerificationMessage(marketReport),
    [marketReport],
  );

  const defaultProfitPlatform = useMemo(() => {
    const marketplace = (marketReport?.best_marketplace || "").toLowerCase();
    if (marketplace.includes("amazon")) return "amazon_au";
    if (marketplace.includes("etsy")) return "etsy";
    if (marketplace.includes("mercari")) return "mercari";
    if (marketplace.includes("poshmark")) return "poshmark";
    if (marketplace.includes("facebook")) return "facebook_local";
    if (marketplace.includes("ebay")) return "ebay_au";
    return "ebay_au";
  }, [marketReport?.best_marketplace]);

  const handleAddLotBuilderItem = () => {
    const value = lotBuilderInput.trim();
    if (!value) return;
    setLotBuilderItems((prev) => [...prev, value]);
    setLotBuilderInput("");
  };

  const handleRemoveLotBuilderItem = (index: number) => {
    setLotBuilderItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOptimizeListing = async () => {
    if (!analysis || !strategy) return;
    setIsListingOptimizing(true);
    try {
      const { data, error } = await invokeSupabaseFunction<{ listing?: OptimizedListing }>("optimize-listing", {
        analysis: {
          title: analysis.title,
          brand: analysis.brand,
          model: analysis.model,
          category: analysis.category,
          condition: analysis.condition,
        },
        price: strategy.recommendedPrice,
      });

      if (error) throw error;
      if (!data?.listing) throw new Error("No listing returned");

      setOptimizedListing(data.listing);
      setSelectedTitleIndex(0);
    } catch (error: unknown) {
      console.error("Optimize listing error:", error);
      const message = await parseSupabaseFunctionError(error, "Failed to optimize listing");
      toast.error(message);
    } finally {
      setIsListingOptimizing(false);
    }
  };

  const handleAnalyze = async (
    rethinkContext?: string,
    imageOverride?: string,
    barcodeOverride?: string | null
  ) => {
    const imageToAnalyze = imageOverride || imagePreview;
    if (!imageToAnalyze || !user) return;

    // Extra safety check for auth
    if (!user?.id) {
      toast.error("Please sign in to analyze items");
      return;
    }

    const isRethink = !!rethinkContext;
    if (!isRethink) {
      setSingleAnalysisStartTime(Date.now());
    }
    if (isRethink) {
      setIsRethinking(true);
    } else {
      setAnalyzing(true);
    }

    try {
      let analysisImage = imageToAnalyze;
      if (visionPlusSingleEnabled && !rethinkContext) {
        setIsVisionPlusSingleScanning(true);
        try {
          const { data, error } = await invokeSupabaseFunction<{ items?: VisionPlusItem[] }>("vision-plus", {
            image: imageToAnalyze,
          });
          if (!error && Array.isArray(data?.items) && data.items.length > 0) {
            const bestBox = data.items
              .map((item: VisionPlusItem) => ({
                ...item,
                area: item.boundingBox.width * item.boundingBox.height,
              }))
              .sort((a: VisionPlusItem & { area: number }, b: VisionPlusItem & { area: number }) => b.area - a.area)[0];
            analysisImage = await cropImageToBox(imageToAnalyze, bestBox.boundingBox);
          }
        } catch (err) {
          console.warn("Vision+ single scan failed, continuing with original image", err);
        } finally {
          setIsVisionPlusSingleScanning(false);
        }
      }

      const { data, error } = await invokeSupabaseFunction<{ analysis: AnalysisResult; marketReport: MarketReportDraft }>("analyze-item", {
        image: analysisImage,
        userId: user.id,
        barcode: barcodeOverride ?? scannedBarcode,
        additionalContext: rethinkContext || uploadNotes.trim() || undefined
      });

      if (error) throw error;
      if (!data) throw new Error("No data returned from analyze-item");

      setAnalysis(data.analysis);
      setMarketReport(data.marketReport);
      setStrategy(null);
      setStrategyChat([]);
      setStrategyInput("");
      setOptimizedListing(null);
      setSelectedTitleIndex(0);

      if (!isRethink) {
        try {
          await supabase.from("scan_logs").insert({
            user_id: user.id,
            name: data.analysis?.title || "Unknown Item",
            brand: data.analysis?.brand || null,
            model: data.analysis?.model || null,
            category: data.analysis?.category || null,
            condition: data.analysis?.condition || null,
            low_price: data.marketReport?.low_price || null,
            median_price: data.marketReport?.median_price || null,
            high_price: data.marketReport?.high_price || null,
            confidence: data.marketReport?.confidence_score || null,
            trend: data.marketReport?.price_trend || null,
            pricing_sources: data.marketReport?.data_sources || null,
          });
        } catch (scanLogError) {
          console.error("Failed to save scan log:", scanLogError);
        }

        refreshHistory();
      }

      toast.success(isRethink ? "Re-analysis complete with your additional info!" : "Analysis complete!");
      if (isRethink) {
        setAdditionalContext("");
      }
    } catch (error: any) {
      console.error("Analysis error:", error);
      const message = await parseSupabaseFunctionError(error, "Failed to analyze image");
      toast.error(message);
    } finally {
      setAnalyzing(false);
      setIsRethinking(false);
      if (!isRethink) {
        setSingleAnalysisStartTime(undefined);
      }
    }
  };

  const handleRethink = () => {
    if (!additionalContext.trim()) {
      toast.error("Please provide additional information about the item");
      return;
    }
    handleAnalyze(additionalContext);
  };

  const cropImageToBox = (dataUrl: string, box: { x: number; y: number; width: number; height: number }): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        const sx = Math.max(0, Math.round(img.width * box.x));
        const sy = Math.max(0, Math.round(img.height * box.y));
        const sw = Math.max(1, Math.round(img.width * box.width));
        const sh = Math.max(1, Math.round(img.height * box.height));

        canvas.width = sw;
        canvas.height = sh;
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
        resolve(canvas.toDataURL("image/jpeg", 0.9));
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = dataUrl;
    });
  };

  const handleSaveItem = async () => {
    if (!user || !analysis || !imagePreview) return;

    setSaving(true);
    try {
      const base64Data = imagePreview.split(",")[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "image/jpeg" });

      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("item-images")
        .upload(fileName, blob, {
          contentType: "image/jpeg",
          upsert: false
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw new Error("Failed to upload image");
      }

      const { data: urlData } = supabase.storage
        .from("item-images")
        .getPublicUrl(fileName);
      const imageUrl = urlData.publicUrl;

      const conditionScore =
        typeof analysis.condition_score === "number"
          ? Math.max(1, Math.min(10, Math.round(analysis.condition_score)))
          : null;

      const { data: item, error: itemError } = await supabase
        .from("items")
        .insert({
          user_id: user.id,
          image_url: imageUrl,
          title: analysis.title,
          brand: analysis.brand,
          model: analysis.model,
          category: analysis.category,
          color: analysis.color,
          condition: analysis.condition,
          condition_score: conditionScore,
          extracted_text: analysis.extracted_text,
          purchase_price: purchasePrice ? parseFloat(purchasePrice) : null,
          barcode: scannedBarcode || null,
          notes: uploadNotes.trim() || null,
          status: "pending"
        })
        .select()
        .single();

      if (itemError) throw itemError;

      if (marketReport && item) {
        const { error: marketReportError } = await supabase.from("market_reports").insert({
          ...buildMarketReportInsertPayload(marketReport, item.id, listingPrice),
        });

        if (marketReportError) throw marketReportError;
      }

      refreshHistory();
      toast.success(
        verifiedMarketDataAvailable
          ? "Item saved to inventory."
          : "Item saved to inventory. Market pricing still needs manual entry.",
      );
      navigate("/inventory");
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error.message || "Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  const handleMethodClick = (methodId: string) => {
    scrollViewportToTop("auto");

    switch (methodId) {
      case "single":
        setShowSingleSourcePicker(true);
        break;
      case "lot":
        setShowLotSourcePicker(true);
        break;
      case "live": {
        const { allowed, reason } = canUseLiveScanner();
        if (!allowed) {
          toast.error(reason || "Live scanning requires a paid membership.", {
            action: {
              label: "Upgrade",
              onClick: () => navigate("/membership"),
            },
          });
          return;
        }
        void incrementScanUsage();
        setShowLiveScanner(true);
        break;
      }
      case "barcode":
        setShowBarcodeScanner(true);
        break;
    }
  };

  return (
    <Layout>
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-background via-background to-muted/20">
        {/* Hidden inputs */}
        <input type="file" ref={singleCameraInputRef} accept="image/*" capture="environment" onChange={handleSingleFileSelect} className="hidden" id="single-camera-input" name="single-camera" aria-label="Take photo for single item analysis" />
        <input type="file" ref={singleFileInputRef} accept="image/*" onChange={handleSingleFileSelect} className="hidden" id="single-file-input" name="single-file" aria-label="Upload photo for single item analysis" />
        <input type="file" ref={lotCameraInputRef} accept="image/*" capture="environment" onChange={handleLotFileSelect} className="hidden" id="lot-camera-input" name="lot-camera" aria-label="Take photo for lot analysis" />
        <input type="file" ref={lotFileInputRef} accept="image/*" onChange={handleLotFileSelect} className="hidden" id="lot-file-input" name="lot-file" aria-label="Upload photo for lot analysis" />
        <input type="file" ref={barcodeCameraInputRef} accept="image/*" capture="environment" onChange={handleBarcodeFileSelect} className="hidden" id="barcode-camera-input" name="barcode-camera" aria-label="Take photo for barcode scanning" />
        <input type="file" ref={barcodeFileInputRef} accept="image/*" onChange={handleBarcodeFileSelect} className="hidden" id="barcode-file-input" name="barcode-file" aria-label="Upload photo for barcode scanning" />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-4">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">AI-Powered Analysis</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold mb-3 tracking-tight">
              Scan & <span className="gradient-text">Price</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg mx-auto">
              Choose your scan method and let AI identify, analyze, and price your items in seconds
            </p>
          </motion.div>

          {/* Scan Methods Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10"
          >
            {scanMethods.map((method, index) => {
              const isLive = method.id === "live";
              const { allowed: liveAllowed } = canUseLiveScanner();
              const isLocked = isLive && !liveAllowed;
              const remainingScans = getRemainingScans();

              return (
                <motion.button
                  key={method.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 + index * 0.05 }}
                  onClick={() => handleMethodClick(method.id)}
                  disabled={method.id === "lot" && analyzingLot}
                  className={`relative group p-6 rounded-2xl border border-border/50 bg-gradient-to-br ${method.gradient} backdrop-blur-sm hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 disabled:opacity-50`}
                >
                  {isLocked && (
                    <div className="absolute top-2 right-2">
                      <div className="p-1 rounded-full bg-warning/20">
                        <Lock className="w-3 h-3 text-warning" />
                      </div>
                    </div>
                  )}
                  {isLive && liveAllowed && planType === "pro" && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                        {remainingScans} left
                      </Badge>
                    </div>
                  )}
                  {isLive && planType === "unlimited" && (
                    <div className="absolute top-2 right-2">
                      <Crown className="w-4 h-4 text-warning" />
                    </div>
                  )}
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex flex-col items-center text-center gap-3">
                    <div className={`p-3 rounded-xl bg-background/80 shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                      {method.id === "lot" && analyzingLot ? (
                        <Loader2 className="w-6 h-6 text-primary animate-spin" />
                      ) : (
                        <method.icon className={`w-6 h-6 ${method.iconColor}`} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{method.label}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {isLocked ? "Upgrade to unlock" : method.description}
                      </p>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>

          {/* Single Item Source Picker Modal */}
          <AnimatePresence>
            {showSingleSourcePicker && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
                onClick={() => setShowSingleSourcePicker(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-card border border-border rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="font-semibold text-lg mb-4 text-center">Choose Image Source</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => { setShowSingleSourcePicker(false); singleCameraInputRef.current?.click(); }}
                      className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-border bg-gradient-to-br from-primary/10 to-info/10 hover:border-primary/50 transition-all"
                    >
                      <Camera className="w-8 h-8 text-primary" />
                      <span className="font-medium">Camera</span>
                    </button>
                    <button
                      onClick={() => { setShowSingleSourcePicker(false); singleFileInputRef.current?.click(); }}
                      className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-border bg-gradient-to-br from-info/10 to-primary/10 hover:border-primary/50 transition-all"
                    >
                      <Upload className="w-8 h-8 text-info" />
                      <span className="font-medium">Upload</span>
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Lot Source Picker Modal */}
          <AnimatePresence>
            {showLotSourcePicker && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
                onClick={() => setShowLotSourcePicker(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-card border border-border rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="font-semibold text-lg mb-4 text-center">Choose Image Source</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => { setShowLotSourcePicker(false); lotCameraInputRef.current?.click(); }}
                      className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-border bg-gradient-to-br from-primary/10 to-info/10 hover:border-primary/50 transition-all"
                    >
                      <Camera className="w-8 h-8 text-primary" />
                      <span className="font-medium">Camera</span>
                    </button>
                    <button
                      onClick={() => { setShowLotSourcePicker(false); lotFileInputRef.current?.click(); }}
                      className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-border bg-gradient-to-br from-info/10 to-primary/10 hover:border-primary/50 transition-all"
                    >
                      <Upload className="w-8 h-8 text-info" />
                      <span className="font-medium">Upload</span>
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Barcode Source Picker Modal */}
          <AnimatePresence>
            {showBarcodeSourcePicker && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
                onClick={() => setShowBarcodeSourcePicker(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  className="bg-card border border-border rounded-2xl p-6 shadow-xl max-w-sm w-full mx-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="font-semibold text-lg mb-4 text-center">Choose Image Source</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => { setShowBarcodeSourcePicker(false); setShowBarcodeScanner(true); }}
                      className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-border bg-gradient-to-br from-primary/10 to-info/10 hover:border-primary/50 transition-all"
                    >
                      <Camera className="w-8 h-8 text-primary" />
                      <span className="font-medium">Camera</span>
                    </button>
                    <button
                      onClick={() => { setShowBarcodeSourcePicker(false); barcodeFileInputRef.current?.click(); }}
                      className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border border-border bg-gradient-to-br from-info/10 to-primary/10 hover:border-primary/50 transition-all"
                    >
                      <Upload className="w-8 h-8 text-info" />
                      <span className="font-medium">Upload</span>
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Lot Analysis Progress */}
          <AnimatePresence>
            {analyzingLot && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-8"
              >
                <AnalysisProgress
                  isAnalyzing={analyzingLot}
                  type="lot"
                  startTime={lotAnalysisStartTime}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Content Area */}
          <AnimatePresence mode="wait">
            {imagePreview ? (
              <motion.div
                key="analysis"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid lg:grid-cols-2 gap-6"
              >
                {/* Image Preview Card */}
                <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
                  <CardContent className="p-0">
                    <div className="relative aspect-square">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                      {scannedBarcode && (
                        <Badge className="absolute bottom-4 left-4 bg-background/90 text-foreground">
                          <Barcode className="w-3 h-3 mr-1" />
                          {scannedBarcode}
                        </Badge>
                      )}
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setShowSingleSourcePicker(true)}>
                          <Camera className="w-4 h-4 mr-2" />
                          Change
                        </Button>
                        <Button
                          variant={visionPlusSingleEnabled ? "default" : "outline"}
                          className="flex-1"
                          onClick={() => setVisionPlusSingleEnabled((prev) => !prev)}
                        >
                          <Brain className="w-4 h-4 mr-2" />
                          Vision+ {visionPlusSingleEnabled ? "On" : "Off"}
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Upload context and notes
                        </Label>
                        <Textarea
                          placeholder="Add anything useful before analysis, like defects, bundle details, or what you already know. These notes will also save to inventory."
                          value={uploadNotes}
                          onChange={(e) => setUploadNotes(e.target.value)}
                          className="min-h-[90px] text-sm"
                        />
                      </div>
                      <Button
                        className="w-full bg-gradient-to-r from-primary to-info text-primary-foreground"
                        onClick={() => handleAnalyze()}
                        disabled={analyzing}
                      >
                        {analyzing ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</>
                        ) : (
                          <><Sparkles className="w-4 h-4 mr-2" /> Analyze</>
                        )}
                      </Button>
                      {isVisionPlusSingleScanning && (
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Vision+ refining detection...
                        </div>
                      )}
                      <AnalysisProgress
                        isAnalyzing={analyzing}
                        type="single"
                        startTime={singleAnalysisStartTime}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Results Section */}
                <div className="space-y-4">
                  {analysis ? (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
                      <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <div className="p-1.5 rounded-lg bg-primary/10">
                              <Sparkles className="w-4 h-4 text-primary" />
                            </div>
                            AI Analysis
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            {[
                              { label: "Title", value: analysis.title },
                              { label: "Brand", value: analysis.brand },
                              { label: "Model", value: analysis.model },
                              { label: "Category", value: analysis.category },
                              { label: "Color", value: analysis.color },
                              { label: "Condition", value: analysis.condition, badge: true },
                            ].map((field) => (
                              <div key={field.label} className="bg-background/50 rounded-lg p-3">
                                <p className="text-xs text-muted-foreground mb-1">{field.label}</p>
                                {field.badge ? (
                                  <Badge variant="secondary">{field.value || "Unknown"}</Badge>
                                ) : (
                                  <p className="font-medium text-sm">{field.value || "Unknown"}</p>
                                )}
                              </div>
                            ))}
                          </div>
                          {analysis.extracted_text && (
                            <div className="bg-background/50 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground mb-1">Extracted Text</p>
                              <p className="text-sm">{analysis.extracted_text}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ) : (
                    <Card className="border-dashed border-2 border-border/50 bg-muted/20">
                      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Sparkles className="w-10 h-10 text-muted-foreground/50 mb-3" />
                        <p className="font-medium text-muted-foreground">Click "Analyze" to identify this item</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">AI will detect brand, model, condition & more</p>
                      </CardContent>
                    </Card>
                  )}

                  {marketReport && !verifiedMarketDataAvailable && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 }}>
                      <Card className="border-warning/30 bg-warning/10">
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-lg text-warning">
                            <AlertTriangle className="w-5 h-5" />
                            Insufficient Market Data - Manual Entry Required.
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-sm text-foreground/80">{marketVerificationMessage}</p>
                          <p className="text-sm text-muted-foreground">
                            Save the item to inventory if identification looks correct, then enter your own listing price until verified sold comps are available.
                          </p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {marketReport && verifiedMarketDataAvailable && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
                      <Card className="border-success/20 bg-gradient-to-br from-card to-success/5">
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <div className="p-1.5 rounded-lg bg-success/10">
                              <TrendingUp className="w-4 h-4 text-success" />
                            </div>
                            Market Report
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="bg-gradient-to-r from-primary/10 via-info/10 to-success/10 rounded-xl p-5 text-center">
                            <p className="text-sm text-muted-foreground mb-1">Suggested Price</p>
                            <p className="text-4xl font-bold text-primary">
                              {formatAud(marketReport.suggested_price ?? marketReport.median_price, { fallback: "N/A" })}
                            </p>
                            <div className="flex justify-center gap-6 mt-3 text-sm">
                              <span><span className="text-muted-foreground">Low:</span> {formatAud(marketReport.low_price)}</span>
                              <span><span className="text-muted-foreground">High:</span> {formatAud(marketReport.high_price)}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-background/50 rounded-lg p-3 text-center">
                              <Clock className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                              <p className="text-xs text-muted-foreground">Avg Days</p>
                              <p className="font-semibold">{marketReport.avg_days_to_sell || "—"}</p>
                            </div>
                            <div className="bg-background/50 rounded-lg p-3 text-center">
                              <Store className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                              <p className="text-xs text-muted-foreground">Best Platform</p>
                              <p className="font-semibold text-sm">{marketReport.best_marketplace || "eBay"}</p>
                            </div>
                            <div className="bg-background/50 rounded-lg p-3 text-center">
                              {marketReport.price_trend === "up" ? (
                                <TrendingUp className="w-4 h-4 mx-auto text-success mb-1" />
                              ) : marketReport.price_trend === "down" ? (
                                <TrendingDown className="w-4 h-4 mx-auto text-destructive mb-1" />
                              ) : (
                                <TrendingUp className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                              )}
                              <p className="text-xs text-muted-foreground">Trend</p>
                              <p className="font-semibold capitalize">{marketReport.price_trend || "Stable"}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {/* Sold Comparables */}
                  {soldComparableExamples.length > 0 && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 }}>
                      <Card className="border-info/20 bg-gradient-to-br from-card to-info/5 overflow-hidden">
                        <CardHeader className="pb-2">
                          <button
                            onClick={() => setShowComparables(!showComparables)}
                            className="flex items-center justify-between w-full text-left group"
                          >
                            <CardTitle className="flex items-center gap-2 text-base">
                              <div className="p-1.5 rounded-lg bg-info/10">
                                <Store className="w-4 h-4 text-info" />
                              </div>
                              Direct Sold Comparables ({soldComparableExamples.length})
                            </CardTitle>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                              {showComparables ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                          </button>
                        </CardHeader>
                        <AnimatePresence>
                          {showComparables && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <CardContent className="pt-0 space-y-2">
                                <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
                                  {soldComparableExamples.map((comp, idx) => {
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
                                      <a
                                        key={idx}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 p-2.5 rounded-lg bg-background/50 border border-border/30 hover:border-info/40 hover:bg-info/5 transition-all group cursor-pointer"
                                      >
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium truncate group-hover:text-info transition-colors">
                                            {comp.title}
                                          </p>
                                          <div className="flex items-center gap-2 mt-1">
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                              {comp.marketplace}
                                            </Badge>
                                            <span className="text-[10px] text-muted-foreground">{comp.condition}</span>
                                            <span className="text-[10px] text-muted-foreground">·</span>
                                            <span className="text-[10px] text-muted-foreground">{comp.timeframe}</span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                          <span className="text-sm font-bold text-success">{formatAud(comp.price)}</span>
                                          <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-info transition-colors" />
                                        </div>
                                      </a>
                                    );
                                  })}
                                </div>
                                {/* Summary bar */}
                                {soldComparableExamples.length >= 2 && (() => {
                                  const prices = soldComparableExamples.map(c => c.price);
                                  const avg = prices.reduce((s, p) => s + p, 0) / prices.length;
                                  const lo = Math.min(...prices);
                                  const hi = Math.max(...prices);
                                  return (
                                    <div className="flex justify-between items-center text-xs text-muted-foreground bg-background/40 rounded-lg px-3 py-2 mt-2 border border-border/20">
                                      <span>Low: <span className="font-semibold text-foreground">{formatAud(lo)}</span></span>
                                      <span>Average: <span className="font-semibold text-primary">{formatAud(avg)}</span></span>
                                      <span>High: <span className="font-semibold text-foreground">{formatAud(hi)}</span></span>
                                    </div>
                                  );
                                })()}
                              </CardContent>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </Card>
                    </motion.div>
                  )}

                  {analysis && marketReport && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}>
                      <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5 overflow-hidden">
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <img src="/mascot.png" alt="ispy.ai mascot" className="w-8 h-8 rounded-full object-cover" />
                            Profit Strategy Assistant
                            {strategy?.deepAnalysis?.flipScore && (
                              <Badge variant="secondary" className={`ml-auto text-xs font-bold ${strategy.deepAnalysis.flipScore >= 75 ? "bg-success/15 text-success border-success/30" :
                                strategy.deepAnalysis.flipScore >= 50 ? "bg-warning/15 text-warning border-warning/30" :
                                  "bg-destructive/15 text-destructive border-destructive/30"
                                }`}>
                                <Star className="w-3 h-3 mr-1" />
                                Flip Score: {strategy.deepAnalysis.flipScore}/100
                              </Badge>
                            )}
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Lot Builder */}
                          <div className="bg-background/40 rounded-lg border border-border/50 p-3">
                            <p className="text-xs text-muted-foreground mb-2">Lot Builder (optional)</p>
                            <div className="flex gap-2">
                              <Input
                                id="lot-builder-input"
                                name="lot-builder"
                                placeholder="Add another item to the lot..."
                                value={lotBuilderInput}
                                onChange={(e) => setLotBuilderInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleAddLotBuilderItem()}
                                className="text-sm"
                                aria-label="Add item to lot bundle"
                              />
                              <Button variant="outline" onClick={handleAddLotBuilderItem}>
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                            {lotBuilderItems.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {lotBuilderItems.map((item, index) => (
                                  <button
                                    key={`${item}-${index}`}
                                    onClick={() => handleRemoveLotBuilderItem(index)}
                                    className="text-xs bg-muted/40 border border-border/50 rounded-full px-2 py-1 hover:bg-muted"
                                  >
                                    {item} ✕
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {!strategy ? (
                            verifiedMarketDataAvailable ? (
                            <div className="text-center py-6">
                              <div className="rounded-full inline-block mb-3 overflow-hidden">
                                <img src="/mascot.png" alt="ispy.ai mascot" className="w-16 h-16 object-cover" />
                              </div>
                              <p className="font-medium text-foreground mb-1">Get Expert Sales Strategy</p>
                              <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                                Your AI resale advisor will analyze marketplace fit, pricing tactics, negotiation tips, and more — like chatting with a veteran flipper.
                              </p>
                              <Button onClick={handleGenerateStrategy} disabled={isStrategyLoading} className="bg-gradient-to-r from-primary to-info text-primary-foreground">
                                {isStrategyLoading ? (
                                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing Markets...</>
                                ) : (
                                  <><Sparkles className="w-4 h-4 mr-2" /> Start Strategy Session</>
                                )}
                              </Button>
                            </div>
                            ) : (
                              <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 text-left">
                                <p className="font-medium text-warning">Verified comps required before strategy analysis.</p>
                                <p className="text-sm text-foreground/80 mt-2">{marketVerificationMessage}</p>
                              </div>
                            )
                          ) : (
                            <>
                              {/* Price Header */}
                              <div className="bg-gradient-to-r from-primary/10 via-info/10 to-success/10 rounded-xl p-5">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-1">Recommended Price</p>
                                    <p className="text-4xl font-bold text-primary">
                                      {formatMoney(strategy.recommendedPrice)}
                                    </p>
                                    <div className="text-sm text-muted-foreground mt-1">
                                      Range: {formatAudRange(strategy.lowEstimate, strategy.highEstimate)}
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <Badge variant="secondary" className="mb-2">{strategy.listingType}</Badge>
                                    {strategy.lotStrategy?.isLot && (
                                      <div className="text-xs text-muted-foreground">
                                        <p>{strategy.lotStrategy.recommendation}</p>
                                        <p className="font-medium">Bundle: {formatMoney(strategy.lotStrategy.bundlePrice)}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Deep Analysis Sections */}
                              {strategy.deepAnalysis && (
                                <div className="space-y-3">
                                  <button
                                    onClick={() => setStrategyDetailExpanded(!strategyDetailExpanded)}
                                    className="flex items-center justify-between w-full text-sm font-semibold text-foreground hover:text-primary transition-colors"
                                  >
                                    <span className="flex items-center gap-2">
                                      <Target className="w-4 h-4" />
                                      Deep Market Analysis
                                    </span>
                                    {strategyDetailExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                  </button>

                                  <AnimatePresence>
                                    {strategyDetailExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="overflow-hidden space-y-3"
                                      >
                                        {/* Market Insight */}
                                        {strategy.deepAnalysis.marketInsight && (
                                          <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                                            <div className="flex items-center gap-2 mb-2">
                                              <TrendingUp className="w-3.5 h-3.5 text-info" />
                                              <p className="text-xs font-semibold text-info uppercase tracking-wide">Market Insight</p>
                                            </div>
                                            <p className="text-sm text-foreground/80 leading-relaxed">{strategy.deepAnalysis.marketInsight}</p>
                                          </div>
                                        )}

                                        {/* Pricing Rationale */}
                                        {strategy.deepAnalysis.pricingRationale && (
                                          <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                                            <div className="flex items-center gap-2 mb-2">
                                              <DollarSign className="w-3.5 h-3.5 text-success" />
                                              <p className="text-xs font-semibold text-success uppercase tracking-wide">Why This Price</p>
                                            </div>
                                            <p className="text-sm text-foreground/80 leading-relaxed">{strategy.deepAnalysis.pricingRationale}</p>
                                          </div>
                                        )}

                                        {/* Sales Tactics */}
                                        {strategy.deepAnalysis.salesTactics?.length > 0 && (
                                          <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                                            <div className="flex items-center gap-2 mb-2">
                                              <Zap className="w-3.5 h-3.5 text-warning" />
                                              <p className="text-xs font-semibold text-warning uppercase tracking-wide">Sales Tactics</p>
                                            </div>
                                            <ul className="space-y-2">
                                              {strategy.deepAnalysis.salesTactics.map((tactic, i) => (
                                                <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                                                  <span className="flex-shrink-0 w-5 h-5 bg-warning/10 rounded-full flex items-center justify-center text-[10px] font-bold text-warning mt-0.5">{i + 1}</span>
                                                  <span className="leading-relaxed">{tactic}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}

                                        {/* Marketplace Breakdown */}
                                        {strategy.deepAnalysis.marketplaceBreakdown?.length > 0 && (
                                          <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                                            <div className="flex items-center gap-2 mb-3">
                                              <Store className="w-3.5 h-3.5 text-primary" />
                                              <p className="text-xs font-semibold text-primary uppercase tracking-wide">Where to Sell</p>
                                            </div>
                                            <div className="space-y-2">
                                              {strategy.deepAnalysis.marketplaceBreakdown
                                                .sort((a, b) => {
                                                  const order = { great: 0, good: 1, okay: 2, poor: 3 };
                                                  return (order[a.fit] ?? 4) - (order[b.fit] ?? 4);
                                                })
                                                .map((mp) => (
                                                  <div key={mp.platform} className="flex items-start gap-3 bg-background/60 rounded-lg p-2.5 border border-border/20">
                                                    <div className="flex-shrink-0 mt-0.5">
                                                      <Badge variant="secondary" className={`text-[10px] px-1.5 py-0.5 font-bold ${mp.fit === "great" ? "bg-success/15 text-success" :
                                                        mp.fit === "good" ? "bg-info/15 text-info" :
                                                          mp.fit === "okay" ? "bg-warning/15 text-warning" :
                                                            "bg-muted text-muted-foreground"
                                                        }`}>
                                                        {mp.fit.toUpperCase()}
                                                      </Badge>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                      <div className="flex items-center justify-between">
                                                        <p className="text-sm font-medium text-foreground">{mp.platform}</p>
                                                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                                          <span className="font-semibold text-foreground">{formatMoney(mp.estimatedPrice)}</span>
                                                          <span className="flex items-center gap-1">
                                                            <Clock className="w-3 h-3" />
                                                            {mp.estimatedDays}d
                                                          </span>
                                                        </div>
                                                      </div>
                                                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{mp.reasoning}</p>
                                                    </div>
                                                  </div>
                                                ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Quick Tips Grid */}
                                        <div className="grid grid-cols-2 gap-2">
                                          {strategy.deepAnalysis.bestTimeToList && (
                                            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                                              <div className="flex items-center gap-1.5 mb-1.5">
                                                <Clock className="w-3 h-3 text-info" />
                                                <p className="text-[10px] font-semibold text-info uppercase tracking-wide">Timing</p>
                                              </div>
                                              <p className="text-xs text-foreground/80 leading-relaxed">{strategy.deepAnalysis.bestTimeToList}</p>
                                            </div>
                                          )}
                                          {strategy.deepAnalysis.negotiationTips && (
                                            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                                              <div className="flex items-center gap-1.5 mb-1.5">
                                                <Shield className="w-3 h-3 text-primary" />
                                                <p className="text-[10px] font-semibold text-primary uppercase tracking-wide">Negotiation</p>
                                              </div>
                                              <p className="text-xs text-foreground/80 leading-relaxed">{strategy.deepAnalysis.negotiationTips}</p>
                                            </div>
                                          )}
                                          {strategy.deepAnalysis.shippingAdvice && (
                                            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                                              <div className="flex items-center gap-1.5 mb-1.5">
                                                <Truck className="w-3 h-3 text-success" />
                                                <p className="text-[10px] font-semibold text-success uppercase tracking-wide">Shipping</p>
                                              </div>
                                              <p className="text-xs text-foreground/80 leading-relaxed">{strategy.deepAnalysis.shippingAdvice}</p>
                                            </div>
                                          )}
                                          {strategy.deepAnalysis.photographyTips && (
                                            <div className="bg-background/50 rounded-lg p-3 border border-border/30">
                                              <div className="flex items-center gap-1.5 mb-1.5">
                                                <Camera className="w-3 h-3 text-warning" />
                                                <p className="text-[10px] font-semibold text-warning uppercase tracking-wide">Photography</p>
                                              </div>
                                              <p className="text-xs text-foreground/80 leading-relaxed">{strategy.deepAnalysis.photographyTips}</p>
                                            </div>
                                          )}
                                        </div>

                                        {/* Risk Assessment */}
                                        {strategy.deepAnalysis.riskAssessment && (
                                          <div className="bg-destructive/5 rounded-lg p-3 border border-destructive/20">
                                            <div className="flex items-center gap-2 mb-1.5">
                                              <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                                              <p className="text-xs font-semibold text-destructive uppercase tracking-wide">Risk Watch</p>
                                            </div>
                                            <p className="text-xs text-foreground/80 leading-relaxed">{strategy.deepAnalysis.riskAssessment}</p>
                                          </div>
                                        )}
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              )}

                              {/* Conversation Thread */}
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                  <MessageCircle className="w-4 h-4" />
                                  Strategy Chat
                                </div>
                                <div className="max-h-64 overflow-y-auto space-y-3 rounded-xl border border-border/50 p-3 bg-background/30">
                                  {strategyChat.map((msg) => (
                                    <motion.div
                                      key={msg.timestamp}
                                      initial={{ opacity: 0, y: 8 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                                    >
                                      <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center overflow-hidden ${msg.role === "user"
                                        ? "bg-primary/10"
                                        : ""
                                        }`}>
                                        {msg.role === "user" ? (
                                          <span className="text-xs font-bold text-primary">U</span>
                                        ) : (
                                          <img src="/ispy-logo.png" alt="ispy.ai" className="w-7 h-7 object-cover" />
                                        )}
                                      </div>
                                      <div className={`flex-1 rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${msg.role === "user"
                                        ? "bg-primary/10 text-foreground ml-8"
                                        : "bg-background/60 text-foreground/80 border border-border/30 mr-8"
                                        }`}>
                                        {msg.text}
                                      </div>
                                    </motion.div>
                                  ))}
                                  {isStrategyRefining && (
                                    <div className="flex gap-3">
                                      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center overflow-hidden">
                                        <img src="/ispy-logo.png" alt="ispy.ai" className="w-7 h-7 object-cover" />
                                      </div>
                                      <div className="bg-background/60 rounded-xl px-3.5 py-2.5 border border-border/30 mr-8">
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce animation-delay-0" />
                                          <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce animation-delay-150" />
                                          <div className="w-1.5 h-1.5 rounded-full bg-primary/50 animate-bounce animation-delay-300" />
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                  <div ref={chatEndRef} />
                                </div>

                                {/* Follow-up suggestion chips */}
                                {strategy.followUpSuggestions && strategy.followUpSuggestions.length > 0 && !isStrategyRefining && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {strategy.followUpSuggestions.map((suggestion, i) => (
                                      <button
                                        key={i}
                                        onClick={() => {
                                          setStrategyInput(suggestion);
                                        }}
                                        className="text-xs bg-primary/5 border border-primary/20 rounded-full px-3 py-1.5 hover:bg-primary/10 hover:border-primary/30 transition-all text-foreground/70 hover:text-foreground"
                                      >
                                        {suggestion}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {/* Chat Input */}
                                <div className="flex gap-2 items-end">
                                  <Textarea
                                    id="strategy-chat-input"
                                    name="strategy-chat"
                                    aria-label="Ask the profit strategy assistant"
                                    placeholder="Ask about pricing, timing, marketplace selection, defects impact, negotiation..."
                                    value={strategyInput}
                                    onChange={(e) => setStrategyInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey && strategyInput.trim()) {
                                        e.preventDefault();
                                        handleRefineStrategy();
                                      }
                                    }}
                                    className="min-h-[52px] text-sm resize-none rounded-xl"
                                  />
                                  <Button
                                    onClick={handleRefineStrategy}
                                    disabled={isStrategyRefining || !strategyInput.trim()}
                                    className="shrink-0 h-[52px] w-[52px] rounded-xl bg-gradient-to-r from-primary to-info text-primary-foreground"
                                  >
                                    {isStrategyRefining ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Send className="w-4 h-4" />
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {analysis && strategy && (
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 }}>
                      <Card className="border-info/20 bg-gradient-to-br from-card to-info/5">
                        <CardHeader className="pb-3">
                          <CardTitle className="flex items-center justify-between text-lg">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-info/10">
                                <Tag className="w-4 h-4 text-info" />
                              </div>
                              Listing Optimizer
                            </div>
                            <Button onClick={handleOptimizeListing} disabled={isListingOptimizing}>
                              {isListingOptimizing ? (
                                <>
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Optimizing...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4 mr-2" /> Optimize
                                </>
                              )}
                            </Button>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {optimizedListing ? (
                            <>
                              <div>
                                <p className="text-xs text-muted-foreground mb-2">Title Suggestions</p>
                                <div className="space-y-2">
                                  {optimizedListing.titles.map((title, index) => (
                                    <button
                                      key={title}
                                      onClick={() => setSelectedTitleIndex(index)}
                                      className={`w-full text-left text-sm border rounded-lg px-3 py-2 transition-colors ${selectedTitleIndex === index
                                        ? "bg-info/10 border-info/30"
                                        : "bg-background/40 border-border/50"
                                        }`}
                                    >
                                      {title}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs text-muted-foreground">Optimized Description</p>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => navigator.clipboard.writeText(optimizedListing.description)}
                                  >
                                    Copy
                                  </Button>
                                </div>
                                <div
                                  className="text-sm text-muted-foreground bg-background/50 border border-border/50 rounded-lg p-3 max-h-40 overflow-y-auto"
                                  dangerouslySetInnerHTML={{ __html: optimizedListing.description }}
                                />
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground mb-2">Keywords</p>
                                <div className="flex flex-wrap gap-2">
                                  {optimizedListing.keywords.map((keyword) => (
                                    <span
                                      key={keyword}
                                      className="text-xs bg-muted/40 border border-border/50 rounded-full px-2 py-1"
                                    >
                                      {keyword}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              Generate optimized titles, description, and keywords for faster sales.
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {/* Action Buttons */}
                  {analysis && marketReport && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="space-y-3"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Purchase Price</Label>
                          <Input
                            type="number"
                            placeholder="0.00"
                            value={purchasePrice}
                            onChange={(e) => setPurchasePrice(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Listing Price</Label>
                          <Input
                            type="number"
                            placeholder={marketReport.suggested_price?.toFixed(2) || "0.00"}
                            value={listingPrice}
                            onChange={(e) => setListingPrice(e.target.value)}
                            className="mt-1"
                          />
                          {!verifiedMarketDataAvailable && (
                            <p className="mt-1 text-xs text-warning">{marketVerificationMessage}</p>
                          )}
                        </div>
                      </div>

                      <ProfitCalculator
                        suggestedPrice={verifiedMarketDataAvailable ? marketReport.suggested_price ?? marketReport.median_price ?? undefined : undefined}
                        lowPrice={verifiedMarketDataAvailable ? marketReport.low_price ?? undefined : undefined}
                        highPrice={verifiedMarketDataAvailable ? marketReport.high_price ?? undefined : undefined}
                        defaultPlatform={defaultProfitPlatform}
                        initialCostPrice={purchasePrice}
                        initialSellingPrice={listingPrice}
                        onCostPriceChange={setPurchasePrice}
                        onSellingPriceChange={setListingPrice}
                      />

                      <div className="flex gap-3">
                        <Button variant="outline" className="flex-1" onClick={() => setShowEbayModal(true)}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          eBay Draft
                        </Button>
                        <Button
                          className="flex-1 bg-gradient-to-r from-success to-info text-primary-foreground"
                          onClick={handleSaveItem}
                          disabled={saving}
                        >
                          {saving ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                          ) : (
                            <><CheckCircle2 className="w-4 h-4 mr-2" /> Save to Inventory</>
                          )}
                        </Button>
                      </div>

                      {/* Rethink Section */}
                      <Card className="bg-muted/30 border-border/50">
                        <CardContent className="p-4">
                          <Label className="text-xs text-muted-foreground">Need corrections? Add context:</Label>
                          <div className="flex gap-2 mt-2">
                            <Textarea
                              placeholder="e.g., 'This is actually a 2019 model' or 'It has minor scratches'"
                              value={additionalContext}
                              onChange={(e) => setAdditionalContext(e.target.value)}
                              className="min-h-[60px] text-sm"
                            />
                            <Button
                              variant="outline"
                              onClick={handleRethink}
                              disabled={isRethinking || !additionalContext.trim()}
                              className="shrink-0"
                            >
                              {isRethinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <Card
                  className="border-dashed border-2 border-border/50 bg-gradient-to-br from-muted/20 to-muted/5 hover:border-primary/30 hover:from-primary/5 hover:to-info/5 transition-all duration-300 cursor-pointer group"
                  onClick={() => setShowSingleSourcePicker(true)}
                >
                  <CardContent className="flex flex-col items-center justify-center py-16 sm:py-20">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-info/10 mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="w-10 h-10 text-primary" />
                    </div>
                    <p className="font-semibold text-lg mb-1">Upload an image to get started</p>
                    <p className="text-sm text-muted-foreground mb-4">or use the scan methods above</p>
                    <Button variant="outline" size="sm" className="group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                      <Camera className="w-4 h-4 mr-2" />
                      Choose File
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Scan History & Profit Panel */}
          {user && (
            <div className="mt-10">
              <ScanHistoryPanel userId={user.id} refreshTrigger={historyRefreshTrigger} />
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showBarcodeScanner && (
        <BarcodeScanner onBarcodeDetected={handleBarcodeDetected} onClose={() => setShowBarcodeScanner(false)} />
      )}

      {showLiveScanner && user && (
        <LiveScanV2
          onClose={() => {
            setShowLiveScanner(false);
            refreshHistory();
          }}
          userId={user.id}
        />
      )}

      {showLotResults && user && lotImagePreview && (
        <LotResultsModal
          items={lotItems}
          open={showLotResults}
          onOpenChange={setShowLotResults}
          imagePreview={lotImagePreview}
          userId={user.id}
        />
      )}

      {showEbayModal && analysis && marketReport && (
        <EbayDraftModal
          open={showEbayModal}
          onOpenChange={setShowEbayModal}
          analysis={analysis}
          marketReport={marketReport}
        />
      )}
            <FeedbackWidget context="scan" trigger={!!analysis} />
    </Layout>
  );
}
