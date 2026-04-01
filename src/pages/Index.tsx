import { useState } from "react";
import { useSpatialScanner } from "@/hooks/useSpatialScanner";
import { SpatialOverlay } from "@/components/scanner/SpatialOverlay";
import { DailyAnalytics } from "@/components/dashboard/DailyAnalytics";
import { ItemDetailDrawer } from "@/components/scanner/ItemDetailDrawer";
import { Button } from "@/components/ui/button";
import { Camera, AlertCircle, RefreshCw } from "lucide-react";

const Index = () => {
  const { videoRef, canvasRef, detectedItems, sessionHistory, captureAndAnalyze, isScanning, cameraError, retryCamera } = useSpatialScanner();
  const [selectedItem, setSelectedItem] = useState(null);

  return (
    <div className="h-screen w-full bg-black relative flex flex-col">
      <div className="relative flex-1">
        {cameraError ? (
          <div className="h-full w-full flex flex-col items-center justify-center bg-muted/20 p-6 text-center">
            <AlertCircle className="w-16 h-16 text-destructive mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Camera Access Required</h2>
            <p className="text-muted-foreground max-w-sm">{cameraError}</p>
            <Button 
              onClick={() => void retryCamera()} 
              className="mt-6"
              variant="outline"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <SpatialOverlay items={detectedItems} onSelect={setSelectedItem} />
            {isScanning && <div className="absolute inset-0 bg-scan-line animate-shimmer" />}
          </>
        )}
      </div>

      <div className="bg-background rounded-t-3xl -mt-6 z-10 pb-8">
        <DailyAnalytics scans={sessionHistory} />
        <div className="px-6 mt-2">
          <Button
            onClick={captureAndAnalyze}
            disabled={isScanning || !!cameraError}
            className="w-full h-16 rounded-2xl bg-gradient-to-r from-primary to-info text-primary-foreground text-lg font-semibold"
          >
            <Camera className="w-5 h-5 mr-2" />
            {isScanning ? "IDENTIFYING..." : "LIVE SPATIAL SCAN"}
          </Button>
        </div>
      </div>

      <ItemDetailDrawer item={selectedItem} open={!!selectedItem} onOpenChange={() => setSelectedItem(null)} />
    </div>
  );
};

export default Index;
