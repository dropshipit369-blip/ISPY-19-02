import { useEffect, useRef, useState } from "react";
import Quagga from "@ericblade/quagga2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Barcode, X, Loader2, RefreshCw } from "lucide-react";
import { getCameraEnvironmentIssue, getCameraErrorMessage } from "@/lib/camera";

interface BarcodeScannerProps {
  onBarcodeDetected: (code: string, format: string, snapshotDataUrl?: string) => void;
  onClose: () => void;
}

export function BarcodeScanner({ onBarcodeDetected, onClose }: BarcodeScannerProps) {
  const scannerRef = useRef<HTMLDivElement>(null);
  const hasDetectedRef = useRef(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!scannerRef.current) return;
    hasDetectedRef.current = false;
    setError(null);
    setIsInitializing(true);

    const environmentIssue = getCameraEnvironmentIssue();
    if (environmentIssue) {
      setError(environmentIssue);
      setIsInitializing(false);
      return;
    }

    const normalizeDetectedCode = (rawCode: string, format: string) => {
      const cleaned = rawCode.replace(/[^\dA-Za-z]/g, "");
      const numeric = cleaned.replace(/\D/g, "");
      const normalizedFormat = format.toLowerCase();

      if (normalizedFormat.includes("ean") || normalizedFormat.includes("upc")) {
        if ((numeric.startsWith("978") || numeric.startsWith("979")) && numeric.length >= 13) {
          return numeric.slice(0, 13);
        }
        if (normalizedFormat.includes("upc") && numeric.length >= 12) {
          return numeric.slice(0, 12);
        }
        if (normalizedFormat.includes("ean") && numeric.length >= 8) {
          return numeric.slice(0, numeric.length >= 13 ? 13 : 8);
        }
      }

      return cleaned || rawCode;
    };

    const captureSnapshot = () => {
      const video = scannerRef.current?.querySelector("video");
      if (!(video instanceof HTMLVideoElement)) return undefined;
      if (!video.videoWidth || !video.videoHeight) return undefined;

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) return undefined;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.9);
    };

    const handleDetected = (result: { codeResult?: { code?: string; format?: string } }) => {
      if (hasDetectedRef.current) return;
      if (!result.codeResult?.code) return;

      hasDetectedRef.current = true;
      const code = normalizeDetectedCode(result.codeResult.code, result.codeResult.format || "unknown");
      const format = result.codeResult.format || "unknown";
      const snapshotDataUrl = captureSnapshot();

      Quagga.stop();
      onBarcodeDetected(code, format, snapshotDataUrl);
    };

    Quagga.init(
      {
        inputStream: {
          type: "LiveStream",
          target: scannerRef.current,
          singleChannel: false,
          constraints: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        locator: {
          patchSize: "large",
          halfSample: false,
        },
        numOfWorkers: Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2)),
        frequency: 8,
        decoder: {
          readers: [
            {
              format: "ean_reader",
              config: {
                supplements: ["ean_5_reader", "ean_2_reader"],
              },
            } as any,
            "ean_reader",
            "ean_8_reader",
            "upc_reader",
            "upc_e_reader",
            "code_128_reader",
            "code_39_reader",
          ],
        },
        locate: true,
      },
      (err) => {
        if (err) {
          console.error("Quagga init error:", err);
          setError(getCameraErrorMessage(err));
          setIsInitializing(false);
          return;
        }
        Quagga.start();
        setIsInitializing(false);
      }
    );

    Quagga.onDetected(handleDetected);

    return () => {
      Quagga.stop();
      Quagga.offDetected(handleDetected);
    };
  }, [onBarcodeDetected, retryKey]);

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Barcode className="w-5 h-5" />
          Scan Barcode
        </CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="aspect-video rounded-lg bg-destructive/10 flex flex-col items-center justify-center gap-4 px-4 text-center">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => setRetryKey((value) => value + 1)}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry scanner
            </Button>
          </div>
        ) : (
          <div className="relative">
            {isInitializing && (
              <div className="absolute inset-0 flex items-center justify-center bg-secondary/80 rounded-lg z-10">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
            <div
              ref={scannerRef}
              className="aspect-video rounded-lg overflow-hidden bg-secondary [&>video]:w-full [&>video]:h-full [&>video]:object-cover [&>canvas]:absolute [&>canvas]:inset-0"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-24 border-2 border-primary/50 rounded-lg" />
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge variant="outline">UPC</Badge>
          <Badge variant="outline">EAN-13</Badge>
          <Badge variant="outline">EAN-8</Badge>
          <Badge variant="outline">Code 128</Badge>
          <Badge variant="outline">Code 39</Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Position the barcode within the frame
        </p>
      </CardContent>
    </Card>
  );
}
