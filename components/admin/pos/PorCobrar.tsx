'use client';

import { Armchair, Beer, BellRing, Clock, ExternalLink, PenLine, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Boton, Cargando, ErrorCaja, useDatos } from '@/components/admin/ui';
import { type Moneda, dinero, hace } from '@/lib/admin/moneda';
import { useVivo } from '@/lib/admin/vivo';

export type CuentaAbierta = {
  id: number; numero: string; tipo: 'mesa' | 'barra' | 'llevar'; nombre_cliente: string | null; total: number; pagado: number; moneda: Moneda; abierta_en: string;
  mesa_numero: number | null; mesa_nombre: string | null; zona: string | null; items: number; mesonero: string | null;
};
type EnCola = { id: number; cobro_solicitado_en: string; cobro_nota: string | null };

export const lugarCuenta = (c: Pick<CuentaAbierta, 'tipo' | 'mesa_numero' | 'mesa_nombre'>) =>
  c.tipo === 'llevar' ? 'Para llevar' : c.mesa_numero && c.tipo === 'mesa' ? (c.mesa_nombre ?? `Mesa ${c.mesa_numero}`) : 'Barra';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Todo lo que está por cobrar en el local, en una sola vista: primero las cuentas que los mesoneros pasaron a caja,
 * después las mesas y la barra. Cada una se cobra o se le anota algo con un toque.
 */
export function PorCobrar({ onCobrar, onAnotar, anotando, onCantidad }: {
  onCobrar: (id: number) => void;
  onAnotar: (c: CuentaAbierta) => void;
  anotando: number | null;
  onCantidad?: (n: number) => void;
}) {
  const cuentas = useDatos<CuentaAbierta[]>('/cuentas?estado=abierta', 30_000);
  const cola = useDatos<EnCola[]>('/cuentas/cola-cobro', 30_000);
  const [q, setQ] = useState('');
  useVivo((e) => {
    if (['pedido', 'cobro', 'cuenta', 'pedido_qr', 'reconectado'].includes(e.tipo)) { cuentas.recargar(); cola.recargar(); }
  });

  const pidieron = useMemo(() => new Map((cola.datos ?? []).map((c) => [c.id, c])), [cola.datos]);
  const lista = useMemo(() => {
    const n = sinTildes(q);
    return (cuentas.datos ?? [])
      .filter((c) => !n || sinTildes(`${lugarCuenta(c)} ${c.nombre_cliente ?? ''} ${c.numero} ${c.mesonero ?? ''} ${c.mesa_numero ?? ''}`).includes(n))
      .sort((a, b) => Number(pidieron.has(b.id)) - Number(pidieron.has(a.id)) || (a.mesa_numero ?? 9999) - (b.mesa_numero ?? 9999) || a.abierta_en.localeCompare(b.abierta_en));
  }, [cuentas.datos, q, pidieron]);

  const total = cuentas.datos?.length ?? 0;
  useEffect(() => onCantidad?.(pidieron.size), [pidieron.size, onCantidad]);

  if (cuentas.cargando) return <Cargando />;
  if (cuentas.error) return <ErrorCaja mensaje={cuentas.error} onReintentar={cuentas.recargar} />;

  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Buscar entre ${total} cuentas abiertas: mesa 5, Carlos…`}
        className="mb-3 h-12 w-full rounded-2xl border border-gold/25 bg-void/70 px-4 text-ivory outline-none placeholder:text-smoke/60 focus:border-gold" />
      {!lista.length ? (
        <p className="rounded-3xl border-2 border-dashed border-gold/20 px-6 py-12 text-center text-smoke">{q ? 'Ninguna cuenta coincide.' : 'No hay cuentas abiertas.'}</p>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((c) => {
            const saldo = c.total - c.pagado;
            const pidio = pidieron.get(c.id);
            const esMesa = c.tipo === 'mesa' && c.mesa_numero;
            return (
              <div key={c.id} className={`rounded-2xl border-2 p-3 ${pidio ? 'border-sky-400/70 bg-sky-500/10' : anotando === c.id ? 'border-gold bg-gold/10' : 'border-gold/15 bg-[#06140f]'}`}>
                <div className="flex items-start gap-2">
                  {esMesa ? <Armchair size={18} className="mt-0.5 shrink-0 text-gold" /> : <Beer size={18} className="mt-0.5 shrink-0 text-gold" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg leading-tight">{lugarCuenta(c)}{c.nombre_cliente && <span className="text-smoke"> · {c.nombre_cliente}</span>}</p>
                    <p className="flex flex-wrap gap-x-2 text-[11px] text-smoke">
                      {c.mesonero && <span>{c.mesonero}</span>}
                      <span className="flex items-center gap-1"><Clock size={10} /> {hace(c.abierta_en)}</span>
                      <span>{c.items} prod.</span>
                    </p>
                  </div>
                  <Link href={`/admin/cuenta/${c.id}`} className="text-smoke hover:text-gold-light" aria-label="Abrir la cuenta" title="Abrir la cuenta"><ExternalLink size={15} /></Link>
                </div>
                {pidio && <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-sky-200"><BellRing size={13} /> Pidió la cuenta {hace(pidio.cobro_solicitado_en)}{pidio.cobro_nota ? ` · ${pidio.cobro_nota}` : ''}</p>}
                <p className={`mt-2 font-display text-2xl font-light ${saldo > 0 ? 'text-gold-light' : 'text-venom'}`}>{saldo > 0 ? dinero(saldo, c.moneda) : 'Al día ✓'}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Boton variante={pidio ? 'oro' : 'borde'} disabled={saldo <= 0} onClick={() => onCobrar(c.id)}><Wallet size={15} /> Cobrar</Boton>
                  <Boton variante="sutil" onClick={() => onAnotar(c)} title="Lo que agregues al ticket va a esta cuenta"><PenLine size={15} /> Anotar</Boton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
