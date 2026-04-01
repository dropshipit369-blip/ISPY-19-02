import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ThumbsUp,
  ThumbsDown,
  Edit3,
  Loader2,
  Star,
  Brain,
  Sparkles,
  DollarSign,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatAudRange } from "@/lib/utils";

interface FeedbackItem {
  name: string;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  condition?: string | null;
  lowPrice?: number;
  highPrice?: number;
  scanLogId?: string;
}

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: FeedbackItem | null;
  userId: string;
  onFeedbackSubmitted?: () => void;
}

const CATEGORIES = [
  "Electronics",
  "Clothing",
  "Collectibles",
  "Home & Garden",
  "Sports",
  "Toys",
  "Books",
  "Jewelry",
  "Art",
  "Antiques",
  "Music",
  "Video Games",
  "Other",
];

const CONDITIONS = ["New", "Like New", "Very Good", "Good", "Fair", "Poor"];

export function FeedbackModal({
  open,
  onOpenChange,
  item,
  userId,
  onFeedbackSubmitted,
}: FeedbackModalProps) {
  const [feedbackType, setFeedbackType] = useState<"confirmation" | "correction" | "rejection">("correction");
  const [correctedName, setCorrectedName] = useState("");
  const [correctedBrand, setCorrectedBrand] = useState("");
  const [correctedModel, setCorrectedModel] = useState("");
  const [correctedCategory, setCorrectedCategory] = useState("");
  const [correctedCondition, setCorrectedCondition] = useState("");
  const [correctedLowPrice, setCorrectedLowPrice] = useState("");
  const [correctedHighPrice, setCorrectedHighPrice] = useState("");
  const [accuracyRating, setAccuracyRating] = useState<number>(3);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setFeedbackType("correction");
    setCorrectedName("");
    setCorrectedBrand("");
    setCorrectedModel("");
    setCorrectedCategory("");
    setCorrectedCondition("");
    setCorrectedLowPrice("");
    setCorrectedHighPrice("");
    setAccuracyRating(3);
    setNotes("");
  };

  const handleSubmit = async () => {
    if (!item) return;

    setSubmitting(true);
    try {
      const feedbackData: any = {
        user_id: userId,
        scan_log_id: item.scanLogId || null,
        original_name: item.name,
        feedback_type: feedbackType,
        accuracy_rating: accuracyRating,
        notes: notes || null,
      };

      // Only add corrections if feedback type is correction
      if (feedbackType === "correction") {
        if (correctedName.trim()) feedbackData.corrected_name = correctedName.trim();
        if (correctedBrand.trim()) feedbackData.corrected_brand = correctedBrand.trim();
        if (correctedModel.trim()) feedbackData.corrected_model = correctedModel.trim();
        if (correctedCategory) feedbackData.corrected_category = correctedCategory;
        if (correctedCondition) feedbackData.corrected_condition = correctedCondition;
        if (correctedLowPrice) feedbackData.corrected_low_price = parseFloat(correctedLowPrice);
        if (correctedHighPrice) feedbackData.corrected_high_price = parseFloat(correctedHighPrice);

        // Store original values for corrections
        feedbackData.original_brand = item.brand || null;
        feedbackData.original_model = item.model || null;
        feedbackData.original_category = item.category || null;
        feedbackData.original_condition = item.condition || null;
        feedbackData.original_low_price = item.lowPrice || null;
        feedbackData.original_high_price = item.highPrice || null;
      }

      const { error } = await supabase.from("scan_feedback").insert(feedbackData);

      if (error) throw error;

      toast.success(
        feedbackType === "confirmation"
          ? "Thanks! Your confirmation helps improve accuracy."
          : feedbackType === "rejection"
          ? "Thanks! We'll learn from this mistake."
          : "Thanks! Your correction will improve future scans."
      );

      resetForm();
      onOpenChange(false);
      onFeedbackSubmitted?.();
    } catch (err) {
      console.error("Feedback submission failed:", err);
      toast.error("Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Help AI Learn
          </DialogTitle>
          <DialogDescription>
            Your feedback improves scan accuracy for everyone
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Detection Summary */}
          <div className="bg-muted/50 rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium">{item.name}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {item.brand && (
                    <Badge variant="outline" className="text-xs">
                      {item.brand}
                    </Badge>
                  )}
                  {item.category && (
                    <Badge variant="secondary" className="text-xs">
                      {item.category}
                    </Badge>
                  )}
                  {item.condition && (
                    <Badge variant="outline" className="text-xs">
                      {item.condition}
                    </Badge>
                  )}
                </div>
              </div>
              {(item.lowPrice || item.highPrice) && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Est. Price</p>
                  <p className="font-semibold">
                    {formatAudRange(item.lowPrice, item.highPrice)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Feedback Type Selection */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant={feedbackType === "confirmation" ? "default" : "outline"}
              className="flex flex-col items-center gap-1 h-auto py-3"
              onClick={() => setFeedbackType("confirmation")}
            >
              <ThumbsUp className="w-5 h-5" />
              <span className="text-xs">Correct!</span>
            </Button>
            <Button
              type="button"
              variant={feedbackType === "correction" ? "default" : "outline"}
              className="flex flex-col items-center gap-1 h-auto py-3"
              onClick={() => setFeedbackType("correction")}
            >
              <Edit3 className="w-5 h-5" />
              <span className="text-xs">Fix It</span>
            </Button>
            <Button
              type="button"
              variant={feedbackType === "rejection" ? "destructive" : "outline"}
              className="flex flex-col items-center gap-1 h-auto py-3"
              onClick={() => setFeedbackType("rejection")}
            >
              <ThumbsDown className="w-5 h-5" />
              <span className="text-xs">Wrong</span>
            </Button>
          </div>

          {/* Accuracy Rating */}
          <div>
            <Label className="text-sm">Overall Accuracy</Label>
            <div className="flex items-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setAccuracyRating(star)}
                  className="p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-6 h-6 ${
                      star <= accuracyRating
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-muted-foreground">
                {accuracyRating === 1 && "Very Poor"}
                {accuracyRating === 2 && "Poor"}
                {accuracyRating === 3 && "Okay"}
                {accuracyRating === 4 && "Good"}
                {accuracyRating === 5 && "Excellent"}
              </span>
            </div>
          </div>

          {/* Correction Fields */}
          {feedbackType === "correction" && (
            <div className="space-y-4 p-4 bg-muted/30 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Provide Corrections</span>
              </div>

              <div className="grid gap-4">
                <div>
                  <Label htmlFor="name" className="text-xs">
                    Correct Name
                  </Label>
                  <Input
                    id="name"
                    placeholder={item.name}
                    value={correctedName}
                    onChange={(e) => setCorrectedName(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="brand" className="text-xs">
                      Correct Brand
                    </Label>
                    <Input
                      id="brand"
                      placeholder={item.brand || "Unknown"}
                      value={correctedBrand}
                      onChange={(e) => setCorrectedBrand(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="model" className="text-xs">
                      Correct Model
                    </Label>
                    <Input
                      id="model"
                      placeholder={item.model || "Unknown"}
                      value={correctedModel}
                      onChange={(e) => setCorrectedModel(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="category" className="text-xs">
                      Correct Category
                    </Label>
                    <Select value={correctedCategory} onValueChange={setCorrectedCategory}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={item.category || "Select..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="condition" className="text-xs">
                      Correct Condition
                    </Label>
                    <Select value={correctedCondition} onValueChange={setCorrectedCondition}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder={item.condition || "Select..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITIONS.map((cond) => (
                          <SelectItem key={cond} value={cond}>
                            {cond}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="lowPrice" className="text-xs">
                      Correct Low Price
                    </Label>
                    <div className="relative mt-1">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="lowPrice"
                        type="number"
                        step="0.01"
                        placeholder={item.lowPrice?.toString() || "0"}
                        value={correctedLowPrice}
                        onChange={(e) => setCorrectedLowPrice(e.target.value)}
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="highPrice" className="text-xs">
                      Correct High Price
                    </Label>
                    <div className="relative mt-1">
                      <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="highPrice"
                        type="number"
                        step="0.01"
                        placeholder={item.highPrice?.toString() || "0"}
                        value={correctedHighPrice}
                        onChange={(e) => setCorrectedHighPrice(e.target.value)}
                        className="pl-7"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-xs">
              Additional Notes (optional)
            </Label>
            <Textarea
              id="notes"
              placeholder="Any other details that would help improve detection..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1"
              rows={2}
            />
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Brain className="w-4 h-4 mr-2" />
                Submit Feedback
              </>
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Your feedback trains the AI to be more accurate over time
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
