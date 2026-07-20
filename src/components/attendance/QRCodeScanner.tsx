import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Webcam from 'react-webcam';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getAttendanceCutoffTime, isPastCutoffTime } from '@/services/attendance/AttendanceSettingsService';
import { recordAttendance } from '@/services/face-recognition/RecognitionService';
import { sendAutoParentNotification } from '@/services/notification/AutoNotificationService';
import {
  QrCode,
  Camera,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Zap,
  Scan,
  Shield,
  User,
  Clock
} from 'lucide-react';
import jsQR from 'jsqr';

interface QRCodeScannerProps {
  onScanComplete?: (result: { success: boolean; name?: string; userId?: string }) => void;
  autoStart?: boolean;
  hideManualControls?: boolean;
}

interface QRData {
  id: string;
  user_id?: string;
  student_id?: string;
  name: string;
  employee_id: string;
  category: string;
  timestamp: number;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({
  onScanComplete,
  autoStart = false,
  hideManualControls = false,
}) => {
  const { toast } = useToast();
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const autofocusIntervalRef = useRef<number | null>(null);
  const isLoopActiveRef = useRef(false);
  const isProcessingScanRef = useRef(false);
  const lastFrameAtRef = useRef(0);
  const inFlightDecodeRef = useRef(false);
  const frameCounterRef = useRef(0);
  const recentScanRef = useRef<Map<string, number>>(new Map());
  const barcodeDetectorRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const roiCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const upscaleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastCanvasSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });

  const SCAN_FRAME_INTERVAL_MS = 22;
  const CENTER_SCAN_RATIO = 0.68;
  const DUPLICATE_SCAN_COOLDOWN_MS = 10_000;
  const MAX_SCAN_WIDTH = 960;
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ success: boolean; name?: string } | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [lastScannedId, setLastScannedId] = useState<string | null>(null);
  const [focusAssistEnabled, setFocusAssistEnabled] = useState(false);
  const stopAutoFocusLoop = () => {
    if (autofocusIntervalRef.current) {
      window.clearInterval(autofocusIntervalRef.current);
      autofocusIntervalRef.current = null;
    }
  };

  const applyAutoFocus = useCallback(async () => {
    const video = webcamRef.current?.video;
    const stream = video?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks?.()[0];
    if (!track?.applyConstraints) return false;

    try {
      const capabilities = typeof track.getCapabilities === 'function' ? track.getCapabilities() : ({} as any);
      const advanced: Record<string, unknown> = {};

      if (Array.isArray((capabilities as any).focusMode)) {
        if ((capabilities as any).focusMode.includes('continuous')) {
          advanced.focusMode = 'continuous';
        } else if ((capabilities as any).focusMode.includes('single-shot')) {
          advanced.focusMode = 'single-shot';
        }
      }

      if (typeof (capabilities as any).zoom?.max === 'number' && typeof (capabilities as any).zoom?.min === 'number') {
        const min = Number((capabilities as any).zoom.min);
        const max = Number((capabilities as any).zoom.max);
        const targetZoom = Math.max(min, Math.min(max, min + (max - min) * 0.15));
        advanced.zoom = targetZoom;
      }

      if (Object.keys(advanced).length === 0) return false;

      await track.applyConstraints({ advanced: [advanced] as any });
      return true;
    } catch {
      return false;
    }
  }, []);

  const startAutoFocusLoop = useCallback(async () => {
    stopAutoFocusLoop();
    const enabled = await applyAutoFocus();
    setFocusAssistEnabled(enabled);

    autofocusIntervalRef.current = window.setInterval(async () => {
      if (!isLoopActiveRef.current) return;
      const ok = await applyAutoFocus();
      if (ok) setFocusAssistEnabled(true);
    }, 1200);
  }, [applyAutoFocus]);


  const normalizeValue = (value: unknown) => String(value ?? '').trim();

  const parseQRPayload = (rawValue: string): QRData | null => {
    const raw = normalizeValue(rawValue);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          id: normalizeValue((parsed as any).id || (parsed as any).user_id || (parsed as any).student_id),
          user_id: normalizeValue((parsed as any).user_id),
          student_id: normalizeValue((parsed as any).student_id),
          name: normalizeValue((parsed as any).name || 'Student'),
          employee_id: normalizeValue((parsed as any).employee_id || (parsed as any).student_id || (parsed as any).id),
          category: normalizeValue((parsed as any).category || 'General'),
          timestamp: Number((parsed as any).timestamp || Date.now()),
        };
      }
    } catch {
      // Support plain-text QR payloads (legacy cards): treat as ID/employee_id.
      return {
        id: raw,
        user_id: raw,
        student_id: raw,
        name: 'Student',
        employee_id: raw,
        category: 'General',
        timestamp: Date.now(),
      };
    }

    return null;
  };

  const getScanIdentity = (qrData: QRData) =>
    String(qrData.user_id || qrData.id || qrData.student_id || qrData.employee_id || qrData.name || '').trim().toLowerCase();

  const looksLikeUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  const resolveAttendanceTargetId = async (qrData: QRData) => {
    const preferred = normalizeValue(qrData.user_id || qrData.id);
    if (preferred && looksLikeUuid(preferred)) return preferred;

    const studentKey = normalizeValue(qrData.student_id || qrData.employee_id || qrData.id);
    if (!studentKey) return preferred || null;

    const [descriptorRes, attendanceRes] = await Promise.all([
      supabase
        .from('face_descriptors')
        .select('user_id')
        .eq('student_id', studentKey)
        .not('user_id', 'is', null)
        .limit(1)
        .maybeSingle(),
      supabase
        .from('attendance_records')
        .select('user_id')
        .eq('student_id', studentKey)
        .not('user_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const resolvedUserId =
      normalizeValue(descriptorRes.data?.user_id) ||
      normalizeValue(attendanceRes.data?.user_id) ||
      preferred ||
      studentKey;

    return resolvedUserId || null;
  };

  const isDuplicateScan = (identity: string) => {
    const now = Date.now();
    const lastSeen = recentScanRef.current.get(identity);
    if (lastSeen && now - lastSeen < DUPLICATE_SCAN_COOLDOWN_MS) return true;
    recentScanRef.current.set(identity, now);

    for (const [key, timestamp] of recentScanRef.current.entries()) {
      if (now - timestamp > DUPLICATE_SCAN_COOLDOWN_MS * 2) {
        recentScanRef.current.delete(key);
      }
    }
    return false;
  };

  // Simple QR code detection using canvas
  const detectQRCode = useCallback(async () => {
    if (inFlightDecodeRef.current || !webcamRef.current || !canvasRef.current || !isLoopActiveRef.current) return;

    const video = webcamRef.current.video;
    if (!video || video.readyState !== 4) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const srcWidth = video.videoWidth;
    const srcHeight = video.videoHeight;
    const scale = srcWidth > MAX_SCAN_WIDTH ? MAX_SCAN_WIDTH / srcWidth : 1;
    const targetWidth = Math.max(320, Math.round(srcWidth * scale));
    const targetHeight = Math.max(240, Math.round(srcHeight * scale));

    if (lastCanvasSizeRef.current.w !== targetWidth || lastCanvasSizeRef.current.h !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      lastCanvasSizeRef.current = { w: targetWidth, h: targetHeight };
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    inFlightDecodeRef.current = true;
    try {
      frameCounterRef.current += 1;
      let foundRawValue: string | null = null;

      // Use BarcodeDetector API if available (modern browsers)
      if ('BarcodeDetector' in window) {
        if (!barcodeDetectorRef.current) {
          barcodeDetectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        }
        // Full-frame first so QR can be recognized anywhere in camera view.
        let barcodes = await barcodeDetectorRef.current.detect(canvas);

        // Fallback ROI (slightly faster on some low-end devices if full-frame misses).
        if (barcodes.length === 0) {
          const roiWidth = Math.round(canvas.width * CENTER_SCAN_RATIO);
          const roiHeight = Math.round(canvas.height * CENTER_SCAN_RATIO);
          const roiX = Math.round((canvas.width - roiWidth) / 2);
          const roiY = Math.round((canvas.height - roiHeight) / 2);

          const roiImageData = ctx.getImageData(roiX, roiY, roiWidth, roiHeight);
          if (!roiCanvasRef.current) roiCanvasRef.current = document.createElement('canvas');
          const roiCanvas = roiCanvasRef.current;
          roiCanvas.width = roiWidth;
          roiCanvas.height = roiHeight;
          const roiCtx = roiCanvas.getContext('2d');
          if (!roiCtx) return;
          roiCtx.putImageData(roiImageData, 0, 0);
          barcodes = await barcodeDetectorRef.current.detect(roiCanvas);
        }

        if (barcodes.length > 0 && barcodes[0]?.rawValue) {
          foundRawValue = String(barcodes[0].rawValue);
        }
      }

      // Fallback path for browsers/devices where BarcodeDetector is missing or unreliable.
      if (!foundRawValue) {
        const tryDecodeJsQr = (x: number, y: number, width: number, height: number): string | null => {
          const imageData = ctx.getImageData(x, y, width, height);
          const decoded = jsQR(imageData.data, width, height, { inversionAttempts: 'attemptBoth' });
          return decoded?.data || null;
        };

        // Full-frame first for "detect from anywhere" behavior.
        foundRawValue = tryDecodeJsQr(0, 0, canvas.width, canvas.height);

        if (!foundRawValue) {
          const roiWidth = Math.round(canvas.width * CENTER_SCAN_RATIO);
          const roiHeight = Math.round(canvas.height * CENTER_SCAN_RATIO);
          const roiX = Math.round((canvas.width - roiWidth) / 2);
          const roiY = Math.round((canvas.height - roiHeight) / 2);
          foundRawValue = tryDecodeJsQr(roiX, roiY, roiWidth, roiHeight);

          // Small/far QR fallback: upscale center region for faster lock from a distance.
          if (!foundRawValue) {
            if (!upscaleCanvasRef.current) upscaleCanvasRef.current = document.createElement('canvas');
            const upscaleCanvas = upscaleCanvasRef.current;
            const upscaleWidth = Math.max(320, roiWidth * 2);
            const upscaleHeight = Math.max(320, roiHeight * 2);
            upscaleCanvas.width = upscaleWidth;
            upscaleCanvas.height = upscaleHeight;

            const upscaleCtx = upscaleCanvas.getContext('2d');
            if (upscaleCtx) {
              upscaleCtx.imageSmoothingEnabled = false;
              upscaleCtx.drawImage(canvas, roiX, roiY, roiWidth, roiHeight, 0, 0, upscaleWidth, upscaleHeight);
              const upscaledImage = upscaleCtx.getImageData(0, 0, upscaleWidth, upscaleHeight);
              const decodedUpscaled = jsQR(upscaledImage.data, upscaleWidth, upscaleHeight, { inversionAttempts: 'attemptBoth' });
              foundRawValue = decodedUpscaled?.data || null;
            }
          }
        }
      }

      if (foundRawValue) {
        await processQRCode(foundRawValue);
      }
    } catch (err) {
      // Silently fail for detection errors
    } finally {
      inFlightDecodeRef.current = false;
    }
  }, [isLoopActiveRef]);

  const playSuccessSound = () => {
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new Ctx();
      }

      const ctx = audioContextRef.current;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.09);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // ignore audio failures
    }
  };

  const processQRCode = async (qrDataString: string) => {
    if (isProcessingScanRef.current) return;
    const qrData = parseQRPayload(qrDataString);
    if (!qrData) {
      setScanResult({ success: false });
      toast({
        title: 'Invalid QR Code',
        description: 'This QR code format is not supported.',
        variant: 'destructive',
      });
      setTimeout(() => {
        setScanResult(null);
      }, 1500);
      return;
    }

    isProcessingScanRef.current = true;
    try {
      const identity = getScanIdentity(qrData);
      if (!identity) {
        isProcessingScanRef.current = false;
        return;
      }
      
      // Prevent duplicate scans within cooldown window (spam protection)
      if (isDuplicateScan(identity)) return;
      if ((qrData.user_id || qrData.id) === lastScannedId) return;

      const attendanceTargetId = await resolveAttendanceTargetId(qrData);
      if (!attendanceTargetId) {
        throw new Error('No valid student identity found in QR payload.');
      }
      
      setLastScannedId(qrData.user_id || qrData.id || attendanceTargetId);
      
      // Record attendance — use the admin-configured cutoff time
      const cutoff = await getAttendanceCutoffTime();
      const status = isPastCutoffTime(cutoff) ? 'late' : 'present';

      await recordAttendance(
        attendanceTargetId,
        status,
        1,
        {
          source: 'qr-scanner',
          type: 'qr_code',
          scanned_at: new Date().toISOString(),
          metadata: {
            name: qrData.name,
            employee_id: qrData.employee_id,
            category: qrData.category,
          },
        },
        undefined,
        'qr-scan',
      );

      setScanResult({ success: true, name: qrData.name });
      playSuccessSound();
      
      toast({
        title: "✓ Attendance Recorded",
        description: `Welcome, ${qrData.name}! Status: ${status}`,
      });

      onScanComplete?.({ success: true, name: qrData.name, userId: attendanceTargetId });

      // Parent channels + local/background push in one unified flow
      sendAutoParentNotification(attendanceTargetId, qrData.name, status).catch(() => undefined);

      // Keep scanning continuously; just clear visual badge quickly.
      setTimeout(() => {
        setScanResult(null);
      }, 900);

      setTimeout(() => {
        setLastScannedId(null);
      }, 1000);

    } catch (err) {
      console.error('QR processing error:', err);
      setScanResult({ success: false });
      toast({
        title: "QR Scan Failed",
        description: "Unable to verify this card right now. Try again.",
        variant: "destructive"
      });
      
      setTimeout(() => {
        setScanResult(null);
      }, 900);
    } finally {
      isProcessingScanRef.current = false;
    }
  };

  const startScanning = () => {
    if (isLoopActiveRef.current) return;
    setIsScanning(true);
    setScanResult(null);

    isLoopActiveRef.current = true;
    inFlightDecodeRef.current = false;
    frameCounterRef.current = 0;

    startAutoFocusLoop();

    const loop = async (timestamp: number) => {
      if (!isLoopActiveRef.current) return;
      if (timestamp - lastFrameAtRef.current >= SCAN_FRAME_INTERVAL_MS) {
        lastFrameAtRef.current = timestamp;
        await detectQRCode();
      }
      if (isLoopActiveRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    rafRef.current = requestAnimationFrame(loop);
  };

  const stopScanning = () => {
    setIsScanning(false);
    isLoopActiveRef.current = false;
    inFlightDecodeRef.current = false;
    isProcessingScanRef.current = false;
    stopAutoFocusLoop();
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      isLoopActiveRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      stopAutoFocusLoop();
    };
  }, []);

  useEffect(() => {
    if (!autoStart) return;
    const timer = window.setTimeout(() => {
      startScanning();
    }, 450);

    return () => {
      window.clearTimeout(timer);
    };
  }, [autoStart]);

  return (
    <div className="relative w-full">
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Scanner Container */}
      <div className="relative aspect-[3/4] sm:aspect-video rounded-2xl overflow-hidden bg-slate-950 shadow-2xl shadow-purple-500/20">
        {/* Tech Grid Background */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(168,85,247,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(168,85,247,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px'
          }} />
        </div>

        {/* Webcam Feed */}
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          className="absolute inset-0 w-full h-full object-cover"
          videoConstraints={{
            facingMode,
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            frameRate: { ideal: 30, min: 24 }
          }}
        />

        {/* Scanning Overlay */}
        <AnimatePresence>
          {isScanning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10"
            >
              {/* QR Frame */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                  className="relative w-64 h-64 sm:w-80 sm:h-80"
                  animate={{ scale: [1, 1.02, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {/* Corner Brackets */}
                  <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-purple-400 rounded-tl-xl" />
                  <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-purple-400 rounded-tr-xl" />
                  <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-purple-400 rounded-bl-xl" />
                  <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-purple-400 rounded-br-xl" />

                  {/* Scanning Line */}
                  <motion.div
                    className="absolute left-4 right-4 h-1 bg-gradient-to-r from-transparent via-purple-400 to-transparent"
                    animate={{ top: ['10%', '90%', '10%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />

                  {/* Center QR Icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center"
                      animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <QrCode className="w-8 h-8 text-purple-400" />
                    </motion.div>
                  </div>
                </motion.div>
              </div>

              {/* Status Text */}
              <motion.div
                className="absolute bottom-20 left-0 right-0 text-center"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                <p className="text-lg font-bold text-purple-400">
                  ◎ SCANNING FOR QR CODE...
                </p>
                <p className="text-sm text-purple-300 mt-1">
                  Hold QR anywhere in camera view
                </p>
              </motion.div>

              {/* Floating Particles */}
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1.5 h-1.5 bg-purple-400 rounded-full"
                  style={{
                    left: `${20 + Math.random() * 60}%`,
                    top: `${20 + Math.random() * 60}%`,
                  }}
                  animate={{
                    y: [0, -20, 0],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success/Error Overlay */}
        <AnimatePresence>
          {scanResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`absolute inset-0 z-20 flex items-center justify-center ${
                scanResult.success ? 'bg-green-950/80' : 'bg-red-950/80'
              }`}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="text-center"
              >
                {scanResult.success ? (
                  <>
                    <motion.div
                      className="w-24 h-24 mx-auto rounded-full bg-green-500/20 flex items-center justify-center mb-4"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <CheckCircle className="w-12 h-12 text-green-400" />
                    </motion.div>
                    <p className="text-2xl font-bold text-green-400">VERIFIED!</p>
                    <p className="text-lg text-green-300 mt-1">{scanResult.name}</p>
                  </>
                ) : (
                  <>
                    <motion.div
                      className="w-24 h-24 mx-auto rounded-full bg-red-500/20 flex items-center justify-center mb-4"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <AlertCircle className="w-12 h-12 text-red-400" />
                    </motion.div>
                    <p className="text-2xl font-bold text-red-400">INVALID QR</p>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status Bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/80 backdrop-blur-sm border border-purple-500/30">
          <QrCode className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-purple-300">QR Scanner</span>
          <div className={`w-2 h-2 rounded-full ${isScanning ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
          {focusAssistEnabled && (
            <Badge variant="secondary" className="h-5 px-2 text-[10px] bg-emerald-500/20 text-emerald-200 border-emerald-400/30">
              AI Focus
            </Badge>
          )}
        </div>
      </div>

      {/* Controls */}
      {!hideManualControls && (
        <div className="flex flex-wrap gap-3 mt-6 justify-center">
          <Button
            variant="outline"
            size="lg"
            onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')}
            className="border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Flip Camera
          </Button>

          <Button
            size="lg"
            onClick={isScanning ? stopScanning : startScanning}
            className={`px-8 ${
              isScanning 
                ? 'bg-red-500 hover:bg-red-600' 
                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600'
            } text-white shadow-lg ${isScanning ? 'shadow-red-500/25' : 'shadow-purple-500/25'}`}
          >
            {isScanning ? (
              <>
                <Scan className="w-5 h-5 mr-2 animate-pulse" />
                Stop Scanning
              </>
            ) : (
              <>
                <QrCode className="w-5 h-5 mr-2" />
                Start QR Scan
              </>
            )}
          </Button>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 mt-6">
        {[
          { icon: Zap, label: 'Instant', value: 'Scan', color: 'text-yellow-500' },
          { icon: Shield, label: 'Secure', value: 'Verified', color: 'text-green-500' },
          { icon: Clock, label: 'Auto', value: 'Record', color: 'text-blue-500' },
        ].map((stat, i) => (
          <div key={i} className="flex flex-col items-center p-3 rounded-xl bg-slate-900/50 border border-purple-500/20">
            <stat.icon className={`w-5 h-5 ${stat.color} mb-1`} />
            <span className="text-lg font-bold text-white">{stat.value}</span>
            <span className="text-xs text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QRCodeScanner;