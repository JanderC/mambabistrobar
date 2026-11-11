'use client';

import { UserRound, X } from 'lucide-react';
import type { KeyboardEvent } from 'react';

/** Señas para reconocer a alguien en la discoteca cuando no se sabe (o no se entiende) su nombre */
export const SENAS = ['Camisa negra', 'Camisa blanca', 'Gorra', 'Lentes', 'Chaqueta', 'Vestido rojo', 'Cumpleañero', 'Grupo grande'];

/** "Carlos" + "Gorra" → "Carlos · gorra" (sin repetir señas) */
export const conSena = (nombre: string, sena: string) => {
  const base = nombre.trim();
  if (base.toLowerCase().includes(sena.toLowerCase())) return base;
  return base ? `${base} · ${sena.toLowerCase()}` : sena;
};

/**
 * Campo grande «¿A nombre de quién?» con señas de un toque. Lo usan la barra, la tablet del mesonero
 * y la cuenta: la idea es que ninguna cuenta quede sin saber de quién es.
 */
export function NombreCliente({
  valor, onCambio, onEnter, autoFocus, placeholder = 'Nombre o seña: “Carlos”, “la de la gorra”…', grande = true,
}: { valor: string; onCambio: (v: string) => void; onEnter?: () => void; autoFocus?: boolean; placeholder?: string; grande?: boolean }) {
  return (
    <div>
      <label className="relative block">
        <UserRound size={grande ? 20 : 17} className="absolute top-1/2 left-4 -translate-y-1/2 text-gold" />
        <input
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && onEnter?.()}
          autoFocus={autoFocus}
          maxLength={60}
          autoComplete="off"
          enterKeyHint="go"
          placeholder={placeholder}
          className={`w-full rounded-2xl border border-gold/30 bg-void/60 pr-12 pl-12 text-ivory placeholder:text-smoke/60 focus:border-gold focus:outline-none ${grande ? 'h-16 text-xl' : 'h-12 text-base'}`}
        />
        {valor && (
          <button type="button" onClick={() => onCambio('')} className="absolute top-1/2 right-2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-smoke hover:text-ivory" aria-label="Borrar nombre">
            <X size={18} />
          </button>
        )}
      </label>
      <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
        {SENAS.map((s) => (
          <button key={s} type="button" onClick={() => onCambio(conSena(valor, s))} className="h-10 shrink-0 rounded-full border border-gold/20 px-3.5 text-sm text-smoke active:bg-gold/20 hover:text-ivory">
            + {s}
          </button>
        ))}
      </div>
    </div>
  );
}
