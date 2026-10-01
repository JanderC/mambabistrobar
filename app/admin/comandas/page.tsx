'use client';

import { Check, ChefHat, Clock, Flame, Martini, Maximize2, User, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSesion } from '@/components/admin/Sesion';
import { Boton, Cargando, Encabezado, ErrorCaja, Pestanas, Vacio, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { agrupar, hace } from '@/lib/admin/moneda';
import { setSonido, sonar, sonidoActivo, useVivo } from '@/lib/admin/vivo';

type Item = {
  id: number; cuenta_id: number; cuenta: string; tipo: string; nombre_cliente: string | null; puesto: number | null; mesa_numero: number | null; mesa_nombre: string | null;
  mesa_tipo: string | null; zona: string | null; mesonero: string | null;
  nombre: string; presentacion: string | null; cantidad: number; asiento: number | null; notas: string | null; estado: 'pendiente' | 'preparando' | 'listo';
  estacion: 'barra' | 'cocina'; ronda: number; creado_en: string; modificadores: { tipo: 'sin' | 'adicional' | 'seleccion'; nombre: string; cantidad: number }[];
};

const lugar = (p: Item) => (p.mesa_tipo === 'barra' || (p.tipo === 'barra' && !p.mesa_numero) ? `Barra${p.puesto ? ` · ${p.puesto}` : ''}` : p.tipo === 'llevar' ? 'Para llevar' : `Mesa ${p.mesa_numero}`);

export default function ComandasPage() {
  const { usuario } = useSesion();
  const [estacion, setEstacion] = useState<'cocina' | 'barra' | 'todas'>(usuario?.rol === 'cocina' ? 'cocina' : usuario?.rol === 'barra' ? 'barra' : 'todas');
  const { datos, cargando, error, recargar } = useDatos<Item[]>(`/comandas${estacion === 'todas' ? '' : `?estacion=${estacion}`}`, 30_000);
  const avisos = useAvisos();
  const [sonido, setSon] = useState(true);
  const [recientes, setRecientes] = useState<Set<number>>(new Set());
  const [, tick] = useState(0);

  useEffect(() => setSon(sonidoActivo()), []);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // El pedido entra en el mismo instante en que el mesonero lo envía desde la tablet
  useVivo((e) => {
    if (e.tipo === 'pedido') {
      if (e.directo || (estacion !== 'todas' && !e.estaciones.includes(estacion))) return;
      sonar('pedido');
      setRecientes((r) => new Set(r).add(e.cuenta_id));
      setTimeout(() => setRecientes((r) => { const n = new Set(r); n.delete(e.cuenta_id); return n; }), 8000);
      recargar();
    } else recargar();
  });

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

  const alternarSonido = () => {
    setSonido(!sonido);
    setSon(!sonido);
    if (!sonido) setTimeout(() => sonar('pedido'), 50);
  };

  return (
    <div>
      <Encabezado titulo="Comandas" descripcion="Cada pedido entra al instante con su mesa, el cliente y quién lo tomó. Al marcarlo listo, el mesonero recibe el aviso en su tablet.">
        <Boton onClick={alternarSonido} title={sonido ? 'Silenciar avisos' : 'Activar avisos sonoros'} aria-label="Sonido">{sonido ? <Volume2 size={16} /> : <VolumeX size={16} className="text-red-300" />}</Boton>
        <Boton onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} title="Pantalla completa" aria-label="Pantalla completa"><Maximize2 size={16} /></Boton>
        <Pestanas valor={estacion} onCambio={setEstacion} opciones={[
          { valor: 'todas', etiqueta: 'Todas' },
          { valor: 'cocina', etiqueta: <span className="flex items-center gap-1.5"><ChefHat size={15} /> Cocina</span>, cuenta: estacion === 'todas' ? datos?.filter((i) => i.estacion === 'cocina' && i.estado !== 'listo').length : undefined },
          { valor: 'barra', etiqueta: <span className="flex items-center gap-1.5"><Martini size={15} /> Barra</span>, cuenta: estacion === 'todas' ? datos?.filter((i) => i.estacion === 'barra' && i.estado !== 'listo').length : undefined },
        ]} />
      </Encabezado>

      {cargando ? <Cargando /> : error ? <ErrorCaja mensaje={error} onReintentar={recargar} /> : !tickets.length ? (
        <Vacio titulo="Nada por preparar 🎉">Cuando un mesonero envíe un pedido aparecerá aquí al instante.</Vacio>
      ) : (
        <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {tickets.map(([clave, items]) => {
            const p = items[0];
            const min = (Date.now() - new Date(p.creado_en).getTime()) / 60000;
            const todosListos = items.every((i) => i.estado === 'listo');
            const enMarcha = items.some((i) => i.estado === 'preparando');
            const nuevo = recientes.has(p.cuenta_id) && items.some((i) => i.estado === 'pendiente') && min < 0.5;
            const borde = nuevo ? 'border-venom shadow-[0_0_50px_-8px_rgba(61,255,176,.8)]' : todosListos ? 'border-venom/60' : min > 15 ? 'border-red-400/70' : min > 8 ? 'border-gold/70' : 'border-gold/15';
            return (
              <article key={clave} className={`overflow-hidden rounded-2xl border-2 bg-[#06140f] transition-all duration-500 ${borde}`}>
                <header className={`px-4 py-3 ${todosListos ? 'bg-venom/15' : min > 15 ? 'bg-red-500/15' : p.estacion === 'cocina' ? 'bg-gold/10' : 'bg-emerald/50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex items-center gap-2 font-display text-3xl leading-none font-light">{lugar(p)}{nuevo && <span className="animate-bounce rounded-full bg-venom px-2 py-0.5 font-body text-[10px] font-bold tracking-wider text-void">NUEVO</span>}</p>
                    <p className={`flex shrink-0 items-center gap-1 text-sm font-medium ${min > 15 ? 'text-red-300' : min > 8 ? 'text-gold-light' : 'text-smoke'}`}>
                      {min > 15 ? <Flame size={14} /> : <Clock size={14} />} {hace(p.creado_en)}
                    </p>
                  </div>
                  {p.nombre_cliente && <p className="mt-1.5 flex items-center gap-1.5 text-lg leading-tight font-medium text-gold-light"><User size={16} className="shrink-0" /> {p.nombre_cliente}</p>}
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-smoke">
                    <span className="flex items-center gap-1 tracking-wider uppercase">{p.estacion === 'cocina' ? <ChefHat size={12} /> : <Martini size={12} />} {p.estacion}</span>
                    <span>·</span><span>Tomó: <b className="font-medium text-ivory/90">{p.mesonero ?? '—'}</b></span>
                    <span>·</span><span>{p.cuenta} · ronda {p.ronda}</span>{p.zona && <><span>·</span><span>{p.zona}</span></>}
                  </p>
                </header>

                <ul className="divide-y divide-white/5">
                  {items.map((i) => (
                    <li key={i.id} className={`flex gap-3 px-4 py-3 ${i.estado === 'listo' ? 'opacity-50' : ''}`}>
                      <span className="font-display text-3xl leading-none text-gold-light">{i.cantidad}×</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-lg leading-tight font-medium">{i.nombre} {i.presentacion && <span className="text-sm font-normal text-smoke">· {i.presentacion}</span>}</p>
                        {i.asiento && <p className="text-xs text-smoke">Puesto {i.asiento}</p>}
                        <ul className="mt-1 space-y-0.5">
                          {i.modificadores.map((m, k) => (
                            <li key={k} className={m.tipo === 'sin' ? 'font-bold text-red-300 uppercase' : m.tipo === 'adicional' ? 'font-medium text-venom' : 'text-ivory/90'}>
                              {m.tipo === 'sin' ? `SIN ${m.nombre}` : m.tipo === 'adicional' ? `+ ${m.cantidad > 1 ? `${m.cantidad}× ` : ''}${m.nombre}` : `${m.cantidad} × ${m.nombre}`}
                            </li>
                          ))}
                        </ul>
                        {i.notas && <p className="mt-1 rounded-lg bg-gold/15 px-2 py-1 text-sm text-gold-light">📝 {i.notas}</p>}
                      </div>
                      {i.estado !== 'listo' && items.length > 1 && (
                        <button onClick={() => cambiar([i.id], 'listo')} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-venom/40 text-venom hover:bg-venom/20" aria-label="Marcar listo"><Check size={18} /></button>
                      )}
                    </li>
                  ))}
                </ul>

                <footer className="flex gap-2 p-3">
                  {todosListos ? (
                    <Boton variante="verde" tam="lg" className="flex-1" onClick={() => cambiar(items.map((i) => i.id), 'entregado')}>Entregado al mesonero</Boton>
                  ) : (
                    <>
                      {!enMarcha && <Boton tam="lg" className="flex-1" onClick={() => cambiar(items.filter((i) => i.estado === 'pendiente').map((i) => i.id), 'preparando')}>Preparando</Boton>}
                      <Boton variante="oro" tam="lg" className="flex-1" onClick={() => cambiar(items.filter((i) => i.estado !== 'listo').map((i) => i.id), 'listo')}><Check size={18} /> Listo</Boton>
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
