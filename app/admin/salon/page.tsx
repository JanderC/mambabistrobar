'use client';

import { BellRing, CalendarCheck, Clock, Move, Plus, Save, ShoppingBag, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSesion } from '@/components/admin/Sesion';
import { Boton, Campo, Cargando, Encabezado, ErrorCaja, Input, InputNum, Insignia, Modal, Tarjeta, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { type Moneda, dinero, hace } from '@/lib/admin/moneda';
import { useVivo } from '@/lib/admin/vivo';

type CuentaMesa = { id: number; numero: string; mesa_id: number | null; asiento: number | null; tipo: string; personas: number; nombre_cliente: string | null; total: number; pagado: number; moneda: Moneda; abierta_en: string; mesonero: string | null; pendientes: number; listos: number; cobro_solicitado_en: string | null };
type ReservaMesa = { id: string; codigo: string; nombre_completo: string; hora: string; personas: number; estado: string; mesa_id: number | null; zona_id: number };
type Mesa = { id: number; zona_id: number; numero: number; nombre: string | null; tipo: 'mesa' | 'barra' | 'vip'; forma: string; capacidad: number; pos_x: number; pos_y: number; cuentas: CuentaMesa[]; reservas: ReservaMesa[] };
type Zona = { id: number; slug: string; nombre: string; color: string; es_vip: boolean; mesas: Mesa[] };
type Salon = { aforo: { actual: number; maximo: number; en_puerta: number; con_cuenta: number }; zonas: Zona[]; sin_mesa: CuentaMesa[]; reservas_sin_mesa: ReservaMesa[] };

export default function SalonPage() {
  const router = useRouter();
  const { es } = useSesion();
  const { datos, cargando, error, recargar } = useDatos<Salon>('/salon', 30_000);
  useVivo(() => recargar()); // el plano se actualiza al instante con cada pedido, comanda o cobro
  const [zonaId, setZonaId] = useState<number | null>(null);
  const [mesaSel, setMesaSel] = useState<number | null>(null);
  const [puesto, setPuesto] = useState<number | null>(null);
  const [editando, setEditando] = useState(false);
  const [posiciones, setPosiciones] = useState<Record<number, { pos_x: number; pos_y: number }>>({});
  const [nueva, setNueva] = useState<{ personas: number | null; nombre: string }>({ personas: 2, nombre: '' });
  const [ocupado, setOcupado] = useState(false);
  const avisos = useAvisos();
  const lienzo = useRef<HTMLDivElement>(null);
  const arrastre = useRef<number | null>(null);

  // Zona inicial y atajo ?mesa=12 (desde el buscador)
  useEffect(() => {
    if (!datos || zonaId) return;
    const n = Number(new URLSearchParams(location.search).get('mesa'));
    const destino = n ? datos.zonas.flatMap((z) => z.mesas).find((m) => m.numero === n) : null;
    if (destino) {
      setZonaId(destino.zona_id);
      setMesaSel(destino.id);
    } else setZonaId((datos.zonas.find((z) => z.mesas.some((m) => m.tipo !== 'barra')) ?? datos.zonas.find((z) => z.mesas.length))?.id ?? null);
  }, [datos, zonaId]);

  const zona = datos?.zonas.find((z) => z.id === zonaId);
  const mesas = useMemo(() => (zona?.mesas ?? []).map((m) => ({ ...m, ...(posiciones[m.id] ?? {}) })), [zona, posiciones]);
  const mesa = datos?.zonas.flatMap((z) => z.mesas).find((m) => m.id === mesaSel);

  const abrir = async (m: Mesa, asiento: number | null = null) => {
    setOcupado(true);
    try {
      const esBarra = m.tipo === 'barra';
      const c = await adm<{ id: number }>('/cuentas', {
        method: 'POST',
        body: { tipo: esBarra ? 'barra' : 'mesa', mesa_id: m.id, asiento, personas: esBarra ? 1 : Math.max(1, nueva.personas ?? 1), nombre_cliente: nueva.nombre || null },
      });
      router.push(`/admin/cuenta/${c.id}`);
    } catch (e) {
      avisos.error(e);
      setOcupado(false);
    }
  };

  const sentar = async (r: ReservaMesa, m: Mesa) => {
    setOcupado(true);
    try {
      const { cuenta_id } = await adm<{ cuenta_id: number }>(`/reservas/${r.id}/sentar`, { method: 'POST', body: { mesa_id: m.id } });
      router.push(`/admin/cuenta/${cuenta_id}`);
    } catch (e) {
      avisos.error(e);
      setOcupado(false);
    }
  };

  const paraLlevar = async () => {
    try {
      const c = await adm<{ id: number }>('/cuentas', { method: 'POST', body: { tipo: 'llevar', personas: 1 } });
      router.push(`/admin/cuenta/${c.id}`);
    } catch (e) {
      avisos.error(e);
    }
  };

  // ---- Edición del plano (arrastrar)
  const mover = (e: React.PointerEvent) => {
    if (arrastre.current == null || !lienzo.current) return;
    const r = lienzo.current.getBoundingClientRect();
    const x = Math.min(96, Math.max(4, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.min(94, Math.max(6, ((e.clientY - r.top) / r.height) * 100));
    setPosiciones((p) => ({ ...p, [arrastre.current!]: { pos_x: Math.round(x * 2) / 2, pos_y: Math.round(y * 2) / 2 } }));
  };
  const guardarPlano = async () => {
    setOcupado(true);
    try {
      await adm('/salon/plano', { method: 'PUT', body: Object.entries(posiciones).map(([id, p]) => ({ id: Number(id), ...p })) });
      avisos.ok('Plano guardado');
      setPosiciones({});
      setEditando(false);
      recargar();
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(false);
    }
  };

  if (cargando) return <Cargando />;
  if (error || !datos) return <ErrorCaja mensaje={error ?? 'Sin datos'} onReintentar={recargar} />;

  const ocupadas = (z: Zona) => z.mesas.filter((m) => m.cuentas.length).length;
  const pct = Math.min(100, (datos.aforo.actual / datos.aforo.maximo) * 100);

  return (
    <div>
      <Encabezado titulo="Salón" descripcion="Toca una mesa para abrir su cuenta o seguir tomando el pedido.">
        <Boton onClick={paraLlevar}><ShoppingBag size={15} /> Para llevar</Boton>
        {es('gerente') && (editando ? (
          <>
            <Boton variante="sutil" onClick={() => { setEditando(false); setPosiciones({}); }}>Cancelar</Boton>
            <Boton variante="oro" cargando={ocupado} onClick={guardarPlano}><Save size={15} /> Guardar plano</Boton>
          </>
        ) : <Boton onClick={() => setEditando(true)}><Move size={15} /> Mover mesas</Boton>)}
      </Encabezado>

      {/* Aforo + zonas */}
      <div className="mb-4 grid gap-3 lg:grid-cols-[260px_1fr]">
        <Tarjeta className="p-4">
          <p className="flex items-center gap-2 text-[11px] tracking-wider text-smoke uppercase"><Users size={13} /> Aforo</p>
          <p className="font-display text-3xl font-light">{datos.aforo.actual}<span className="text-base text-smoke"> / {datos.aforo.maximo}</span></p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-gold' : 'bg-venom'}`} style={{ width: `${pct}%` }} /></div>
          <p className="mt-1.5 text-[11px] text-smoke">{datos.aforo.con_cuenta} sentados con cuenta · cuenta la puerta desde la barra superior</p>
        </Tarjeta>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {datos.zonas.filter((z) => z.mesas.length).map((z) => {
            const puestos = z.mesas.reduce((s, m) => s + m.capacidad, 0);
            const sentados = z.mesas.reduce((s, m) => s + m.cuentas.reduce((x, c) => x + c.personas, 0), 0);
            return (
              <button key={z.id} onClick={() => setZonaId(z.id)}
                className={`min-w-40 shrink-0 rounded-2xl border p-4 text-left transition ${zonaId === z.id ? 'bg-white/5' : 'border-gold/10 hover:border-gold/30'}`}
                style={zonaId === z.id ? { borderColor: z.color } : undefined}>
                <p className="flex items-center gap-2 text-sm font-medium"><span className="h-2.5 w-2.5 rounded-full" style={{ background: z.color }} />{z.nombre}</p>
                <p className="mt-1 font-display text-2xl font-light">{z.mesas[0].tipo === 'barra' ? z.mesas.reduce((s, m) => s + m.cuentas.length, 0) : ocupadas(z)}<span className="text-sm text-smoke"> / {z.mesas[0].tipo === 'barra' ? puestos : z.mesas.length} {z.mesas[0].tipo === 'barra' ? 'puestos' : 'mesas'}</span></p>
                <p className="text-[11px] text-smoke">{sentados} de {puestos} personas</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Plano */}
      {zona && (
        <Tarjeta className="relative overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-gold/10 px-4 py-2.5 text-[11px] text-smoke">
            <span className="font-display text-sm text-ivory">{zona.nombre}</span>
            <Leyenda color="border-smoke/40" texto="Libre" />
            <Leyenda color="border-venom bg-emerald" texto="Ocupada" />
            <Leyenda color="border-gold bg-gold/30" texto="Pedido listo para llevar" />
            <Leyenda color="border-sky-400 bg-sky-400/30" texto="Pidió la cuenta (en caja)" />
            <Leyenda color="border-dashed border-sky-400" texto="Reservada hoy" />
            {editando && <span className="ml-auto text-gold">Arrastra las mesas y guarda</span>}
          </div>
          <div className="overflow-x-auto">
          <div
            ref={lienzo}
            onPointerMove={editando ? mover : undefined}
            onPointerUp={() => (arrastre.current = null)}
            onPointerLeave={() => (arrastre.current = null)}
            className={`relative h-[max(640px,calc(100dvh-390px))] min-w-[760px] overflow-hidden ${editando ? 'touch-none' : ''} bg-[radial-gradient(circle,rgba(212,175,55,.07)_1px,transparent_1px)] [background-size:28px_28px]`}
          >
            {mesas.map((m) => (
              <div
                key={m.id}
                className={`absolute -translate-x-1/2 -translate-y-1/2 ${editando ? 'cursor-grab active:cursor-grabbing' : ''}`}
                style={{ left: `${m.pos_x}%`, top: `${m.pos_y}%` }}
                onPointerDown={editando ? (e) => { arrastre.current = m.id; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); } : undefined}
              >
                {m.tipo === 'barra'
                  ? <BarraNodo mesa={m} onPuesto={(n, cuenta) => (editando ? null : cuenta ? router.push(`/admin/cuenta/${cuenta.id}`) : (setMesaSel(m.id), setPuesto(n)))} />
                  : <MesaNodo mesa={m} color={zona.color} onClick={() => !editando && (setMesaSel(m.id), setPuesto(null))} />}
              </div>
            ))}
          </div>
          </div>
        </Tarjeta>
      )}

      {/* Cuentas sin mesa y reservas por ubicar */}
      {(datos.sin_mesa.length > 0 || datos.reservas_sin_mesa.length > 0) && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {datos.sin_mesa.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-medium text-smoke">Cuentas sin mesa (barra libre / para llevar)</h2>
              <div className="flex flex-wrap gap-2">
                {datos.sin_mesa.map((c) => (
                  <button key={c.id} onClick={() => router.push(`/admin/cuenta/${c.id}`)} className="rounded-xl border border-venom/30 bg-emerald/30 px-3 py-2 text-left text-sm hover:border-venom">
                    <b className="font-medium">{c.nombre_cliente ?? c.numero}</b> <span className="text-xs text-smoke">· {c.tipo === 'llevar' ? 'para llevar' : 'barra'}</span>
                    <span className="block text-xs text-gold-light">{dinero(c.total - c.pagado, c.moneda)} por cobrar</span>
                  </button>
                ))}
              </div>
            </section>
          )}
          {datos.reservas_sin_mesa.length > 0 && (
            <section>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-smoke"><CalendarCheck size={15} /> Reservas de hoy sin mesa asignada</h2>
              <div className="flex flex-wrap gap-2">
                {datos.reservas_sin_mesa.map((r) => (
                  <button key={r.id} onClick={() => router.push('/admin/reservas')} className="rounded-xl border border-dashed border-sky-400/50 px-3 py-2 text-left text-sm hover:bg-sky-400/10">
                    <b className="font-medium">{r.hora}</b> {r.nombre_completo} <span className="text-xs text-smoke">· {r.personas} pers.</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Detalle de mesa */}
      {mesa && (
        <Modal
          titulo={mesa.tipo === 'barra' ? `${mesa.nombre ?? 'Barra'}${puesto ? ` · puesto B-${String(puesto).padStart(2, '0')}` : ''}` : `Mesa ${mesa.numero}${mesa.nombre ? ` · ${mesa.nombre}` : ''}`}
          subtitulo={`${datos.zonas.find((z) => z.id === mesa.zona_id)?.nombre} · ${mesa.capacidad} puestos numerados (${mesa.tipo === 'barra' ? 'B-01' : `M${mesa.numero}-1`} … ${mesa.tipo === 'barra' ? `B-${mesa.capacidad}` : `M${mesa.numero}-${mesa.capacidad}`})`}
          onCerrar={() => setMesaSel(null)}
        >
          <div className="space-y-5">
            {mesa.cuentas.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs tracking-wider text-gold uppercase">Cuentas abiertas</h3>
                <div className="space-y-2">
                  {mesa.cuentas.map((c) => (
                    <button key={c.id} onClick={() => router.push(`/admin/cuenta/${c.id}`)} className="flex w-full items-center gap-3 rounded-2xl border border-venom/30 bg-emerald/30 p-3 text-left hover:border-venom">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{c.nombre_cliente ?? c.numero} {c.asiento && <span className="text-xs text-smoke">· puesto {c.asiento}</span>}</p>
                        <p className="flex flex-wrap items-center gap-x-3 text-xs text-smoke">
                          <span>{c.numero}</span><span className="flex items-center gap-1"><Users size={12} /> {c.personas}</span>
                          <span className="flex items-center gap-1"><Clock size={12} /> {hace(c.abierta_en)}</span><span>{c.mesonero}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-lg text-gold-light">{dinero(c.total - c.pagado, c.moneda)}</p>
                        {c.listos > 0 && <Insignia color="oro"><BellRing size={11} /> {c.listos} listos</Insignia>}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {mesa.reservas.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs tracking-wider text-sky-300 uppercase">Reservada hoy</h3>
                {mesa.reservas.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-dashed border-sky-400/40 p-3">
                    <div className="flex-1 text-sm"><b>{r.hora}</b> · {r.nombre_completo} <span className="text-smoke">· {r.personas} personas · {r.estado}</span></div>
                    <Boton tam="sm" variante="oro" cargando={ocupado} onClick={() => sentar(r, mesa)}>Llegaron</Boton>
                  </div>
                ))}
              </section>
            )}

            <section>
              <h3 className="mb-2 text-xs tracking-wider text-gold uppercase">{mesa.cuentas.length ? 'Abrir otra cuenta (cuentas separadas)' : 'Abrir cuenta'}</h3>
              <div className="grid grid-cols-[110px_1fr] gap-3">
                {mesa.tipo !== 'barra' && <Campo etiqueta="Personas"><InputNum min={1} max={mesa.capacidad} valor={nueva.personas} onCambio={(v) => setNueva({ ...nueva, personas: v })} /></Campo>}
                <Campo etiqueta="Nombre (opcional)" className={mesa.tipo === 'barra' ? 'col-span-2' : ''}><Input value={nueva.nombre} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} placeholder="Para identificar la cuenta" /></Campo>
              </div>
              <Boton variante="oro" tam="lg" className="mt-3 w-full" cargando={ocupado} onClick={() => abrir(mesa, puesto)}><Plus size={17} /> Abrir cuenta y tomar pedido</Boton>
            </section>
          </div>
        </Modal>
      )}
    </div>
  );
}

const Leyenda = ({ color, texto }: { color: string; texto: string }) => (
  <span className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-full border-2 ${color}`} />{texto}</span>
);

// ====================================================================== Mesa con sus asientos numerados alrededor
function MesaNodo({ mesa, color, onClick }: { mesa: Mesa; color: string; onClick: () => void }) {
  const ocupada = mesa.cuentas.length > 0;
  const listos = mesa.cuentas.reduce((s, c) => s + Number(c.listos), 0);
  const personas = mesa.cuentas.reduce((s, c) => s + c.personas, 0);
  const saldo = mesa.cuentas.reduce((s, c) => s + (c.total - c.pagado), 0);
  const reservada = !ocupada && mesa.reservas.length > 0;
  const enCaja = mesa.cuentas.some((c) => c.cobro_solicitado_en);
  const rect = mesa.forma === 'rectangular';
  const W = rect ? 150 : mesa.capacidad > 8 ? 104 : 84;
  const H = rect ? 84 : W;
  const R = 15; // separación de los asientos respecto al borde

  // Asientos distribuidos alrededor (elipse que envuelve la mesa)
  const asientos = Array.from({ length: mesa.capacidad }, (_, i) => {
    const a = (i / mesa.capacidad) * Math.PI * 2 - Math.PI / 2;
    return { n: i + 1, x: Math.cos(a) * (W / 2 + R), y: Math.sin(a) * (H / 2 + R) };
  });

  return (
    <button onClick={onClick} className="group relative block" style={{ width: W + 2 * (R + 10), height: H + 2 * (R + 10) }} aria-label={`Mesa ${mesa.numero}`}>
      {asientos.map((s) => (
        <span
          key={s.n}
          className={`absolute grid h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full text-[9px] font-semibold transition ${
            s.n <= personas ? 'bg-venom text-void' : 'bg-white/10 text-smoke'
          }`}
          style={{ left: `calc(50% + ${s.x}px)`, top: `calc(50% + ${s.y}px)` }}
        >
          {s.n}
        </span>
      ))}
      <span
        className={`absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center border-2 transition group-hover:scale-105 ${
          mesa.forma === 'redonda' ? 'rounded-full' : 'rounded-2xl'
        } ${listos ? 'animate-pulse border-gold bg-gold/25' : enCaja ? 'border-sky-400 bg-sky-400/20' : ocupada ? 'border-venom bg-emerald' : reservada ? 'border-dashed border-sky-400 bg-sky-400/10' : 'border-smoke/30 bg-void/60'}`}
        style={{ width: W, height: H, boxShadow: ocupada ? `0 0 30px -8px ${color}` : undefined }}
      >
        <span className="font-display text-2xl leading-none font-light">{mesa.numero}</span>
        {mesa.nombre && rect && <span className="max-w-[130px] truncate text-[9px] text-smoke">{mesa.nombre}</span>}
        {ocupada ? (
          <span className="mt-0.5 text-[10px] font-medium text-gold-light">{dinero(saldo, mesa.cuentas[0].moneda)}</span>
        ) : reservada ? (
          <span className="mt-0.5 text-[10px] text-sky-300">{mesa.reservas[0].hora}</span>
        ) : (
          <span className="mt-0.5 text-[9px] text-smoke">{mesa.capacidad} pers.</span>
        )}
      </span>
      {listos > 0 && <span className="absolute top-1 right-1 grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-void">{listos}</span>}
      {mesa.cuentas.length > 1 && <span className="absolute bottom-1 left-1 rounded-full bg-void px-1.5 text-[9px] text-venom ring-1 ring-venom/50">{mesa.cuentas.length} cuentas</span>}
    </button>
  );
}

// ====================================================================== Barra con taburetes numerados
function BarraNodo({ mesa, onPuesto }: { mesa: Mesa; onPuesto: (n: number, cuenta: CuentaMesa | undefined) => void }) {
  const sinPuesto = mesa.cuentas.filter((c) => !c.asiento);
  return (
    <div className="w-[min(88vw,860px)]">
      <div className="rounded-t-[40px] border-2 border-b-0 border-gold/40 bg-gradient-to-b from-gold/15 to-transparent px-6 pt-4 pb-3 text-center">
        <p className="font-display text-sm tracking-[0.4em] text-gold-light uppercase">{mesa.nombre ?? 'Barra'}</p>
        <p className="text-[10px] text-smoke">Aquí van cancelando: toca un taburete para abrirle cuenta y cobrar</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2 rounded-b-2xl border-2 border-t-0 border-gold/40 bg-void/40 p-3">
        {Array.from({ length: mesa.capacidad }, (_, i) => i + 1).map((n) => {
          const c = mesa.cuentas.find((x) => x.asiento === n);
          return (
            <button
              key={n}
              onClick={() => onPuesto(n, c)}
              title={c ? `${c.nombre_cliente ?? c.numero} · ${dinero(c.total - c.pagado, c.moneda)}` : `Puesto B-${String(n).padStart(2, '0')} libre`}
              className={`flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 text-[10px] transition hover:scale-110 ${
                c ? (Number(c.listos) ? 'animate-pulse border-gold bg-gold/25' : 'border-venom bg-emerald') : 'border-smoke/30 bg-void/60 text-smoke'
              }`}
            >
              <span className="font-display text-base leading-none text-ivory">{n}</span>
              {c && <span className="text-[8px] text-gold-light">{dinero(c.total - c.pagado, c.moneda).replace(/\s/g, '')}</span>}
            </button>
          );
        })}
      </div>
      {sinPuesto.length > 0 && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {sinPuesto.map((c) => (
            <button key={c.id} onClick={() => onPuesto(0, c)} className="rounded-full border border-venom/40 bg-emerald/40 px-3 py-1 text-[11px] hover:border-venom">
              {c.nombre_cliente ?? c.numero} · {dinero(c.total - c.pagado, c.moneda)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
