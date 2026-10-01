import Image from 'next/image';
import Link from 'next/link';
import { DIAS, hora12, linksMapa, waLink } from '@/lib/format';
import type { Local } from '@/lib/types';
import { IconInstagram, IconPin, IconTikTok, IconWhatsApp } from './icons';
import { NAV } from '@/lib/nav';

export function Footer({ local }: { local: Local }) {
  const mapa = linksMapa(local);
  return (
    <footer className="relative mt-24 overflow-hidden border-t border-gold/15 bg-abyss px-4 pt-16 pb-32 md:pb-12 lg:px-16">
      <div className="scales pointer-events-none absolute inset-0 opacity-[.04]" />
      <div className="relative mx-auto grid max-w-7xl gap-12 md:grid-cols-4">
        <div className="md:col-span-1">
          <div className="relative h-24 w-24 overflow-hidden rounded-full ring-1 ring-gold/30">
            <Image src="/brand/logo.webp" alt="Mamba Bistro Bar 2.0" fill unoptimized className="object-cover" />
          </div>
          <p className="mt-5 font-serif text-xl text-ivory/80 italic">{local.eslogan}</p>
          <div className="mt-5 flex gap-3">
            {local.instagram && (
              <a href={`https://instagram.com/${local.instagram}`} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="grid h-10 w-10 place-items-center rounded-full border border-gold/30 text-gold transition hover:bg-gold hover:text-void"><IconInstagram /></a>
            )}
            {local.tiktok && (
              <a href={`https://tiktok.com/@${local.tiktok}`} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="grid h-10 w-10 place-items-center rounded-full border border-gold/30 text-gold transition hover:bg-gold hover:text-void"><IconTikTok /></a>
            )}
            {local.whatsapp && (
              <a href={waLink(local.whatsapp)} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="grid h-10 w-10 place-items-center rounded-full border border-gold/30 text-gold transition hover:bg-gold hover:text-void"><IconWhatsApp /></a>
            )}
          </div>
        </div>

        <div>
          <h3 className="eyebrow mb-5">Explora</h3>
          <ul className="space-y-2.5 text-sm text-smoke">
            {NAV.map((n) => <li key={n.href}><Link href={n.href} className="transition hover:text-gold">{n.label}</Link></li>)}
          </ul>
        </div>

        <div>
          <h3 className="eyebrow mb-5">Horarios</h3>
          <ul className="space-y-1.5 text-sm">
            {local.horarios.map((h) => (
              <li key={h.dia_semana} className="flex justify-between gap-4 border-b border-gold/5 pb-1.5">
                <span className="text-smoke">{DIAS[h.dia_semana]}</span>
                <span className={h.abierto ? 'text-ivory' : 'text-smoke/50'}>
                  {h.abierto ? `${hora12(h.hora_apertura)} – ${hora12(h.hora_cierre)}` : 'Cerrado'}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="eyebrow mb-5">Encuéntranos</h3>
          <p className="flex gap-2 text-sm text-smoke"><IconPin className="mt-0.5 shrink-0 text-gold" width={16} />{local.direccion}{local.ciudad && `, ${local.ciudad}`}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={mapa.google} target="_blank" rel="noopener noreferrer" className="btn-ghost !px-4 !py-2 !text-[10px]">Google Maps</a>
            <a href={mapa.waze} target="_blank" rel="noopener noreferrer" className="btn-ghost !px-4 !py-2 !text-[10px]">Waze</a>
          </div>
          {local.edad_minima > 0 && (
            <p className="mt-6 text-xs text-smoke/70">Prohibido el expendio de bebidas embriagantes a menores de edad. Ley 124 de 1994. El exceso de alcohol es perjudicial para la salud.</p>
          )}
        </div>
      </div>

      <div className="relative mx-auto mt-14 flex max-w-7xl flex-col items-center justify-between gap-3 border-t border-gold/10 pt-6 text-xs text-smoke/60 sm:flex-row">
        <p>© {new Date().getFullYear()} {local.nombre}. Todos los derechos reservados.</p>
        <p className="font-display tracking-[0.3em] uppercase">Muda de piel <span className="text-foil">✦</span> cada noche</p>
      </div>
    </footer>
  );
}
