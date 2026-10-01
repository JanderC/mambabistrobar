'use client';

import { Clock, Eye, Inbox, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { adm } from '@/lib/admin/api';
import { type Moneda, type Tasa, convertir, dinero, hace } from '@/lib/admin/moneda';
import { useVivo } from '@/lib/admin/vivo';
import { Boton, Cargando, ErrorCaja, useAvisos, useDatos } from '../ui';
import { Cobro } from './Cobro';
import type { Cuenta } from './tipos';

export type EnCola = {
  id: number; numero: string; tipo: string; asiento: number | null; personas: number; nombre_cliente: string | null; moneda: Moneda; total: number; pagado: number;
  mesonero: string | null; cobro_solicitado_en: string; cobro_nota: string | null; mesa_numero: number | null; mesa_tipo: string | null; zona: string | null; items: number;
};

const lugar = (c: EnCola) => (c.mesa_tipo === 'barra' || (c.tipo === 'barra' && !c.mesa_numero) ? 'Barra' : c.tipo === 'llevar' ? 'Llevar' : String(c.mesa_numero));
const etiqueta = (c: EnCola) => (c.mesa_tipo === 'barra' || (c.tipo === 'barra' && !c.mesa_numero) ? `Barra${c.asiento ? ` · puesto ${c.asiento}` : ''}` : c.tipo === 'llevar' ? 'Para llevar' : `Mesa ${c.mesa_numero}`);

/**
 * Lo que los mesoneros pasan desde sus tablets cae aquí en orden de llegada.
 * El cajero toca "Cobrar" y resuelve sin cambiar de pantalla.
 */
export function ColaCobro({ onCambio }: { onCambio?: (n: number) => void }) {
  const cola = useDatos<EnCola[]>('/cuentas/cola-cobro', 20_000);
  const tasa = useDatos<Tasa>('/tasas/actual');
  const [cobrando, setCobrando] = useState<Cuenta | null>(null);
  const [abriendo, setAbriendo] = useState<number | null>(null);
  const [nuevas, setNuevas] = useState<Set<number>>(new Set());
  const vistas = useRef<Set<number> | null>(null);
  const avisos = useAvisos();
  const [, tic] = useState(0);

  useVivo((e) => {
    if (e.tipo === 'cobro' || e.tipo === 'reconectado' || (e.tipo === 'cuenta' && ['cerrada', 'anulada', 'item_anulado', 'editada'].includes(e.accion))) cola.recargar();
  });

  // Resalta por unos segundos las que acaban de llegar
  useEffect(() => {
    if (!cola.datos) return;
    onCambio?.(cola.datos.length);
    const ids = new Set(cola.datos.map((c) => c.id));
    if (vistas.current) {
      const frescas = [...ids].filter((id) => !vistas.current!.has(id));
      if (frescas.length) {
        setNuevas((n) => new Set([...n, ...frescas]));
        setTimeout(() => setNuevas((n) => new Set([...n].filter((id) => !frescas.includes(id)))), 6000);
      }
    }
    vistas.current = ids;
  }, [cola.datos, onCambio]);

  useEffect(() => {
    const id = setInterval(() => tic((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const cobrar = async (c: EnCola) => {
    setAbriendo(c.id);
    try {
      setCobrando(await adm<Cuenta>(`/cuentas/${c.id}`));
    } catch (e) {
      avisos.error(e);
    } finally {
      setAbriendo(null);
    }
  };

  if (cola.cargando) return <Cargando />;
  if (cola.error) return <ErrorCaja mensaje={cola.error} onReintentar={cola.recargar} />;

  // La ventana de cobro vive fuera de la lista: al cobrar la última cuenta la cola queda vacía,
  // pero el cajero todavía tiene que ver el vuelto.
  const ventanaCobro = cobrando && tasa.datos && (
    <Cobro cuenta={cobrando} tasa={tasa.datos} onCerrar={() => { setCobrando(null); cola.recargar(); }} onPagado={() => cola.recargar()} />
  );

  if (!cola.datos?.length)
    return (
      <>
      <div className="rounded-3xl border border-dashed border-gold/20 px-6 py-16 text-center">
        <Inbox size={44} className="mx-auto text-gold/50" />
        <p className="mt-4 font-display text-xl">Nada por cobrar</p>
        <p className="mt-1 text-sm text-smoke">Cuando un mesonero pase una cuenta desde su tablet aparecerá aquí al instante, con sonido.</p>
      </div>
      {ventanaCobro}
      </>
    );

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cola.datos.map((c, i) => {
          const saldo = c.total - c.pagado;
          const espera = (Date.now() - new Date(c.cobro_solicitado_en).getTime()) / 60000;
          return (
            <article key={c.id} className={`flex flex-col overflow-hidden rounded-3xl border-2 bg-[#06140f] transition-all duration-500 ${nuevas.has(c.id) ? 'scale-[1.02] border-gold shadow-[0_0_50px_-10px_rgba(212,175,55,.7)]' : espera > 6 ? 'border-red-400/60' : 'border-gold/25'}`}>
              <div className="flex items-center gap-4 p-4">
                <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-gold-light to-gold-dark font-display font-medium text-void">
                  <span className={lugar(c).length > 3 ? 'text-xl' : 'text-4xl'}>{lugar(c)}</span>
                  <span className="absolute -top-2 -left-2 grid h-6 w-6 place-items-center rounded-full bg-void text-[11px] font-bold text-gold ring-1 ring-gold">{i + 1}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-medium">{c.nombre_cliente ?? etiqueta(c)}</p>
                  <p className="flex flex-wrap items-center gap-x-3 text-xs text-smoke">
                    <span>{etiqueta(c)}{c.zona ? ` · ${c.zona}` : ''}</span>
                    <span className="flex items-center gap-1"><Users size={12} /> {c.personas}</span>
                  </p>
                  <p className="text-xs text-smoke">Atiende <b className="font-medium text-ivory">{c.mesonero ?? '—'}</b> · {c.numero}</p>
                </div>
              </div>

              <div className="px-4">
                <p className="font-display text-4xl font-light text-gold-light">{dinero(saldo, c.moneda)}</p>
                {tasa.datos && (
                  <p className="flex gap-3 text-xs text-smoke">
                    {(['COP', 'USD', 'VES'] as Moneda[]).filter((m) => m !== c.moneda).map((m) => <span key={m}>{dinero(convertir(saldo, c.moneda, m, tasa.datos!), m)}</span>)}
                  </p>
                )}
                {c.cobro_nota && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {c.cobro_nota.split(' · ').map((n) => <span key={n} className="rounded-full bg-sky-400/15 px-2.5 py-1 text-xs text-sky-200 ring-1 ring-sky-400/30">{n}</span>)}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-white/5 p-3">
                <span className={`flex items-center gap-1 text-xs ${espera > 6 ? 'font-medium text-red-300' : 'text-smoke'}`}><Clock size={13} /> espera {hace(c.cobro_solicitado_en)}</span>
                <Link href={`/admin/cuenta/${c.id}`} className="ml-auto grid h-12 w-12 place-items-center rounded-xl border border-gold/25 text-smoke hover:text-ivory" aria-label="Ver detalle"><Eye size={18} /></Link>
                <Boton variante="oro" tam="lg" cargando={abriendo === c.id} disabled={!tasa.datos} onClick={() => cobrar(c)}><Wallet size={18} /> Cobrar</Boton>
              </div>
            </article>
          );
        })}
      </div>

      {ventanaCobro}
    </>
  );
}
