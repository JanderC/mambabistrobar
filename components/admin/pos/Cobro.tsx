'use client';

import { Banknote, CheckCircle2, CreditCard, ListChecks, Minus, Plus, Printer, Trash2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AbrirCajaRapida } from './AbrirCaja';
import { adm } from '@/lib/admin/api';
import { MONEDAS, type Moneda, type Tasa, convertir, dinero, redondear, tolerancia } from '@/lib/admin/moneda';
import { Boton, Cargando, Input, InputNum, Insignia, Interruptor, Modal, Select, useAvisos, useDatos } from '../ui';
import type { Cuenta, MetodoPago } from './tipos';

const NOMBRE_MONEDA: Record<Moneda, string> = { COP: 'Pesos', USD: 'Dólares', VES: 'Bolívares' };
type Linea = { clave: number; metodo: MetodoPago; moneda: Moneda; monto: number | null; referencia: string };
type CajaAbierta = { id: number; nombre: string; sesion: { id: number; usuario: string } | null };
type Parte = { n: number; monto: number; pagado?: string; vuelto?: string };
type PagoPersona = { n: number; monto: number; como: string; vuelto?: string; lineas: { nombre: string; cantidad: number; monto: number }[] };
type Resultado = { saldado: boolean; restante: number; vuelto: { monto: number; moneda: Moneda } | null; cuenta: Cuenta };

/** Saldo pendiente de un puesto: lo que consumió (con su parte de servicio/descuento) menos lo que ya pagó */
export function saldoPorPuesto(c: Cuenta) {
  const factor = c.subtotal > 0 ? c.total / c.subtotal : 1;
  const mapa = new Map<number, number>();
  for (const i of c.items) if (i.estado !== 'anulado' && i.asiento) mapa.set(i.asiento, (mapa.get(i.asiento) ?? 0) + i.subtotal * factor);
  for (const p of c.pagos) if (p.asiento) mapa.set(p.asiento, (mapa.get(p.asiento) ?? 0) - p.monto_cuenta);
  return [...mapa.entries()].map(([asiento, saldo]) => ({ asiento, saldo: Math.min(c.saldo, redondear(saldo, c.moneda)) })).filter((x) => x.saldo > tolerancia(c.moneda)).sort((a, b) => a.asiento - b.asiento);
}

export function Cobro({ cuenta: cuentaInicial, tasa, onCerrar, onPagado, cerrarAlPagar }: { cuenta: Cuenta; tasa: Tasa; onCerrar: () => void; onPagado: (c: Cuenta) => void; /** Venta rápida: cerrar la cuenta al completar el pago */ cerrarAlPagar?: boolean }) {
  const [cuenta, setCuenta] = useState(cuentaInicial);
  const moneda = cuenta.moneda;
  const metodos = useDatos<MetodoPago[]>('/metodos-pago');
  const cajas = useDatos<CajaAbierta[]>('/caja');
  const abiertas = (cajas.datos ?? []).filter((c) => c.sesion);
  const [cajaId, setCajaId] = useState<number | null>(null);
  const puestos = useMemo(() => saldoPorPuesto(cuenta), [cuenta]);
  const [modo, setModo] = useState<'todo' | 'puesto' | 'otro' | 'dividir' | 'productos'>('todo');
  // Cobro por producto: cada cliente paga lo suyo («la hamburguesa y la malteada»). sel = unidades elegidas por producto
  const [sel, setSel] = useState<Record<number, number>>({});
  const [pagosPorPersona, setPagosPorPersona] = useState<PagoPersona[]>([]);
  // Cuenta dividida entre varias personas: cada parte se cobra aparte, con su método y su moneda
  const claveDivision = `mamba_division_${cuenta.id}`;
  const [partes, setPartes] = useState<Parte[]>(() => {
    try { return JSON.parse(localStorage.getItem(claveDivision) ?? '[]') as Parte[]; } catch { return []; }
  });
  const [parteActual, setParteActual] = useState<number | null>(null);
  const [personas, setPersonas] = useState<number>(Math.max(2, cuentaInicial.personas || 2));
  const [ultimoPago, setUltimoPago] = useState<string | null>(null);
  useEffect(() => {
    try { if (partes.length) localStorage.setItem(claveDivision, JSON.stringify(partes)); else localStorage.removeItem(claveDivision); } catch { /* sin almacenamiento */ }
  }, [partes, claveDivision]);
  // Si se abre una cuenta que ya venía dividida, arranca en la primera persona pendiente
  useEffect(() => {
    if (partes.some((x) => !x.pagado)) { setModo('dividir'); setParteActual(partes.find((x) => !x.pagado)!.n); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Reparte el saldo en partes iguales (la última absorbe el redondeo) */
  const dividir = (n: number) => {
    const pagadas = partes.filter((x) => x.pagado);
    const pendiente = cuenta.saldo;
    const base = redondear(pendiente / n, moneda);
    const nuevas: Parte[] = Array.from({ length: n }, (_, k) => ({ n: pagadas.length + k + 1, monto: k === n - 1 ? redondear(pendiente - base * (n - 1), moneda) : base }));
    setPartes([...pagadas, ...nuevas]);
    setModo('dividir');
    setParteActual(nuevas[0].n);
    setLineas([]);
  };
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
    setCajaId(abiertas.find((c) => c.id === guardada)?.id ?? abiertas[0].id);
  }, [abiertas, cajaId, cuenta.tipo]);

  const parte = partes.find((x) => x.n === parteActual);
  // Precio por unidad de cada producto con su parte de servicio y descuento (para que la suma cuadre con el total)
  const factor = cuenta.subtotal > 0 ? cuenta.total / cuenta.subtotal : 1;
  const porCobrar = cuenta.items.filter((i) => i.estado !== 'anulado' && Number(i.cantidad) - Number(i.pagado_cantidad ?? 0) > 0);
  const unitario = (i: Cuenta['items'][number]) => (Number(i.subtotal) / Number(i.cantidad)) * factor;
  const elegidoTodo = porCobrar.length > 0 && porCobrar.every((i) => (sel[i.id] ?? 0) >= Number(i.cantidad) - Number(i.pagado_cantidad ?? 0));
  // Si eligió todo lo que falta, paga exactamente el saldo (sin diferencias de redondeo)
  const montoProductos = elegidoTodo ? cuenta.saldo : Math.min(cuenta.saldo, redondear(porCobrar.reduce((t, i) => t + (sel[i.id] ?? 0) * unitario(i), 0), moneda));
  const objetivo = modo === 'todo' ? cuenta.saldo
    : modo === 'puesto' ? (puestos.find((p) => p.asiento === puesto)?.saldo ?? 0)
    : modo === 'dividir' ? Math.min(cuenta.saldo, parte && !parte.pagado ? parte.monto : 0)
    : modo === 'productos' ? montoProductos
    : Math.min(cuenta.saldo, otro ?? 0);
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

  /** Ticket separado para un cliente: sus productos, lo que pagó y cómo (se imprime sin abrir ventanas) */
  const imprimirTicket = (x: PagoPersona) => {
    document.getElementById('ticket-cliente')?.remove();
    const marco = document.createElement('iframe');
    marco.id = 'ticket-cliente';
    marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(marco);
    const esc = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
    const filas = x.lineas.map((l) => `<tr><td>${l.cantidad}× ${esc(l.nombre)}</td><td class="d">${esc(dinero(l.monto, moneda))}</td></tr>`).join('');
    marco.contentWindow!.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Ticket</title><style>
      @page { size: 80mm auto; margin: 4mm; } body { font: 12px monospace; margin: 0; width: 72mm; }
      h1 { font-size: 14px; text-align: center; margin: 0 0 4px; } p { margin: 2px 0; text-align: center; }
      table { width: 100%; border-collapse: collapse; margin: 6px 0; } td { padding: 2px 0; vertical-align: top; } .d { text-align: right; white-space: nowrap; }
      .t { border-top: 1px dashed #000; font-weight: bold; font-size: 14px; }
    </style></head><body><h1>MAMBA BISTRO BAR</h1><p>Cuenta ${esc(cuenta.numero)} · Cliente ${x.n}</p><p>${new Date().toLocaleString('es-CO')}</p>
      <table>${filas}<tr class="t"><td>TOTAL</td><td class="d">${esc(dinero(x.monto, moneda))}</td></tr></table>
      <p>Pagó con ${esc(x.como)}${x.vuelto ? ` · vuelto ${esc(x.vuelto)}` : ''}</p><p>¡Gracias por tu visita!</p></body></html>`);
    marco.contentWindow!.document.close();
    setTimeout(() => { marco.contentWindow!.focus(); marco.contentWindow!.print(); }, 250);
  };

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
        body: {
          pagos, sesion_caja_id: sesionId, asiento: modo === 'puesto' ? puesto : null, vuelto_moneda: vueltoMoneda, cerrar: cerrar && cubreTodo,
          items: modo === 'productos' ? Object.entries(sel).filter(([, n]) => n > 0).map(([id, cantidad]) => ({ id: Number(id), cantidad })) : [],
        },
      });
      localStorage.setItem('mamba_caja', String(cajaId));
      onPagado(r.cuenta);
      setCuenta(r.cuenta);
      const vuelto = r.vuelto ?? vueltoLocal;
      if (modo === 'productos') {
        const como = validas.map((l) => `${l.metodo.nombre} ${NOMBRE_MONEDA[l.moneda].toLowerCase()}`).join(' + ');
        const persona: PagoPersona = {
          n: pagosPorPersona.length + 1, monto: montoProductos, como, vuelto: vuelto ? dinero(vuelto.monto, vuelto.moneda) : undefined,
          lineas: porCobrar.filter((i) => sel[i.id]).map((i) => ({ nombre: `${i.nombre}${i.presentacion && !/^(unidad|botella|porci[oó]n)$/i.test(i.presentacion) ? ` · ${i.presentacion}` : ''}`, cantidad: sel[i.id], monto: redondear(sel[i.id] * unitario(i), moneda) })),
        };
        setPagosPorPersona((x) => [...x, persona]);
        setSel({});
        if (r.cuenta.estado === 'abierta' && r.cuenta.saldo > tolerancia(moneda)) {
          setUltimoPago(`Cliente ${persona.n} pagó ${dinero(persona.monto, moneda)} con ${como}${vuelto ? ` · VUELTO: ${dinero(vuelto.monto, vuelto.moneda)}` : ''}`);
          setLineas([]);
          return;
        }
      }
      if (modo === 'dividir' && parte) {
        const como = validas.map((l) => `${l.metodo.nombre} ${NOMBRE_MONEDA[l.moneda].toLowerCase()}`).join(' + ');
        const nuevas = partes.map((x) => (x.n === parte.n ? { ...x, pagado: como, vuelto: vuelto ? dinero(vuelto.monto, vuelto.moneda) : undefined } : x));
        setPartes(nuevas);
        const siguiente = nuevas.find((x) => !x.pagado);
        if (siguiente && r.cuenta.estado === 'abierta' && r.cuenta.saldo > tolerancia(moneda)) {
          // Sigue con la próxima persona sin salir del cobro; el vuelto de esta queda a la vista
          setUltimoPago(`Persona ${parte.n} pagó ${dinero(parte.monto, moneda)} con ${como}${vuelto ? ` · VUELTO: ${dinero(vuelto.monto, vuelto.moneda)}` : ''}`);
          setParteActual(siguiente.n);
          setLineas([]);
          return;
        }
        setPartes([]);
      }
      setResultado({ ...r, vuelto });
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
          {pagosPorPersona.length > 0 && (
            <ul className="mt-4 space-y-1 text-left">
              {pagosPorPersona.map((x) => (
                <li key={x.n} className="flex items-center gap-2 rounded-xl border border-venom/25 px-3 py-1.5 text-xs">
                  <span className="min-w-0 flex-1 truncate"><b className="text-venom">Cliente {x.n}</b> · {dinero(x.monto, moneda)} · {x.como}</span>
                  <button onClick={() => imprimirTicket(x)} className="flex shrink-0 items-center gap-1 text-gold-light"><Printer size={13} /> Ticket</button>
                </li>
              ))}
            </ul>
          )}
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
            {modo === 'productos'
              ? (completo ? `Cobrar a cliente ${pagosPorPersona.length + 1}${cerrar && cubreTodo ? ' y cerrar' : ''}` : `Abonar ${dinero(recibido, moneda)}`)
              : modo === 'dividir' && parte && !parte.pagado
              ? (completo ? `Cobrar persona ${parte.n}${cerrar && cubreTodo ? ' y cerrar' : ''}` : `Abonar ${dinero(recibido, moneda)}`)
              : completo ? (cerrar && cubreTodo ? 'Cobrar y cerrar cuenta' : 'Cobrar') : `Abonar ${dinero(recibido, moneda)}`}
          </Boton>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Qué se cobra */}
        <section>
          <h3 className="mb-2 text-xs tracking-wider text-gold uppercase">¿Qué va a pagar?</h3>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => { setModo('todo'); setLineas([]); setUltimoPago(null); }} className={`rounded-2xl border px-4 py-2.5 text-left ${modo === 'todo' ? 'border-gold bg-gold/15' : 'border-gold/15'}`}>
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
            {/* Cada cliente paga sus productos */}
            <button onClick={() => { setModo('productos'); setLineas([]); setUltimoPago(null); }}
              className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-left ${modo === 'productos' ? 'border-gold bg-gold/15' : 'border-gold/15'}`}>
              <ListChecks size={18} className="text-gold" />
              <span><span className="block text-xs text-smoke">Cuentas separadas</span><b className="text-sm">Por producto</b></span>
            </button>
            {/* Dividir entre varias personas */}
            <div className={`flex items-center gap-2 rounded-2xl border px-3 py-2 ${modo === 'dividir' ? 'border-gold bg-gold/15' : 'border-gold/15'}`}>
              <Users size={18} className="text-gold" />
              <span className="text-xs text-smoke">Dividir entre</span>
              <button onClick={() => setPersonas(Math.max(2, personas - 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-gold/25" aria-label="Menos personas"><Minus size={14} /></button>
              <b className="w-6 text-center font-display text-xl">{personas}</b>
              <button onClick={() => setPersonas(Math.min(30, personas + 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-gold/25" aria-label="Más personas"><Plus size={14} /></button>
              <Boton tam="sm" variante={modo === 'dividir' ? 'borde' : 'oro'} onClick={() => dividir(personas)}>{partes.some((x) => !x.pagado) ? 'Volver a dividir' : 'Dividir'}</Boton>
            </div>
          </div>

          {/* Por producto: se tocan los productos de este cliente; lo ya pagado queda marcado */}
          {modo === 'productos' && (
            <div className="mt-3">
              {ultimoPago && <p className="mb-2 rounded-xl border border-venom/40 bg-emerald/30 px-3 py-2 text-sm text-venom">✓ {ultimoPago}</p>}
              <p className="mb-2 text-xs text-smoke">Toca lo que paga <b className="text-gold-light">el cliente {pagosPorPersona.length + 1}</b>. Si pidió varias unidades, toca otra vez para sumar.</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {cuenta.items.filter((i) => i.estado !== 'anulado').map((i) => {
                  const resto = Number(i.cantidad) - Number(i.pagado_cantidad ?? 0);
                  const n = sel[i.id] ?? 0;
                  const pagado = resto <= 0;
                  return (
                    <div key={i.id} className={`flex items-center gap-2 rounded-xl border p-2 ${pagado ? 'border-venom/20 bg-emerald/10 opacity-60' : n ? 'border-gold bg-gold/15' : 'border-gold/15'}`}>
                      <button disabled={pagado} onClick={() => setSel({ ...sel, [i.id]: Math.min(resto, n + 1) })} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm">{Number(i.cantidad) > 1 && <b className="text-gold-light">{Number(i.cantidad)}× </b>}{i.nombre}{i.presentacion && !/^(unidad|botella|porci[oó]n)$/i.test(i.presentacion) && <span className="text-smoke"> · {i.presentacion}</span>}</span>
                        <span className="block text-[11px] text-smoke">
                          {pagado ? '✓ Ya pagado' : `${dinero(redondear(unitario(i), moneda), moneda)} c/u${Number(i.pagado_cantidad) > 0 ? ` · faltan ${resto}` : ''}`}
                        </span>
                      </button>
                      {n > 0 && (
                        <span className="flex shrink-0 items-center gap-1">
                          <button onClick={() => setSel({ ...sel, [i.id]: n - 1 })} className="grid h-7 w-7 place-items-center rounded-lg border border-gold/30" aria-label="Uno menos"><Minus size={13} /></button>
                          <b className="w-5 text-center">{n}</b>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-void/50 px-3 py-2">
                <span className="text-sm">Cliente {pagosPorPersona.length + 1} paga <b className="font-display text-xl text-gold-light">{dinero(montoProductos, moneda)}</b>
                  {montoProductos > 0 && <span className="ml-2 text-xs text-smoke">{MONEDAS.filter((m) => m !== moneda).map((m) => dinero(redondear(convertir(montoProductos, moneda, m, tasa), m), m)).join(' · ')}</span>}
                </span>
                <span className="flex gap-2">
                  {porCobrar.length > 0 && <button onClick={() => setSel(Object.fromEntries(porCobrar.map((i) => [i.id, Number(i.cantidad) - Number(i.pagado_cantidad ?? 0)])))} className="text-xs text-gold-light">Todo lo que falta</button>}
                  {Object.values(sel).some(Boolean) && <button onClick={() => setSel({})} className="text-xs text-smoke">Limpiar</button>}
                </span>
              </div>
              {pagosPorPersona.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {pagosPorPersona.map((x) => (
                    <li key={x.n} className="flex items-center gap-2 rounded-xl border border-venom/25 px-3 py-1.5 text-xs">
                      <span className="min-w-0 flex-1 truncate"><b className="text-venom">Cliente {x.n} ✓</b> {x.lineas.map((l) => `${l.cantidad}× ${l.nombre}`).join(', ')} · {dinero(x.monto, moneda)} · {x.como}{x.vuelto ? ` · vuelto ${x.vuelto}` : ''}</span>
                      <button onClick={() => imprimirTicket(x)} className="flex shrink-0 items-center gap-1 text-gold-light" title="Imprimir el ticket de este cliente"><Printer size={13} /> Ticket</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Una tarjeta por persona: se toca, se elige con qué paga y se cobra; pasa sola a la siguiente */}
          {modo === 'dividir' && partes.length > 0 && (
            <div className="mt-3">
              {ultimoPago && <p className="mb-2 rounded-xl border border-venom/40 bg-emerald/30 px-3 py-2 text-sm text-venom">✓ {ultimoPago}</p>}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {partes.map((x) => (
                  <button key={x.n} disabled={!!x.pagado} onClick={() => { setParteActual(x.n); setLineas([]); setUltimoPago(null); }}
                    className={`rounded-2xl border-2 p-2.5 text-left transition ${x.pagado ? 'border-venom/40 bg-emerald/20' : parteActual === x.n ? 'border-gold bg-gold/15' : 'border-gold/15 hover:border-gold/50'}`}>
                    <span className="flex items-center justify-between text-xs text-smoke">Persona {x.n}{x.pagado ? <span className="text-venom">✓ Pagó</span> : parteActual === x.n ? <span className="text-gold-light">Cobrando</span> : null}</span>
                    <b className={`block font-display text-xl ${x.pagado ? 'text-venom line-through decoration-1' : 'text-gold-light'}`}>{dinero(x.monto, moneda)}</b>
                    {x.pagado
                      ? <span className="block truncate text-[11px] text-venom">{x.pagado}{x.vuelto ? ` · vuelto ${x.vuelto}` : ''}</span>
                      : <span className="block truncate text-[11px] text-smoke">{MONEDAS.filter((m) => m !== moneda).map((m) => dinero(redondear(convertir(x.monto, moneda, m, tasa), m), m)).join(' · ')}</span>}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-smoke">
                {partes.filter((x) => x.pagado).length} de {partes.length} pagaron · falta {dinero(cuenta.saldo, moneda)}
                {parte && !parte.pagado && <> · ahora cobras a la <b className="text-gold-light">persona {parte.n}</b>: elige abajo con qué paga</>}
              </p>
            </div>
          )}
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
