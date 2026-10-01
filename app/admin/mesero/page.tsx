'use client';

import { BellRing, Check, ChefHat, Clock, Martini, Minus, Plus, ShoppingBag, Undo2, Users, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useSesion } from '@/components/admin/Sesion';
import { PasarACaja } from '@/components/admin/pos/PasarACaja';
import { Boton, Cargando, ErrorCaja, Input, Insignia, Modal, Pestanas, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { type Moneda, dinero, hace } from '@/lib/admin/moneda';
import { useVivo } from '@/lib/admin/vivo';

type Listo = { id: number; nombre: string; presentacion: string | null; cantidad: number; estacion: string; asiento: number | null };
type Activa = {
  id: number; numero: string; tipo: 'mesa' | 'barra' | 'llevar'; asiento: number | null; personas: number; nombre_cliente: string | null; moneda: Moneda;
  total: number; pagado: number; abierta_en: string; mesonero_id: number | null; mesonero: string | null; cobro_solicitado_en: string | null; cobro_nota: string | null;
  mesa_numero: number | null; mesa_nombre: string | null; mesa_tipo: string | null; zona: string | null; en_cola: number; preparando: number; items: number; listos: Listo[];
};
type MesaSalon = { id: number; numero: number; nombre: string | null; tipo: string; capacidad: number; cuentas: { id: number }[]; reservas: { hora: string; nombre_completo: string }[] };
type Salon = { zonas: { id: number; nombre: string; color: string; mesas: MesaSalon[] }[] };

const lugar = (c: Activa) => (c.mesa_tipo === 'barra' || (c.tipo === 'barra' && !c.mesa_numero) ? 'Barra' : c.tipo === 'llevar' ? 'Llevar' : String(c.mesa_numero));
const etiquetaLugar = (c: Activa) => (c.mesa_tipo === 'barra' || (c.tipo === 'barra' && !c.mesa_numero) ? `Barra${c.asiento ? ` · puesto ${c.asiento}` : ''}` : c.tipo === 'llevar' ? 'Para llevar' : `Mesa ${c.mesa_numero}`);

export default function MeseroPage() {
  const router = useRouter();
  const { usuario } = useSesion();
  const [ver, setVer] = useState<'mias' | 'todas'>('mias');
  const { datos, cargando, error, recargar } = useDatos<Activa[]>(`/cuentas/activas${ver === 'todas' ? '?todas=1' : ''}`, 25_000);
  const [nueva, setNueva] = useState(false);
  const [aCaja, setACaja] = useState<number | null>(null);
  const avisos = useAvisos();

  // Cualquier cosa que pase en el salón refresca la pantalla al instante
  useVivo((e) => {
    if (e.tipo === 'pedido' || e.tipo === 'comanda' || e.tipo === 'cobro' || e.tipo === 'cuenta' || e.tipo === 'reconectado') recargar();
  });

  const entregar = async (ids: number[]) => {
    try {
      await adm('/comandas/lote', { method: 'POST', body: { ids, estado: 'entregado' } });
      recargar();
    } catch (e) {
      avisos.error(e);
    }
  };

  const retirar = async (id: number) => {
    try {
      await adm(`/cuentas/${id}/solicitar-cobro`, { method: 'DELETE' });
      avisos.ok('Cuenta retirada de caja');
      recargar();
    } catch (e) {
      avisos.error(e);
    }
  };

  const conListos = (datos ?? []).filter((c) => c.listos.length);
  const hora = new Date().getHours();

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-light">{hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches'}, <span className="text-gold-light">{usuario?.nombre.split(' ')[0]}</span></h1>
          <p className="text-sm text-smoke">{datos ? `${datos.length} ${datos.length === 1 ? 'cuenta abierta' : 'cuentas abiertas'}` : ' '} · los pedidos llegan a barra y cocina al instante</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pestanas valor={ver} onCambio={setVer} opciones={[{ valor: 'mias', etiqueta: 'Mis mesas' }, { valor: 'todas', etiqueta: 'Todo el salón' }]} />
          <Boton variante="oro" tam="lg" onClick={() => setNueva(true)}><Plus size={20} /> Nueva mesa</Boton>
        </div>
      </div>

      {/* ------------------------------------------------------------ Listo para llevar a la mesa */}
      {conListos.length > 0 && (
        <section className="mb-6 rounded-3xl border-2 border-gold/60 bg-gold/10 p-4">
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-gold-light"><BellRing size={20} className="animate-bounce" /> Listo para llevar</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {conListos.map((c) => (
              <div key={c.id} className="flex items-center gap-4 rounded-2xl bg-void/60 p-3">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gold font-display text-2xl font-medium text-void">{lugar(c)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{etiquetaLugar(c)}{c.nombre_cliente && <span className="text-smoke"> · {c.nombre_cliente}</span>}</p>
                  <ul className="text-sm text-ivory/85">
                    {c.listos.map((i) => (
                      <li key={i.id} className="flex items-center gap-1.5">
                        {i.estacion === 'cocina' ? <ChefHat size={13} className="text-gold" /> : <Martini size={13} className="text-venom" />}
                        {i.cantidad}× {i.nombre}{i.asiento ? <span className="text-xs text-smoke"> (puesto {i.asiento})</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
                <Boton variante="verde" tam="lg" onClick={() => entregar(c.listos.map((i) => i.id))}><Check size={20} /> Entregado</Boton>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ Mis mesas */}
      {cargando ? <Cargando /> : error ? <ErrorCaja mensaje={error} onReintentar={recargar} /> : !datos?.length ? (
        <button onClick={() => setNueva(true)} className="grid w-full place-items-center rounded-3xl border-2 border-dashed border-gold/25 px-6 py-20 text-center transition hover:border-gold">
          <span className="grid h-20 w-20 place-items-center rounded-full bg-gold/15 text-gold"><Plus size={40} /></span>
          <span className="mt-4 font-display text-2xl">{ver === 'mias' ? 'Aún no tienes mesas' : 'El salón está vacío'}</span>
          <span className="mt-1 text-smoke">Toca aquí para abrir la primera</span>
        </button>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {datos.map((c) => {
            const saldo = c.total - c.pagado;
            const enCaja = !!c.cobro_solicitado_en;
            return (
              <article key={c.id} className={`flex flex-col overflow-hidden rounded-3xl border-2 bg-[#06140f] transition ${enCaja ? 'border-sky-400/60' : c.listos.length ? 'border-gold' : 'border-gold/15'}`}>
                <button onClick={() => router.push(`/admin/cuenta/${c.id}`)} className="flex items-center gap-4 p-4 text-left active:bg-white/5">
                  <div className={`grid h-20 w-20 shrink-0 place-items-center rounded-2xl font-display font-light ${enCaja ? 'bg-sky-400/20 text-sky-200' : 'bg-emerald text-ivory'} ${lugar(c).length > 3 ? 'text-xl' : 'text-4xl'}`}>{lugar(c)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-medium">{c.nombre_cliente ?? etiquetaLugar(c)}</p>
                    <p className="flex flex-wrap items-center gap-x-3 text-xs text-smoke">
                      <span>{c.zona ?? etiquetaLugar(c)}</span>
                      <span className="flex items-center gap-1"><Users size={12} /> {c.personas}</span>
                      <span className="flex items-center gap-1"><Clock size={12} /> {hace(c.abierta_en)}</span>
                      {ver === 'todas' && c.mesonero && <span>{c.mesonero}</span>}
                    </p>
                    <p className="mt-1 font-display text-2xl font-light text-gold-light">{dinero(saldo, c.moneda)}</p>
                  </div>
                </button>

                <div className="flex flex-wrap gap-1.5 px-4 pb-3">
                  {Number(c.items) === 0 && <Insignia>Sin pedido aún</Insignia>}
                  {Number(c.en_cola) > 0 && <Insignia>{c.en_cola} en cola</Insignia>}
                  {Number(c.preparando) > 0 && <Insignia color="oro">{c.preparando} preparándose</Insignia>}
                  {c.listos.length > 0 && <Insignia color="verde"><BellRing size={11} /> {c.listos.length} listos</Insignia>}
                  {c.pagado > 0 && <Insignia color="azul">Abonó {dinero(c.pagado, c.moneda)}</Insignia>}
                </div>

                <div className="mt-auto grid grid-cols-2 gap-2 border-t border-white/5 p-3">
                  <Boton tam="lg" onClick={() => router.push(`/admin/cuenta/${c.id}`)}><Plus size={18} /> Pedido</Boton>
                  {enCaja ? (
                    <Boton tam="lg" variante="sutil" className="!text-sky-300" onClick={() => retirar(c.id)} title={c.cobro_nota ?? ''}><Undo2 size={17} /> En caja · {hace(c.cobro_solicitado_en!)}</Boton>
                  ) : (
                    <Boton tam="lg" variante="oro" disabled={c.total <= 0} onClick={() => setACaja(c.id)}><Wallet size={18} /> A caja</Boton>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {nueva && <NuevaMesa onCerrar={() => setNueva(false)} />}
      {aCaja && <PasarACaja cuentaId={aCaja} onCerrar={() => setACaja(null)} onEnviada={() => { setACaja(null); recargar(); }} />}
    </div>
  );
}

// ====================================================================== Abrir mesa en dos toques
function NuevaMesa({ onCerrar }: { onCerrar: () => void }) {
  const router = useRouter();
  const salon = useDatos<Salon>('/salon');
  const [zonaId, setZonaId] = useState<number | null>(null);
  const [mesa, setMesa] = useState<MesaSalon | null>(null);
  const [personas, setPersonas] = useState(2);
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const avisos = useAvisos();

  const zonas = useMemo(() => (salon.datos?.zonas ?? []).filter((z) => z.mesas.some((m) => m.tipo !== 'barra')), [salon.datos]);
  const zona = zonas.find((z) => z.id === zonaId) ?? zonas[0];

  const abrir = async (cuerpo: Record<string, unknown>) => {
    setOcupado(true);
    try {
      const c = await adm<{ id: number }>('/cuentas', { method: 'POST', body: { ...cuerpo, nombre_cliente: nombre.trim() || null } });
      router.push(`/admin/cuenta/${c.id}`);
    } catch (e) {
      avisos.error(e);
      setOcupado(false);
    }
  };

  return (
    <Modal titulo={mesa ? `Mesa ${mesa.numero}${mesa.nombre ? ` · ${mesa.nombre}` : ''}` : '¿Qué mesa vas a atender?'} subtitulo={mesa ? `${zona?.nombre} · ${mesa.capacidad} puestos` : 'Las verdes están libres'} onCerrar={onCerrar} ancho="max-w-3xl">
      {salon.cargando ? <Cargando /> : !mesa ? (
        <div className="space-y-4">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {zonas.map((z) => (
              <button key={z.id} onClick={() => setZonaId(z.id)} className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm ${zona?.id === z.id ? 'bg-gold font-semibold text-void' : 'border border-gold/20 text-smoke'}`}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: z.color }} /> {z.nombre}
                <span className="text-xs opacity-70">{z.mesas.filter((m) => !m.cuentas.length).length} libres</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-6">
            {zona?.mesas.filter((m) => m.tipo !== 'barra').map((m) => {
              const ocupada = m.cuentas.length > 0;
              return (
                <button key={m.id} onClick={() => { setMesa(m); setPersonas(Math.min(2, m.capacidad)); }}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl border-2 transition active:scale-95 ${ocupada ? 'border-gold/30 bg-gold/10 text-gold-light' : 'border-venom/50 bg-emerald/40 text-ivory hover:border-venom'}`}>
                  <span className="font-display text-3xl font-light">{m.numero}</span>
                  <span className="text-[10px] text-smoke">{ocupada ? 'ocupada' : `${m.capacidad} pers.`}</span>
                  {m.reservas.length > 0 && !ocupada && <span className="absolute top-1.5 right-1.5 rounded-full bg-sky-400 px-1.5 text-[9px] font-bold text-void">{m.reservas[0].hora}</span>}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-4">
            <Boton tam="lg" cargando={ocupado} onClick={() => abrir({ tipo: 'barra', personas: 1 })}><Martini size={18} /> Cliente en barra</Boton>
            <Boton tam="lg" cargando={ocupado} onClick={() => abrir({ tipo: 'llevar', personas: 1 })}><ShoppingBag size={18} /> Para llevar</Boton>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {mesa.cuentas.length > 0 && <p className="rounded-xl bg-gold/10 px-3 py-2 text-sm text-gold-light">Esta mesa ya tiene {mesa.cuentas.length} cuenta abierta. Vas a abrir una cuenta separada.</p>}
          {mesa.reservas.length > 0 && <p className="rounded-xl bg-sky-400/10 px-3 py-2 text-sm text-sky-200">Reservada hoy a las {mesa.reservas[0].hora} para {mesa.reservas[0].nombre_completo}.</p>}
          <div>
            <p className="mb-2 text-xs tracking-wider text-gold uppercase">¿Cuántas personas?</p>
            <div className="flex items-center justify-center gap-6 rounded-2xl border border-gold/15 p-3">
              <button onClick={() => setPersonas((p) => Math.max(1, p - 1))} className="grid h-14 w-14 place-items-center rounded-full border border-gold/30 text-gold active:bg-gold/20" aria-label="Menos"><Minus size={24} /></button>
              <span className="w-16 text-center font-display text-5xl font-light">{personas}</span>
              <button onClick={() => setPersonas((p) => Math.min(mesa.capacidad, p + 1))} className="grid h-14 w-14 place-items-center rounded-full border border-gold/30 text-gold active:bg-gold/20" aria-label="Más"><Plus size={24} /></button>
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs tracking-wider text-gold uppercase">Nombre del cliente <span className="text-smoke normal-case">· aparece en la comanda de barra y cocina</span></p>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Laura, cumpleaños" className="!h-14 !text-lg" maxLength={60} />
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-2">
            <Boton tam="lg" variante="sutil" onClick={() => setMesa(null)}>Otra mesa</Boton>
            <Boton tam="lg" variante="oro" cargando={ocupado} onClick={() => abrir({ tipo: 'mesa', mesa_id: mesa.id, personas })}>Abrir y tomar pedido</Boton>
          </div>
        </div>
      )}
    </Modal>
  );
}
