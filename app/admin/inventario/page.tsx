'use client';

import { AlertTriangle, ClipboardCheck, PackagePlus, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CampoForm, type CampoCrud } from '@/components/admin/Crud';
import { useSesion } from '@/components/admin/Sesion';
import { Area, Boton, Campo, Cargando, Dato, Encabezado, ErrorCaja, Input, InputNum, Insignia, Interruptor, Modal, Pestanas, Select, Tabla, Tarjeta, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { dinero, fechaHora, numero } from '@/lib/admin/moneda';

type Insumo = {
  id: number; codigo: string; nombre: string; categoria_insumo_id: number | null; categoria: string | null; icono: string | null; unidad: 'und' | 'ml' | 'g';
  presentacion_compra: string | null; factor_compra: number; stock: number; stock_minimo: number; costo_unitario: number; moneda_costo: string;
  recargo_seleccion: number; activo: boolean; bajo: boolean; valor: number;
};
type CatInsumo = { id: number; nombre: string; icono: string | null };
type Mov = { id: number; fecha: string; insumo: string; unidad: string; tipo: string; cantidad: number; stock_resultante: number; proveedor: string | null; nota: string | null; usuario: string | null };

const TIPO_MOV: Record<string, { nombre: string; color: 'verde' | 'oro' | 'rojo' | 'azul' | 'gris' }> = {
  entrada: { nombre: 'Entrada', color: 'verde' }, venta: { nombre: 'Venta', color: 'gris' }, anulacion: { nombre: 'Anulación', color: 'azul' },
  ajuste: { nombre: 'Conteo', color: 'oro' }, merma: { nombre: 'Merma', color: 'rojo' }, consumo_interno: { nombre: 'Consumo interno', color: 'rojo' },
};

/** "234 und · 9,8 cajas" */
function stockLegible(i: Pick<Insumo, 'stock' | 'unidad' | 'factor_compra' | 'presentacion_compra'>) {
  const base = `${numero(i.stock, i.unidad === 'und' ? 0 : 0)} ${i.unidad}`;
  if (!i.presentacion_compra || i.factor_compra <= 1) return base;
  return `${base} · ${numero(i.stock / i.factor_compra, 1)} × ${i.presentacion_compra}`;
}

export default function InventarioPage() {
  const { es } = useSesion();
  const gestion = es('gerente');
  const [tab, setTab] = useState<'existencias' | 'kardex'>('existencias');
  const insumos = useDatos<Insumo[]>('/inventario/insumos');
  const cats = useDatos<CatInsumo[]>('/inventario/categorias');
  const kardex = useDatos<Mov[]>(tab === 'kardex' ? '/inventario/movimientos?limite=300' : null);
  const [cat, setCat] = useState<number | 'todas' | 'bajo'>('todas');
  const [q, setQ] = useState('');
  const [editar, setEditar] = useState<Record<string, any> | null>(null);
  const [mov, setMov] = useState<{ insumo: Insumo; tipo: 'entrada' | 'ajuste' | 'merma' | 'consumo_interno'; cantidad: number | null; en_presentacion: boolean; costo: number | null; proveedor: string; nota: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const avisos = useAvisos();

  const lista = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (insumos.datos ?? []).filter(
      (i) => (cat === 'todas' || (cat === 'bajo' ? i.bajo && i.activo : i.categoria_insumo_id === cat)) && (!n || `${i.nombre} ${i.codigo}`.toLowerCase().includes(n)),
    );
  }, [insumos.datos, cat, q]);

  const activos = (insumos.datos ?? []).filter((i) => i.activo);
  const bajos = activos.filter((i) => i.bajo).length;
  const valorTotal = activos.reduce((s, i) => s + (i.moneda_costo === 'COP' ? Number(i.valor) : 0), 0);

  const camposInsumo: CampoCrud[] = [
    { nombre: 'nombre', etiqueta: 'Nombre' },
    { nombre: 'codigo', etiqueta: 'Código', placeholder: 'Automático si lo dejas vacío' },
    { nombre: 'categoria_insumo_id', etiqueta: 'Categoría', tipo: 'select', opciones: (cats.datos ?? []).map((c) => ({ valor: c.id, etiqueta: `${c.icono ?? ''} ${c.nombre}` })) },
    { nombre: 'unidad', etiqueta: 'Unidad base', tipo: 'select', opciones: [{ valor: 'und', etiqueta: 'Unidades (cervezas, panes…)' }, { valor: 'ml', etiqueta: 'Mililitros (licores)' }, { valor: 'g', etiqueta: 'Gramos (cocina)' }], ayuda: 'En esta unidad se descuenta al vender.' },
    { nombre: 'presentacion_compra', etiqueta: 'Cómo se compra', placeholder: 'Caja x24, Botella 750 ml, Kilo…' },
    { nombre: 'factor_compra', etiqueta: 'Unidades base por compra', tipo: 'numero', ayuda: 'Caja x24 → 24 · Botella 750 ml → 750 · Kilo → 1000' },
    { nombre: 'stock_minimo', etiqueta: 'Stock mínimo (alerta)', tipo: 'numero' },
    { nombre: 'costo_unitario', etiqueta: 'Costo por unidad base', tipo: 'numero' },
    { nombre: 'moneda_costo', etiqueta: 'Moneda del costo', tipo: 'select', opciones: ['COP', 'USD', 'VES'].map((m) => ({ valor: m, etiqueta: m })) },
    { nombre: 'recargo_seleccion', etiqueta: 'Recargo en surtidos', tipo: 'numero', ayuda: 'Se suma al tobo cuando eligen esta opción (ej. importadas). En la moneda del producto.' },
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

  return (
    <div>
      <Encabezado titulo="Inventario" descripcion="Cada venta descuenta sola según la receta del producto. Aquí registras lo que entra, cuentas lo que hay y anotas las mermas.">
        <Pestanas valor={tab} onCambio={setTab} opciones={[{ valor: 'existencias', etiqueta: 'Existencias' }, { valor: 'kardex', etiqueta: 'Movimientos (kardex)' }]} />
        {gestion && <Boton variante="oro" onClick={() => setEditar({ nombre: '', codigo: '', categoria_insumo_id: cats.datos?.[0]?.id ?? null, unidad: 'und', presentacion_compra: '', factor_compra: 1, stock_minimo: 0, costo_unitario: 0, moneda_costo: 'COP', recargo_seleccion: 0, stock_inicial: 0, activo: true })}><Plus size={16} /> Nuevo insumo</Boton>}
      </Encabezado>

      {tab === 'existencias' && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Dato etiqueta="Insumos activos" valor={activos.length} />
            <Dato etiqueta="En stock bajo" valor={<span className={bajos ? 'text-red-300' : ''}>{bajos}</span>} sub={bajos ? 'Revisa y haz pedido' : 'Todo en orden'} />
            <Dato etiqueta="Valor del inventario" valor={dinero(valorTotal, 'COP')} sub="A costo, insumos en COP" acento />
            <Dato etiqueta="Cervezas disponibles" valor={numero(activos.filter((i) => i.categoria === 'Cervezas').reduce((s, i) => s + Number(i.stock), 0))} sub="Para tobos y venta suelta" />
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <label className="relative">
              <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-smoke" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar insumo…" className="w-52 pl-9" />
            </label>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              {[{ id: 'todas' as const, nombre: 'Todas' }, { id: 'bajo' as const, nombre: `⚠ Stock bajo (${bajos})` }, ...(cats.datos ?? []).map((c) => ({ id: c.id, nombre: `${c.icono ?? ''} ${c.nombre}` }))].map((c) => (
                <button key={c.id} onClick={() => setCat(c.id)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs whitespace-nowrap ${cat === c.id ? 'bg-gold font-semibold text-void' : 'border border-gold/15 text-smoke hover:text-ivory'}`}>{c.nombre}</button>
              ))}
            </div>
          </div>

          {insumos.cargando ? <Cargando /> : insumos.error ? <ErrorCaja mensaje={insumos.error} onReintentar={insumos.recargar} /> : (
            <Tabla<Insumo>
              filas={lista}
              clave={(i) => i.id}
              vacio="No hay insumos con ese filtro"
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
          )}
        </>
      )}

      {tab === 'kardex' && (
        kardex.cargando ? <Cargando /> : (
          <Tabla<Mov>
            filas={kardex.datos ?? []}
            clave={(m) => m.id}
            columnas={[
              { titulo: 'Fecha', celda: (m) => <span className="text-smoke">{fechaHora(m.fecha)}</span> },
              { titulo: 'Insumo', celda: (m) => m.insumo },
              { titulo: 'Tipo', celda: (m) => <Insignia color={TIPO_MOV[m.tipo]?.color}>{TIPO_MOV[m.tipo]?.nombre ?? m.tipo}</Insignia> },
              { titulo: 'Cantidad', celda: (m) => <span className={m.cantidad > 0 ? 'text-venom' : 'text-red-300'}>{m.cantidad > 0 ? '+' : ''}{numero(m.cantidad, 2)} {m.unidad}</span>, alinear: 'der' },
              { titulo: 'Queda', celda: (m) => `${numero(m.stock_resultante, 1)} ${m.unidad}`, alinear: 'der' },
              { titulo: 'Detalle', celda: (m) => <span className="text-xs text-smoke">{[m.proveedor, m.nota].filter(Boolean).join(' · ') || '—'}</span> },
              { titulo: 'Usuario', celda: (m) => <span className="text-smoke">{m.usuario ?? 'Sistema'}</span> },
            ]}
          />
        )
      )}

      {editar && (
        <Modal titulo={editar.id ? 'Editar insumo' : 'Nuevo insumo'} onCerrar={() => setEditar(null)} ancho="max-w-2xl"
          pie={<><Boton variante="sutil" onClick={() => setEditar(null)}>Cancelar</Boton><Boton variante="oro" cargando={ocupado} onClick={guardarInsumo}>Guardar</Boton></>}>
          <div className="grid gap-4 sm:grid-cols-2">
            {camposInsumo.filter((c) => !c.si || c.si(editar)).map((c) => <CampoForm key={c.nombre} campo={c} valor={editar[c.nombre]} onCambio={(v) => setEditar({ ...editar, [c.nombre]: v })} />)}
          </div>
        </Modal>
      )}

      {mov && (
        <Modal
          titulo={{ entrada: 'Registrar entrada', ajuste: 'Conteo físico', merma: 'Registrar merma', consumo_interno: 'Consumo interno' }[mov.tipo]}
          subtitulo={`${mov.insumo.nombre} · en sistema: ${stockLegible(mov.insumo)}`}
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
