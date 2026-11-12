'use client';

import { Banknote, CheckCircle2, CreditCard, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AbrirCajaRapida } from './AbrirCaja';
import { adm } from '@/lib/admin/api';
import { MONEDAS, type Moneda, type Tasa, convertir, dinero, redondear, tolerancia } from '@/lib/admin/moneda';
import { Boton, Cargando, Input, InputNum, Insignia, Interruptor, Modal, Select, useAvisos, useDatos } from '../ui';
import type { Cuenta, MetodoPago } from './tipos';

const NOMBRE_MONEDA: Record<Moneda, string> = { COP: 'Pesos', USD: 'Dólares', VES: 'Bolívares' };
type Linea = { clave: number; metodo: MetodoPago; moneda: Moneda; monto: number | null; referencia: string };
type CajaAbierta = { id: number; nombre: string; sesion: { id: number; usuario: string } | null };
type Resultado = { saldado: boolean; restante: number; vuelto: { monto: number; moneda: Moneda } | null; cuenta: Cuenta };

/** Saldo pendiente de un puesto: lo que consumió (con su parte de servicio/descuento) menos lo que ya pagó */
export function saldoPorPuesto(c: Cuenta) {
  const factor = c.subtotal > 0 ? c.total / c.subtotal : 1;
  const mapa = new Map<number, number>();
  for (const i of c.items) if (i.estado !== 'anulado' && i.asiento) mapa.set(i.asiento, (mapa.get(i.asiento) ?? 0) + i.subtotal * factor);
  for (const p of c.pagos) if (p.asiento) mapa.set(p.asiento, (mapa.get(p.asiento) ?? 0) - p.monto_cuenta);
  return [...mapa.entries()].map(([asiento, saldo]) => ({ asiento, saldo: Math.min(c.saldo, redondear(saldo, c.moneda)) })).filter((x) => x.saldo > tolerancia(c.moneda)).sort((a, b) => a.asiento - b.asiento);
}

export function Cobro({ cuenta, tasa, onCerrar, onPagado, cerrarAlPagar }: { cuenta: Cuenta; tasa: Tasa; onCerrar: () => void; onPagado: (c: Cuenta) => void; /** Venta rápida: cerrar la cuenta al completar el pago */ cerrarAlPagar?: boolean }) {
  const moneda = cuenta.moneda;
  const metodos = useDatos<MetodoPago[]>('/metodos-pago');
  const cajas = useDatos<CajaAbierta[]>('/caja');
  const abiertas = (cajas.datos ?? []).filter((c) => c.sesion);
  const [cajaId, setCajaId] = useState<number | null>(null);
  const puestos = useMemo(() => saldoPorPuesto(cuenta), [cuenta]);
  const [modo, setModo] = useState<'todo' | 'puesto' | 'otro'>('todo');
  const [puesto, setPuesto] = useState<number | null>(null);
  const [otro, setOtro] = useState<number | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [vueltoMoneda, setVueltoMoneda] = useState<Moneda>(moneda);
  const [cerrar, setCerrar] = useState(cerrarAlPagar ?? cuenta.tipo !== 'barra');
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const avisos = useAvisos();

  // Caja: la última usada en este equipo, o la única abierta
  useEffect(() => {
    if (cajaId || !abiertas.length) return;
    const guardada = Number(localStorage.getItem('mamba_caja'));
    setCajaId(abiertas.find((c) => c.id === guardada)?.id ?? (cuenta.tipo === 'barra' ? abiertas.find((c) => /barra/i.test(c.nombre))?.id : undefined) ?? abiertas[0].id);
  }, [abiertas, cajaId, cuenta.tipo]);

  const objetivo = modo === 'todo' ? cuenta.saldo : modo === 'puesto' ? (puestos.find((p) => p.asiento === puesto)?.saldo ?? 0) : Math.min(cuenta.saldo, otro ?? 0);
  const enCuenta = (l: Linea) => redondear(convertir(l.monto ?? 0, l.moneda, moneda, tasa), moneda);
  const recibido = lineas.reduce((s, l) => s + enCuenta(l), 0);
  const falta = redondear(objetivo - recibido, moneda);
  const exceso = falta < -tolerancia(moneda) ? -falta : 0;
  const completo = Math.abs(falta) <= tolerancia(moneda) || exceso > 0;
  const cubreTodo = objetivo >= cuenta.saldo - tolerancia(moneda) && completo;
  const ultimaEfectivo = lineas.at(-1)?.metodo.es_efectivo ?? false;

  const agregar = (m: MetodoPago, enMoneda?: Moneda) => {
    const mon = enMoneda ?? (m.monedas.includes(moneda) ? moneda : m.monedas[0]);
    const pendiente = Math.max(0, falta);
    setLineas([...lineas, { clave: Date.now(), metodo: m, moneda: mon, monto: pendiente > 0 ? redondear(convertir(pendiente, moneda, mon, tasa), mon) : null, referencia: '' }]);
  };
  const setL = (clave: number, cambios: Partial<Linea>) => setLineas(lineas.map((l) => (l.clave === clave ? { ...l, ...cambios } : l)));

  const cobrar = async () => {
    if (!cajaId) return avisos.error('Selecciona la caja');
    const sesionId = abiertas.find((c) => c.id === cajaId)?.sesion?.id;
    if (!sesionId) return avisos.error('Esa caja no está abierta');
    const validas = lineas.filter((l) => (l.monto ?? 0) > 0);
    if (!validas.length) return avisos.error('Agrega al menos un pago');
    const sinRef = validas.find((l) => l.metodo.requiere_referencia && !l.referencia.trim());
    if (sinRef) return avisos.error(`Falta la referencia de ${sinRef.metodo.nombre}`);
    if (exceso > 0 && !ultimaEfectivo) return avisos.error('El monto supera lo que se va a cobrar. Solo el efectivo da vuelto: ajusta el último pago.');

    // Abono parcial con efectivo de más: se aplica solo lo necesario y el resto es vuelto (se calcula aquí
    // porque el servidor solo da vuelto cuando se supera el saldo TOTAL de la cuenta).
    let pagos = validas.map((l) => ({ metodo_pago_id: l.metodo.id, moneda: l.moneda, monto: l.monto!, referencia: l.referencia.trim() || null }));
    let vueltoLocal: Resultado['vuelto'] = null;
    if (exceso > 0 && objetivo < cuenta.saldo - tolerancia(moneda)) {
      const ult = validas.at(-1)!;
      const necesario = redondear(convertir(enCuenta(ult) - exceso, moneda, ult.moneda, tasa), ult.moneda);
      pagos = pagos.map((p, i) => (i === pagos.length - 1 ? { ...p, monto: necesario } : p));
      vueltoLocal = { monto: redondear(convertir(exceso, moneda, vueltoMoneda, tasa), vueltoMoneda), moneda: vueltoMoneda };
    }

    setOcupado(true);
    try {
      const r = await adm<Resultado>(`/cuentas/${cuenta.id}/pagos`, {
        method: 'POST',
        body: { pagos, sesion_caja_id: sesionId, asiento: modo === 'puesto' ? puesto : null, vuelto_moneda: vueltoMoneda, cerrar: cerrar && cubreTodo },
      });
      localStorage.setItem('mamba_caja', String(cajaId));
      setResultado({ ...r, vuelto: r.vuelto ?? vueltoLocal });
      onPagado(r.cuenta);
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(false);
    }
  };

  // ------------------------------------------------------------------ Resultado
  if (resultado) {
    return (
      <Modal titulo="Pago registrado" onCerrar={onCerrar} ancho="max-w-md" pie={<Boton variante="oro" tam="lg" className="w-full" onClick={onCerrar}>Listo</Boton>}>
        <div className="py-4 text-center">
          <CheckCircle2 size={56} className="mx-auto text-venom" />
          {resultado.vuelto ? (
            <>
              <p className="mt-4 text-sm tracking-wider text-smoke uppercase">Vuelto a entregar</p>
              <p className="font-display text-5xl font-light text-gold-light">{dinero(resultado.vuelto.monto, resultado.vuelto.moneda)}</p>
            </>
          ) : <p className="mt-4 font-display text-2xl">Sin vuelto</p>}
          <p className="mt-4 text-sm text-smoke">
            {resultado.cuenta.estado === 'pagada' ? `Cuenta ${resultado.cuenta.numero} cerrada ✔` : resultado.saldado ? 'Cuenta al día. Sigue abierta para nuevos pedidos.' : `Quedan ${dinero(resultado.restante, moneda)} por cobrar.`}
          </p>
        </div>
      </Modal>
    );
  }

  if (cajas.cargando || metodos.cargando) return <Modal titulo="Cobrar" onCerrar={onCerrar}><Cargando /></Modal>;

  if (!abiertas.length) {
    return (
      <Modal titulo="Abre la caja para cobrar" subtitulo="Es un solo paso: confirma con cuánto efectivo arrancas y sigues cobrando." onCerrar={onCerrar} ancho="max-w-md">
        <AbrirCajaRapida onAbierta={cajas.recargar} />
      </Modal>
    );
  }

  return (
    <Modal
      titulo={`Cobrar ${cuenta.numero}`}
      subtitulo={`Saldo: ${dinero(cuenta.saldo, moneda)} · ${MONEDAS.filter((m) => m !== moneda).map((m) => dinero(cuenta.equivalentes.saldo[m], m)).join(' · ')}`}
      onCerrar={onCerrar}
      ancho="max-w-3xl"
      pie={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            {exceso > 0 ? (
              <span className="flex flex-wrap items-center gap-2">
                Vuelto: <b className="font-display text-xl text-gold-light">{dinero(convertir(exceso, moneda, vueltoMoneda, tasa), vueltoMoneda)}</b>
                <span className="flex gap-1">{MONEDAS.map((m) => <button key={m} onClick={() => setVueltoMoneda(m)} className={`rounded-full px-2 py-0.5 text-[11px] ${vueltoMoneda === m ? 'bg-gold text-void' : 'border border-gold/30 text-smoke'}`}>en {m}</button>)}</span>
              </span>
            ) : falta > tolerancia(moneda) ? (
              <span>Falta <b className="font-display text-xl text-red-300">{dinero(falta, moneda)}</b></span>
            ) : <span className="text-venom">✓ Monto exacto</span>}
          </div>
          <Boton variante="oro" tam="lg" cargando={ocupado} disabled={!lineas.length || recibido <= 0} onClick={cobrar}>
            {completo ? (cerrar && cubreTodo ? 'Cobrar y cerrar cuenta' : 'Cobrar') : `Abonar ${dinero(recibido, moneda)}`}
          </Boton>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Qué se cobra */}
        <section>
          <h3 className="mb-2 text-xs tracking-wider text-gold uppercase">¿Qué va a pagar?</h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setModo('todo'); setLineas([]); }} className={`rounded-2xl border px-4 py-2.5 text-left ${modo === 'todo' ? 'border-gold bg-gold/15' : 'border-gold/15'}`}>
              <span className="block text-xs text-smoke">Todo el saldo</span><b className="font-display text-lg">{dinero(cuenta.saldo, moneda)}</b>
            </button>
            {puestos.map((p) => (
              <button key={p.asiento} onClick={() => { setModo('puesto'); setPuesto(p.asiento); setLineas([]); }} className={`rounded-2xl border px-4 py-2.5 text-left ${modo === 'puesto' && puesto === p.asiento ? 'border-gold bg-gold/15' : 'border-gold/15'}`}>
                <span className="block text-xs text-smoke">Puesto {p.asiento}</span><b className="font-display text-lg">{dinero(p.saldo, moneda)}</b>
              </button>
            ))}
            <div className={`rounded-2xl border px-4 py-2.5 ${modo === 'otro' ? 'border-gold bg-gold/15' : 'border-gold/15'}`}>
              <span className="block text-xs text-smoke">Otro monto (abono)</span>
              <InputNum valor={otro} onCambio={(v) => { setModo('otro'); setOtro(v); setLineas([]); }} onFocus={() => setModo('otro')} className="mt-1 h-8 w-32" placeholder={moneda} />
            </div>
          </div>
        </section>

        {/* Métodos */}
        <section>
          <h3 className="mb-2 text-xs tracking-wider text-gold uppercase">¿Con qué paga? <span className="text-smoke normal-case">· puedes combinar varios</span></h3>
          {metodos.datos && !metodos.datos.length && (
            <p className="mb-2 rounded-xl border border-red-400/40 bg-red-950/30 p-3 text-sm text-red-100">
              No hay métodos de pago creados. Créalos en Administración → Métodos de pago (Efectivo, Nequi, Pago Móvil…).
            </p>
          )}
          {/* Un botón por método y moneda: «Efectivo · dólares» se toca directo, sin cambiar nada después */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {metodos.datos?.flatMap((m) => m.monedas.map((mon) => (
              <button key={`${m.id}-${mon}`} onClick={() => agregar(m, mon)} className="flex items-center gap-2 rounded-2xl border border-gold/15 p-3 text-left text-sm transition hover:border-gold hover:bg-gold/10">
                {m.es_efectivo ? <Banknote size={18} className="shrink-0 text-venom" /> : <CreditCard size={18} className="shrink-0 text-gold" />}
                <span className="min-w-0">
                  <span className="block truncate font-medium">{m.nombre}</span>
                  <span className={`block text-[11px] font-semibold ${mon === 'USD' ? 'text-venom' : mon === 'VES' ? 'text-sky-300' : 'text-gold-light'}`}>{NOMBRE_MONEDA[mon]}</span>
                </span>
              </button>
            )))}
          </div>
          {/* Cuánto falta en cada moneda: para decirle al cliente «son 20 dólares» o «son 800 bolívares» */}
          {!completo && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {MONEDAS.map((m) => (
                <div key={m} className={`rounded-xl border px-3 py-2 ${m === moneda ? 'border-gold/40 bg-gold/5' : 'border-white/10'}`}>
                  <span className="block text-[10px] tracking-wider text-smoke uppercase">{lineas.length ? 'Falta en' : 'Son'} {NOMBRE_MONEDA[m].toLowerCase()}</span>
                  <b className="font-display text-lg">{dinero(redondear(convertir(Math.max(0, falta), moneda, m, tasa), m), m)}</b>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Líneas de pago */}
        {lineas.length > 0 && (
          <section className="space-y-2">
            {lineas.map((l) => (
              <div key={l.clave} className="grid grid-cols-[1fr_auto] items-center gap-2 rounded-2xl border border-gold/15 bg-void/40 p-3 sm:grid-cols-[1.1fr_90px_1fr_1fr_auto]">
                <p className="text-sm font-medium">{l.metodo.nombre}</p>
                <Select value={l.moneda} onChange={(e) => { const m = e.target.value as Moneda; setL(l.clave, { moneda: m, monto: l.monto == null ? null : redondear(convertir(l.monto, l.moneda, m, tasa), m) }); }} className="col-start-1 sm:col-start-auto">
                  {l.metodo.monedas.map((m) => <option key={m} value={m}>{NOMBRE_MONEDA[m]}</option>)}
                </Select>
                <div>
                  <InputNum autoFocus valor={l.monto} onCambio={(v) => setL(l.clave, { monto: v })} placeholder="Monto" />
                  {l.moneda !== moneda && l.monto ? <p className="mt-0.5 text-[11px] text-smoke">= {dinero(enCuenta(l), moneda)}</p> : null}
                </div>
                {l.metodo.requiere_referencia ? <Input value={l.referencia} onChange={(e) => setL(l.clave, { referencia: e.target.value })} placeholder="N.º de referencia" /> : <span className="hidden sm:block" />}
                <button onClick={() => setLineas(lineas.filter((x) => x.clave !== l.clave))} className="row-start-1 justify-self-end text-smoke hover:text-red-300 sm:row-start-auto" aria-label="Quitar pago"><Trash2 size={16} /></button>
              </div>
            ))}
          </section>
        )}

        <section className="flex flex-wrap items-center justify-between gap-3 border-t border-gold/10 pt-4">
          <label className="flex items-center gap-2 text-sm text-smoke">
            Entra a
            <Select value={cajaId ?? ''} onChange={(e) => setCajaId(Number(e.target.value))} className="w-48">
              {abiertas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
          </label>
          <Interruptor activo={cerrar} onCambio={setCerrar} etiqueta={cerrar ? 'Cerrar la cuenta al completar el pago' : 'Dejar la cuenta abierta (sigue consumiendo)'} />
          {modo === 'puesto' && puesto && <Insignia color="azul">Pago del puesto {puesto}</Insignia>}
        </section>
      </div>
    </Modal>
  );
}
