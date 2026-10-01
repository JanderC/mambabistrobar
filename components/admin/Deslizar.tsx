'use client';

import { ChevronsRight, Loader2 } from 'lucide-react';
import { type ReactNode, useRef, useState } from 'react';

/**
 * "Desliza para confirmar": evita envíos por un toque accidental en la tablet y
 * hace que pasar una cuenta a caja se sienta como entregarla de mano en mano.
 */
export function Deslizar({ texto, onConfirmar, icono, ocupado = false, className = '' }: { texto: string; onConfirmar: () => void | Promise<void>; icono?: ReactNode; ocupado?: boolean; className?: string }) {
  const pista = useRef<HTMLDivElement>(null);
  const inicio = useRef<{ x: number; max: number } | null>(null);
  const [x, setX] = useState(0);
  const [soltando, setSoltando] = useState(false);
  const TAM = 52;

  const abajo = (e: React.PointerEvent) => {
    if (ocupado || !pista.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    inicio.current = { x: e.clientX - x, max: pista.current.clientWidth - TAM - 8 };
    setSoltando(false);
  };
  const mover = (e: React.PointerEvent) => {
    if (!inicio.current) return;
    setX(Math.max(0, Math.min(inicio.current.max, e.clientX - inicio.current.x)));
  };
  const arriba = async () => {
    if (!inicio.current) return;
    const completo = x >= inicio.current.max * 0.86;
    inicio.current = null;
    setSoltando(true);
    if (completo) {
      setX(9999);
      try {
        await onConfirmar();
      } finally {
        setX(0);
      }
    } else setX(0);
  };

  const max = pista.current ? pista.current.clientWidth - TAM - 8 : 1;
  const avance = Math.min(1, x / max);

  return (
    <div
      ref={pista}
      className={`relative h-[60px] touch-none overflow-hidden rounded-full border border-gold/40 bg-void/70 select-none ${className}`}
      role="button"
      aria-label={texto}
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !ocupado && onConfirmar()}
    >
      {/* Relleno dorado que avanza con el dedo */}
      <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-gold-dark via-gold to-gold-light" style={{ width: Math.min(x, max) + TAM + 4, opacity: 0.25 + avance * 0.75, transition: soltando ? 'width .25s, opacity .25s' : undefined }} />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 pl-10 text-sm font-medium tracking-wide text-gold-light" style={{ opacity: 1 - avance * 1.4 }}>
        {texto} <ChevronsRight size={18} className="animate-pulse" />
      </span>
      <div
        onPointerDown={abajo}
        onPointerMove={mover}
        onPointerUp={arriba}
        onPointerCancel={arriba}
        className="absolute top-1 left-1 grid cursor-grab place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold-dark text-void shadow-lg active:cursor-grabbing"
        style={{ width: TAM, height: TAM, transform: `translateX(${Math.min(x, max)}px)`, transition: soltando ? 'transform .25s' : undefined }}
      >
        {ocupado ? <Loader2 size={22} className="animate-spin" /> : (icono ?? <ChevronsRight size={24} />)}
      </div>
    </div>
  );
}
