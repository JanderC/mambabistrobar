'use client';

import { Beer, Minus, Plus, Shuffle, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Boton, Campo, Cargando, Input, InputNum, Modal, Select, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { type Moneda, dinero } from '@/lib/admin/moneda';

type Insumo = { id: number; nombre: string; unidad: string; activo: boolean; stock: number; costo_unitario: number; categoria: string | null; categoria_insumo_id: number | null; area: string };
type CatMenu = { id: number; nombre: string; icono: string | null; activo: boolean };
type CatInsumo = { id: number; nombre: string };

const esCerveza = (i: Insumo) => /cervez|birra|beer/i.test(`${i.categoria ?? ''} ${i.nombre}`);

/**
 * Crear un tobo en un paso: cuántas cervezas trae y cuáles. Puede ser una mezcla fija («5 Polar + 5 Zulia»)
 * o que el cliente elija al pedirlo. Al venderlo se descuentan del inventario exactamente esas cervezas.
 */
export function CrearTobo({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: () => void }) {
  const avisos = useAvisos();
  const insumos = useDatos<Insumo[]>('/inventario/insumos');
  const catsInsumo = useDatos<CatInsumo[]>('/inventario/categorias');
  const categorias = useDatos<CatMenu[]>('/catalogo/categorias');
  const ajustes = useDatos<{ moneda_principal: Moneda }>('/config/ajustes');
  const moneda: Moneda = ajustes.datos?.moneda_principal ?? 'COP';

  const [total, setTotal] = useState(10);
  const [modo, setModo] = useState<'fija' | 'surtido'>('fija');
  const [mezcla, setMezcla] = useState<Record<number, number>>({});
  const [verTodos, setVerTodos] = useState(false);
  const [catSurtido, setCatSurtido] = useState<number | null>(null);
  const [nombre, setNombre] = useState('');
  const [nombreTocado, setNombreTocado] = useState(false);
  const [precio, setPrecio] = useState<number | null>(null);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);

  const disponibles = useMemo(() => {
    const activos = (insumos.datos ?? []).filter((i) => i.activo);
    const cervezas = activos.filter(esCerveza);
    return verTodos || !cervezas.length ? activos.filter((i) => /^(und|unidad|unidades)$/i.test(i.unidad) || esCerveza(i)) : cervezas;
  }, [insumos.datos, verTodos]);

  // Categoría del menú: «Tobos» si existe; si no, «Cervezas». La del surtido: la categoría de inventario de las cervezas.
  useEffect(() => {
    if (categoriaId || !categorias.datos) return;
    const c = categorias.datos.find((x) => x.activo && /tobo/i.test(x.nombre)) ?? categorias.datos.find((x) => x.activo && /cervez/i.test(x.nombre)) ?? categorias.datos.find((x) => x.activo);
    if (c) setCategoriaId(c.id);
  }, [categorias.datos, categoriaId]);
  useEffect(() => {
    if (catSurtido || !catsInsumo.datos) return;
    setCatSurtido(catsInsumo.datos.find((c) => /cervez/i.test(c.nombre))?.id ?? catsInsumo.datos[0]?.id ?? null);
  }, [catsInsumo.datos, catSurtido]);

  const elegidas = Object.entries(mezcla).filter(([, n]) => n > 0).map(([id, n]) => ({ insumo: (insumos.datos ?? []).find((i) => i.id === Number(id))!, n })).filter((x) => x.insumo);
  const puestas = elegidas.reduce((t, x) => t + x.n, 0);
  const faltan = total - puestas;
  const costo = elegidas.reduce((t, x) => t + x.n * Number(x.insumo.costo_unitario), 0);
  const alcanza = elegidas.length ? Math.min(...elegidas.map((x) => Math.floor(Number(x.insumo.stock) / x.n))) : 0;

  // Nombre automático mientras no lo escriban a mano
  const sugerido = modo === 'surtido'
    ? `Tobo surtido x${total}`
    : elegidas.length === 1 ? `Tobo ${total} ${elegidas[0].insumo.nombre}` : elegidas.length ? `Tobo ${elegidas.map((x) => `${x.n} ${x.insumo.nombre}`).join(' + ')}` : `Tobo x${total}`;
  useEffect(() => { if (!nombreTocado) setNombre(sugerido); }, [sugerido, nombreTocado]);

  const cambiar = (id: number, d: number) => setMezcla((m) => {
    const actual = m[id] ?? 0;
    const nuevo = Math.max(0, Math.min(actual + d, actual + (total - puestas)));
    return { ...m, [id]: nuevo };
  });
  const llenarCon = (id: number) => setMezcla((m) => ({ ...m, [id]: (m[id] ?? 0) + Math.max(0, total - puestas) }));
  const cambiarTotal = (n: number) => {
    const t = Math.max(1, Math.min(100, n));
    setTotal(t);
    // Si se achica el tobo, se recorta la mezcla desde la última cerveza
    setMezcla((m) => {
      let sobra = Object.values(m).reduce((a, b) => a + b, 0) - t;
      if (sobra <= 0) return m;
      const nuevo = { ...m };
      for (const k of Object.keys(nuevo).reverse()) {
        const quita = Math.min(nuevo[Number(k)], sobra);
        nuevo[Number(k)] -= quita;
        sobra -= quita;
        if (!sobra) break;
      }
      return nuevo;
    });
  };

  const listo = !!nombre.trim() && !!categoriaId && (precio ?? 0) > 0 && (modo === 'surtido' ? !!catSurtido : faltan === 0);

  const guardar = async () => {
    if (!listo) return;
    setGuardando(true);
    try {
      const descripcion = modo === 'surtido'
        ? `${total} cervezas bien frías en hielo: el cliente arma la mezcla a su gusto.`
        : `${total} cervezas bien frías en hielo: ${elegidas.map((x) => `${x.n} ${x.insumo.nombre}`).join(', ')}.`;
      await adm('/catalogo/productos', {
        method: 'POST',
        body: {
          nombre: nombre.trim(), categoria_id: categoriaId, descripcion, ingredientes: [], etiquetas: ['tobo'], imagen_url: null, moneda_base: moneda,
          destacado: false, disponible: true, visible_web: true, visible_pos: true, orden: 5,
          variantes: [{
            presentacion: `Tobo x${total}`, precio, precio_manual_usd: null, precio_manual_cop: null, precio_manual_ves: null,
            seleccion_categoria_insumo_id: modo === 'surtido' ? catSurtido : null,
            seleccion_cantidad: modo === 'surtido' ? total : null,
            receta: modo === 'fija' ? elegidas.map((x) => ({ insumo_id: x.insumo.id, cantidad: x.n, removible: false, etiqueta: null })) : [],
          }],
        },
      });
      avisos.ok(`${nombre.trim()} creado: ya se puede vender`);
      onCreado();
    } catch (e) {
      avisos.error(e);
    } finally {
      setGuardando(false);
    }
  };

  const cargando = insumos.cargando || categorias.cargando;

  return (
    <Modal titulo="Crear tobo" subtitulo="Elige cuántas cervezas trae y cuáles. Cada venta las descuenta del inventario." onCerrar={onCerrar} ancho="max-w-3xl"
      pie={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-smoke">
            {modo === 'fija' && (faltan > 0 ? <>Faltan <b className="text-gold-light">{faltan}</b> cervezas</> : faltan === 0 && elegidas.length ? <span className="text-venom">✓ {total} cervezas listas</span> : null)}
          </span>
          <div className="flex gap-2">
            <Boton variante="sutil" onClick={onCerrar}>Cancelar</Boton>
            <Boton variante="oro" tam="lg" cargando={guardando} disabled={!listo} onClick={guardar}><Beer size={17} /> Crear tobo</Boton>
          </div>
        </div>
      }>
      {cargando ? <Cargando /> : (
        <div className="space-y-5">
          {/* ¿Cuántas trae? */}
          <section className="flex flex-wrap items-center gap-3">
            <span className="text-xs tracking-wider text-gold uppercase">¿Cuántas cervezas trae?</span>
            <div className="flex items-center gap-2">
              <button onClick={() => cambiarTotal(total - 1)} className="grid h-10 w-10 place-items-center rounded-xl border border-gold/25" aria-label="Una menos"><Minus size={16} /></button>
              <b className="w-12 text-center font-display text-3xl text-gold-light">{total}</b>
              <button onClick={() => cambiarTotal(total + 1)} className="grid h-10 w-10 place-items-center rounded-xl border border-gold/25" aria-label="Una más"><Plus size={16} /></button>
            </div>
            <div className="flex gap-1.5">
              {[6, 10, 12, 24].map((n) => (
                <button key={n} onClick={() => cambiarTotal(n)} className={`rounded-full px-3 py-1.5 text-sm ${total === n ? 'bg-gold font-semibold text-void' : 'border border-gold/20 text-smoke'}`}>{n}</button>
              ))}
            </div>
          </section>

          {/* Mezcla fija o la elige el cliente */}
          <section className="grid gap-2 sm:grid-cols-2">
            <button onClick={() => setModo('fija')} className={`rounded-2xl border-2 p-3 text-left ${modo === 'fija' ? 'border-gold bg-gold/10' : 'border-gold/15'}`}>
              <span className="flex items-center gap-2 font-medium"><Beer size={17} className="text-gold" /> Yo elijo las cervezas</span>
              <span className="mt-0.5 block text-xs text-smoke">Ej.: «Tobo 10 Zulia» o «Tobo 5 Polar + 5 Zulia». Se vende de un toque.</span>
            </button>
            <button onClick={() => setModo('surtido')} className={`rounded-2xl border-2 p-3 text-left ${modo === 'surtido' ? 'border-gold bg-gold/10' : 'border-gold/15'}`}>
              <span className="flex items-center gap-2 font-medium"><Shuffle size={17} className="text-gold" /> El cliente arma la mezcla</span>
              <span className="mt-0.5 block text-xs text-smoke">Al venderlo se eligen cuáles de las {total}. Descuenta las que se elijan.</span>
            </button>
          </section>

          {modo === 'fija' ? (
            <section>
              <div className="mb-2 flex items-center gap-3">
                <span className="text-xs tracking-wider text-gold uppercase">Cervezas del inventario</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full transition-all ${faltan === 0 ? 'bg-venom' : 'bg-gold'}`} style={{ width: `${(puestas / total) * 100}%` }} />
                </div>
                <b className={`text-sm ${faltan === 0 ? 'text-venom' : 'text-gold-light'}`}>{puestas} / {total}</b>
              </div>
              {!disponibles.length ? (
                <p className="rounded-2xl border border-dashed border-gold/20 p-4 text-sm text-smoke">No hay cervezas en el inventario. Créalas en Inventario → Nuevo insumo (categoría «Cervezas», unidad «unidades»).</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {disponibles.map((i) => {
                    const n = mezcla[i.id] ?? 0;
                    return (
                      <div key={i.id} className={`flex items-center gap-2 rounded-2xl border p-2.5 ${n ? 'border-gold/60 bg-gold/5' : 'border-gold/15'}`}>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{i.nombre}</p>
                          <p className={`text-[11px] ${Number(i.stock) < n ? 'text-red-300' : 'text-smoke'}`}>{Number(i.stock)} en inventario · {dinero(Number(i.costo_unitario), moneda)} c/u</p>
                        </div>
                        {faltan > 0 && <button onClick={() => llenarCon(i.id)} className="rounded-lg border border-gold/20 px-2 py-1 text-[11px] text-gold-light hover:bg-gold/10" title="Completar el tobo con esta cerveza">+{faltan}</button>}
                        <button onClick={() => cambiar(i.id, -1)} disabled={!n} className="grid h-9 w-9 place-items-center rounded-xl border border-gold/25 disabled:opacity-30" aria-label={`Una ${i.nombre} menos`}><Minus size={15} /></button>
                        <b className="w-7 text-center font-display text-xl">{n}</b>
                        <button onClick={() => cambiar(i.id, 1)} disabled={!faltan} className="grid h-9 w-9 place-items-center rounded-xl border border-gold/25 disabled:opacity-30" aria-label={`Una ${i.nombre} más`}><Plus size={15} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
              <button onClick={() => setVerTodos(!verTodos)} className="mt-2 text-xs text-smoke underline-offset-2 hover:text-ivory hover:underline">{verTodos ? 'Ver solo cervezas' : '¿No aparece? Ver todos los insumos por unidad'}</button>
            </section>
          ) : (
            <Campo etiqueta="El cliente elige entre" ayuda="Se muestran las de esa categoría del inventario con su existencia.">
              <Select value={catSurtido ?? ''} onChange={(e) => setCatSurtido(Number(e.target.value))}>
                {(catsInsumo.datos ?? []).map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Select>
            </Campo>
          )}

          {/* Nombre, precio y dónde sale */}
          <section className="grid gap-3 sm:grid-cols-3">
            <Campo etiqueta="Nombre en la carta" className="sm:col-span-3">
              <Input value={nombre} onChange={(e) => { setNombre(e.target.value); setNombreTocado(true); }} />
            </Campo>
            <Campo etiqueta={`Precio (${moneda})`} ayuda={modo === 'fija' && costo > 0 ? `Costo de las cervezas: ${dinero(costo, moneda)}${precio ? ` · ganancia ${dinero(precio - costo, moneda)}` : ''}` : undefined}>
              <InputNum valor={precio} onCambio={setPrecio} placeholder="0" className="!h-12 !text-xl" />
            </Campo>
            <Campo etiqueta="Sale en la categoría">
              <Select value={categoriaId ?? ''} onChange={(e) => setCategoriaId(Number(e.target.value))}>
                {(categorias.datos ?? []).filter((c) => c.activo).map((c) => <option key={c.id} value={c.id}>{c.icono ?? ''} {c.nombre}</option>)}
              </Select>
            </Campo>
            {modo === 'fija' && elegidas.length > 0 && (
              <div className="rounded-2xl border border-gold/15 bg-gold/5 p-3 text-sm">
                <p className="flex items-center gap-1.5 text-gold-light"><Sparkles size={14} /> Alcanza para</p>
                <p className={`font-display text-2xl ${alcanza < 3 ? 'text-red-300' : 'text-ivory'}`}>{alcanza} {alcanza === 1 ? 'tobo' : 'tobos'}</p>
                <p className="text-[11px] text-smoke">con lo que hay en inventario</p>
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  );
}
