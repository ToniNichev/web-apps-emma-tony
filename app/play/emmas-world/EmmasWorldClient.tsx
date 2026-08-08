'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppSocket } from '@/app/components/SocketProvider';

const BUILD_URL = '/unity/emmas-world/Build';
const LOADER_URL = `${BUILD_URL}/WebGL.loader.js`;

interface UnityInstance {
  Quit: () => Promise<void>;
  SetFullscreen: (fullscreen: number) => void;
}

declare global {
  interface Window {
    __emmasWorldSocket?: unknown;
    createUnityInstance?: (
      canvas: HTMLCanvasElement,
      config: Record<string, unknown>,
      onProgress?: (progress: number) => void
    ) => Promise<UnityInstance>;
  }
}

export default function EmmasWorldClient() {
  const socket = useAppSocket();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const instanceRef = useRef<UnityInstance | null>(null);
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The EmmasWorldBridge.jslib plugin (Unity side) reads
  // window.__emmasWorldSocket directly on every call rather than caching a
  // reference, so this just needs to stay current -- including through
  // SocketProvider's reconnects, which create a brand new Socket instance.
  useEffect(() => {
    window.__emmasWorldSocket = socket ?? undefined;
    return () => { window.__emmasWorldSocket = undefined; };
  }, [socket]);

  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;

    const script = document.createElement('script');
    script.src = LOADER_URL;
    script.onload = () => {
      if (cancelled || !window.createUnityInstance || !canvasRef.current) return;

      window.createUnityInstance(canvasRef.current, {
        dataUrl: `${BUILD_URL}/WebGL.data`,
        frameworkUrl: `${BUILD_URL}/WebGL.framework.js`,
        codeUrl: `${BUILD_URL}/WebGL.wasm`,
        streamingAssetsUrl: '/unity/emmas-world/StreamingAssets',
        companyName: 'DefaultCompany',
        productName: "Emma's World",
        productVersion: '1.0',
      }, (p: number) => setProgress(p))
        .then((instance) => {
          if (cancelled) { instance.Quit(); return; }
          instanceRef.current = instance;
          setReady(true);
        })
        .catch((err: Error) => setError(err.message));
    };
    script.onerror = () => setError('Failed to load the game files.');
    document.body.appendChild(script);

    return () => {
      cancelled = true;
      document.body.removeChild(script);
      instanceRef.current?.Quit();
      instanceRef.current = null;
    };
  }, []);

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <canvas id="unity-canvas" ref={canvasRef} className="w-full h-full" />
      {ready && (
        <button
          onClick={() => instanceRef.current?.SetFullscreen(1)}
          className="absolute top-2 right-2 z-10 rounded bg-black/60 px-3 py-1.5 text-xs text-white hover:bg-black/80"
        >
          Fullscreen
        </button>
      )}
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
          Loading Emma&apos;s World... {Math.round(progress * 100)}%
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-red-300 px-4 text-center text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
