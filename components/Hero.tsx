'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { IconArrow, IconCalendar } from './icons';
import { SerpentMark } from './SerpentMark';

type Props = { eslogan: string | null; estado?: string; proximo?: { titulo: string; slug: string; fecha: string } | null };

/**
 * Hero "Piel de Mamba":
 *  - Una linterna sigue el cursor / dedo y revela escamas doradas bajo la oscuridad.
 *  - Si nadie interactúa, la linterna "serpentea" sola.
 *  - Chispas doradas flotan como en el logo.
 */
export function Hero({ eslogan, proximo }: Props) {
  const ref = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Linterna que revela las escamas
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let lastInteraction = 0;
    const target = { x: 0.5, y: 0.45 };
    const pos = { x: 0.5, y: 0.45 };

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      target.x = (e.clientX - r.left) / r.width;
      target.y = (e.clientY - r.top) / r.height;
      lastInteraction = performance.now();
    };
    const tick = (t: number) => {
      if (t - lastInteraction > 2500) {
        // movimiento serpenteante automático
        target.x = 0.5 + Math.sin(t / 1900) * 0.32;
        target.y = 0.5 + Math.sin(t / 1100) * 0.18;
      }
      pos.x += (target.x - pos.x) * 0.07;
      pos.y += (target.y - pos.y) * 0.07;
      el.style.setProperty('--mx', `${pos.x * 100}%`);
      el.style.setProperty('--my', `${pos.y * 100}%`);
      raf = requestAnimationFrame(tick);
    };
    el.addEventListener('pointermove', onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      el.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Chispas doradas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d')!;
    let w = 0, h = 0, raf = 0;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const N = innerWidth < 640 ? 36 : 70;
    const sparks = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.3, v: Math.random() * 0.00035 + 0.0001, p: Math.random() * Math.PI * 2 }));
    const resize = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const s of sparks) {
        s.y -= s.v;
        if (s.y < -0.02) { s.y = 1.02; s.x = Math.random(); }
        const tw = (Math.sin(t / 400 + s.p) + 1) / 2;
        const x = s.x * w + Math.sin(t / 1500 + s.p) * 12, y = s.y * h;
        ctx.globalAlpha = 0.25 + tw * 0.75;
        const g = ctx.createRadialGradient(x, y, 0, x, y, s.r * 6);
        g.addColorStop(0, '#fff6d5'); g.addColorStop(0.3, '#d4af37'); g.addColorStop(1, 'rgba(212,175,55,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, s.r * 6, 0, Math.PI * 2); ctx.fill();
        if (s.r > 1.5 && tw > 0.92) { // destello en cruz
          ctx.strokeStyle = '#fff6d5'; ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8); ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    resize();
    addEventListener('resize', resize);
    raf = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
  }, []);

  return (
    <section
      ref={ref}
      className="relative isolate flex min-h-[100svh] flex-col items-center justify-center overflow-hidden px-4 pt-24 pb-16 text-center"
      style={{ ['--mx' as string]: '50%', ['--my' as string]: '45%' }}
    >
      {/* Fondo esmeralda */}
      <div className="absolute inset-0 -z-30 bg-[radial-gradient(120%_80%_at_50%_0%,#0b4a35_0%,#03110c_55%,#010604_100%)]" />
      {/* Escamas reveladas por la linterna */}
      <div
        className="scales absolute inset-0 -z-20 opacity-70"
        style={{
          maskImage: 'radial-gradient(circle 240px at var(--mx) var(--my), #000 0%, rgba(0,0,0,.35) 45%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(circle 240px at var(--mx) var(--my), #000 0%, rgba(0,0,0,.35) 45%, transparent 100%)',
        }}
      />
      {/* Luz de la linterna */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_320px_at_var(--mx)_var(--my),rgba(18,128,90,.28),transparent_70%)]" />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 -z-10 h-full w-full" />
      {/* Láseres */}
      <div className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-[140%] w-px origin-top -translate-x-1/2 rotate-[24deg] bg-gradient-to-b from-venom/50 via-venom/5 to-transparent blur-[1px]" />
      <div className="pointer-events-none absolute -top-20 left-1/2 -z-10 h-[140%] w-px origin-top -translate-x-1/2 -rotate-[24deg] bg-gradient-to-b from-gold/50 via-gold/5 to-transparent blur-[1px]" />

      <p className="eyebrow mb-6 animate-[float_6s_ease-in-out_infinite]">Bistro · Coctelería · Rumba</p>

      <SerpentMark className="w-[min(88vw,560px)] drop-shadow-[0_0_40px_rgba(212,175,55,.25)]" />

      <h1 className="title-xl mt-4 text-[clamp(2.8rem,12.5vw,8.5rem)]">
        <span className="text-foil">Mamba</span>
      </h1>
      <p className="mt-3 font-display text-sm tracking-[0.45em] text-gold-light/90 sm:tracking-[0.6em] uppercase sm:text-base">Bistro Bar 2.0</p>
      {eslogan && <p className="mt-6 max-w-md font-serif text-2xl text-ivory/80 italic sm:text-3xl">“{eslogan}”</p>}

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link href="/reservas" className="btn-gold">Reservar mesa <IconArrow width={16} /></Link>
        <Link href="/eventos" className="btn-ghost"><IconCalendar width={16} /> Eventos del finde</Link>
      </div>

      {proximo && (
        <Link
          href={`/eventos/${proximo.slug}`}
          className="glass group mt-10 flex items-center gap-3 rounded-full py-2 pr-5 pl-2 text-left text-sm transition hover:border-gold/50"
        >
          <span className="relative flex h-2.5 w-2.5 rounded-full bg-venom animate-pulse-ring" />
          <span className="text-smoke">Próximo:</span>
          <span className="font-medium text-ivory">{proximo.titulo}</span>
          <span className="text-foil">· {proximo.fecha}</span>
          <IconArrow width={14} className="text-gold transition group-hover:translate-x-1" />
        </Link>
      )}

      <div className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[10px] tracking-[0.4em] text-smoke/70 uppercase [@media(min-height:960px)]:flex">
        Desliza
        <span className="h-10 w-px animate-pulse bg-gradient-to-b from-gold to-transparent" />
      </div>
    </section>
  );
}
