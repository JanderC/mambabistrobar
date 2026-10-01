'use client';

import { ChevronDown, Plus, Search, Star, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CampoForm, Crud } from '@/components/admin/Crud';
import { Boton, Campo, Cargando, Encabezado, ErrorCaja, Input, InputNum, Insignia, Interruptor, Modal, Pestanas, Select, Tarjeta, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { agrupar, dinero } from '@/lib/admin/moneda';

type RecetaItem = { insumo_id: number | null; cantidad: number | null; removible: boolean; etiqueta: string | null; insumo?: string; unidad?: string };
type Variante = {
  id?: number; presentacion: string; precio: number | null; precio_manual_usd: number | null; precio_manual_cop: number | null; precio_manual_ves: number | null;
  seleccion_categoria_insumo_id: number | null; seleccion_cantidad: number | null; receta: RecetaItem[];
};
type Producto = {
  id?: number; nombre: string; categoria_id: number | null; categoria?: string; icono?: string; descripcion: string | null; ingredientes: string[]; etiquetas: string[];
  imagen_url: string | null; moneda_base: string; destacado: boolean; disponible: boolean; visible_web: boolean; visible_pos: boolean; orden: number; variantes: Variante[];
};
type Categoria = { id: number; nombre: string; descripcion: string | null; tipo: string; estacion: string; icono: string | null; orden: number; activo: boolean; productos: number };
type Adicional = { id: number; nombre: string; precio: number; moneda_base: string; precio_manual_usd: number | null; precio_manual_cop: number | null; precio_manual_ves: number | null; insumo_id: number | null; insumo: string | null; unidad: string | null; cantidad_insumo: number; orden: number; activo: boolean; categorias: number[] };
type Insumo = { id: number; nombre: string; unidad: string; activo: boolean };
type CatInsumo = { id: number; nombre: string };

const MONEDAS = ['COP', 'USD', 'VES'].map((m) => ({ valor: m, etiqueta: m }));
const varianteVacia = (): Variante => ({ presentacion: '', precio: null, precio_manual_usd: null, precio_manual_cop: null, precio_manual_ves: null, seleccion_categoria_insumo_id: null, seleccion_cantidad: null, receta: [] });

export default function ProductosPage() {
  const [tab, setTab] = useState<'productos' | 'categorias' | 'adicionales'>('productos');
  const categorias = useDatos<Categoria[]>('/catalogo/categorias');
  const insumos = useDatos<Insumo[]>('/inventario/insumos');
  const catsInsumo = useDatos<CatInsumo[]>('/inventario/categorias');
  const opCategorias = (categorias.datos ?? []).filter((c) => c.activo).map((c) => ({ valor: c.id, etiqueta: `${c.icono ?? ''} ${c.nombre}` }));
  const opInsumos = (insumos.datos ?? []).filter((i) => i.activo).map((i) => ({ valor: i.id, etiqueta: `${i.nombre} (${i.unidad})` }));

  return (
    <div>
      <Encabezado titulo="Productos" descripcion="La carta que se vende en el local y se muestra en la web: presentaciones, precios, recetas y adicionales.">
        <Pestanas valor={tab} onCambio={setTab} opciones={[{ valor: 'productos', etiqueta: 'Productos' }, { valor: 'adicionales', etiqueta: 'Adicionales' }, { valor: 'categorias', etiqueta: 'Categorías' }]} />
      </Encabezado>

      {tab === 'productos' && <ListaProductos categorias={categorias.datos ?? []} insumos={insumos.datos ?? []} catsInsumo={catsInsumo.datos ?? []} />}

      {tab === 'categorias' && (
        <Crud<Categoria>
          sinEncabezado titulo="Categoría" ruta="/catalogo/categorias" textoNuevo="Nueva categoría"
          nuevo={{ nombre: '', descripcion: '', tipo: 'bebida', estacion: 'barra', icono: '', orden: 10, activo: true }}
          columnas={[
            { titulo: 'Categoría', celda: (c) => <span className="font-medium">{c.icono} {c.nombre}</span> },
            { titulo: 'Se prepara en', celda: (c) => <Insignia color={c.estacion === 'cocina' ? 'oro' : 'verde'}>{c.estacion === 'cocina' ? '👨‍🍳 Cocina' : '🍸 Barra'}</Insignia> },
            { titulo: 'Productos', celda: (c) => c.productos, alinear: 'centro' },
            { titulo: 'Orden', celda: (c) => c.orden, alinear: 'centro' },
            { titulo: 'Estado', celda: (c) => (c.activo ? <Insignia color="verde">Activa</Insignia> : <Insignia color="rojo">Oculta</Insignia>) },
          ]}
          campos={[
            { nombre: 'nombre', etiqueta: 'Nombre' },
            { nombre: 'icono', etiqueta: 'Emoji', placeholder: '🍔' },
            { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: [{ valor: 'bebida', etiqueta: 'Bebida' }, { valor: 'comida', etiqueta: 'Comida' }, { valor: 'combo', etiqueta: 'Combo' }] },
            { nombre: 'estacion', etiqueta: 'Dónde se prepara', tipo: 'select', opciones: [{ valor: 'barra', etiqueta: 'Barra' }, { valor: 'cocina', etiqueta: 'Cocina' }], ayuda: 'A esa pantalla de comandas llegan sus pedidos.' },
            { nombre: 'descripcion', etiqueta: 'Descripción (web)', tipo: 'area' },
            { nombre: 'orden', etiqueta: 'Orden', tipo: 'numero' },
            { nombre: 'activo', etiqueta: 'Activa', tipo: 'si_no' },
          ]}
        />
      )}

      {tab === 'adicionales' && (
        <Crud<Adicional>
          sinEncabezado titulo="Adicional" ruta="/catalogo/adicionales" textoNuevo="Nuevo adicional"
          buscarEn={(a) => a.nombre}
          nuevo={{ nombre: '', precio: 0, moneda_base: 'COP', precio_manual_usd: null, precio_manual_cop: null, precio_manual_ves: null, insumo_id: null, cantidad_insumo: 1, orden: 10, activo: true, categorias: [] }}
          columnas={[
            { titulo: 'Adicional', celda: (a) => <span className="font-medium">{a.nombre}</span> },
            { titulo: 'Precio', celda: (a) => dinero(a.precio, a.moneda_base), alinear: 'der' },
            { titulo: 'Descuenta de inventario', celda: (a) => (a.insumo ? <span className="text-smoke">{a.cantidad_insumo} {a.unidad} de {a.insumo}</span> : <span className="text-smoke/60">No descuenta</span>) },
            { titulo: 'Se ofrece en', celda: (a) => <div className="flex flex-wrap gap-1">{a.categorias.map((id) => <Insignia key={id}>{categorias.datos?.find((c) => c.id === id)?.nombre ?? id}</Insignia>)}</div> },
            { titulo: 'Estado', celda: (a) => (a.activo ? <Insignia color="verde">Activo</Insignia> : <Insignia color="rojo">Inactivo</Insignia>) },
          ]}
          campos={[
            { nombre: 'nombre', etiqueta: 'Nombre', placeholder: 'Extra queso, carne adicional, shot extra…', ancho: true },
            { nombre: 'precio', etiqueta: 'Precio', tipo: 'numero' },
            { nombre: 'moneda_base', etiqueta: 'Moneda', tipo: 'select', opciones: MONEDAS },
            { nombre: 'categorias', etiqueta: 'Se ofrece en estas categorías', tipo: 'multi', opciones: opCategorias },
            { nombre: 'insumo_id', etiqueta: 'Insumo que descuenta', tipo: 'select', opciones: opInsumos, ayuda: 'Opcional' },
            { nombre: 'cantidad_insumo', etiqueta: 'Cantidad que descuenta', tipo: 'numero' },
            { nombre: 'orden', etiqueta: 'Orden', tipo: 'numero' },
            { nombre: 'activo', etiqueta: 'Activo', tipo: 'si_no' },
          ]}
        />
      )}
    </div>
  );
}

// ====================================================================== Lista + editor de productos
function ListaProductos({ categorias, insumos, catsInsumo }: { categorias: Categoria[]; insumos: Insumo[]; catsInsumo: CatInsumo[] }) {
  const { datos, cargando, error, recargar } = useDatos<Producto[]>('/catalogo/productos');
  const [q, setQ] = useState('');
  const [form, setForm] = useState<Producto | null>(null);
  const [abierta, setAbierta] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const avisos = useAvisos();

  const grupos = useMemo(() => {
    const n = q.trim().toLowerCase();
    return agrupar((datos ?? []).filter((p) => !n || p.nombre.toLowerCase().includes(n)), (p) => `${p.icono ?? ''} ${p.categoria}`);
  }, [datos, q]);

  const alternar = async (p: Producto, campo: 'disponible' | 'destacado') => {
    try {
      await adm(`/catalogo/productos/${p.id}`, { method: 'PATCH', body: { [campo]: !p[campo] } });
      recargar();
    } catch (e) {
      avisos.error(e);
    }
  };

  const guardar = async () => {
    if (!form) return;
    if (!form.categoria_id) return avisos.error('Elige la categoría');
    if (form.variantes.some((v) => !v.presentacion.trim() || v.precio == null)) return avisos.error('Cada presentación necesita nombre y precio');
    if (form.variantes.some((v) => v.receta.some((r) => !r.insumo_id || !r.cantidad))) return avisos.error('Completa el insumo y la cantidad en cada línea de receta');
    setGuardando(true);
    try {
      await adm(form.id ? `/catalogo/productos/${form.id}` : '/catalogo/productos', { method: form.id ? 'PUT' : 'POST', body: form });
      avisos.ok('Producto guardado');
      setForm(null);
      recargar();
    } catch (e) {
      avisos.error(e);
    } finally {
      setGuardando(false);
    }
  };

  const setV = (i: number, cambios: Partial<Variante>) => setForm((f) => f && { ...f, variantes: f.variantes.map((v, j) => (j === i ? { ...v, ...cambios } : v)) });
  const setR = (i: number, k: number, cambios: Partial<RecetaItem>) =>
    setForm((f) => f && { ...f, variantes: f.variantes.map((v, j) => (j === i ? { ...v, receta: v.receta.map((r, l) => (l === k ? { ...r, ...cambios } : r)) } : v)) });

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <label className="relative">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-smoke" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto…" className="w-60 pl-9" />
        </label>
        <Boton variante="oro" onClick={() => { setAbierta(0); setForm({ nombre: '', categoria_id: categorias[0]?.id ?? null, descripcion: '', ingredientes: [], etiquetas: [], imagen_url: '', moneda_base: 'COP', destacado: false, disponible: true, visible_web: true, visible_pos: true, orden: 10, variantes: [{ ...varianteVacia(), presentacion: 'Unidad' }] }); }}>
          <Plus size={16} /> Nuevo producto
        </Boton>
      </div>

      {cargando ? <Cargando /> : error ? <ErrorCaja mensaje={error} onReintentar={recargar} /> : (
        <div className="space-y-6">
          {grupos.map(([categoria, productos]) => (
            <section key={categoria}>
              <h2 className="mb-2 font-display text-lg text-gold-light">{categoria} <span className="text-sm text-smoke">· {productos.length}</span></h2>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {productos.map((p) => (
                  <Tarjeta key={p.id} className={`flex flex-col p-4 ${p.disponible ? '' : 'opacity-60'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <button className="min-w-0 text-left" onClick={() => { setAbierta(0); setForm(structuredClone(p)); }}>
                        <p className="truncate font-medium hover:text-gold">{p.nombre}</p>
                        <p className="line-clamp-1 text-xs text-smoke">{p.descripcion || 'Sin descripción'}</p>
                      </button>
                      <button onClick={() => alternar(p, 'destacado')} title="Destacar en la web" aria-label="Destacar">
                        <Star size={16} className={p.destacado ? 'fill-gold text-gold' : 'text-smoke/40 hover:text-gold'} />
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {p.variantes.map((v) => (
                        <span key={v.id} className="rounded-lg bg-void/60 px-2 py-1 text-xs ring-1 ring-gold/10">
                          <span className="text-smoke">{v.presentacion}</span> <b className="font-medium text-gold-light">{dinero(v.precio, p.moneda_base)}</b>
                          {v.seleccion_cantidad ? <span className="text-venom"> · surtido ×{v.seleccion_cantidad}</span> : null}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                      <Interruptor activo={p.disponible} onCambio={() => alternar(p, 'disponible')} etiqueta={<span className="text-xs">{p.disponible ? 'Disponible' : 'Agotado'}</span>} />
                      <span className="text-[11px] text-smoke">{p.variantes.some((v) => v.receta.length) ? `Receta: ${p.variantes.reduce((s, v) => s + v.receta.length, 0)} líneas` : 'Sin receta'}</span>
                    </div>
                  </Tarjeta>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {form && (
        <Modal titulo={form.id ? form.nombre : 'Nuevo producto'} subtitulo="Lo que cambies se refleja al instante en el POS y en el menú de la web." onCerrar={() => setForm(null)} ancho="max-w-4xl"
          pie={<><Boton variante="sutil" onClick={() => setForm(null)}>Cancelar</Boton><Boton variante="oro" cargando={guardando} onClick={guardar}>Guardar producto</Boton></>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoForm campo={{ nombre: 'nombre', etiqueta: 'Nombre' }} valor={form.nombre} onCambio={(v) => setForm({ ...form, nombre: v })} />
            <CampoForm campo={{ nombre: 'categoria_id', etiqueta: 'Categoría', tipo: 'select', opciones: categorias.filter((c) => c.activo).map((c) => ({ valor: c.id, etiqueta: `${c.icono ?? ''} ${c.nombre}` })) }} valor={form.categoria_id} onCambio={(v) => setForm({ ...form, categoria_id: v })} />
            <CampoForm campo={{ nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'area' }} valor={form.descripcion} onCambio={(v) => setForm({ ...form, descripcion: v })} />
            <CampoForm campo={{ nombre: 'moneda_base', etiqueta: 'Moneda de los precios', tipo: 'select', opciones: MONEDAS, ayuda: 'Las otras monedas se calculan con la tasa, salvo que fijes un precio.' }} valor={form.moneda_base} onCambio={(v) => setForm({ ...form, moneda_base: v })} />
            <CampoForm campo={{ nombre: 'orden', etiqueta: 'Orden en la categoría', tipo: 'numero' }} valor={form.orden} onCambio={(v) => setForm({ ...form, orden: v ?? 0 })} />
            <CampoForm campo={{ nombre: 'etiquetas', etiqueta: 'Etiquetas', tipo: 'lista', placeholder: 'premium, nuevo, picante, para compartir…' }} valor={form.etiquetas} onCambio={(v) => setForm({ ...form, etiquetas: v })} />
            <div className="flex flex-wrap gap-x-6 gap-y-2 sm:col-span-2">
              <Interruptor activo={form.disponible} onCambio={(v) => setForm({ ...form, disponible: v })} etiqueta="Disponible" />
              <Interruptor activo={form.visible_pos} onCambio={(v) => setForm({ ...form, visible_pos: v })} etiqueta="Se vende en el POS" />
              <Interruptor activo={form.visible_web} onCambio={(v) => setForm({ ...form, visible_web: v })} etiqueta="Se muestra en la web" />
              <Interruptor activo={form.destacado} onCambio={(v) => setForm({ ...form, destacado: v })} etiqueta="Destacado" />
            </div>
          </div>

          <div className="mt-6 mb-2 flex items-center justify-between">
            <h3 className="font-display text-base text-gold-light">Presentaciones y precios</h3>
            <Boton tam="sm" onClick={() => { setForm({ ...form, variantes: [...form.variantes, varianteVacia()] }); setAbierta(form.variantes.length); }}><Plus size={14} /> Presentación</Boton>
          </div>
          <div className="space-y-2">
            {form.variantes.map((v, i) => (
              <div key={v.id ?? `n${i}`} className="rounded-2xl border border-gold/15 bg-void/40">
                <div className="flex flex-wrap items-end gap-3 p-3">
                  <Campo etiqueta="Presentación" className="min-w-36 flex-1"><Input value={v.presentacion} onChange={(e) => setV(i, { presentacion: e.target.value })} placeholder="Botella, Media, Trago, Con papas…" /></Campo>
                  <Campo etiqueta={`Precio (${form.moneda_base})`} className="w-36"><InputNum valor={v.precio} onCambio={(n) => setV(i, { precio: n })} /></Campo>
                  <Boton tam="md" variante="sutil" onClick={() => setAbierta(abierta === i ? -1 : i)}>
                    Receta ({v.receta.length}){v.seleccion_cantidad ? ' · surtido' : ''} <ChevronDown size={15} className={`transition ${abierta === i ? 'rotate-180' : ''}`} />
                  </Boton>
                  {form.variantes.length > 1 && <Boton variante="peligro" onClick={() => setForm({ ...form, variantes: form.variantes.filter((_, j) => j !== i) })} aria-label="Quitar presentación"><Trash2 size={15} /></Boton>}
                </div>

                {abierta === i && (
                  <div className="space-y-5 border-t border-gold/10 p-3">
                    {/* Precios fijos */}
                    <div>
                      <p className="mb-2 text-xs text-smoke">Precio fijo por moneda <span className="text-smoke/60">(opcional: si lo dejas vacío se convierte con la tasa del día)</span></p>
                      <div className="grid grid-cols-3 gap-3">
                        {(['usd', 'cop', 'ves'] as const).filter((m) => m.toUpperCase() !== form.moneda_base).map((m) => (
                          <Campo key={m} etiqueta={`Fijo en ${m.toUpperCase()}`}>
                            <InputNum valor={v[`precio_manual_${m}`]} onCambio={(n) => setV(i, { [`precio_manual_${m}`]: n } as Partial<Variante>)} placeholder="Automático" />
                          </Campo>
                        ))}
                      </div>
                    </div>

                    {/* Receta */}
                    <div>
                      <p className="mb-2 text-xs text-smoke">
                        Receta: lo que se descuenta del inventario al vender una unidad. Marca <b className="text-ivory">“Se puede quitar”</b> en los ingredientes que el cliente puede pedir <i>sin</i>.
                      </p>
                      <div className="space-y-2">
                        {v.receta.map((r, k) => {
                          const ins = insumos.find((x) => x.id === r.insumo_id);
                          return (
                            <div key={k} className="grid grid-cols-[1fr_90px_auto] items-center gap-2 sm:grid-cols-[1.4fr_100px_1fr_auto_auto]">
                              <Select value={r.insumo_id ?? ''} onChange={(e) => setR(i, k, { insumo_id: e.target.value ? Number(e.target.value) : null })}>
                                <option value="">— Insumo —</option>
                                {insumos.filter((x) => x.activo || x.id === r.insumo_id).map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                              </Select>
                              <div className="relative">
                                <InputNum valor={r.cantidad} onCambio={(n) => setR(i, k, { cantidad: n })} className="pr-9" />
                                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-smoke">{ins?.unidad ?? ''}</span>
                              </div>
                              <Input className="col-span-2 sm:col-span-1" value={r.etiqueta ?? ''} onChange={(e) => setR(i, k, { etiqueta: e.target.value })} placeholder={r.removible ? 'Nombre que ve el cliente' : 'Etiqueta (opcional)'} />
                              <Interruptor activo={r.removible} onCambio={(b) => setR(i, k, { removible: b })} etiqueta={<span className="text-xs whitespace-nowrap">Se puede quitar</span>} />
                              <button onClick={() => setV(i, { receta: v.receta.filter((_, l) => l !== k) })} className="justify-self-end text-smoke hover:text-red-300" aria-label="Quitar línea"><Trash2 size={15} /></button>
                            </div>
                          );
                        })}
                      </div>
                      <Boton tam="sm" variante="sutil" className="mt-2" onClick={() => setV(i, { receta: [...v.receta, { insumo_id: null, cantidad: null, removible: false, etiqueta: '' }] })}><Plus size={14} /> Agregar insumo</Boton>
                    </div>

                    {/* Surtido */}
                    <div className="rounded-xl bg-emerald/20 p-3">
                      <p className="mb-2 text-xs text-smoke">
                        <b className="text-ivory">Surtido (tobos, baldes, combos):</b> al venderlo, el mesonero elige las unidades entre los insumos de una categoría del inventario y se descuenta exactamente lo elegido.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <Campo etiqueta="Elegir entre">
                          <Select value={v.seleccion_categoria_insumo_id ?? ''} onChange={(e) => setV(i, { seleccion_categoria_insumo_id: e.target.value ? Number(e.target.value) : null, seleccion_cantidad: e.target.value ? (v.seleccion_cantidad ?? 10) : null })}>
                            <option value="">— No es surtido —</option>
                            {catsInsumo.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </Select>
                        </Campo>
                        <Campo etiqueta="Cuántas unidades trae"><InputNum disabled={!v.seleccion_categoria_insumo_id} valor={v.seleccion_cantidad} onCambio={(n) => setV(i, { seleccion_cantidad: n })} /></Campo>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
