'use client';

import { Check, ChefHat, Clock, Flame, Martini } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSesion } from '@/components/admin/Sesion';
import { Boton, Cargando, Encabezado, ErrorCaja, Pestanas, Vacio, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { agrupar, hace } from '@/lib/admin/moneda';

type Item = {
  id: number; cuenta_id: number; cuenta: string; tipo: string; nombre_cliente: string | null; mesa_numero: number | null; mesa_nombre: string | null; mesonero: string | null;
  nombre: string; presentacion: string | null; cantidad: number; asiento: number | null; notas: string | null; estado: 'pendiente' | 'preparando' | 'listo';
  estacion: 'barra' | 'cocina'; ronda: number; creado_en: string; modificadores: { tipo: 'sin' | 'adicional' | 'seleccion'; nombre: string; cantidad: number }[];
};

export default function ComandasPage() {
  const { usuario } = useSesion();
  const [estacion, setEstacion] = useState<'cocina' | 'barra' | 'todas'>(usuario?.rol === 'cocina' ? 'cocina' : usuario?.rol === 'barra' ? 'barra' : 'todas');
  const { datos, cargando, error, recargar } = useDatos<Item[]>(`/comandas${estacion === 'todas' ? '' : `?estacion=${estacion}`}`, 7000);
  const avisos = useAvisos();
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Una tarjeta por cuenta + ronda + estación (lo que salió junto, se prepara junto)
  const tickets = useMemo(() => agrupar(datos ?? [], (i) => `${i.cuenta_id}-${i.ronda}-${i.estacion}`), [datos]);

  const cambiar = async (ids: number[], estado: 'preparando' | 'listo' | 'entregado') => {
    try {
      await adm('/comandas/lote', { method: 'POST', body: { ids, estado } });
      recargar();
    } catch (e) {
      avisos.error(e);
    }
  };

  return (
    <div>
      <Encabezado titulo="Comandas" descripcion="Los pedidos aparecen aquí apenas el mesonero los envía. Se actualiza solo.">
        <Pestanas valor={estacion} onCambio={setEstacion} opciones={[
          { valor: 'todas', etiqueta: 'Todas' },
          { valor: 'cocina', etiqueta: <span className="flex items-center gap-1.5"><ChefHat size={15} /> Cocina</span>, cuenta: estacion === 'todas' ? datos?.filter((i) => i.estacion === 'cocina' && i.estado !== 'listo').length : undefined },
          { valor: 'barra', etiqueta: <span className="flex items-center gap-1.5"><Martini size={15} /> Barra</span>, cuenta: estacion === 'todas' ? datos?.filter((i) => i.estacion === 'barra' && i.estado !== 'listo').length : undefined },
        ]} />
      </Encabezado>

      {cargando ? <Cargando /> : error ? <ErrorCaja mensaje={error} onReintentar={recargar} /> : !tickets.length ? (
        <Vacio titulo="Nada por preparar 🎉">Cuando entre un pedido aparecerá aquí.</Vacio>
      ) : (
        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {tickets.map(([clave, items]) => {
            const p = items[0];
            const min = (Date.now() - new Date(p.creado_en).getTime()) / 60000;
            const todosListos = items.every((i) => i.estado === 'listo');
            const enMarcha = items.some((i) => i.estado === 'preparando');
            const urgencia = todosListos ? 'border-venom/60' : min > 15 ? 'border-red-400/70' : min > 8 ? 'border-gold/70' : 'border-gold/15';
            return (
              <article key={clave} className={`overflow-hidden rounded-2xl border-2 bg-[#06140f] ${urgencia}`}>
                <header className={`flex items-center justify-between px-4 py-2.5 ${todosListos ? 'bg-venom/15' : min > 15 ? 'bg-red-500/15' : 'bg-white/5'}`}>
                  <div>
                    <p className="font-display text-xl leading-none">
                      {p.mesa_numero ? (p.tipo === 'barra' || p.mesa_nombre?.startsWith('Barra') ? 'Barra' : `Mesa ${p.mesa_numero}`) : p.tipo === 'llevar' ? 'Para llevar' : 'Barra'}
                      {p.nombre_cliente && <span className="ml-2 text-sm text-smoke">{p.nombre_cliente}</span>}
                    </p>
                    <p className="mt-0.5 text-[11px] text-smoke">{p.cuenta} · ronda {p.ronda} · {p.mesonero}</p>
                  </div>
                  <div className="text-right">
                    <p className={`flex items-center gap-1 text-sm font-medium ${min > 15 ? 'text-red-300' : min > 8 ? 'text-gold-light' : 'text-smoke'}`}>
                      {min > 15 ? <Flame size={14} /> : <Clock size={14} />} {hace(p.creado_en)}
                    </p>
                    <p className="text-[10px] tracking-wider text-smoke uppercase">{p.estacion}</p>
                  </div>
                </header>

                <ul className="divide-y divide-white/5">
                  {items.map((i) => (
                    <li key={i.id} className={`flex gap-3 px-4 py-3 ${i.estado === 'listo' ? 'opacity-50' : ''}`}>
                      <span className="font-display text-2xl leading-none text-gold-light">{i.cantidad}×</span>
                      <div className="min-w-0 flex-1">
                        <p className="leading-tight font-medium">{i.nombre} {i.presentacion && <span className="text-sm font-normal text-smoke">· {i.presentacion}</span>}</p>
                        {i.asiento && <p className="text-xs text-smoke">Puesto {i.asiento}</p>}
                        <ul className="mt-1 space-y-0.5 text-sm">
                          {i.modificadores.map((m, k) => (
                            <li key={k} className={m.tipo === 'sin' ? 'font-semibold text-red-300 uppercase' : m.tipo === 'adicional' ? 'font-medium text-venom' : 'text-ivory/80'}>
                              {m.tipo === 'sin' ? `SIN ${m.nombre}` : m.tipo === 'adicional' ? `+ ${m.cantidad > 1 ? `${m.cantidad}× ` : ''}${m.nombre}` : `${m.cantidad} × ${m.nombre}`}
                            </li>
                          ))}
                        </ul>
                        {i.notas && <p className="mt-1 rounded-lg bg-gold/15 px-2 py-1 text-sm text-gold-light">📝 {i.notas}</p>}
                      </div>
                      {i.estado !== 'listo' && items.length > 1 && (
                        <button onClick={() => cambiar([i.id], 'listo')} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-venom/40 text-venom hover:bg-venom/20" aria-label="Marcar listo"><Check size={16} /></button>
                      )}
                    </li>
                  ))}
                </ul>

                <footer className="flex gap-2 p-3">
                  {todosListos ? (
                    <Boton variante="verde" className="flex-1" onClick={() => cambiar(items.map((i) => i.id), 'entregado')}>Entregado</Boton>
                  ) : (
                    <>
                      {!enMarcha && <Boton className="flex-1" onClick={() => cambiar(items.filter((i) => i.estado === 'pendiente').map((i) => i.id), 'preparando')}>Preparando</Boton>}
                      <Boton variante="oro" className="flex-1" onClick={() => cambiar(items.filter((i) => i.estado !== 'listo').map((i) => i.id), 'listo')}><Check size={16} /> Listo</Boton>
                    </>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
