'use client';

import { useState } from 'react';
import { Barra, Boton, Cargando, Dato, Encabezado, ErrorCaja, Input, Pestanas, Tabla, Tarjeta, Vacio, useDatos } from '@/components/admin/ui';
import { type Moneda, dinero, fechaCorta, jornadaHoy, numero } from '@/lib/admin/moneda';

type Fila = { usd: number; total: number };
type Reporte = {
  moneda: Moneda;
  resumen: { cuentas: number; personas: number; total: number; usd: number; ticket_promedio: number; consumo_por_persona: number; servicio: number; descuentos: number; items_anulados: number };
  por_dia: (Fila & { dia: string; cuentas: number })[];
  por_metodo: (Fila & { metodo: string; moneda: Moneda; pagos: number; total_moneda: number })[];
  por_producto: (Fila & { nombre: string; presentacion: string | null; cantidad: number })[];
  por_categoria: (Fila & { categoria: string; cantidad: number })[];
  por_mesonero: (Fila & { mesonero: string; cuentas: number; personas: number })[];
  por_zona: (Fila & { zona: string; cuentas: number })[];
};
type Consumo = { id: number; nombre: string; unidad: string; categoria: string | null; stock: number; stock_minimo: number; vendido: number; merma: number; entradas: number };

const RANGOS = [
  { id: 'hoy', nombre: 'Esta noche', desde: () => jornadaHoy(), hasta: () => jornadaHoy() },
  { id: 'ayer', nombre: 'Anoche', desde: () => jornadaHoy(-1), hasta: () => jornadaHoy(-1) },
  { id: '7', nombre: '7 días', desde: () => jornadaHoy(-6), hasta: () => jornadaHoy() },
  { id: '30', nombre: '30 días', desde: () => jornadaHoy(-29), hasta: () => jornadaHoy() },
];

function Ranking<T extends Fila>({ titulo, filas, nombre, detalle, moneda }: { titulo: string; filas: T[]; nombre: (f: T) => string; detalle?: (f: T) => string; moneda: Moneda }) {
  const max = Math.max(...filas.map((f) => f.total), 1);
  return (
    <Tarjeta className="p-4">
      <h2 className="mb-3 font-display text-base text-gold-light">{titulo}</h2>
      {!filas.length ? <p className="py-6 text-center text-sm text-smoke">Sin datos en el rango</p> : (
        <ul className="space-y-2.5">
          {filas.slice(0, 12).map((f, i) => (
            <li key={i}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{nombre(f)} {detalle && <span className="text-xs text-smoke">· {detalle(f)}</span>}</span>
                <b className="shrink-0 font-medium tabular-nums">{dinero(f.total, moneda)}</b>
              </div>
              <Barra valor={f.total} maximo={max} />
            </li>
          ))}
        </ul>
      )}
    </Tarjeta>
  );
}

export default function ReportesPage() {
  const [tab, setTab] = useState<'ventas' | 'inventario'>('ventas');
  const [desde, setDesde] = useState(jornadaHoy(-6));
  const [hasta, setHasta] = useState(jornadaHoy());
  const ventas = useDatos<Reporte>(tab === 'ventas' ? `/reportes/ventas?desde=${desde}&hasta=${hasta}` : null);
  const consumo = useDatos<Consumo[]>(tab === 'inventario' ? `/reportes/inventario?desde=${desde}&hasta=${hasta}` : null);
  const r = ventas.datos;
  const maxDia = Math.max(...(r?.por_dia.map((d) => d.total) ?? [1]), 1);

  return (
    <div>
      <Encabezado titulo="Reportes" descripcion="Las jornadas cortan a las 6:00 a.m.: lo vendido de madrugada cuenta para la noche anterior.">
        <Pestanas valor={tab} onCambio={setTab} opciones={[{ valor: 'ventas', etiqueta: 'Ventas' }, { valor: 'inventario', etiqueta: 'Consumo de inventario' }]} />
      </Encabezado>

      <div className="mb-5 flex flex-wrap items-end gap-2">
        {RANGOS.map((x) => (
          <Boton key={x.id} tam="sm" variante={desde === x.desde() && hasta === x.hasta() ? 'oro' : 'borde'} onClick={() => { setDesde(x.desde()); setHasta(x.hasta()); }}>{x.nombre}</Boton>
        ))}
        <label className="ml-2 text-xs text-smoke">Desde<Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="mt-1 h-8 w-36" /></label>
        <label className="text-xs text-smoke">Hasta<Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="mt-1 h-8 w-36" /></label>
      </div>

      {tab === 'ventas' && (ventas.cargando ? <Cargando /> : ventas.error || !r ? <ErrorCaja mensaje={ventas.error ?? 'Sin datos'} onReintentar={ventas.recargar} /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Dato etiqueta="Ventas cobradas" valor={dinero(r.resumen.total, r.moneda)} sub={`≈ ${dinero(r.resumen.usd, 'USD')}`} acento />
            <Dato etiqueta="Cuentas" valor={r.resumen.cuentas} sub={`${r.resumen.personas} personas atendidas`} />
            <Dato etiqueta="Ticket promedio" valor={dinero(r.resumen.ticket_promedio, r.moneda)} sub={`${dinero(r.resumen.consumo_por_persona, r.moneda)} por persona`} />
            <Dato etiqueta="Servicio recaudado" valor={dinero(r.resumen.servicio, r.moneda)} sub={`Descuentos ${dinero(r.resumen.descuentos, r.moneda)} · ${r.resumen.items_anulados} ítems anulados`} />
          </div>

          <Tarjeta className="mt-4 p-4">
            <h2 className="mb-4 font-display text-base text-gold-light">Ventas por jornada</h2>
            {!r.por_dia.length ? <p className="py-8 text-center text-sm text-smoke">Sin ventas en el rango</p> : (
              <div className="flex h-48 items-end gap-2 overflow-x-auto">
                {r.por_dia.map((d) => (
                  <div key={d.dia} className="group flex max-w-24 min-w-10 flex-1 flex-col items-center gap-1.5" title={`${fechaCorta(d.dia)}: ${dinero(d.total, r.moneda)} · ${d.cuentas} cuentas`}>
                    <span className="text-[10px] text-smoke opacity-0 transition group-hover:opacity-100">{dinero(d.total, r.moneda)}</span>
                    <div className="w-full rounded-t-lg bg-gradient-to-t from-gold-dark to-gold-light transition group-hover:brightness-125" style={{ height: `${Math.max(3, (d.total / maxDia) * 130)}px` }} />
                    <span className="text-[10px] whitespace-nowrap text-smoke">{fechaCorta(d.dia)}</span>
                  </div>
                ))}
              </div>
            )}
          </Tarjeta>

          <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <Ranking titulo="Productos más vendidos" filas={r.por_producto} moneda={r.moneda} nombre={(f) => `${f.nombre}${f.presentacion ? ` (${f.presentacion})` : ''}`} detalle={(f) => `${numero(f.cantidad)} und`} />
            <Ranking titulo="Por categoría" filas={r.por_categoria} moneda={r.moneda} nombre={(f) => f.categoria} detalle={(f) => `${numero(f.cantidad)} und`} />
            <Ranking titulo="Por zona" filas={r.por_zona} moneda={r.moneda} nombre={(f) => f.zona} detalle={(f) => `${f.cuentas} cuentas`} />
            <Ranking titulo="Por mesonero" filas={r.por_mesonero} moneda={r.moneda} nombre={(f) => f.mesonero} detalle={(f) => `${f.cuentas} cuentas · ${f.personas} pers.`} />
            <Tarjeta className="p-4 lg:col-span-2">
              <h2 className="mb-3 font-display text-base text-gold-light">Por método de pago y moneda</h2>
              {!r.por_metodo.length ? <p className="py-6 text-center text-sm text-smoke">Sin pagos en el rango</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-[11px] tracking-wider text-smoke uppercase"><th className="pb-2 font-medium">Método</th><th className="pb-2 font-medium">Moneda</th><th className="pb-2 text-right font-medium">Pagos</th><th className="pb-2 text-right font-medium">Recibido</th><th className="pb-2 text-right font-medium">Equivale a</th></tr></thead>
                  <tbody>
                    {r.por_metodo.map((m) => (
                      <tr key={`${m.metodo}${m.moneda}`} className="border-t border-white/5">
                        <td className="py-2">{m.metodo}</td><td className="text-smoke">{m.moneda}</td><td className="text-right tabular-nums">{m.pagos}</td>
                        <td className="text-right font-medium tabular-nums">{dinero(m.total_moneda, m.moneda)}</td><td className="text-right text-smoke tabular-nums">{dinero(m.total, r.moneda)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Tarjeta>
          </div>
        </>
      ))}

      {tab === 'inventario' && (consumo.cargando ? <Cargando /> : !consumo.datos?.length ? <Vacio titulo="Sin movimientos" /> : (
        <Tabla<Consumo>
          filas={consumo.datos}
          clave={(c) => c.id}
          columnas={[
            { titulo: 'Insumo', celda: (c) => <div><p className="font-medium">{c.nombre}</p><p className="text-xs text-smoke">{c.categoria}</p></div> },
            { titulo: 'Vendido', celda: (c) => <b className="font-medium">{numero(c.vendido, 1)} {c.unidad}</b>, alinear: 'der' },
            { titulo: 'Mermas / interno', celda: (c) => <span className={c.merma > 0 ? 'text-red-300' : 'text-smoke'}>{numero(c.merma, 1)} {c.unidad}</span>, alinear: 'der' },
            { titulo: 'Entradas', celda: (c) => <span className="text-venom">{numero(c.entradas, 1)} {c.unidad}</span>, alinear: 'der' },
            { titulo: 'Queda', celda: (c) => <span className={c.stock <= c.stock_minimo ? 'text-red-300' : ''}>{numero(c.stock, 1)} {c.unidad}</span>, alinear: 'der' },
          ]}
        />
      ))}
    </div>
  );
}
