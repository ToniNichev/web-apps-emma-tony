'use client';
import { useEffect } from 'react';

interface LightboxProps {
  urls: string[];
  index: number;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function Lightbox({ urls, index, onClose, onPrev, onNext }: LightboxProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft')  onPrev();
      if (e.key === 'ArrowRight') onNext();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose, onPrev, onNext]);

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white text-3xl leading-none z-10"
      >
        ✕
      </button>

      {/* Counter */}
      {urls.length > 1 && (
        <p className="absolute top-4 left-1/2 -translate-x-1/2 text-white/60 text-sm">
          {index + 1} / {urls.length}
        </p>
      )}

      {/* Prev */}
      {urls.length > 1 && index > 0 && (
        <button
          onClick={e => { e.stopPropagation(); onPrev(); }}
          className="absolute left-4 text-white/70 hover:text-white text-4xl leading-none z-10 p-2"
        >
          ‹
        </button>
      )}

      {/* Image */}
      <img
        src={urls[index]}
        alt=""
        className="max-w-full max-h-full object-contain select-none"
        style={{ maxHeight: '90vh', maxWidth: '90vw' }}
        onClick={e => e.stopPropagation()}
      />

      {/* Next */}
      {urls.length > 1 && index < urls.length - 1 && (
        <button
          onClick={e => { e.stopPropagation(); onNext(); }}
          className="absolute right-4 text-white/70 hover:text-white text-4xl leading-none z-10 p-2"
        >
          ›
        </button>
      )}
    </div>
  );
}
