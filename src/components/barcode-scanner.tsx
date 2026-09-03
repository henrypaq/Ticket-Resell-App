"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

const noopSubscribe = () => () => {};
const getBarcodeDetectorSnapshot = () => typeof window !== "undefined" && "BarcodeDetector" in window;
const getServerSnapshot = () => false;

/**
 * Camera barcode scan, using the browser's native BarcodeDetector API rather
 * than pulling in a decoding library — it's zero-dependency and covers the
 * PWA's primary mobile target (Chrome/Edge on Android). Safari/iOS doesn't
 * implement it yet; callers decide how to degrade (BarcodeScanButton hides
 * itself, GlobalScanButton below falls back to manual entry).
 */
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
    };
  }
}

/**
 * Shared camera-scan state machine: capability detection, getUserMedia,
 * and the detect-loop. UI (the button, the overlay) is up to each caller —
 * BarcodeScanButton and GlobalScanButton both sit on top of this rather than
 * duplicating the camera-handling logic.
 */
function useBarcodeScanner(onDetected: (value: string) => void) {
  // Client-only capability check via useSyncExternalStore rather than an
  // effect — an effect that calls setState synchronously on mount causes a
  // pointless extra render, and returning false on the server keeps the SSR
  // markup consistent for hydration.
  const supported = useSyncExternalStore(noopSubscribe, getBarcodeDetectorSnapshot, getServerSnapshot);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!scanning) return;

    let cancelled = false;
    let raf = 0;

    async function run() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const Detector = window.BarcodeDetector!;
        const detector = new Detector({
          formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "pdf417"],
        });

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const results = await detector.detect(videoRef.current);
            if (results.length > 0) {
              onDetected(results[0].rawValue);
              setScanning(false);
              return;
            }
          } catch {
            // Transient decode errors are expected mid-stream; keep trying.
          }
          raf = requestAnimationFrame(() => void tick());
        };
        raf = requestAnimationFrame(() => void tick());
      } catch {
        setError("Couldn't access the camera. You can type the barcode instead.");
        setScanning(false);
      }
    }

    void run();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [scanning, onDetected]);

  return {
    supported,
    scanning,
    error,
    videoRef,
    start: () => {
      setError(null);
      setScanning(true);
    },
    stop: () => setScanning(false),
  };
}

function ScannerOverlay({
  videoRef,
  onCancel,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-6">
      <video ref={videoRef} muted playsInline className="w-full max-w-sm rounded-2xl" />
      <p className="mt-4 text-[13px] text-white/70">Point the camera at the barcode or QR code.</p>
      <button
        type="button"
        onClick={onCancel}
        className="mt-6 rounded-full border border-white/20 px-5 py-2.5 text-[13.5px] font-semibold text-white"
      >
        Cancel
      </button>
    </div>
  );
}

/** Inline variant used in the sell form's ticket-ID field. */
export function BarcodeScanButton({ onDetected }: { onDetected: (value: string) => void }) {
  const { supported, scanning, error, videoRef, start, stop } = useBarcodeScanner(onDetected);

  if (!supported) return null;

  return (
    <>
      <button
        type="button"
        onClick={start}
        className="pill-quiet px-3 py-2 text-[12.5px] font-semibold text-ink"
      >
        Scan barcode
      </button>

      {error && <p className="mt-2 text-[12px] text-urgency">{error}</p>}

      {scanning && <ScannerOverlay videoRef={videoRef} onCancel={stop} />}
    </>
  );
}

/**
 * Global entry point rendered once in the authenticated shell
 * (app/(app)/layout.tsx), top-left on every page. Scanning a ticket only
 * means something in the sell flow today (there's no door/entry check-in
 * feature — CLAUDE.md keeps that out of scope), so a successful scan jumps
 * straight to /sell with the ticket ID pre-filled. Always renders, including
 * on Safari/iOS where BarcodeDetector isn't implemented — a browser that
 * can't scan just jumps straight to the sell form for manual entry instead of
 * looking broken.
 *
 * Deliberately laid out in normal document flow (not fixed/absolute): every
 * page in (app)/ already puts *something* — a heading, a back arrow, filter
 * chips — right at the top-left safe-area corner, so a floating circle there
 * collided with real content on every page it was tried against. Sitting in
 * flow, at the very top of the shared layout, means it always renders above
 * whatever a page does with its own top-left corner instead of on top of it.
 */
export function GlobalScanButton() {
  const router = useRouter();
  const { supported, scanning, error, videoRef, start, stop } = useBarcodeScanner((value) => {
    router.push(`/sell?scannedBarcode=${encodeURIComponent(value)}`);
  });

  return (
    <div className="px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <button
        type="button"
        onClick={() => (supported ? start() : router.push("/sell"))}
        aria-label="Scan a ticket"
        className="frosted flex h-11 w-11 items-center justify-center rounded-full border border-white/10"
      >
        <CameraIcon className="h-5 w-5" />
      </button>

      {error && <p className="mt-2 max-w-[240px] text-[12px] text-urgency">{error}</p>}

      {scanning && <ScannerOverlay videoRef={videoRef} onCancel={stop} />}
    </div>
  );
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className}>
      <path
        d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.13a1.5 1.5 0 0 0 1.28-.72l.7-1.16A1.5 1.5 0 0 1 10.89 4h2.22a1.5 1.5 0 0 1 1.28.72l.7 1.16A1.5 1.5 0 0 0 16.37 7h2.13A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5v-9Z"
        strokeLinejoin="round"
      />
      <circle cx={12} cy={13} r={3.25} />
    </svg>
  );
}
