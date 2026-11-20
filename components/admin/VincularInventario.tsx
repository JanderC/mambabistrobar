'use client';

import { AlertTriangle, Link2, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Boton, InputNum, Select, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';

type Receta = { insumo_id: number; cantidad: number; removible: boolean; etiqueta: string | null };
type Variante = { id: number; presentacion: string; seleccion_categoria_insumo_id: number | null; receta: Receta[] } & Record<string, unknown>;
type Producto = { id: number; nombre: string; categoria?: string; disponible: boolean; variantes: Variante[] } & Record<string, unknown>;
type Insumo = { id: number; nombre: string; unidad: string; activo: boolean; stock: number };

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/** El insumo que se llama igual que el producto (Corona ↔ Corona, «Club Colombia Dorada»…) */
function sugerir(nombre: string, insumos: Insumo[]) {
  const n = norm(nombre);
  return insumos.find((i) => norm(i.nombre) === n) ?? insumos.find((i) => n.includes(norm(i.nombre)) && norm(i.nombre).length >= 4) ?? null;
}

/**
 * Inventario exacto: los productos sin receta no descuentan nada al venderse (nunca se agotan).
 * Aquí se vinculan con su insumo en un toque; los que se llaman igual se vinculan todos juntos.
 */
export function VincularInventario({ productos, onCambio }: { productos: Producto[]; onCambio: () => void }) {
  const avisos = useAvisos();
  const insumos = useDatos<Insumo[]>('/inventario/insumos');
  const activos = useMemo(() => (insumos.datos ?? []).filter((i) => i.activo), [insumos.datos]);
  const [abierto, setAbierto] = useState(false);
  const [eleccion, setEleccion] = useState<Record<string, { insumo: number | null; cantidad: number | null }>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Cada presentación sin receta ni surtido = no descuenta inventario
  const sinReceta = useMemo(() => productos.filter((p) => p.disponible).flatMap((p) =>
    p.variantes.filter((v) => !v.receta.length && !v.seleccion_categoria_insumo_id).map((v) => ({ p, v, clave: `${p.id}-${v.id}` }))), [productos]);
  const sugeridas = sinReceta.map((x) => ({ ...x, s: sugerir(x.p.nombre, activos) })).filter((x) => x.s);

  if (!sinReceta.length) return null;

  const guardar = async (lista: { p: Producto; v: Variante; insumo: number; cantidad: number }[], clave: string) => {
    setOcupado(clave);
    try {
      // Se agrupan por producto para guardar cada uno una sola vez
      const porProducto = new Map<number, { p: Producto; cambios: Map<number, Receta[]> }>();
      for (const x of lista) {
        const e = porProducto.get(x.p.id) ?? { p: x.p, cambios: new Map() };
        e.cambios.set(x.v.id, [{ insumo_id: x.insumo, cantidad: x.cantidad, removible: false, etiqueta: null }]);
        porProducto.set(x.p.id, e);
      }
      for (const { p, cambios } of porProducto.values()) {
        await adm(`/catalogo/productos/${p.id}`, { method: 'PUT', body: { ...p, variantes: p.variantes.map((v) => (cambios.has(v.id) ? { ...v, receta: cambios.get(v.id) } : v)) } });
      }
      avisos.ok(lista.length === 1 ? 'Vinculado: ya descuenta del inventario' : `${lista.length} productos vinculados al inventario`);
      onCambio();
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(null);
    }
  };

  return (
    <div className="mb-4 rounded-2xl border-2 border-orange-400/50 bg-orange-500/5 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle size={18} className="shrink-0 text-orange-300" />
        <p className="min-w-0 flex-1 text-sm">
          <b className="text-orange-200">{sinReceta.length} {sinReceta.length === 1 ? 'producto no descuenta' : 'productos no descuentan'} del inventario</b>
          <span className="text-smoke"> · sin receta nunca se agotan y el stock no cuadra</span>
        </p>
        {sugeridas.length > 0 && (
          <Boton variante="oro" tam="sm" cargando={ocupado === 'todas'} onClick={() => guardar(sugeridas.map((x) => ({ p: x.p, v: x.v, insumo: x.s!.id, cantidad: 1 })), 'todas')}>
            <Wand2 size={14} /> Vincular {sugeridas.length} por nombre
          </Boton>
        )}
        <Boton tam="sm" onClick={() => setAbierto(!abierto)}>{abierto ? 'Ocultar' : 'Ver y vincular'}</Boton>
      </div>
      {abierto && (
        <div className="mt-3 grid gap-1.5">
          {sinReceta.map(({ p, v, clave }) => {
            const sug = sugerir(p.nombre, activos);
            const e = eleccion[clave] ?? { insumo: sug?.id ?? null, cantidad: 1 };
            const ins = activos.find((i) => i.id === e.insumo);
            return (
              <div key={clave} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/5 bg-[#06140f] p-2 text-sm">
                <span className="min-w-40 flex-1 truncate">{p.nombre}{p.variantes.length > 1 && <span className="text-smoke"> · {v.presentacion}</span>} <span className="text-[11px] text-smoke">{p.categoria}</span></span>
                <span className="text-xs text-smoke">descuenta</span>
                <div className="w-20 shrink-0"><InputNum valor={e.cantidad} onCambio={(n) => setEleccion({ ...eleccion, [clave]: { ...e, cantidad: n } })} className="!h-9" /></div>
                <div className="w-56 shrink-0"><Select value={e.insumo ?? ''} onChange={(ev) => setEleccion({ ...eleccion, [clave]: { ...e, insumo: ev.target.value ? Number(ev.target.value) : null } })} className="!h-9">
                  <option value="">— elegir insumo —</option>
                  {activos.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>)}
                </Select></div>
                {ins && <span className="text-[11px] text-smoke">{ins.unidad}</span>}
                <Boton tam="sm" variante="borde" disabled={!e.insumo || !e.cantidad} cargando={ocupado === clave}
                  onClick={() => guardar([{ p, v, insumo: e.insumo!, cantidad: e.cantidad! }], clave)}><Link2 size={13} /> Vincular</Boton>
              </div>
            );
          })}
          <p className="text-[11px] text-smoke">Para recetas con varios insumos (hamburguesas, cócteles) usa «Receta» dentro del producto.</p>
        </div>
      )}
    </div>
  );
}
