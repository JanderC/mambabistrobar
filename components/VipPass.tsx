'use client';

import { useRef } from 'react';
import { hora12 } from '@/lib/format';
import { SerpentMark } from './SerpentMark';

export type PassData = {
  nombre: string;
  fecha: string;
  hora: string;
  personas: number;
  zona: string;
  vip: boolean;
  motivo: string;
  codigo?: string;
};

function fechaCorta(fecha: string) {
  if (!fecha) return '— — —';
  const d = new Date(`${fecha}T12:00:00`);
  return d.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' }).replace(/\./g, '').toUpperCase();
}

/** Código de barras decorativo derivado del texto */
function Barcode({ seed }: { seed: string }) {
  let h = 7;
  const bars = Array.from({ length: 46 }, (_, i) => {
    h = (h * 31 + seed.charCodeAt(i % Math.max(seed.length, 1)) + i) % 997;
    return (h % 3) + 1;
  });
  return (
    <div className="flex h-10 items-stretch gap-[2px]">
      {bars.map((w, i) => <span key={i} className="bg-current" style={{ width: w, opacity: i % 7 === 0 ? 0.5 : 1 }} />)}
    </div>
  );
}

/** Pase de reserva que se construye en vivo. VIP = oro holográfico. */
export function VipPass({ data }: { data: PassData }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(1000px) rotateY(${(x - 0.5) * 16}deg) rotateX(${(0.5 - y) * 12}deg)`;
    el.style.setProperty('--px', `${x * 100}%`);
    el.style.setProperty('--py', `${y * 100}%`);
  };
  const reset = () => { if (ref.current) ref.current.style.transform = ''; };

  const vip = data.vip;
  const ink = vip ? 'text-[#1b1305]' : 'text-ivory';
  const sub = vip ? 'text-[#4a3710]' : 'text-gold';

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={reset}
      className="relative mx-auto w-full max-w-[330px] transition-transform duration-300 ease-out sm:max-w-sm"
      style={{ transformStyle: 'preserve-3d' }}
    >
      <div
        className={`relative overflow-hidden rounded-[28px] shadow-[0_40px_100px_-30px_rgba(212,175,55,.5)] ${ink}`}
        style={{
          background: vip
            ? 'linear-gradient(135deg,#8a6a1b 0%,#f6e3a1 28%,#d4af37 45%,#fff3c4 60%,#b8922b 80%,#8a6a1b 100%)'
            : 'linear-gradient(160deg,#0b4a35 0%,#062319 45%,#010604 100%)',
          // Muescas laterales del ticket
          WebkitMask: 'radial-gradient(circle 14px at 0 68%, transparent 98%, #000) left / 51% 100% no-repeat, radial-gradient(circle 14px at 100% 68%, transparent 98%, #000) right / 51% 100% no-repeat',
          mask: 'radial-gradient(circle 14px at 0 68%, transparent 98%, #000) left / 51% 100% no-repeat, radial-gradient(circle 14px at 100% 68%, transparent 98%, #000) right / 51% 100% no-repeat',
        }}
      >
        {/* Holograma */}
        <div
          className="pointer-events-none absolute inset-0 mix-blend-soft-light"
          style={{
            background: vip
              ? 'radial-gradient(circle at var(--px,30%) var(--py,20%), rgba(255,255,255,.9), transparent 40%), repeating-linear-gradient(115deg, rgba(61,255,176,.18) 0 8px, rgba(255,120,220,.14) 8px 16px, rgba(120,200,255,.16) 16px 24px)'
              : 'radial-gradient(circle at var(--px,30%) var(--py,20%), rgba(61,255,176,.35), transparent 45%)',
          }}
        />
        <div className={`scales pointer-events-none absolute inset-0 ${vip ? 'opacity-25 mix-blend-multiply' : 'opacity-[.12]'}`} />

        <div className="relative p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className={`font-display text-[9px] tracking-[0.45em] uppercase ${sub}`}>{vip ? 'Acceso VIP' : 'Reserva'}</p>
              <p className="mt-1 font-display text-2xl font-light tracking-[0.35em]">MAMBA</p>
              <p className={`font-display text-[8px] tracking-[0.4em] ${sub}`}>BISTRO BAR 2.0</p>
            </div>
            <SerpentMark animate={false} className="w-24" />
          </div>

          <p className={`mt-6 font-display text-[9px] tracking-[0.35em] uppercase ${sub}`}>A nombre de</p>
          <p className="truncate font-serif text-3xl italic">{data.nombre || 'Tu nombre aquí'}</p>

          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              ['Fecha', fechaCorta(data.fecha)],
              ['Hora', data.hora ? hora12(data.hora) : '—'],
              ['Pax', String(data.personas)],
            ].map(([k, v]) => (
              <div key={k}>
                <p className={`font-display text-[8px] tracking-[0.35em] uppercase ${sub}`}>{k}</p>
                <p className="font-display text-sm font-medium">{v}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <p className={`font-display text-[8px] tracking-[0.35em] uppercase ${sub}`}>Zona</p>
              <p className="font-display text-sm font-medium">{data.zona || '—'}</p>
            </div>
            <div>
              <p className={`font-display text-[8px] tracking-[0.35em] uppercase ${sub}`}>Motivo</p>
              <p className="font-display text-sm font-medium">{data.motivo || '—'}</p>
            </div>
          </div>
        </div>

        {/* Talón */}
        <div className={`relative border-t-2 border-dashed px-6 pt-4 pb-6 ${vip ? 'border-[#1b1305]/30' : 'border-gold/30'}`}>
          <div className="flex items-end justify-between gap-4">
            <div className={vip ? 'text-[#1b1305]' : 'text-gold-light'}>
              <Barcode seed={`${data.nombre}${data.fecha}${data.hora}${data.codigo ?? ''}`} />
            </div>
            <div className="text-right">
              <p className={`font-display text-[8px] tracking-[0.35em] uppercase ${sub}`}>Código</p>
              <p className="font-mono text-sm font-semibold tracking-wider">{data.codigo ?? 'MB-····'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
