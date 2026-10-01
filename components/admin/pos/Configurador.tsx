'use client';

import { Minus, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { type Moneda, dinero } from '@/lib/admin/moneda';
import { Boton, Input, Modal } from '../ui';
import type { Borrador, CategoriaCat, ProductoCat } from './tipos';

type Props = {
  producto: ProductoCat;
  categoria: CategoriaCat;
  moneda: Moneda;
  /** Asientos de la mesa (0 = no aplica) */
  asientos: number;
  asientoInicial: number | null;
  onAgregar: (b: Borrador) => void;
  onCerrar: () => void;
};

function Contador({ valor, onCambio, max, min = 0, grande = false }: { valor: number; onCambio: (n: number) => void; max?: number; min?: number; grande?: boolean }) {
  const cls = `grid place-items-center rounded-full border border-gold/30 text-gold transition hover:bg-gold/15 disabled:opacity-30 ${grande ? 'h-11 w-11' : 'h-8 w-8'}`;
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={cls} disabled={valor <= min} onClick={() => onCambio(valor - 1)} aria-label="Menos"><Minus size={grande ? 18 : 14} /></button>
      <span className={`text-center font-display tabular-nums ${grande ? 'w-10 text-2xl' : 'w-6 text-base'}`}>{valor}</span>
      <button type="button" className={cls} disabled={max != null && valor >= max} onClick={() => onCambio(valor + 1)} aria-label="Más"><Plus size={grande ? 18 : 14} /></button>
    </div>
  );
}

/**
 * Arma un ítem: presentación, cantidad, puesto, ingredientes que se quitan, adicionales con precio
 * y —en los tobos— qué cervezas del inventario lo componen.
 */
export function Configurador({ producto, categoria, moneda, asientos, asientoInicial, onAgregar, onCerrar }: Props) {
  const [vId, setVId] = useState(producto.variantes.find((v) => v.disponibles !== 0)?.id ?? producto.variantes[0].id);
  const variante = producto.variantes.find((v) => v.id === vId)!;
  const [cantidad, setCantidad] = useState(1);
  const [asiento, setAsiento] = useState<number | null>(asientoInicial);
  const [sin, setSin] = useState<number[]>([]);
  const [adic, setAdic] = useState<Record<number, number>>({});
  const [sel, setSel] = useState<Record<number, number>>({});
  const [notas, setNotas] = useState('');

  const elegidas = Object.values(sel).reduce((s, n) => s + n, 0);
  const requeridas = variante.seleccion?.cantidad ?? 0;
  const faltan = requeridas - elegidas;

  const { unitario, detalle } = useMemo(() => {
    let extra = 0;
    const d: string[] = [];
    for (const r of variante.removibles) if (sin.includes(r.id)) d.push(`SIN ${r.etiqueta}`);
    for (const a of categoria.adicionales) {
      const n = adic[a.id] ?? 0;
      if (n) {
        extra += a.precios[moneda] * n;
        d.push(`+ ${n > 1 ? `${n}× ` : ''}${a.nombre}`);
      }
    }
    for (const o of variante.seleccion?.opciones ?? []) {
      const n = sel[o.insumo_id] ?? 0;
      if (n) {
        extra += o.recargo[moneda] * n;
        d.push(`${n} × ${o.nombre}`);
      }
    }
    return { unitario: variante.precios[moneda] + extra, detalle: d };
  }, [variante, categoria.adicionales, sin, adic, sel, moneda]);

  const cambiarVariante = (id: number) => {
    setVId(id);
    setSin([]);
    setSel({});
  };

  const agregar = () =>
    onAgregar({
      clave: `${variante.id}-${Date.now()}`,
      producto, variante, cantidad, asiento, notas: notas.trim(), sin,
      adicionales: Object.entries(adic).filter(([, n]) => n > 0).map(([id, n]) => ({ id: Number(id), cantidad: n })),
      seleccion: Object.entries(sel).filter(([, n]) => n > 0).map(([id, n]) => ({ insumo_id: Number(id), cantidad: n })),
      unitario, detalle,
    });

  const maxPorStock = variante.disponibles ?? undefined;

  return (
    <Modal
      titulo={producto.nombre}
      subtitulo={producto.descripcion ?? undefined}
      onCerrar={onCerrar}
      ancho="max-w-2xl"
      pie={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <Contador grande valor={cantidad} min={1} max={maxPorStock} onCambio={setCantidad} />
          <Boton variante="oro" tam="lg" className="flex-1 sm:flex-none" disabled={faltan !== 0 && requeridas > 0} onClick={agregar}>
            {requeridas > 0 && faltan !== 0 ? (faltan > 0 ? `Faltan ${faltan} por elegir` : `Sobran ${-faltan}`) : <>Agregar · {dinero(unitario * cantidad, moneda)}</>}
          </Boton>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Presentación */}
        {producto.variantes.length > 1 && (
          <section>
            <h3 className="mb-2 text-xs tracking-wider text-gold uppercase">Presentación</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {producto.variantes.map((v) => (
                <button key={v.id} disabled={v.disponibles === 0} onClick={() => cambiarVariante(v.id)}
                  className={`rounded-2xl border p-3 text-left transition disabled:opacity-40 ${v.id === vId ? 'border-gold bg-gold/15' : 'border-gold/15 hover:border-gold/40'}`}>
                  <p className="text-sm font-medium">{v.presentacion}</p>
                  <p className="font-display text-lg text-gold-light">{dinero(v.precios[moneda], moneda)}</p>
                  {v.disponibles === 0 ? <p className="text-[11px] text-red-300">Agotado</p> : v.disponibles != null && v.disponibles <= 5 && <p className="text-[11px] text-gold">Quedan {v.disponibles}</p>}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Surtido: tobo de cervezas */}
        {variante.seleccion && (
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs tracking-wider text-gold uppercase">Arma el surtido</h3>
              <span className={`rounded-full px-3 py-1 font-display text-sm ${faltan === 0 ? 'bg-venom text-void' : 'bg-gold/15 text-gold-light'}`}>{elegidas} / {requeridas}</span>
            </div>
            <div className="space-y-2">
              {variante.seleccion.opciones.map((o) => {
                const n = sel[o.insumo_id] ?? 0;
                // No se puede elegir más de lo que hay en inventario (por cada tobo pedido)
                const tope = Math.min(n + Math.max(0, faltan), Math.floor(o.stock / cantidad));
                return (
                  <div key={o.insumo_id} className={`flex items-center gap-3 rounded-2xl border p-3 ${n ? 'border-venom/50 bg-emerald/30' : 'border-gold/10'} ${o.stock < cantidad ? 'opacity-40' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{o.nombre}</p>
                      <p className="text-xs text-smoke">
                        {o.stock} en inventario{o.recargo[moneda] > 0 && <span className="text-gold-light"> · +{dinero(o.recargo[moneda], moneda)} c/u</span>}
                      </p>
                    </div>
                    <Boton tam="sm" variante="sutil" disabled={faltan <= 0 || o.stock < cantidad * (n + faltan)} onClick={() => setSel({ ...sel, [o.insumo_id]: n + faltan })}>
                      {elegidas === 0 ? `Las ${requeridas}` : `+${Math.max(0, faltan)}`}
                    </Boton>
                    <Contador valor={n} max={tope} onCambio={(v) => setSel({ ...sel, [o.insumo_id]: v })} />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Quitar ingredientes */}
        {variante.removibles.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs tracking-wider text-gold uppercase">Ingredientes <span className="text-smoke normal-case">· toca para quitar</span></h3>
            <div className="flex flex-wrap gap-2">
              {variante.removibles.map((r) => {
                const quitado = sin.includes(r.id);
                return (
                  <button key={r.id} onClick={() => setSin(quitado ? sin.filter((x) => x !== r.id) : [...sin, r.id])}
                    className={`rounded-full border px-3.5 py-2 text-sm transition ${quitado ? 'border-red-400/60 bg-red-500/15 text-red-200 line-through' : 'border-venom/30 bg-emerald/30 text-ivory'}`}>
                    {quitado ? `Sin ${r.etiqueta.toLowerCase()}` : r.etiqueta}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Adicionales */}
        {categoria.adicionales.length > 0 && (
          <section>
            <h3 className="mb-2 text-xs tracking-wider text-gold uppercase">Adicionales <span className="text-smoke normal-case">· se cobran aparte</span></h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {categoria.adicionales.map((a) => {
                const n = adic[a.id] ?? 0;
                return (
                  <div key={a.id} className={`flex items-center justify-between gap-2 rounded-2xl border p-3 ${n ? 'border-gold/60 bg-gold/10' : 'border-gold/10'}`}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{a.nombre}</p>
                      <p className="text-xs text-gold-light">+{dinero(a.precios[moneda], moneda)}</p>
                    </div>
                    <Contador valor={n} max={9} onCambio={(v) => setAdic({ ...adic, [a.id]: v })} />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Puesto */}
        {asientos > 0 && (
          <section>
            <h3 className="mb-2 text-xs tracking-wider text-gold uppercase">¿Para qué puesto? <span className="text-smoke normal-case">· sirve para dividir la cuenta</span></h3>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setAsiento(null)} className={`h-9 rounded-full px-4 text-sm ${asiento == null ? 'bg-gold font-semibold text-void' : 'border border-gold/20 text-smoke'}`}>Toda la mesa</button>
              {Array.from({ length: asientos }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => setAsiento(n)} className={`h-9 w-9 rounded-full text-sm ${asiento === n ? 'bg-gold font-semibold text-void' : 'border border-gold/20 text-smoke'}`}>{n}</button>
              ))}
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-xs tracking-wider text-gold uppercase">Nota para {categoria.estacion === 'cocina' ? 'cocina' : 'barra'}</h3>
          <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Término medio, sin hielo, bien fría…" maxLength={200} />
        </section>
      </div>
    </Modal>
  );
}
