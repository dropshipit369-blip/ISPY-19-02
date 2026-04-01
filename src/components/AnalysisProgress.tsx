import { Progress } from "@/components/ui/progress";
import { Loader2, Sparkles, Search, DollarSign, CheckCircle2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";

interface AnalysisProgressProps {
  isAnalyzing: boolean;
  type?: "single" | "lot";
  startTime?: number; // When analysis started (Date.now())
  estimatedDurationMs?: number;
}

const SINGLE_STEPS = [
  { label: "Uploading image", icon: Loader2 },
  { label: "Analyzing with AI", icon: Sparkles },
  { label: "Researching market prices", icon: Search },
  { label: "Generating report", icon: DollarSign },
];

const LOT_STEPS = [
  { label: "Uploading image", icon: Loader2 },
  { label: "Detecting items", icon: Search },
  { label: "Analyzing each item", icon: Sparkles },
  { label: "Researching prices", icon: DollarSign },
  { label: "Generating reports", icon: CheckCircle2 },
];

// Estimated durations based on typical API response times
const ESTIMATED_SINGLE_DURATION = 8000; // 8 seconds
const ESTIMATED_LOT_DURATION = 15000; // 15 seconds

export function AnalysisProgress({
  isAnalyzing,
  type = "single",
  startTime,
  estimatedDurationMs,
}: AnalysisProgressProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [adaptiveEstimate, setAdaptiveEstimate] = useState(
    type === "lot" ? ESTIMATED_LOT_DURATION : ESTIMATED_SINGLE_DURATION
  );
  const analysisStartRef = useRef<number>(0);

  const steps = type === "lot" ? LOT_STEPS : SINGLE_STEPS;
  const defaultEstimatedDuration = type === "lot" ? ESTIMATED_LOT_DURATION : ESTIMATED_SINGLE_DURATION;

  useEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(`analysis-duration-${type}`);
      if (!storedValue) return;
      const parsed = Number(storedValue);
      if (Number.isFinite(parsed) && parsed > 2000) {
        setAdaptiveEstimate(parsed);
      }
    } catch {
      // localStorage unavailable; keep defaults
    }
  }, [type]);

  const estimatedDuration = estimatedDurationMs || adaptiveEstimate || defaultEstimatedDuration;

  useEffect(() => {
    if (!isAnalyzing) {
      // Analysis complete - snap to 100%
      if (progress > 0 && progress < 100) {
        setProgress(100);
        setCurrentStep(steps.length - 1);
        // Reset after showing complete
        const timeout = setTimeout(() => {
          setCurrentStep(0);
          setProgress(0);
          setElapsedTime(0);
        }, 500);
        return () => clearTimeout(timeout);
      }
      return;
    }

    // Start or continue tracking
    analysisStartRef.current = startTime || Date.now();
    
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - analysisStartRef.current;
      setElapsedTime(elapsed);

      // Use asymptotic progress - approaches 95% but never reaches it until complete
      // This creates a natural slowdown effect
      const progressPercent = Math.min(95 * (1 - Math.exp(-elapsed / (estimatedDuration * 0.5))), 95);
      setProgress(progressPercent);

      // Determine current step based on progress
      const stepProgress = progressPercent / 95;
      const newStep = Math.min(
        Math.floor(stepProgress * steps.length),
        steps.length - 1
      );
      setCurrentStep(newStep);
    }, 50);

    return () => clearInterval(interval);
  }, [isAnalyzing, startTime, estimatedDuration, steps.length, progress]);

  useEffect(() => {
    if (isAnalyzing || elapsedTime < 1500) return;

    try {
      const previous = Number(window.localStorage.getItem(`analysis-duration-${type}`));
      const nextEstimate = Number.isFinite(previous) && previous > 0
        ? Math.round(previous * 0.7 + elapsedTime * 0.3)
        : elapsedTime;
      window.localStorage.setItem(`analysis-duration-${type}`, String(nextEstimate));
      setAdaptiveEstimate(nextEstimate);
    } catch {
      // localStorage unavailable; ignore
    }
  }, [elapsedTime, isAnalyzing, type]);

  if (!isAnalyzing && progress === 0) return null;

  const CurrentIcon = steps[currentStep]?.icon || Loader2;
  const isComplete = progress >= 100;
  
  const remainingMs = Math.max(0, estimatedDuration - elapsedTime);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const elapsedSeconds = Math.floor(elapsedTime / 1000);
  const runningLong = !isComplete && elapsedTime > estimatedDuration;

  return (
    <div className="space-y-4 p-4 rounded-xl border border-border bg-card/50 backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            {isComplete ? (
              <CheckCircle2 className="w-5 h-5 text-primary" />
            ) : (
              <CurrentIcon className="w-5 h-5 text-primary animate-spin" />
            )}
          </div>
          <div>
            <p className="font-medium text-sm">
              {isComplete ? "Analysis complete!" : steps[currentStep]?.label}
            </p>
            <p className="text-xs text-muted-foreground">
              {isComplete ? "Results ready" : `Step ${currentStep + 1} of ${steps.length}`}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium tabular-nums">
            {isComplete ? "Done" : runningLong ? "Finalizing" : `~${remainingSeconds}s`}
          </p>
          <p className="text-xs text-muted-foreground">
            {isComplete ? `${elapsedSeconds}s total` : runningLong ? `${elapsedSeconds}s elapsed` : "estimated left"}
          </p>
        </div>
      </div>
      
      <Progress value={progress} className="h-2 transition-all duration-300" />

      {!isComplete && (
        <p className="text-xs text-muted-foreground text-center">
          {runningLong
            ? "Taking longer than usual. Finishing up..."
            : `Elapsed ${elapsedSeconds}s`}
        </p>
      )}
      
      <div className="flex justify-between">
        {steps.map((step, index) => {
          const StepIcon = step.icon;
          const isActive = index === currentStep;
          const isStepComplete = index < currentStep || isComplete;
          
          return (
            <div 
              key={index}
              className={`flex flex-col items-center gap-1 transition-opacity ${
                isActive ? "opacity-100" : isStepComplete ? "opacity-60" : "opacity-30"
              }`}
            >
              <div className={`p-1.5 rounded-full ${
                isStepComplete ? "bg-primary/20" : isActive ? "bg-primary/10" : "bg-muted"
              }`}>
                {isStepComplete ? (
                  <CheckCircle2 className="w-3 h-3 text-primary" />
                ) : (
                  <StepIcon className={`w-3 h-3 ${isActive ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
