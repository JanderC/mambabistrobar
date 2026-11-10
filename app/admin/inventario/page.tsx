'use client';

import { AlertTriangle, Beer, ChefHat, ClipboardCheck, PackagePlus, Pencil, Plus, Search, Trash2, Wine } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CampoForm, type CampoCrud } from '@/components/admin/Crud';
import { useSesion } from '@/components/admin/Sesion';
import { Area, Boton, Campo, Cargando, Dato, Encabezado, ErrorCaja, Input, InputNum, Interruptor, Modal, Pestanas, Select, Tabla, Vacio, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { type Moneda, dinero, numero } from '@/lib/admin/moneda';

type AreaInv = 'cocina' | 'barra' | 'general';

type Insumo = {
  id: number; codigo: string; nombre: string; categoria_insumo_id: number | null; categoria: string | null; icono: string | null; area: AreaInv;
  unidad: 'und' | 'ml' | 'g'; presentacion_compra: string | null; factor_compra: number; stock: number; stock_minimo: number; costo_unitario: number;
  moneda_costo: Moneda; recargo_seleccion: number; activo: boolean; bajo: boolean; valor: number;
};
type CatInsumo = { id: number; nombre: string; icono: string | null; area: AreaInv };

/** Las tres bolsas en las que el dueño invierte y controla el inventario */
const AREAS: { id: AreaInv; nombre: string; icono: typeof ChefHat; descripcion: string }[] = [
  { id: 'cocina', nombre: 'Cocina', icono: ChefHat, descripcion: 'Carnes, panes, papa, salsas y todo lo que se prepara en cocina.' },
  { id: 'barra', nombre: 'Barra', icono: Wine, descripcion: 'Licores, mixers y todo lo que se sirve en la barra.' },
  { id: 'general', nombre: 'Inventario general', icono: Beer, descripcion: 'Bodega: cervezas y lo que se compra y guarda por caja.' },
];
const AREA = Object.fromEntries(AREAS.map((a) => [a.id, a])) as Record<AreaInv, (typeof AREAS)[number]>;

/** "234 und · 9,8 cajas" */
function stockLegible(i: Pick<Insumo, 'stock' | 'unidad' | 'factor_compra' | 'presentacion_compra'>) {
  const base = `${numero(i.stock, 0)} ${i.unidad}`;
  if (!i.presentacion_compra || i.factor_compra <= 1) return base;
  return `${base} · ${numero(i.stock / i.factor_compra, 1)} × ${i.presentacion_compra}`;
}

export default function InventarioPage() {
  const { es } = useSesion();
  const gestion = es('gerente');
  const [area, setArea] = useState<AreaInv>('cocina');
  const insumos = useDatos<Insumo[]>('/inventario/insumos');
  const cats = useDatos<CatInsumo[]>('/inventario/categorias');
  const [cat, setCat] = useState<number | 'todas' | 'bajo'>('todas');
  const [q, setQ] = useState('');
  const [editar, setEditar] = useState<Record<string, any> | null>(null);
  const [mov, setMov] = useState<{ insumo: Insumo; tipo: 'entrada' | 'ajuste' | 'merma' | 'consumo_interno'; cantidad: number | null; en_presentacion: boolean; costo: number | null; proveedor: string; nota: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const avisos = useAvisos();

  const todos = insumos.datos ?? [];

  /** Lo invertido en cada área, a costo: la foto que se compara antes y después del fin de semana */
  const porArea = useMemo(
    () =>
      AREAS.map((a) => {
        const propios = todos.filter((i) => i.area === a.id && i.activo);
        return {
          ...a,
          insumos: propios.length,
          bajos: propios.filter((i) => i.bajo).length,
          agotados: propios.filter((i) => i.stock <= 0).length,
          valor: propios.reduce((s, i) => s + (i.moneda_costo === 'COP' ? Number(i.valor) : 0), 0),
        };
      }),
    [todos],
  );
  const invertidoTotal = porArea.reduce((s, a) => s + a.valor, 0);

  // Solo las categorías que tienen insumos en el área activa (más las declaradas de esa área)
  const catsArea = useMemo(() => {
    const conInsumos = new Set(todos.filter((i) => i.area === area).map((i) => i.categoria_insumo_id));
    return (cats.datos ?? []).filter((c) => c.area === area || conInsumos.has(c.id));
  }, [cats.datos, todos, area]);

  const lista = useMemo(() => {
    const n = q.trim().toLowerCase();
    return todos.filter(
      (i) =>
        i.area === area &&
        (cat === 'todas' || (cat === 'bajo' ? i.bajo && i.activo : i.categoria_insumo_id === cat)) &&
        (!n || `${i.nombre} ${i.codigo}`.toLowerCase().includes(n)),
    );
  }, [todos, area, cat, q]);

  const actual = porArea.find((a) => a.id === area)!;

  // Formulario corto para agregar rápido: el código lo genera el sistema; compra por caja y recargo en surtidos quedan con su valor por defecto
  const camposInsumo: CampoCrud[] = [
    { nombre: 'nombre', etiqueta: 'Nombre' },
    { nombre: 'area', etiqueta: 'Área del inventario', tipo: 'select', opciones: AREAS.map((a) => ({ valor: a.id, etiqueta: a.nombre })), ayuda: 'Cocina, barra o bodega general: define en qué bolsa entra la plata de este insumo.' },
    { nombre: 'categoria_insumo_id', etiqueta: 'Categoría', tipo: 'select', opciones: (cats.datos ?? []).map((c) => ({ valor: c.id, etiqueta: `${c.icono ?? ''} ${c.nombre} · ${AREA[c.area]?.nombre ?? c.area}` })) },
    { nombre: 'unidad', etiqueta: 'Unidad base', tipo: 'select', opciones: [{ valor: 'und', etiqueta: 'Unidades (cervezas, panes…)' }, { valor: 'ml', etiqueta: 'Mililitros (licores)' }, { valor: 'g', etiqueta: 'Gramos (cocina)' }], ayuda: 'En esta unidad se descuenta al vender.' },
    { nombre: 'stock_minimo', etiqueta: 'Stock mínimo (alerta)', tipo: 'numero' },
    { nombre: 'costo_unitario', etiqueta: 'Costo por unidad base', tipo: 'numero' },
    { nombre: 'moneda_costo', etiqueta: 'Moneda del costo', tipo: 'select', opciones: ['COP', 'USD', 'VES'].map((m) => ({ valor: m, etiqueta: m })) },
    { nombre: 'stock_inicial', etiqueta: 'Stock inicial', tipo: 'numero', si: (f) => !f.id },
    { nombre: 'activo', etiqueta: 'Activo', tipo: 'si_no' },
  ];

  const guardarInsumo = async () => {
    if (!editar) return;
    setOcupado(true);
    try {
      await adm(editar.id ? `/inventario/insumos/${editar.id}` : '/inventario/insumos', { method: editar.id ? 'PUT' : 'POST', body: { ...editar, stock_inicial: editar.stock_inicial ?? undefined } });
      avisos.ok('Insumo guardado');
      setEditar(null);
      insumos.recargar();
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(false);
    }
  };

  const guardarMov = async () => {
    if (!mov || mov.cantidad == null) return avisos.error('Escribe la cantidad');
    setOcupado(true);
    try {
      const r = await adm<{ stock: number; delta: number }>('/inventario/movimientos', {
        method: 'POST',
        body: { insumo_id: mov.insumo.id, tipo: mov.tipo, cantidad: mov.cantidad, en_presentacion: mov.en_presentacion, costo: mov.tipo === 'entrada' ? mov.costo : null, proveedor: mov.proveedor || null, nota: mov.nota || null },
      });
      avisos.ok(`${mov.insumo.nombre}: ${r.delta > 0 ? '+' : ''}${numero(r.delta, 2)} → quedan ${numero(r.stock, 1)} ${mov.insumo.unidad}`);
      setMov(null);
      insumos.recargar();
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(false);
    }
  };

  const abrirMov = (insumo: Insumo, tipo: NonNullable<typeof mov>['tipo']) =>
    setMov({ insumo, tipo, cantidad: null, en_presentacion: tipo === 'entrada' && insumo.factor_compra > 1, costo: null, proveedor: '', nota: '' });

  const nuevoInsumo = () =>
    setEditar({
      nombre: '', area, categoria_insumo_id: catsArea[0]?.id ?? cats.datos?.[0]?.id ?? null,
      unidad: area === 'cocina' ? 'g' : 'und', presentacion_compra: '', factor_compra: 1, stock_minimo: 0,
      costo_unitario: 0, moneda_costo: 'COP', recargo_seleccion: 0, stock_inicial: 0, activo: true,
    });

  return (
    <div>
      <Encabezado titulo="Inventario" descripcion="El inventario se maneja en tres bolsas separadas: cocina, barra y bodega general. Aquí registras lo que entra, cuentas lo que hay y anotas las mermas.">
        <Pestanas
          valor={area}
          onCambio={(v) => { setArea(v); setCat('todas'); }}
          opciones={porArea.map((a) => ({ valor: a.id, etiqueta: a.nombre, cuenta: a.insumos }))}
        />
        {gestion && <Boton variante="oro" onClick={nuevoInsumo}><Plus size={16} /> Nuevo insumo</Boton>}
      </Encabezado>

      {/* Lo invertido en cada bolsa: lo que el dueño compara antes y después del fin de semana */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {porArea.map((a) => {
          const Icono = a.icono;
          const activa = a.id === area;
          return (
            <button key={a.id} onClick={() => { setArea(a.id); setCat('todas'); }} className={`rounded-2xl border p-4 text-left transition ${activa ? 'border-gold bg-gold/10' : 'border-gold/15 hover:border-gold/40'}`}>
              <p className="flex items-center gap-1.5 text-[11px] tracking-wider text-smoke uppercase"><Icono size={13} className={activa ? 'text-gold' : ''} /> {a.nombre}</p>
              <p className={`mt-1 font-display text-2xl font-light ${activa ? 'text-gold-light' : 'text-ivory'}`}>{dinero(a.valor, 'COP')}</p>
              <p className="mt-0.5 text-xs text-smoke">{a.insumos} insumos{a.bajos > 0 && <span className="text-red-300"> · {a.bajos} bajo{a.bajos > 1 ? 's' : ''}</span>}</p>
            </button>
          );
        })}
        <Dato etiqueta="Inversión total" valor={dinero(invertidoTotal, 'COP')} sub="Suma de las tres bolsas, a costo" acento />
      </div>

      <p className="mb-3 text-sm text-smoke">{actual.descripcion}</p>

      <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-center">
        <label className="relative w-full xl:w-52 xl:shrink-0">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-smoke" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar insumo…" className="w-full pl-9" />
        </label>
        <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          {[{ id: 'todas' as const, nombre: 'Todas' }, { id: 'bajo' as const, nombre: `⚠ Stock bajo (${actual.bajos})` }, ...catsArea.map((c) => ({ id: c.id, nombre: `${c.icono ?? ''} ${c.nombre}` }))].map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} className={`shrink-0 rounded-full px-4 py-2.5 text-sm whitespace-nowrap xl:px-3 xl:py-1.5 xl:text-xs ${cat === c.id ? 'bg-gold font-semibold text-void' : 'border border-gold/15 text-smoke hover:text-ivory'}`}>{c.nombre}</button>
          ))}
        </div>
      </div>

      {insumos.cargando ? <Cargando /> : insumos.error ? <ErrorCaja mensaje={insumos.error} onReintentar={insumos.recargar} /> : (
        <>
        {/* Tablet y celular: tarjetas táctiles con botones grandes */}
        <div className="xl:hidden">
          {!lista.length ? <Vacio titulo={`Todavía no hay insumos cargados en ${actual.nombre.toLowerCase()}`} /> : (
            <div className="grid gap-3 sm:grid-cols-2">
              {lista.map((i) => {
                const estado = !i.activo ? null : i.stock <= 0 ? { t: 'Agotado', c: 'bg-red-500/15 text-red-300' } : i.bajo ? { t: 'Stock bajo', c: 'bg-gold/15 text-gold-light' } : null;
                return (
                  <div key={i.id} className={`flex flex-col rounded-2xl border bg-[#06140f]/90 p-4 ${i.stock <= 0 && i.activo ? 'border-red-400/30' : i.bajo && i.activo ? 'border-gold/30' : 'border-gold/10'} ${i.activo ? '' : 'opacity-60'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-ivory">{i.nombre}</p>
                        <p className="text-xs text-smoke">{i.codigo} · {i.categoria ?? 'Sin categoría'}{!i.activo && ' · inactivo'}</p>
                      </div>
                      {estado && <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${estado.c}`}><AlertTriangle size={12} /> {estado.t}</span>}
                      {gestion && <button onClick={() => setEditar({ ...i })} aria-label="Editar" className="-mt-1 -mr-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-smoke hover:bg-white/10 hover:text-ivory"><Pencil size={17} /></button>}
                    </div>

                    <p className={`mt-3 font-display text-2xl font-light ${i.stock <= 0 ? 'text-red-300' : i.bajo ? 'text-gold-light' : 'text-ivory'}`}>
                      {numero(i.stock, 0)} <span className="text-base text-smoke">{i.unidad}</span>
                    </p>
                    <p className="text-xs text-smoke">
                      {i.presentacion_compra && i.factor_compra > 1 && <>{numero(i.stock / i.factor_compra, 1)} × {i.presentacion_compra} · </>}
                      Mínimo {numero(i.stock_minimo)} {i.unidad}
                    </p>

                    <div className="mt-3 flex justify-between gap-2 border-t border-white/5 pt-3 text-xs text-smoke">
                      <span>Costo {dinero(i.costo_unitario * i.factor_compra, i.moneda_costo)}{i.factor_compra > 1 && ` / ${i.presentacion_compra}`}</span>
                      <span className="tabular-nums text-ivory">{dinero(i.valor, i.moneda_costo)}</span>
                    </div>

                    <div className="mt-3 grid auto-cols-fr grid-flow-col gap-2">
                      {gestion && <Boton variante="verde" className="h-12" onClick={() => abrirMov(i, 'entrada')}><PackagePlus size={17} /> Entrada</Boton>}
                      {gestion && <Boton className="h-12" onClick={() => abrirMov(i, 'ajuste')}><ClipboardCheck size={17} /> Conteo</Boton>}
                      <Boton variante="peligro" className="h-12" onClick={() => abrirMov(i, 'merma')}><Trash2 size={17} /> Merma</Boton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Escritorio: tabla completa */}
        <div className="hidden xl:block">
        <Tabla<Insumo>
          filas={lista}
          clave={(i) => i.id}
          vacio={`Todavía no hay insumos cargados en ${actual.nombre.toLowerCase()}`}
          columnas={[
            { titulo: 'Insumo', celda: (i) => (
              <div className={i.activo ? '' : 'opacity-50'}>
                <p className="flex items-center gap-2 font-medium">{i.bajo && i.activo && <AlertTriangle size={14} className="shrink-0 text-red-300" />}{i.nombre}</p>
                <p className="text-xs text-smoke">{i.codigo} · {i.categoria ?? 'Sin categoría'}{!i.activo && ' · inactivo'}</p>
              </div>
            ) },
            { titulo: 'Existencia', celda: (i) => (
              <div>
                <p className={`font-medium ${i.stock <= 0 ? 'text-red-300' : i.bajo ? 'text-gold-light' : 'text-ivory'}`}>{stockLegible(i)}</p>
                <p className="text-xs text-smoke">Mínimo {numero(i.stock_minimo)} {i.unidad}</p>
              </div>
            ) },
            { titulo: 'Costo', celda: (i) => <span className="text-smoke">{dinero(i.costo_unitario * i.factor_compra, i.moneda_costo)}{i.factor_compra > 1 && <span className="block text-[11px]">por {i.presentacion_compra}</span>}</span>, alinear: 'der' },
            { titulo: 'Valor', celda: (i) => dinero(i.valor, i.moneda_costo), alinear: 'der' },
            { titulo: '', alinear: 'der', celda: (i) => (
              <div className="flex justify-end gap-1">
                {gestion && <Boton tam="sm" variante="verde" onClick={() => abrirMov(i, 'entrada')} title="Registrar compra"><PackagePlus size={14} /> Entrada</Boton>}
                {gestion && <Boton tam="sm" onClick={() => abrirMov(i, 'ajuste')} title="Conteo físico"><ClipboardCheck size={14} /> Conteo</Boton>}
                <Boton tam="sm" variante="peligro" onClick={() => abrirMov(i, 'merma')} title="Botella rota, producto dañado…"><Trash2 size={14} /> Merma</Boton>
                {gestion && <Boton tam="sm" variante="sutil" onClick={() => setEditar({ ...i })} aria-label="Editar"><Pencil size={14} /></Boton>}
              </div>
            ) },
          ]}
        />
        </div>
        </>
      )}

      {editar && (
        <Modal titulo={editar.id ? 'Editar insumo' : `Nuevo insumo en ${AREA[editar.area as AreaInv]?.nombre ?? 'inventario'}`} onCerrar={() => setEditar(null)} ancho="max-w-2xl"
          pie={<><Boton variante="sutil" onClick={() => setEditar(null)}>Cancelar</Boton><Boton variante="oro" cargando={ocupado} onClick={guardarInsumo}>Guardar</Boton></>}>
          <div className="grid gap-4 sm:grid-cols-2">
            {camposInsumo.filter((c) => !c.si || c.si(editar)).map((c) => <CampoForm key={c.nombre} campo={c} valor={editar[c.nombre]} onCambio={(v) => setEditar({ ...editar, [c.nombre]: v })} />)}
          </div>
        </Modal>
      )}

      {mov && (
        <Modal
          titulo={{ entrada: 'Registrar entrada', ajuste: 'Conteo físico', merma: 'Registrar merma', consumo_interno: 'Consumo interno' }[mov.tipo]}
          subtitulo={`${mov.insumo.nombre} · ${AREA[mov.insumo.area]?.nombre} · en sistema: ${stockLegible(mov.insumo)}`}
          onCerrar={() => setMov(null)}
          ancho="max-w-md"
          pie={<><Boton variante="sutil" onClick={() => setMov(null)}>Cancelar</Boton><Boton variante="oro" cargando={ocupado} onClick={guardarMov}>Guardar</Boton></>}
        >
          <div className="space-y-4">
            {mov.tipo !== 'entrada' && mov.tipo !== 'ajuste' && (
              <Campo etiqueta="Motivo">
                <Select value={mov.tipo} onChange={(e) => setMov({ ...mov, tipo: e.target.value as 'merma' })}>
                  <option value="merma">Merma (se dañó, se rompió, venció)</option>
                  <option value="consumo_interno">Consumo interno (cortesía de la casa, personal)</option>
                </Select>
              </Campo>
            )}
            <Campo
              etiqueta={mov.tipo === 'ajuste' ? 'Cantidad real contada' : 'Cantidad'}
              ayuda={mov.tipo === 'ajuste' && mov.cantidad != null ? `Diferencia: ${numero(mov.cantidad * (mov.en_presentacion ? mov.insumo.factor_compra : 1) - mov.insumo.stock, 2)} ${mov.insumo.unidad}` : undefined}
            >
              <div className="flex gap-2">
                <InputNum autoFocus valor={mov.cantidad} onCambio={(v) => setMov({ ...mov, cantidad: v })} />
                <span className="grid shrink-0 place-items-center rounded-xl border border-gold/15 px-3 text-sm text-smoke">{mov.en_presentacion ? mov.insumo.presentacion_compra : mov.insumo.unidad}</span>
              </div>
            </Campo>
            {mov.insumo.factor_compra > 1 && (
              <Interruptor activo={mov.en_presentacion} onCambio={(v) => setMov({ ...mov, en_presentacion: v })} etiqueta={`Contar en "${mov.insumo.presentacion_compra}" (×${numero(mov.insumo.factor_compra)} ${mov.insumo.unidad})`} />
            )}
            {mov.tipo === 'entrada' && (
              <>
                <Campo etiqueta={`Costo por ${mov.en_presentacion ? mov.insumo.presentacion_compra : mov.insumo.unidad} (${mov.insumo.moneda_costo})`} ayuda="Opcional. Actualiza el costo promedio.">
                  <InputNum valor={mov.costo} onCambio={(v) => setMov({ ...mov, costo: v })} placeholder={String(Math.round(mov.insumo.costo_unitario * (mov.en_presentacion ? mov.insumo.factor_compra : 1)))} />
                </Campo>
                <Campo etiqueta="Proveedor"><Input value={mov.proveedor} onChange={(e) => setMov({ ...mov, proveedor: e.target.value })} /></Campo>
              </>
            )}
            <Campo etiqueta="Nota"><Area rows={2} value={mov.nota} onChange={(e) => setMov({ ...mov, nota: e.target.value })} placeholder={mov.tipo === 'merma' ? 'Se cayó una caja…' : ''} /></Campo>
          </div>
        </Modal>
      )}
    </div>
  );
}
