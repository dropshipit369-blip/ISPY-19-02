import { useEffect, useRef, useState, useCallback } from "react";
import * as tf from "@tensorflow/tfjs";
import * as cocoSsd from "@tensorflow-models/coco-ssd";

export interface LocalDetection {
  id: string;
  class: string;
  score: number;
  bbox: [number, number, number, number]; // [x, y, width, height] in pixels
}

export function useTensorFlow() {
  const modelRef = useRef<cocoSsd.ObjectDetection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the model once
  useEffect(() => {
    let mounted = true;

    const loadModel = async () => {
      try {
        // Prefer WebGL for GPU acceleration, fallback to WASM
        try {
          await tf.setBackend("webgl");
        } catch {
          console.log("WebGL not available, trying WASM...");
          await tf.setBackend("wasm");
        }
        await tf.ready();
        
        console.log(`TensorFlow backend: ${tf.getBackend()}`);
        console.log("Loading COCO-SSD model (MobileNet V2)...");
        
        const model = await cocoSsd.load({
          base: "mobilenet_v2", // Better accuracy than lite_mobilenet_v2
        });
        
        if (mounted) {
          modelRef.current = model;
          setIsReady(true);
          setIsLoading(false);
          console.log("COCO-SSD model loaded successfully");
        }
      } catch (err) {
        console.error("Failed to load TensorFlow model:", err);
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load AI model");
          setIsLoading(false);
        }
      }
    };

    loadModel();

    return () => {
      mounted = false;
    };
  }, []);

  // High-performance detection with more objects and lower threshold
  const detect = useCallback(
    async (video: HTMLVideoElement): Promise<LocalDetection[]> => {
      if (!modelRef.current || !video.videoWidth || !video.videoHeight) {
        return [];
      }

      try {
        // Detect up to 20 objects with 25% confidence threshold for better coverage
        const predictions = await modelRef.current.detect(video, 20, 0.25);
        
        return predictions.map((pred, idx) => ({
          id: `${pred.class}-${idx}-${Date.now()}`,
          class: pred.class,
          score: pred.score,
          bbox: pred.bbox as [number, number, number, number],
        }));
      } catch (err) {
        console.error("Detection error:", err);
        return [];
      }
    },
    []
  );

  return { detect, isLoading, isReady, error };
}
