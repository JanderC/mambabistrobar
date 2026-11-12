'use client';

import { ArrowDownLeft, ArrowUpRight, ChefHat, ChevronLeft, ChevronRight, Lock, Martini, Receipt, Unlock, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Cargando, Dato, ErrorCaja, Insignia, Tarjeta, Vacio, useDatos } from '@/components/admin/ui';
import { MONEDAS, type Moneda, type PorMoneda, type Tasa, dinero, soloHora } from '@/lib/admin/moneda';
import { useVivo } from '@/lib/admin/vivo';

type Diario = {
  fecha: string; es_hoy: boolean; moneda: Moneda; tasa: Tasa;
  totales: { cobrado: number; cobrado_usd: number; vendido: number; vendido_usd: number; por_cobrar: number; cuentas_abiertas: number; cuentas_cobradas: number; anuladas: number; fiadas: number; ticket_promedio: number; unidades: number };
  por_moneda: Record<Moneda, { efectivo: number; otros: number; total: number; pagos: number; vueltos: number }>;
  por_metodo: { metodo: string; moneda: Moneda; es_efectivo: boolean; total: number; pagos: number }[];
  movimientos_totales: Record<Moneda, { ingresos: number; egresos: number }>;
  por_hora: { hora: string; total: number }[];
  vendido: { nombre: string; presentacion: string | null; estacion: string; cantidad: number; total: number }[];
  pagos: {
    id: number; fecha: string; moneda: Moneda; monto: number; vuelto_monto: number | null; vuelto_moneda: Moneda | null; referencia: string | null; anulado: boolean;
    metodo: string; es_efectivo: boolean; cuenta_id: number; numero: string; tipo: string; nombre_cliente: string | null; mesa_numero: number | null; mesa_nombre: string | null; usuario: string | null;
  }[];
  movimientos: { id: number; fecha: string; tipo: 'ingreso' | 'egreso'; concepto: string; moneda: Moneda; monto: number; usuario: string | null }[];
  sesiones: { id: number; caja: string; estado: string; usuario: string; fecha_apertura: string; fecha_cierre: string | null; esperado: PorMoneda; total_usd: number }[];
};

const NOMBRE: Record<Moneda, string> = { COP: 'Pesos', USD: 'Dólares', VES: 'Bolívares' };
const COLOR: Record<Moneda, string> = { COP: 'text-gold-light', USD: 'text-venom', VES: 'text-sky-300' };
const hoyISO = () => {
  // La jornada empieza a las 6 a. m.: de madrugada todavía es «la noche de ayer»
  const d = new Date(Date.now() - 6 * 3600_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const mover = (f: string, dias: number) => {
  const d = new Date(`${f}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
};
const lugar = (p: Diario['pagos'][number]) => (p.tipo === 'llevar' ? 'Para llevar' : p.mesa_numero && p.tipo === 'mesa' ? (p.mesa_nombre ?? `Mesa ${p.mesa_numero}`) : 'Barra');

/**
 * Movimientos del día: cuánto se ha vendido y cobrado, en qué moneda y con qué método, lo que falta por
 * cobrar, lo más vendido, cada cobro con su hora y los ingresos / egresos de caja. Se actualiza en vivo.
 */
export function MovimientosDia() {
  const [fecha, setFecha] = useState(hoyISO());
  const esHoy = fecha === hoyISO();
  const d = useDatos<Diario>(`/caja/diario${esHoy ? '' : `?fecha=${fecha}`}`, esHoy ? 30_000 : undefined);
  const [verTodo, setVerTodo] = useState(false);
  useVivo((e) => {
    if (esHoy && (e.tipo === 'cobro' || e.tipo === 'cuenta' || e.tipo === 'pedido' || e.tipo === 'reconectado')) d.recargar();
  });

  const maxHora = useMemo(() => Math.max(1, ...(d.datos?.por_hora.map((h) => h.total) ?? [1])), [d.datos]);

  const encabezado = (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/15 bg-gold/5 px-4 py-3">
      <div>
        <p className="font-display text-lg">{((t) => t.charAt(0).toUpperCase() + t.slice(1))(new Date(`${fecha}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
        <p className="text-xs text-smoke">{esHoy ? 'La noche de hoy · se actualiza sola con cada venta' : 'Jornada de 6 a. m. a 6 a. m.'}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={() => setFecha(mover(fecha, -1))} className="grid h-10 w-10 place-items-center rounded-xl border border-gold/20 hover:bg-white/5" aria-label="Día anterior"><ChevronLeft size={18} /></button>
        <input type="date" value={fecha} max={hoyISO()} onChange={(e) => e.target.value && setFecha(e.target.value)}
          className="h-10 rounded-xl border border-gold/20 bg-void/60 px-3 text-sm text-ivory [color-scheme:dark]" />
        <button onClick={() => !esHoy && setFecha(mover(fecha, 1))} disabled={esHoy} className="grid h-10 w-10 place-items-center rounded-xl border border-gold/20 hover:bg-white/5 disabled:opacity-30" aria-label="Día siguiente"><ChevronRight size={18} /></button>
        {!esHoy && <button onClick={() => setFecha(hoyISO())} className="h-10 rounded-xl bg-gold px-4 text-sm font-semibold text-void">Hoy</button>}
      </div>
    </div>
  );

  if (d.cargando) return <>{encabezado}<Cargando /></>;
  if (d.error || !d.datos) return <>{encabezado}<ErrorCaja mensaje={d.error ?? 'Sin datos'} onReintentar={d.recargar} /></>;
  const x = d.datos;
  const m = x.moneda;
  const t = x.totales;
  const pagos = verTodo ? x.pagos : x.pagos.slice(0, 15);
  // Lo que debería haber en los cajones ahora: la suma de las cajas abiertas (cada una se ve abajo en «Turnos de caja»)
  const abiertas = x.sesiones.filter((s) => s.estado === 'abierta');
  const cajaAbierta = abiertas.length ? { esperado: Object.fromEntries(MONEDAS.map((mo) => [mo, abiertas.reduce((t, s) => t + Number(s.esperado[mo]), 0)])) as PorMoneda } : null;

  return (
    <div>
      {encabezado}

      {/* Cifras grandes */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato acento etiqueta="Cobrado" valor={dinero(t.cobrado, m)} sub={`≈ ${dinero(t.cobrado_usd, 'USD')} · ${t.cuentas_cobradas} ${t.cuentas_cobradas === 1 ? 'cuenta' : 'cuentas'}`} />
        <Dato etiqueta="Vendido" valor={dinero(t.vendido, m)} sub={`${t.unidades} productos${t.anuladas ? ` · ${t.anuladas} anuladas` : ''}`} />
        {x.es_hoy
          ? <Dato etiqueta="Por cobrar ahora" valor={dinero(t.por_cobrar, m)} sub={`${t.cuentas_abiertas} ${t.cuentas_abiertas === 1 ? 'cuenta abierta' : 'cuentas abiertas'}`} />
          : <Dato etiqueta="Fiado" valor={t.fiadas} sub="cuentas a crédito" />}
        <Dato etiqueta="Ticket promedio" valor={dinero(t.ticket_promedio, m)} sub="por cuenta cobrada" />
      </div>

      {/* Lo que entró por moneda */}
      <Tarjeta className="mt-4 p-4">
        <h3 className="mb-3 flex items-center gap-2 font-display text-base text-gold-light"><Wallet size={16} /> Lo que entró, por moneda</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm [&_td]:px-2 [&_th]:px-2">
            <thead>
              <tr className="text-right text-[11px] tracking-wider text-smoke uppercase">
                <th className="py-2 text-left">Moneda</th><th className="py-2">Efectivo</th><th className="py-2">Otros métodos</th><th className="py-2">Total cobrado</th><th className="py-2">Ingresos / egresos</th>
                {cajaAbierta && <th className="py-2">{abiertas.length > 1 ? `En los ${abiertas.length} cajones` : 'En el cajón ahora'}</th>}
              </tr>
            </thead>
            <tbody>
              {MONEDAS.map((mo) => {
                const r = x.por_moneda[mo];
                const mv = x.movimientos_totales[mo];
                return (
                  <tr key={mo} className="border-t border-white/5 text-right tabular-nums">
                    <td className={`py-2.5 text-left font-semibold ${COLOR[mo]}`}>{NOMBRE[mo]}</td>
                    <td className="py-2.5">{dinero(r.efectivo, mo)}{r.vueltos > 0 && <span className="block text-[11px] text-red-300">vueltos −{dinero(r.vueltos, mo)}</span>}</td>
                    <td className="py-2.5">{dinero(r.otros, mo)}</td>
                    <td className={`py-2.5 font-display text-lg ${COLOR[mo]}`}>{dinero(r.total, mo)}<span className="block text-[11px] text-smoke">{r.pagos} {r.pagos === 1 ? 'pago' : 'pagos'}</span></td>
                    <td className="py-2.5 text-xs"><span className="block text-venom">+ {dinero(mv.ingresos, mo)}</span><span className="block text-red-300">− {dinero(mv.egresos, mo)}</span></td>
                    {cajaAbierta && <td className="py-2.5 font-semibold">{dinero(cajaAbierta.esperado[mo], mo)}</td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {x.por_metodo.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-3">
            {x.por_metodo.map((p) => (
              <span key={`${p.metodo}-${p.moneda}`} className="rounded-full border border-gold/15 px-3 py-1 text-xs">
                {p.metodo} · <span className={COLOR[p.moneda]}>{NOMBRE[p.moneda].toLowerCase()}</span> <b className="ml-1">{dinero(p.total, p.moneda)}</b> <span className="text-smoke">({p.pagos})</span>
              </span>
            ))}
          </div>
        )}
      </Tarjeta>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Lo más vendido */}
        <Tarjeta className="p-4 lg:col-span-2">
          <h3 className="mb-3 font-display text-base text-gold-light">Lo que se ha vendido</h3>
          {!x.vendido.length ? <p className="py-8 text-center text-sm text-smoke">Todavía no hay ventas.</p> : (
            <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
              {x.vendido.map((v) => (
                <li key={`${v.nombre}-${v.presentacion}`} className="flex items-center gap-2 border-b border-white/5 py-1.5 text-sm">
                  {v.estacion === 'cocina' ? <ChefHat size={13} className="shrink-0 text-gold" /> : <Martini size={13} className="shrink-0 text-venom" />}
                  <span className="min-w-0 flex-1 truncate">{v.nombre}{v.presentacion && !/^(unidad|botella|porci[oó]n)$/i.test(v.presentacion) && <span className="text-smoke"> · {v.presentacion}</span>}</span>
                  <b className="font-display text-base text-gold-light">{Number(v.cantidad)}</b>
                  <span className="w-24 text-right text-xs text-smoke tabular-nums">{dinero(v.total, m)}</span>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>

        {/* Por hora + cajas */}
        <div className="space-y-4">
          <Tarjeta className="p-4">
            <h3 className="mb-3 font-display text-base text-gold-light">Cobros por hora</h3>
            {!x.por_hora.length ? <p className="py-6 text-center text-sm text-smoke">Sin cobros.</p> : (
              <div className="flex h-32 items-end gap-1.5">
                {x.por_hora.map((h) => (
                  <div key={h.hora} className="flex max-w-14 flex-1 flex-col items-center gap-1" title={`${h.hora}:00 · ${dinero(h.total, m)}`}>
                    <div className="w-full rounded-t-md bg-gradient-to-t from-emerald to-venom/80" style={{ height: `${Math.max(4, (h.total / maxHora) * 100)}px` }} />
                    <span className="text-[9px] text-smoke">{h.hora}h</span>
                  </div>
                ))}
              </div>
            )}
          </Tarjeta>
          <Tarjeta className="p-4">
            <h3 className="mb-2 font-display text-base text-gold-light">Turnos de caja</h3>
            {!x.sesiones.length ? <p className="text-sm text-smoke">No se abrió caja este día.</p> : x.sesiones.map((s) => (
              <div key={s.id} className="border-b border-white/5 py-2 text-sm last:border-0">
                <div className="flex items-center gap-2">
                  {s.estado === 'abierta' ? <Unlock size={15} className="text-venom" /> : <Lock size={15} className="text-smoke" />}
                  <span className="min-w-0 flex-1">
                    <span className="block">{s.caja} <span className="text-smoke">· {s.usuario}</span></span>
                    <span className="block text-[11px] text-smoke">{soloHora(s.fecha_apertura)} → {s.fecha_cierre ? soloHora(s.fecha_cierre) : 'abierta'}</span>
                  </span>
                  <Insignia color={s.estado === 'abierta' ? 'verde' : 'gris'}>{s.estado === 'abierta' ? 'Abierta' : 'Cerrada'}</Insignia>
                </div>
                {/* Lo que debería haber en el cajón de esta caja ahora */}
                {s.estado === 'abierta' && (
                  <p className="mt-1 flex flex-wrap gap-x-3 pl-6 text-[11px]">
                    {MONEDAS.filter((mo) => Number(s.esperado[mo])).map((mo) => <span key={mo} className={COLOR[mo]}>{dinero(s.esperado[mo], mo)}</span>)}
                    {MONEDAS.every((mo) => !Number(s.esperado[mo])) && <span className="text-smoke">cajón vacío</span>}
                  </p>
                )}
              </div>
            ))}
          </Tarjeta>
        </div>
      </div>

      {/* Cada cobro */}
      <Tarjeta className="mt-4 p-4">
        <h3 className="mb-3 flex items-center gap-2 font-display text-base text-gold-light"><Receipt size={16} /> Cobros del día ({x.pagos.length})</h3>
        {!x.pagos.length ? <Vacio titulo="Sin cobros">Cuando se cobre una cuenta aparece aquí al instante.</Vacio> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm [&_td]:px-2 [&_th]:px-2">
              <thead>
                <tr className="text-left text-[11px] tracking-wider text-smoke uppercase">
                  <th className="py-2">Hora</th><th className="py-2">Cuenta</th><th className="py-2">Método</th><th className="py-2 text-right">Monto</th><th className="py-2 text-right">Vuelto</th><th className="py-2">Cobró</th>
                </tr>
              </thead>
              <tbody>
                {pagos.map((p) => (
                  <tr key={p.id} className={`border-t border-white/5 ${p.anulado ? 'opacity-45' : ''}`}>
                    <td className="py-2 text-smoke tabular-nums">{soloHora(p.fecha)}</td>
                    <td className="py-2">
                      <Link href={`/admin/cuenta/${p.cuenta_id}`} className="hover:text-gold-light">{lugar(p)}{p.nombre_cliente && <span className="text-smoke"> · {p.nombre_cliente}</span>}</Link>
                      <span className="block text-[11px] text-smoke">{p.numero}{p.anulado && <span className="ml-1 text-red-300">ANULADO</span>}</span>
                    </td>
                    <td className="py-2">{p.metodo} <span className={`text-xs ${COLOR[p.moneda]}`}>{NOMBRE[p.moneda].toLowerCase()}</span>{p.referencia && <span className="block text-[11px] text-smoke">Ref. {p.referencia}</span>}</td>
                    <td className={`py-2 text-right font-semibold tabular-nums ${p.anulado ? 'line-through' : COLOR[p.moneda]}`}>{dinero(p.monto, p.moneda)}</td>
                    <td className="py-2 text-right text-xs text-smoke tabular-nums">{p.vuelto_monto ? dinero(p.vuelto_monto, p.vuelto_moneda ?? p.moneda) : '—'}</td>
                    <td className="py-2 text-smoke">{p.usuario ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {x.pagos.length > 15 && (
              <button onClick={() => setVerTodo(!verTodo)} className="mt-2 w-full rounded-xl border border-gold/15 py-2 text-sm text-smoke hover:text-ivory">{verTodo ? 'Ver menos' : `Ver los ${x.pagos.length} cobros`}</button>
            )}
          </div>
        )}
      </Tarjeta>

      {/* Ingresos y egresos de caja */}
      {x.movimientos.length > 0 && (
        <Tarjeta className="mt-4 p-4">
          <h3 className="mb-2 font-display text-base text-gold-light">Ingresos y egresos de caja</h3>
          {x.movimientos.map((mv) => (
            <div key={mv.id} className="flex items-center gap-3 border-b border-white/5 py-2 text-sm last:border-0">
              {mv.tipo === 'ingreso' ? <ArrowDownLeft size={16} className="text-venom" /> : <ArrowUpRight size={16} className="text-red-300" />}
              <span className="min-w-0 flex-1">{mv.concepto}<span className="block text-[11px] text-smoke">{soloHora(mv.fecha)} · {mv.usuario ?? '—'}</span></span>
              <b className={mv.tipo === 'ingreso' ? 'text-venom' : 'text-red-300'}>{mv.tipo === 'ingreso' ? '+' : '−'} {dinero(mv.monto, mv.moneda)}</b>
            </div>
          ))}
        </Tarjeta>
      )}
    </div>
  );
}
