'use client';
import { useRef } from 'react';
import type { MouseEvent, ReactNode } from 'react';

export default function TiltCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width  - 0.5;
    const y = (e.clientY - r.top)  / r.height - 0.5;
    el.style.transform = `perspective(700px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 7).toFixed(2)}deg) scale(1.02)`;
  }

  function onLeave() {
    const el = ref.current;
    if (el) el.style.transform = 'perspective(700px) rotateX(0deg) rotateY(0deg) scale(1)';
  }

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ transition: 'transform 0.2s ease-out', willChange: 'transform' }}
    >
      {children}
    </div>
  );
}
