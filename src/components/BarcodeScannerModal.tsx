import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, HTMLCanvasElementLuminanceSource } from '@zxing/browser';
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
} from '@zxing/library';
import { Camera, RefreshCw, X, Image as ImageIcon, AlertCircle, ZoomIn } from 'lucide-react';
import { Language } from '../translations';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (code: string) => void;
  lang?: Language;
}

interface NativeBarcodeDetectorResult {
  rawValue?: string;
}

interface NativeBarcodeDetector {
  detect(source: ImageBitmapSource): Promise<NativeBarcodeDetectorResult[]>;
}

function createScannerHints(): Map<DecodeHintType, unknown> {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.QR_CODE,
  ]);
  return hints;
}

function enhanceBarcodeContrast(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    // Strong S-curve contrast boost to sharpen pale/anti-aliased printed bars
    const stretched = lum < 105 ? 0 : lum > 155 ? 255 : Math.round(((lum - 105) / 50) * 255);
    data[i] = stretched;
    data[i + 1] = stretched;
    data[i + 2] = stretched;
  }
  ctx.putImageData(imgData, 0, 0);
}

function playScanBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1046.5, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
  } catch {
    // Ignore audio context errors
  }
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onScan,
  lang = 'ur',
}: BarcodeScannerModalProps) {
  const isUrdu = lang === 'ur';
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const zoomRef = useRef<number>(2);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [zoom, setZoom] = useState<1 | 2 | 3>(2);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    const videoEl = videoRef.current;
    if (videoEl) {
      if (videoEl.srcObject) {
        const stream = videoEl.srcObject as MediaStream;
        stream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch {
            // ignore
          }
        });
      }
      videoEl.srcObject = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    let cancelled = false;
    let activeStream: MediaStream | null = null;
    let scanTimer: ReturnType<typeof setInterval> | null = null;
    let isDecodingFrame = false;
    let frameTick = 0;

    const hints = createScannerHints();
    const zxingReader = new MultiFormatReader();
    zxingReader.setHints(hints);

    let nativeDetector: NativeBarcodeDetector | null = null;
    try {
      const DetectorCtor = (
        window as unknown as {
          BarcodeDetector?: new (opts?: { formats?: string[] }) => NativeBarcodeDetector;
        }
      ).BarcodeDetector;
      if (DetectorCtor) {
        nativeDetector = new DetectorCtor({
          formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'qr_code'],
        });
      }
    } catch {
      nativeDetector = null;
    }

    const roiCanvas = document.createElement('canvas');
    const roiCtx = roiCanvas.getContext('2d', { willReadFrequently: true });
    const fullCanvas = document.createElement('canvas');
    const fullCtx = fullCanvas.getContext('2d', { willReadFrequently: true });

    const getStreamWithFallback = async (deviceId?: string): Promise<MediaStream> => {
      const hdDims = {
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
      };

      if (deviceId) {
        try {
          return await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: deviceId }, ...hdDims },
            audio: false,
          });
        } catch {
          try {
            return await navigator.mediaDevices.getUserMedia({
              video: { deviceId: { exact: deviceId } },
              audio: false,
            });
          } catch {
            // Fallback to rear camera
          }
        }
      }

      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, ...hdDims },
          audio: false,
        });
      } catch {
        try {
          return await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
          });
        } catch {
          return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
      }
    };

    const handleDetectedCode = (rawCode: string) => {
      const decoded = rawCode.trim();
      if (!decoded || cancelled) return;
      cancelled = true;
      if (scanTimer) {
        clearInterval(scanTimer);
        scanTimer = null;
      }
      playScanBeep();
      stopCamera();
      onScan(decoded);
      onClose();
    };

    const tryZxingOnCanvas = (canvas: HTMLCanvasElement): string | null => {
      try {
        const source = new HTMLCanvasElementLuminanceSource(canvas);
        const bitmap = new BinaryBitmap(new HybridBinarizer(source));
        const res = zxingReader.decodeWithState(bitmap);
        const txt = res?.getText()?.trim();
        return txt || null;
      } catch {
        return null;
      }
    };

    const startScanner = async () => {
      setErrorMsg(null);
      setIsStarting(true);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorMsg(
          isUrdu
            ? 'اس براؤزر میں کیمرہ دستیاب نہیں ہے۔ آپ تصویر اپلوڈ کر کے بارکوڈ اسکین کر سکتے ہیں۔'
            : 'Camera API is unavailable here. You can upload a barcode photo instead.'
        );
        setIsStarting(false);
        return;
      }

      try {
        activeStream = await getStreamWithFallback(selectedDeviceId || undefined);
        if (cancelled) {
          activeStream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = activeStream;

        // Safely request continuous autofocus if supported (never touch torch/photo options)
        const [videoTrack] = activeStream.getVideoTracks();
        if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
          try {
            const caps = videoTrack.getCapabilities() as MediaTrackCapabilities & {
              focusMode?: string[];
            };
            if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
              void videoTrack
                .applyConstraints({
                  advanced: [{ focusMode: 'continuous' } as unknown as MediaTrackConstraintSet],
                })
                .catch(() => {});
            }
          } catch {
            // Ignore unsupported focus constraints
          }
        }

        // Refresh camera list after permission is granted so labels are populated
        try {
          const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices();
          if (!cancelled) {
            setDevices(videoInputDevices);
          }
        } catch {
          // Ignore device enumeration failure
        }

        const videoEl = videoRef.current;
        if (!videoEl) {
          activeStream.getTracks().forEach(t => t.stop());
          setIsStarting(false);
          return;
        }

        videoEl.srcObject = activeStream;
        await videoEl.play().catch(() => {});
        setIsStarting(false);

        scanTimer = setInterval(() => {
          if (
            cancelled ||
            isDecodingFrame ||
            !videoEl ||
            videoEl.readyState < 2 ||
            videoEl.videoWidth === 0 ||
            videoEl.videoHeight === 0
          ) {
            return;
          }

          isDecodingFrame = true;
          frameTick += 1;

          void (async () => {
            try {
              const vw = videoEl.videoWidth;
              const vh = videoEl.videoHeight;
              const currentZoom = zoomRef.current;

              // Center ROI band scaled by active digital zoom so small 1.5"x0.5" tags held at 15-20cm fill sensor pixels
              const sw = Math.max(160, Math.floor(vw / currentZoom));
              const sh = Math.max(100, Math.floor((vh * 0.65) / currentZoom));
              const sx = Math.floor((vw - sw) / 2);
              const sy = Math.floor((vh - sh) / 2);

              const targetW = Math.min(960, Math.max(640, sw));
              const targetH = Math.max(160, Math.round(targetW * (sh / sw)));

              if (roiCtx) {
                roiCanvas.width = targetW;
                roiCanvas.height = targetH;
                roiCtx.imageSmoothingEnabled = false;
                roiCtx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, targetW, targetH);

                if (nativeDetector) {
                  try {
                    const detected = await nativeDetector.detect(roiCanvas);
                    const found = detected.find(d => d.rawValue && d.rawValue.trim().length > 0);
                    if (found?.rawValue) {
                      handleDetectedCode(found.rawValue);
                      return;
                    }
                  } catch {
                    // Continue to ZXing fallback
                  }
                }

                const directHit = tryZxingOnCanvas(roiCanvas);
                if (directHit) {
                  handleDetectedCode(directHit);
                  return;
                }

                // On odd ticks, contrast-stretch the cropped barcode band for faint ink / glossy paper glare
                if (frameTick % 2 === 1) {
                  enhanceBarcodeContrast(roiCtx, targetW, targetH);
                  const boostedHit = tryZxingOnCanvas(roiCanvas);
                  if (boostedHit) {
                    handleDetectedCode(boostedHit);
                    return;
                  }
                }
              }

              // Every 4th tick, also inspect the full frame in case barcode sits slightly outside center
              if (frameTick % 4 === 0 && fullCtx) {
                const fw = Math.min(960, vw);
                const fh = Math.max(200, Math.round(fw * (vh / vw)));
                fullCanvas.width = fw;
                fullCanvas.height = fh;
                fullCtx.drawImage(videoEl, 0, 0, vw, vh, 0, 0, fw, fh);

                const fullHit = tryZxingOnCanvas(fullCanvas);
                if (fullHit) {
                  handleDetectedCode(fullHit);
                  return;
                }
              }
            } finally {
              isDecodingFrame = false;
            }
          })();
        }, 110);
      } catch (err: unknown) {
        if (cancelled) return;
        console.error('Camera scanner error:', err);
        if (activeStream) {
          activeStream.getTracks().forEach(t => t.stop());
        }
        setErrorMsg(
          isUrdu
            ? 'کیمرہ شروع نہیں ہو سکا۔ براہ کرم کیمرے کی اجازت دیں یا بارکوڈ تصویر منتخب کریں۔'
            : 'Could not start camera. Please allow camera permission or upload a barcode image.'
        );
        setIsStarting(false);
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      if (scanTimer) {
        clearInterval(scanTimer);
      }
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
      stopCamera();
    };
  }, [isOpen, selectedDeviceId]);

  const handleImageScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    const reader = new BrowserMultiFormatReader(createScannerHints());
    const url = URL.createObjectURL(file);
    try {
      const result = await reader.decodeFromImageUrl(url);
      const decoded = result.getText().trim();
      if (decoded) {
        playScanBeep();
        stopCamera();
        onScan(decoded);
        onClose();
      }
    } catch {
      setErrorMsg(
        isUrdu
          ? 'اس تصویر میں کوئی بارکوڈ نہیں ملا۔ براہ کرم واضح تصویر منتخب کریں۔'
          : 'No barcode detected in that image. Please try a clearer photo.'
      );
    } finally {
      URL.revokeObjectURL(url);
      e.target.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      dir={isUrdu ? 'rtl' : 'ltr'}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-amber-200">
        <div className="p-4 bg-gradient-to-r from-amber-700 to-amber-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Camera size={20} className="text-amber-200" />
            <h3 className="font-bold text-base urdu-text">
              {isUrdu ? 'کیمرہ بارکوڈ اسکینر' : 'Camera Barcode Scanner'}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {devices.length > 1 ? (
              <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
                <RefreshCw size={15} className="text-amber-700 shrink-0" />
                <select
                  value={selectedDeviceId}
                  onChange={e => setSelectedDeviceId(e.target.value)}
                  className="flex-1 text-xs font-bold p-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                >
                  <option value="">{isUrdu ? 'خودکار (بیک کیمرہ)' : 'Auto (Rear Camera)'}</option>
                  {devices.map((cam, idx) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label || `${isUrdu ? 'کیمرہ' : 'Camera'} ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <span className="text-[11px] font-bold text-amber-900 flex items-center gap-1 urdu-text">
                <ZoomIn size={14} className="text-amber-700" />
                {isUrdu ? 'چھوٹے ٹیگ کے لیے زوم:' : 'Tag Zoom:'}
              </span>
            )}

            <div className="flex items-center gap-1 bg-amber-50 p-1 rounded-xl border border-amber-200">
              {([1, 2, 3] as const).map(level => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setZoom(level)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-colors ${
                    zoom === level
                      ? 'bg-amber-700 text-white shadow-sm'
                      : 'text-amber-900 hover:bg-amber-100'
                  }`}
                >
                  {level}x
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full aspect-[4/3] bg-zinc-950 rounded-2xl overflow-hidden flex items-center justify-center border-2 border-amber-500/40">
            <video
              ref={videoRef}
              className="w-full h-full object-cover transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
              playsInline
              muted
            />

            {/* Target Overlay */}
            {!errorMsg && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="w-4/5 h-28 border-2 border-amber-400 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] relative">
                  <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-red-500/85 animate-pulse" />
                </div>
              </div>
            )}

            {isStarting && !errorMsg && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-bold urdu-text">
                {isUrdu ? 'کیمرہ کھل رہا ہے...' : 'Starting camera...'}
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle size={16} className="text-amber-700 shrink-0 mt-0.5" />
              <span className="urdu-text leading-relaxed">{errorMsg}</span>
            </div>
          )}

          <p className="text-xs text-zinc-500 text-center urdu-text">
            {isUrdu
              ? 'ٹیگ کو کیمرے سے تقریباً 15 سینٹی میٹر دور صاف فوکس میں رکھیں (چھوٹے ٹیگ کے لیے 2x یا 3x زوم استعمال کریں)۔'
              : 'Hold the tag ~15cm away in clear focus (use 2x/3x zoom for small 1.5"×0.5" tags).'}
          </p>

          <div className="flex items-center gap-2 pt-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageScan}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 py-2.5 px-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <ImageIcon size={16} />
              <span className="urdu-text">
                {isUrdu ? 'تصویر سے اسکین کریں' : 'Scan from Photo'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="py-2.5 px-4 rounded-xl border border-slate-300 text-zinc-700 font-bold text-xs hover:bg-slate-100 transition-colors"
            >
              {isUrdu ? 'بند کریں' : 'Cancel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
