/**
 * La "M" serpiente de Mamba redibujada como trazo vectorial.
 * Se dibuja sola (stroke-dashoffset) y un destello dorado la recorre en bucle.
 */
export const SERPENT_PATH =
  'M12 150 C30 152 44 140 46 118 C48 92 60 80 76 80 C94 80 104 94 104 118 L106 170 C106 196 140 196 140 170 L140 60 C140 20 196 20 196 60 C198 80 206 96 216 108 L262 170 C280 198 240 212 232 184 C224 160 240 130 262 100 L290 64 C300 30 356 22 356 62 L356 170 C356 196 390 196 390 170 L390 132 C390 100 420 82 468 70';

export function SerpentMark({ className = '', animate = true }: { className?: string; animate?: boolean }) {
  return (
    <svg viewBox="0 0 480 220" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="sm-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a6a1b" />
          <stop offset="0.35" stopColor="#f6e3a1" />
          <stop offset="0.55" stopColor="#d4af37" />
          <stop offset="1" stopColor="#8a6a1b" />
        </linearGradient>
        <filter id="sm-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <style>{`
        .sm-draw { stroke-dasharray: 1; stroke-dashoffset: ${animate ? 1 : 0}; animation: sm-draw 2.8s cubic-bezier(.65,0,.35,1) .3s forwards; }
        .sm-spark { stroke-dasharray: .035 .965; stroke-dashoffset: 1; animation: sm-spark 5s linear 3.2s infinite; opacity: 0; }
        @keyframes sm-draw { to { stroke-dashoffset: 0; } }
        @keyframes sm-spark { 0% { stroke-dashoffset: 1; opacity: 1 } 100% { stroke-dashoffset: 0; opacity: 1 } }
        @media (prefers-reduced-motion: reduce) { .sm-draw { stroke-dashoffset: 0; animation: none } .sm-spark { display: none } }
      `}</style>
      {/* halo */}
      <path d={SERPENT_PATH} pathLength={1} className="sm-draw" fill="none" stroke="#d4af37" strokeOpacity=".35" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" filter="url(#sm-glow)" />
      {/* borde dorado */}
      <path d={SERPENT_PATH} pathLength={1} className="sm-draw" fill="none" stroke="url(#sm-gold)" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" />
      {/* cuerpo negro */}
      <path d={SERPENT_PATH} pathLength={1} className="sm-draw" fill="none" stroke="#06110d" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
      {/* filete interior */}
      <path d={SERPENT_PATH} pathLength={1} className="sm-draw" fill="none" stroke="#d4af37" strokeOpacity=".55" strokeWidth="1.2" strokeLinecap="round" />
      {/* destello que recorre la serpiente */}
      <path d={SERPENT_PATH} pathLength={1} className="sm-spark" fill="none" stroke="#fff8dc" strokeWidth="5" strokeLinecap="round" filter="url(#sm-glow)" />
    </svg>
  );
}
