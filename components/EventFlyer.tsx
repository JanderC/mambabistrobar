import Image from 'next/image';
import { fechaEvento, hueDe, shortCOP } from '@/lib/format';
import type { Evento } from '@/lib/types';
import { SERPENT_PATH } from './SerpentMark';

/**
 * Si el evento tiene flyer lo muestra; si no, genera un póster único
 * (color, ángulo y serpiente) a partir del nombre del evento.
 */
export function EventFlyer({ evento, className = '', priority = false }: { evento: Evento; className?: string; priority?: boolean }) {
  const f = fechaEvento(evento.inicia_en);

  if (evento.flyer_url) {
    return (
      <div className={`relative aspect-[4/5] overflow-hidden ${className}`}>
        <Image src={evento.flyer_url} alt={`Flyer ${evento.titulo}`} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover" priority={priority} />
      </div>
    );
  }

  const hue = hueDe(evento.slug);
  const angle = hue % 180;
  // Mantiene la paleta de marca: tonos entre verde esmeralda y oro
  const h1 = 140 + (hue % 40); // verdes
  const h2 = 38 + (hue % 14); // dorados

  return (
    <div
      className={`relative isolate aspect-[4/5] overflow-hidden ${className}`}
      style={{
        background: `radial-gradient(120% 80% at ${20 + (hue % 60)}% 0%, hsl(${h1} 70% 22%) 0%, hsl(${h1} 80% 6%) 55%, #010604 100%)`,
      }}
    >
      <div className="scales absolute inset-0 -z-10 opacity-20" style={{ transform: `rotate(${angle - 90}deg) scale(1.6)` }} />
      <div className="absolute inset-0 -z-10" style={{ background: `conic-gradient(from ${angle}deg at 70% 30%, transparent, hsl(${h2} 70% 55% / .25), transparent 30%)` }} />
      <svg viewBox="0 0 480 220" className="absolute -right-[18%] bottom-[18%] w-[130%] opacity-40" style={{ transform: `rotate(${-14 + (hue % 28)}deg)` }} aria-hidden="true">
        <path d={SERPENT_PATH} fill="none" stroke={`hsl(${h2} 70% 55%)`} strokeWidth="14" strokeLinecap="round" />
        <path d={SERPENT_PATH} fill="none" stroke="#020a07" strokeWidth="9" strokeLinecap="round" />
      </svg>

      <div className="absolute inset-0 flex flex-col justify-between p-5">
        <div className="flex items-start justify-between">
          <div className="rounded-xl bg-void/60 px-3 py-2 text-center ring-1 ring-gold/30 backdrop-blur">
            <p className="font-display text-3xl leading-none font-light text-gold-light">{f.dia}</p>
            <p className="font-display text-[10px] tracking-[0.3em] text-gold">{f.mes}</p>
          </div>
          <span className="font-display text-[9px] tracking-[0.4em] text-ivory/60 uppercase [writing-mode:vertical-rl]">Mamba · Bistro Bar 2.0</span>
        </div>
        <div>
          {evento.tematica && <p className="eyebrow mb-2 !text-[9px] !tracking-[0.35em]">{evento.tematica}</p>}
          <h3 className="title-xl text-[clamp(2rem,9vw,2.8rem)] leading-[0.9] text-ivory [text-shadow:0_4px_30px_rgba(0,0,0,.6)]">{evento.titulo}</h3>
          {evento.artistas[0] && <p className="mt-3 font-serif text-lg text-gold-light italic">con {evento.artistas.map((a) => a.nombre).join(' · ')}</p>}
          <div className="mt-4 flex items-center justify-between border-t border-gold/25 pt-3 font-display text-[10px] tracking-[0.25em] text-ivory/80 uppercase">
            <span>{f.semana} · {f.hora}</span>
            <span className="text-foil">{evento.cover_cop ? `Cover ${shortCOP(evento.cover_cop)}` : 'Free'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
