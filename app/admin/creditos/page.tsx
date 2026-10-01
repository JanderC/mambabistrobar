'use client';

import { Banknote, CheckCircle2, Clock, CreditCard, DoorOpen, HandCoins, History, MessageCircle, Phone, Star, Users, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Fiar } from '@/components/admin/pos/Fiar';
import type { MetodoPago } from '@/components/admin/pos/tipos';
import { Boton, Campo, Cargando, Dato, Encabezado, ErrorCaja, Input, InputNum, Insignia, Modal, Pestanas, Select, Tarjeta, Vacio, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { type Moneda, type Tasa, convertir, dinero, fechaHora, hace, redondear } from '@/lib/admin/moneda';
import { useVivo } from '@/lib/admin/vivo';

type Deuda = { moneda: Moneda; saldo: number };
type Deudor = {
  id: number; nombre: string; telefono: string | null; documento: string | null; vip: boolean; notas: string | null; ultimo_cargo: string | null; primer_cargo: string | null;
  ultimo_abono: string | null; cuentas_fiadas: number; se_fue: boolean; deudas: Deuda[]; deuda_total: number;
};
type MesaPorCobrar = {
  id: number; numero: string; tipo: string; asiento: number | null; personas: number; nombre_cliente: string | null; moneda: Moneda; total: number; pagado: number;
  abierta_en: string; cobro_solicitado_en: string | null; mesa_numero: number | null; mesa_tipo: string | null; zona: string | null; mesonero: string | null; items: number;
};
type Tablero = {
  moneda: Moneda;
  resumen: { deuda_total: number; clientes: number; se_fueron: number; por_cobrar_mesas: number; mesas: number };
  deudores: Deudor[]; al_dia: Deudor[]; mesas: MesaPorCobrar[];
};
type Movimiento = {
  id: number; tipo: 'cargo' | 'abono'; motivo: 'fiado' | 'se_fue' | null; moneda: Moneda; monto: number; pago_moneda: Moneda | null; pago_monto: number | null;
  referencia: string | null; nota: string | null; fecha: string; cuenta_id: number | null; cuenta: string | null; metodo: string | null; usuario: string | null; consumo: string | null;
};
type CajaAbierta = { id: number; nombre: string; sesion: { id: number } | null };

const iniciales = (n: string) => n.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
const dias = (iso: string | null) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400e3) : 0);
const lugar = (m: MesaPorCobrar) => (m.mesa_tipo === 'barra' || (m.tipo === 'barra' && !m.mesa_numero) ? 'Barra' : m.tipo === 'llevar' ? 'Llevar' : String(m.mesa_numero));
const etiquetaLugar = (m: MesaPorCobrar) => (m.mesa_tipo === 'barra' || (m.tipo === 'barra' && !m.mesa_numero) ? `Barra${m.asiento ? ` · puesto ${m.asiento}` : ''}` : m.tipo === 'llevar' ? 'Para llevar' : `Mesa ${m.mesa_numero}`);

export default function CreditosPage() {
  const { datos, cargando, error, recargar } = useDatos<Tablero>('/creditos', 30_000);
  const [tab, setTab] = useState<'deudores' | 'mesas' | 'al_dia'>('deudores');
  const [filtro, setFiltro] = useState<'todos' | 'se_fue' | 'fiado'>('todos');
  const [q, setQ] = useState('');
  const [abonar, setAbonar] = useState<Deudor | null>(null);
  const [historial, setHistorial] = useState<Deudor | null>(null);
  const [seFue, setSeFue] = useState<MesaPorCobrar | null>(null);

  useVivo((e) => {
    if (e.tipo === 'cuenta' || e.tipo === 'cobro' || e.tipo === 'pedido' || e.tipo === 'reconectado') recargar();
  });

  const deudores = useMemo(() => {
    const n = q.trim().toLowerCase();
    return (datos?.deudores ?? []).filter(
      (d) => (filtro === 'todos' || (filtro === 'se_fue' ? d.se_fue : !d.se_fue)) && (!n || `${d.nombre} ${d.telefono ?? ''} ${d.documento ?? ''}`.toLowerCase().includes(n)),
    );
  }, [datos, filtro, q]);

  if (cargando) return <Cargando />;
  if (error || !datos) return <ErrorCaja mensaje={error ?? 'Sin datos'} onReintentar={recargar} />;
  const r = datos.resumen;

  return (
    <div className="mx-auto max-w-7xl">
      <Encabezado titulo="Por cobrar" descripcion="Lo que te deben: clientes que fiaron, los que consumieron y se fueron, y las mesas que siguen abiertas esta noche.">
        <Pestanas valor={tab} onCambio={setTab} opciones={[
          { valor: 'deudores', etiqueta: 'Clientes que deben', cuenta: r.clientes },
          { valor: 'mesas', etiqueta: 'Mesas por cobrar', cuenta: r.mesas },
          { valor: 'al_dia', etiqueta: 'Ya pagaron' },
        ]} />
      </Encabezado>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Dato etiqueta="Deuda total de clientes" valor={<span className={r.deuda_total ? 'text-red-300' : ''}>{dinero(r.deuda_total, datos.moneda)}</span>} sub={`${r.clientes} ${r.clientes === 1 ? 'cliente debe' : 'clientes deben'}`} />
        <Dato etiqueta="Consumieron y se fueron" valor={r.se_fueron} sub={r.se_fueron ? 'Clientes con cuentas sin pagar' : 'Nadie se ha ido sin pagar'} />
        <Dato etiqueta="Mesas por cobrar ahora" valor={dinero(r.por_cobrar_mesas, datos.moneda)} sub={`${r.mesas} cuentas abiertas con saldo`} acento />
        <Dato etiqueta="Total en la calle" valor={dinero(r.deuda_total + r.por_cobrar_mesas, datos.moneda)} sub="Deudas + mesas abiertas" />
      </div>

      {/* ------------------------------------------------------------ Clientes que deben */}
      {tab === 'deudores' && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="w-56"><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente…" /></div>
            {([['todos', 'Todos'], ['fiado', 'Fiaron'], ['se_fue', 'Se fueron sin pagar']] as const).map(([v, t]) => (
              <button key={v} onClick={() => setFiltro(v)} className={`rounded-full px-3.5 py-1.5 text-sm ${filtro === v ? 'bg-gold font-semibold text-void' : 'border border-gold/15 text-smoke hover:text-ivory'}`}>{t}</button>
            ))}
          </div>
          {!deudores.length ? (
            <Vacio titulo={datos.deudores.length ? 'Nadie con ese filtro' : 'Nadie te debe 🎉'}>Cuando fíes una cuenta o un cliente se vaya sin pagar, aparecerá aquí con su deuda.</Vacio>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {deudores.map((d) => {
                const antiguedad = dias(d.primer_cargo);
                return (
                  <article key={d.id} className={`flex flex-col overflow-hidden rounded-3xl border-2 bg-[#06140f] ${d.se_fue ? 'border-red-400/50' : antiguedad > 15 ? 'border-gold/60' : 'border-gold/15'}`}>
                    <div className="flex items-center gap-4 p-4">
                      <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl font-display text-xl font-medium ${d.se_fue ? 'bg-red-500/20 text-red-200' : 'bg-gradient-to-br from-gold-light to-gold-dark text-void'}`}>{iniciales(d.nombre)}</div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-lg font-medium">{d.vip && <Star size={14} className="shrink-0 fill-gold text-gold" />}{d.nombre}</p>
                        <p className="flex items-center gap-1 text-xs text-smoke">{d.telefono ? <><Phone size={11} /> {d.telefono}</> : 'Sin teléfono registrado'}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {d.se_fue ? <Insignia color="rojo"><DoorOpen size={11} /> Se fue sin pagar</Insignia> : <Insignia color="oro"><HandCoins size={11} /> Fiado</Insignia>}
                          <Insignia>{d.cuentas_fiadas} {d.cuentas_fiadas === 1 ? 'cuenta' : 'cuentas'}</Insignia>
                        </div>
                      </div>
                    </div>

                    <div className="px-4">
                      <p className="text-[11px] tracking-wider text-smoke uppercase">Debe</p>
                      <p className="font-display text-4xl font-light text-red-300">{dinero(d.deuda_total, datos.moneda)}</p>
                      {(d.deudas.length > 1 || d.deudas[0]?.moneda !== datos.moneda) && (
                        <p className="flex flex-wrap gap-x-3 text-xs text-smoke">{d.deudas.map((x) => <span key={x.moneda}>{dinero(x.saldo, x.moneda)}</span>)}</p>
                      )}
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-smoke">
                        <span className={`flex items-center gap-1 ${antiguedad > 15 ? 'font-medium text-gold-light' : ''}`}><Clock size={12} /> {antiguedad === 0 ? 'desde hoy' : `desde hace ${antiguedad} ${antiguedad === 1 ? 'día' : 'días'}`}</span>
                        {d.ultimo_abono && <span>último abono {hace(d.ultimo_abono)}</span>}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2 border-t border-white/5 p-3">
                      <Boton variante="oro" tam="lg" onClick={() => setAbonar(d)}><Wallet size={18} /> Abonar</Boton>
                      <Boton tam="lg" onClick={() => setHistorial(d)} aria-label="Estado de cuenta" title="Estado de cuenta"><History size={18} /></Boton>
                      {d.telefono ? (
                        <a href={`https://wa.me/${d.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${d.nombre.split(' ')[0]}, te escribimos de Mamba Bistro Bar 🐍. Tienes un saldo pendiente de ${dinero(d.deuda_total, datos.moneda)}. ¿Cuándo podrías pasar a cancelarlo? ¡Gracias!`)}`}
                          target="_blank" rel="noopener noreferrer" className="grid h-12 w-12 place-items-center rounded-xl bg-[#25d366] text-white" aria-label="Cobrar por WhatsApp" title="Cobrar por WhatsApp"><MessageCircle size={20} /></a>
                      ) : <span className="w-12" />}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ------------------------------------------------------------ Mesas por cobrar */}
      {tab === 'mesas' && (
        !datos.mesas.length ? <Vacio titulo="No hay mesas con saldo">Todas las cuentas abiertas están al día.</Vacio> : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {datos.mesas.map((m) => {
              const horas = (Date.now() - new Date(m.abierta_en).getTime()) / 3600e3;
              return (
                <article key={m.id} className={`flex flex-col overflow-hidden rounded-3xl border-2 bg-[#06140f] ${m.cobro_solicitado_en ? 'border-sky-400/60' : horas > 5 ? 'border-red-400/50' : 'border-gold/15'}`}>
                  <Link href={`/admin/cuenta/${m.id}`} className="flex items-center gap-4 p-4 hover:bg-white/5">
                    <div className={`grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-emerald font-display font-light ${lugar(m).length > 3 ? 'text-xl' : 'text-4xl'}`}>{lugar(m)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-lg font-medium">{m.nombre_cliente ?? etiquetaLugar(m)}</p>
                      <p className="flex flex-wrap items-center gap-x-3 text-xs text-smoke">
                        <span>{etiquetaLugar(m)}{m.zona ? ` · ${m.zona}` : ''}</span><span className="flex items-center gap-1"><Users size={12} /> {m.personas}</span>
                      </p>
                      <p className="text-xs text-smoke">{m.mesonero ?? '—'} · {m.numero} · <span className={horas > 5 ? 'font-medium text-red-300' : ''}>abierta hace {hace(m.abierta_en)}</span></p>
                    </div>
                  </Link>
                  <div className="px-4">
                    <p className="font-display text-4xl font-light text-gold-light">{dinero(m.total - m.pagado, m.moneda)}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {m.pagado > 0 && <Insignia color="azul">Abonó {dinero(m.pagado, m.moneda)}</Insignia>}
                      {m.cobro_solicitado_en && <Insignia color="azul"><Wallet size={11} /> En caja</Insignia>}
                      <Insignia>{m.items} {Number(m.items) === 1 ? 'ítem' : 'ítems'}</Insignia>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/5 p-3">
                    <Link href={`/admin/cuenta/${m.id}`} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-gold-light via-gold to-gold-dark font-semibold text-void"><Wallet size={18} /> Cobrar</Link>
                    <Boton tam="lg" variante="peligro" onClick={() => setSeFue(m)}><DoorOpen size={18} /> Se fue</Boton>
                  </div>
                </article>
              );
            })}
          </div>
        )
      )}

      {/* ------------------------------------------------------------ Ya pagaron */}
      {tab === 'al_dia' && (
        !datos.al_dia.length ? <Vacio titulo="Aún no hay historial">Aquí verás a los clientes que tuvieron crédito y ya lo pagaron.</Vacio> : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {datos.al_dia.map((d) => (
              <Tarjeta key={d.id} className="flex items-center gap-3 p-4">
                <CheckCircle2 size={28} className="shrink-0 text-venom" />
                <div className="min-w-0 flex-1"><p className="truncate font-medium">{d.nombre}</p><p className="text-xs text-smoke">Al día · pagó {d.ultimo_abono ? hace(d.ultimo_abono) : ''} atrás</p></div>
                <Boton tam="sm" variante="sutil" onClick={() => setHistorial(d)}><History size={15} /></Boton>
              </Tarjeta>
            ))}
          </div>
        )
      )}

      {abonar && <Abono deudor={abonar} onCerrar={() => setAbonar(null)} onListo={() => { setAbonar(null); recargar(); }} />}
      {historial && <EstadoCuenta deudor={historial} onCerrar={() => setHistorial(null)} />}
      {seFue && (
        <Fiar cuenta={{ id: seFue.id, numero: seFue.numero, saldo: seFue.total - seFue.pagado, moneda: seFue.moneda, nombre_cliente: seFue.nombre_cliente }} motivoInicial="se_fue"
          onCerrar={() => setSeFue(null)} onFiada={() => { setSeFue(null); setTab('deudores'); recargar(); }} />
      )}
    </div>
  );
}

// ====================================================================== Recibir un abono
function Abono({ deudor, onCerrar, onListo }: { deudor: Deudor; onCerrar: () => void; onListo: () => void }) {
  const metodos = useDatos<MetodoPago[]>('/metodos-pago');
  const cajas = useDatos<CajaAbierta[]>('/caja');
  const tasa = useDatos<Tasa>('/tasas/actual');
  const abiertas = (cajas.datos ?? []).filter((c) => c.sesion);
  const [deuda, setDeuda] = useState<Deuda>(deudor.deudas[0]);
  const [metodo, setMetodo] = useState<MetodoPago | null>(null);
  const [moneda, setMoneda] = useState<Moneda>(deudor.deudas[0].moneda);
  const [monto, setMonto] = useState<number | null>(null);
  const [referencia, setReferencia] = useState('');
  const [cajaId, setCajaId] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const avisos = useAvisos();

  useEffect(() => {
    if (!cajaId && abiertas.length) setCajaId(abiertas.find((c) => c.id === Number(localStorage.getItem('mamba_caja')))?.id ?? abiertas[0].id);
  }, [abiertas, cajaId]);

  const t = tasa.datos;
  const total = t ? redondear(convertir(deuda.saldo, deuda.moneda, moneda, t), moneda) : 0;
  const aplicado = t && monto ? redondear(convertir(monto, moneda, deuda.moneda, t), deuda.moneda) : 0;

  const elegirMetodo = (m: MetodoPago) => {
    setMetodo(m);
    const mon = m.monedas.includes(deuda.moneda) ? deuda.moneda : m.monedas[0];
    setMoneda(mon);
    setMonto(t ? redondear(convertir(deuda.saldo, deuda.moneda, mon, t), mon) : null);
  };

  const guardar = async () => {
    const sesionId = abiertas.find((c) => c.id === cajaId)?.sesion?.id;
    if (!sesionId) return avisos.error('Selecciona una caja abierta');
    if (!metodo) return avisos.error('Elige con qué paga');
    if (!monto) return avisos.error('Escribe el monto');
    setOcupado(true);
    try {
      const r = await adm<{ saldado: boolean; restante: number; moneda: Moneda }>(`/creditos/${deudor.id}/abonos`, {
        method: 'POST',
        body: { sesion_caja_id: sesionId, metodo_pago_id: metodo.id, moneda, monto, moneda_deuda: deuda.moneda, referencia: referencia.trim() || null },
      });
      avisos.ok(r.saldado ? `${deudor.nombre} quedó al día ✓` : `Abono registrado. Le quedan ${dinero(r.restante, r.moneda)}`);
      onListo();
    } catch (e) {
      avisos.error(e);
      setOcupado(false);
    }
  };

  if (cajas.cargando || metodos.cargando || !t) return <Modal titulo="Abonar" onCerrar={onCerrar}><Cargando /></Modal>;
  if (!abiertas.length)
    return (
      <Modal titulo="No hay caja abierta" onCerrar={onCerrar} ancho="max-w-md">
        <p className="text-sm text-smoke">El abono entra a la caja, así que primero hay que abrir un turno.</p>
        <Link href="/admin/caja" className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-gold font-semibold text-void">Ir a abrir caja</Link>
      </Modal>
    );

  return (
    <Modal titulo={`Abono de ${deudor.nombre}`} subtitulo={`Debe ${deudor.deudas.map((d) => dinero(d.saldo, d.moneda)).join(' + ')}`} onCerrar={onCerrar} ancho="max-w-2xl"
      pie={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-smoke">{monto ? (aplicado >= deuda.saldo - 1 ? <span className="text-venom">✓ Salda la deuda en {deuda.moneda}</span> : <>Le quedarán <b className="text-ivory">{dinero(Math.max(0, deuda.saldo - aplicado), deuda.moneda)}</b></>) : 'Elige cómo paga'}</p>
          <Boton variante="oro" tam="lg" cargando={ocupado} disabled={!metodo || !monto} onClick={guardar}>Registrar abono</Boton>
        </div>
      }>
      <div className="space-y-5">
        {deudor.deudas.length > 1 && (
          <section>
            <h3 className="mb-2 text-xs tracking-wider text-gold uppercase">¿Qué deuda abona?</h3>
            <div className="flex gap-2">
              {deudor.deudas.map((d) => (
                <button key={d.moneda} onClick={() => { setDeuda(d); setMetodo(null); setMonto(null); }} className={`rounded-2xl border px-4 py-2.5 text-left ${deuda.moneda === d.moneda ? 'border-gold bg-gold/15' : 'border-gold/15'}`}>
                  <span className="block text-xs text-smoke">Deuda en {d.moneda}</span><b className="font-display text-lg">{dinero(d.saldo, d.moneda)}</b>
                </button>
              ))}
            </div>
          </section>
        )}
        <section>
          <h3 className="mb-2 text-xs tracking-wider text-gold uppercase">¿Con qué paga?</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {metodos.datos?.map((m) => (
              <button key={m.id} onClick={() => elegirMetodo(m)} className={`flex items-center gap-2 rounded-2xl border p-3 text-left text-sm transition ${metodo?.id === m.id ? 'border-gold bg-gold/15' : 'border-gold/15 hover:border-gold/50'}`}>
                {m.es_efectivo ? <Banknote size={18} className="shrink-0 text-venom" /> : <CreditCard size={18} className="shrink-0 text-gold" />}
                <span className="min-w-0"><span className="block truncate font-medium">{m.nombre}</span><span className="block text-[10px] text-smoke">{m.monedas.join(' · ')}</span></span>
              </button>
            ))}
          </div>
        </section>
        {metodo && (
          <section className="grid gap-3 sm:grid-cols-[110px_1fr_1fr]">
            <Campo etiqueta="Moneda">
              <Select value={moneda} onChange={(e) => { const mon = e.target.value as Moneda; setMoneda(mon); setMonto(redondear(convertir(deuda.saldo, deuda.moneda, mon, t), mon)); }}>
                {metodo.monedas.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </Campo>
            <Campo etiqueta="Monto que entrega" ayuda={`Deuda completa: ${dinero(total, moneda)}${moneda !== deuda.moneda && monto ? ` · equivale a ${dinero(aplicado, deuda.moneda)}` : ''}`}>
              <InputNum autoFocus valor={monto} onCambio={setMonto} />
            </Campo>
            {metodo.requiere_referencia ? <Campo etiqueta="N.º de referencia"><Input value={referencia} onChange={(e) => setReferencia(e.target.value)} /></Campo> : <span />}
          </section>
        )}
        <label className="flex items-center gap-2 border-t border-gold/10 pt-4 text-sm text-smoke">
          Entra a
          <Select value={cajaId ?? ''} onChange={(e) => setCajaId(Number(e.target.value))} className="w-48">{abiertas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</Select>
        </label>
      </div>
    </Modal>
  );
}

// ====================================================================== Estado de cuenta del cliente
function EstadoCuenta({ deudor, onCerrar }: { deudor: Deudor; onCerrar: () => void }) {
  const { datos, cargando } = useDatos<{ deudas: Deuda[]; movimientos: Movimiento[] }>(`/creditos/${deudor.id}`);
  return (
    <Modal titulo={deudor.nombre} subtitulo={datos ? (datos.deudas.length ? `Debe ${datos.deudas.map((d) => dinero(d.saldo, d.moneda)).join(' + ')}` : 'Al día: no debe nada') : 'Estado de cuenta'} onCerrar={onCerrar} ancho="max-w-2xl">
      {cargando || !datos ? <Cargando /> : (
        <ul className="space-y-2">
          {datos.movimientos.map((m) => (
            <li key={m.id} className={`rounded-2xl border p-3 ${m.tipo === 'cargo' ? 'border-red-400/25 bg-red-500/5' : 'border-venom/25 bg-venom/5'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {m.tipo === 'cargo' ? (m.motivo === 'se_fue' ? <><DoorOpen size={15} className="text-red-300" /> Consumió y se fue</> : <><HandCoins size={15} className="text-gold" /> Fiado</>) : <><Wallet size={15} className="text-venom" /> Abono · {m.metodo}</>}
                    {m.cuenta && <Link href={`/admin/cuenta/${m.cuenta_id}`} className="text-xs font-normal text-smoke underline hover:text-gold">{m.cuenta}</Link>}
                  </p>
                  <p className="text-xs text-smoke">{fechaHora(m.fecha)} · {m.usuario ?? '—'}{m.referencia && ` · ref ${m.referencia}`}</p>
                  {m.consumo && <p className="mt-1 text-xs text-ivory/80">{m.consumo}</p>}
                  {m.nota && <p className="mt-1 text-xs text-gold-light">📝 {m.nota}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className={`font-display text-xl ${m.tipo === 'cargo' ? 'text-red-300' : 'text-venom'}`}>{m.tipo === 'cargo' ? '+' : '−'}{dinero(m.monto, m.moneda)}</p>
                  {m.tipo === 'abono' && m.pago_moneda && m.pago_moneda !== m.moneda && <p className="text-[11px] text-smoke">entregó {dinero(m.pago_monto, m.pago_moneda)}</p>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
