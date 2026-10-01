'use client';

import Link from 'next/link';
import { useRef } from 'react';
import type { Evento } from '@/lib/types';
import { EventFlyer } from './EventFlyer';
import { IconArrow } from './icons';

/** Tarjeta con inclinación 3D y reflejo dorado que sigue el dedo/cursor */
export function EventCard({ evento, pasado = false, priority = false }: { evento: Evento; pasado?: boolean; priority?: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null);

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || e.pointerType === 'touch') return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(900px) rotateY(${(x - 0.5) * 10}deg) rotateX(${(0.5 - y) * 10}deg) translateY(-4px)`;
    el.style.setProperty('--gx', `${x * 100}%`);
    el.style.setProperty('--gy', `${y * 100}%`);
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = ''; };

  return (
    <Link
      ref={ref}
      href={`/eventos/${evento.slug}`}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className={`group relative block overflow-hidden rounded-3xl ring-1 ring-gold/20 transition-[transform,box-shadow] duration-300 will-change-transform hover:shadow-[0_30px_80px_-20px_rgba(212,175,55,.35)] ${pasado ? 'opacity-70 grayscale-[.6] hover:grayscale-0' : ''}`}
    >
      <EventFlyer evento={evento} priority={priority} />
      <div className="pointer-events-none absolute inset-0 opacity-0 mix-blend-overlay transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_var(--gx,50%)_var(--gy,50%),rgba(255,240,190,.55),transparent_45%)]" />
      {evento.destacado && !pasado && (
        <span className="absolute top-4 right-4 rounded-full bg-gold px-3 py-1 font-display text-[9px] tracking-[0.25em] text-void uppercase">Hot 🔥</span>
      )}
      <div className="absolute top-1/2 right-4 grid h-11 w-11 -translate-y-1/2 translate-x-3 place-items-center rounded-full bg-gold text-void opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100">
        <IconArrow width={18} />
      </div>
    </Link>
  );
}
