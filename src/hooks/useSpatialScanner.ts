import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  attachCameraStream,
  getCameraErrorMessage,
  requestBestEffortCameraStream,
  stopCameraStream,
} from '@/lib/camera';

const MAX_IMAGE_WIDTH = 1024;

export const useSpatialScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [detectedItems, setDetectedItems] = useState<any[]>([]);
  const [sessionHistory, setSessionHistory] = useState<any[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const persistedTitles = useRef<Set<string>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);

  // Initialize camera stream
  const initCamera = useCallback(async () => {
    try {
      stopCameraStream(streamRef.current);
      streamRef.current = null;

      const stream = await requestBestEffortCameraStream('environment');
      const video = videoRef.current;
      if (!video) {
        stopCameraStream(stream);
        throw new Error('Camera preview could not be attached.');
      }

      streamRef.current = stream;
      await attachCameraStream(video, stream);
      setCameraError(null);
    } catch (err) {
      console.error('Camera access denied:', err);
      setCameraError(getCameraErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    void initCamera();

    return () => {
      stopCameraStream(streamRef.current);
      streamRef.current = null;
    };
  }, [initCamera]);

  // Haptic feedback utility
  const triggerHaptic = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(50);
    }
  }, []);

  const captureAndAnalyze = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isScanning || cameraError) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context || !video.videoWidth || !video.videoHeight) return;

    // Downsample to max 1024px width to reduce API costs and latency
    const aspectRatio = video.videoHeight / video.videoWidth;
    const targetWidth = Math.min(video.videoWidth, MAX_IMAGE_WIDTH);
    const targetHeight = Math.round(targetWidth * aspectRatio);

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.drawImage(video, 0, 0, targetWidth, targetHeight);
    
    const base64Image = canvas.toDataURL('image/jpeg', 0.7);

    setIsScanning(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('analyze-lot', { body: { image: base64Image } });

      if (!error && data?.items) {
        const itemsWithIds = data.items.map((i: any) => ({ ...i, id: crypto.randomUUID() }));
        setDetectedItems(itemsWithIds);
        
        // Haptic feedback on successful scan
        triggerHaptic();
        
        // Auto-save logic
        const newLogs = itemsWithIds.filter((i: any) => !persistedTitles.current.has(i.analysis.title));
        if (newLogs.length > 0) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from('scan_logs').insert(newLogs.map((i: any) => ({
              name: i.analysis.title,
              brand: i.analysis.brand,
              median_price: i.marketReport?.median_price,
              confidence: i.marketReport?.confidence_score,
              category: i.analysis.category,
              condition: i.analysis.condition,
              user_id: user.id
            })));
          }
          newLogs.forEach((i: any) => persistedTitles.current.add(i.analysis.title));
          setSessionHistory(prev => [...newLogs, ...prev]);
        }
      }
    } catch (err) {
      console.error('Scan failed:', err);
    }
    
    setIsScanning(false);
  }, [cameraError, isScanning, triggerHaptic]);

  return { 
    videoRef, 
    canvasRef, 
    detectedItems, 
    sessionHistory, 
    captureAndAnalyze, 
    isScanning,
    cameraError,
    retryCamera: initCamera,
  };
};
