'use client';

import { Loader2, X } from 'lucide-react';
import {
  type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes,
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import { adm, mensajeError } from '@/lib/admin/api';

// ====================================================================== Avisos (toasts)
type Aviso = { id: number; tipo: 'ok' | 'error' | 'info'; texto: string };
const AvisosCtx = createContext<{ ok: (t: string) => void; error: (e: unknown) => void; info: (t: string) => void }>({
  ok: () => {}, error: () => {}, info: () => {},
});
export const useAvisos = () => useContext(AvisosCtx);

export function AvisosProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const push = useCallback((tipo: Aviso['tipo'], texto: string) => {
    const id = Date.now() + Math.random();
    setAvisos((a) => [...a.slice(-3), { id, tipo, texto }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'error' ? 6500 : 3200);
  }, []);
  const api = useRef({
    ok: (t: string) => push('ok', t),
    info: (t: string) => push('info', t),
    error: (e: unknown) => push('error', typeof e === 'string' ? e : mensajeError(e)),
  }).current;
  return (
    <AvisosCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed top-16 right-4 z-[100] flex w-[min(92vw,380px)] flex-col gap-2">
        {avisos.map((a) => (
          <div
            key={a.id}
            role="status"
            className={`pointer-events-auto rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${
              a.tipo === 'error' ? 'border-red-400/40 bg-red-950/90 text-red-100'
              : a.tipo === 'ok' ? 'border-venom/40 bg-emerald/90 text-ivory'
              : 'border-gold/40 bg-abyss/95 text-ivory'
            }`}
          >
            {a.texto}
          </div>
        ))}
      </div>
    </AvisosCtx.Provider>
  );
}

// ====================================================================== Datos
/** Carga una ruta del API y la mantiene fresca (opcionalmente cada N ms) */
export function useDatos<T = any>(ruta: string | null, refrescarMs?: number) {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(!!ruta);
  const [error, setError] = useState<string | null>(null);
  const recargar = useCallback(async () => {
    if (!ruta) return;
    try {
      setDatos(await adm<T>(ruta));
      setError(null);
    } catch (e) {
      setError(mensajeError(e));
    } finally {
      setCargando(false);
    }
  }, [ruta]);
  useEffect(() => {
    setCargando(!!ruta);
    recargar();
    if (!refrescarMs) return;
    const id = setInterval(() => document.visibilityState === 'visible' && recargar(), refrescarMs);
    return () => clearInterval(id);
  }, [recargar, refrescarMs, ruta]);
  return { datos, cargando, error, recargar, setDatos };
}

// ====================================================================== Botones
type BotonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'oro' | 'borde' | 'sutil' | 'peligro' | 'verde';
  tam?: 'sm' | 'md' | 'lg';
  cargando?: boolean;
};
const VARIANTES = {
  oro: 'bg-gradient-to-br from-gold-light via-gold to-gold-dark text-void font-semibold hover:brightness-110 shadow-[0_6px_24px_-8px_rgba(212,175,55,.7)]',
  verde: 'bg-emerald-glow text-white font-semibold hover:brightness-110',
  borde: 'border border-gold/30 text-gold-light hover:bg-gold/10',
  sutil: 'text-smoke hover:bg-white/5 hover:text-ivory',
  peligro: 'border border-red-400/40 text-red-200 hover:bg-red-500/15',
};
const TAMS = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2' };

export function Boton({ variante = 'borde', tam = 'md', cargando, className = '', children, disabled, ...p }: BotonProps) {
  return (
    <button
      type="button"
      {...p}
      disabled={disabled || cargando}
      className={`inline-flex shrink-0 items-center justify-center rounded-xl whitespace-nowrap transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${TAMS[tam]} ${className}`}
    >
      {cargando && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

// ====================================================================== Contenedores
export function Tarjeta({ children, className = '', ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...p} className={`rounded-2xl border border-gold/10 bg-[#06140f]/90 ${className}`}>
      {children}
    </div>
  );
}

export function Encabezado({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-light tracking-wide text-ivory">{titulo}</h1>
        {descripcion && <p className="mt-0.5 text-sm text-smoke">{descripcion}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function Modal({
  titulo, subtitulo, onCerrar, children, pie, ancho = 'max-w-lg',
}: { titulo: ReactNode; subtitulo?: ReactNode; onCerrar: () => void; children: ReactNode; pie?: ReactNode; ancho?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onCerrar();
    addEventListener('keydown', k);
    document.body.style.overflow = 'hidden';
    return () => {
      removeEventListener('keydown', k);
      document.body.style.overflow = '';
    };
  }, [onCerrar]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div role="dialog" aria-modal="true" className={`flex max-h-[94dvh] w-full ${ancho} flex-col rounded-t-3xl border border-gold/20 bg-[#04110c] shadow-2xl sm:rounded-3xl`}>
        <header className="flex items-start justify-between gap-4 border-b border-gold/10 px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg text-ivory">{titulo}</h2>
            {subtitulo && <p className="mt-0.5 text-xs text-smoke">{subtitulo}</p>}
          </div>
          <button onClick={onCerrar} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-smoke hover:bg-white/10 hover:text-ivory" aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {pie && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-gold/10 px-5 py-3">{pie}</footer>}
      </div>
    </div>
  );
}

// ====================================================================== Formularios
export const claseInput =
  'h-10 w-full rounded-xl border border-gold/15 bg-void/60 px-3 text-sm text-ivory placeholder:text-smoke/50 focus:border-gold focus:outline-none disabled:opacity-50 [color-scheme:dark]';

export function Campo({ etiqueta, ayuda, children, className = '' }: { etiqueta: ReactNode; ayuda?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-medium tracking-wider text-gold/80 uppercase">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1 block text-[11px] text-smoke/80">{ayuda}</span>}
    </label>
  );
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${claseInput} ${p.className ?? ''}`} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={`${claseInput} ${p.className ?? ''}`} />;
export const Area = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea rows={3} {...p} className={`${claseInput} h-auto py-2 ${p.className ?? ''}`} />
);

/** Input numérico que entrega number | null (vacío = null) */
export function InputNum({ valor, onCambio, ...p }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { valor: number | null | undefined; onCambio: (n: number | null) => void }) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="any"
      min={0}
      {...p}
      value={valor ?? ''}
      onChange={(e) => onCambio(e.target.value === '' ? null : Number(e.target.value))}
      className={`${claseInput} ${p.className ?? ''}`}
    />
  );
}

export function Interruptor({ activo, onCambio, etiqueta, disabled }: { activo: boolean; onCambio: (v: boolean) => void; etiqueta?: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onCambio(!activo)} className="inline-flex items-center gap-2 text-sm text-ivory/90 disabled:opacity-50" role="switch" aria-checked={activo}>
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${activo ? 'bg-emerald-glow' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${activo ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {etiqueta}
    </button>
  );
}

// ====================================================================== Piezas pequeñas
const COLORES = {
  verde: 'bg-venom/10 text-venom ring-venom/30',
  oro: 'bg-gold/10 text-gold-light ring-gold/30',
  rojo: 'bg-red-500/10 text-red-300 ring-red-400/30',
  azul: 'bg-sky-400/10 text-sky-300 ring-sky-400/30',
  gris: 'bg-white/5 text-smoke ring-white/10',
};
export function Insignia({ color = 'gris', children, className = '' }: { color?: keyof typeof COLORES; children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ring-1 ${COLORES[color]} ${className}`}>{children}</span>;
}

export function Pestanas<T extends string>({ valor, onCambio, opciones, className = '' }: { valor: T; onCambio: (v: T) => void; opciones: { valor: T; etiqueta: ReactNode; cuenta?: number }[]; className?: string }) {
  return (
    <div className={`no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-gold/10 bg-void/50 p-1 ${className}`}>
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onCambio(o.valor)}
          className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm transition ${valor === o.valor ? 'bg-gold text-void font-semibold' : 'text-smoke hover:text-ivory'}`}
        >
          {o.etiqueta}
          {o.cuenta != null && <span className={`rounded-full px-1.5 text-[10px] ${valor === o.valor ? 'bg-void/20' : 'bg-white/10'}`}>{o.cuenta}</span>}
        </button>
      ))}
    </div>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-smoke">
      <Loader2 size={18} className="animate-spin text-gold" /> {texto}
    </div>
  );
}

export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-gold/15 px-6 py-12 text-center">
      <p className="font-display text-lg text-ivory/80">{titulo}</p>
      {children && <div className="mt-2 text-sm text-smoke">{children}</div>}
    </div>
  );
}

export function ErrorCaja({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-400/30 bg-red-950/30 p-5 text-sm text-red-100">
      {mensaje}
      {onReintentar && <Boton tam="sm" variante="peligro" className="ml-3" onClick={onReintentar}>Reintentar</Boton>}
    </div>
  );
}

export function Dato({ etiqueta, valor, sub, acento = false }: { etiqueta: string; valor: ReactNode; sub?: ReactNode; acento?: boolean }) {
  return (
    <Tarjeta className="p-4">
      <p className="text-[11px] tracking-wider text-smoke uppercase">{etiqueta}</p>
      <p className={`mt-1 font-display text-2xl font-light ${acento ? 'text-gold-light' : 'text-ivory'}`}>{valor}</p>
      {sub && <p className="mt-0.5 text-xs text-smoke">{sub}</p>}
    </Tarjeta>
  );
}

// ====================================================================== Tabla
export type Columna<T> = { titulo: string; celda: (fila: T) => ReactNode; clase?: string; alinear?: 'der' | 'centro' };

export function Tabla<T>({ columnas, filas, clave, onFila, vacio = 'Sin registros' }: { columnas: Columna<T>[]; filas: T[]; clave: (f: T) => string | number; onFila?: (f: T) => void; vacio?: string }) {
  if (!filas.length) return <Vacio titulo={vacio} />;
  return (
    <Tarjeta className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-gold/10 text-left text-[11px] tracking-wider text-smoke uppercase">
            {columnas.map((c) => (
              <th key={c.titulo} className={`px-4 py-3 font-medium ${c.alinear === 'der' ? 'text-right' : c.alinear === 'centro' ? 'text-center' : ''}`}>{c.titulo}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={clave(f)} onClick={onFila ? () => onFila(f) : undefined} className={`border-b border-white/5 last:border-0 ${onFila ? 'cursor-pointer hover:bg-gold/5' : ''}`}>
              {columnas.map((c) => (
                <td key={c.titulo} className={`px-4 py-2.5 align-middle ${c.alinear === 'der' ? 'text-right tabular-nums' : c.alinear === 'centro' ? 'text-center' : ''} ${c.clase ?? ''}`}>{c.celda(f)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Tarjeta>
  );
}

/** Barra horizontal simple para reportes */
export function Barra({ valor, maximo, color = 'bg-gold' }: { valor: number; maximo: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${maximo > 0 ? Math.max(2, (valor / maximo) * 100) : 0}%` }} />
    </div>
  );
}
