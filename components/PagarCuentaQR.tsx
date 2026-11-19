'use client';

import { Banknote, Check, Copy, CreditCard, Loader2, Receipt } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Boton, Modal } from '@/components/admin/ui';
import { type Moneda, dinero } from '@/lib/admin/moneda';

export type CuentaCliente = {
  numero: string; nombre_cliente: string | null; moneda: Moneda; subtotal: number; servicio: number; descuento: number; total: number; pagado: number; saldo: number;
  equivalentes: { saldo: Record<Moneda, number> }; pidio_cuenta: boolean;
  lineas: { nombre: string; presentacion: string | null; cantidad: number; subtotal: number }[];
};
export type MetodoCliente = { nombre: string; es_efectivo: boolean; monedas: Moneda[]; datos_pago: string | null };
type Opcion = { metodo: MetodoCliente; moneda: Moneda };

const NOMBRE: Record<Moneda, string> = { COP: 'pesos', USD: 'dólares', VES: 'bolívares' };
const COLOR: Record<Moneda, string> = { COP: 'text-gold-light', USD: 'text-venom', VES: 'text-sky-300' };

export type DatosCuenta = { cuentas: CuentaCliente[]; metodos: MetodoCliente[] };

/**
 * «Mi cuenta» en el teléfono del cliente: lo que consumió la mesa, el total en pesos / dólares / bolívares,
 * y cómo pagar (con los datos de Nequi, Pago Móvil, Zelle…). Al elegir, avisa a la caja con qué va a pagar.
 */
export function PagarCuentaQR({ cargar, avisar, onCerrar }: {
  cargar: () => Promise<{ cuentas: CuentaCliente[]; metodos: MetodoCliente[] }>;
  avisar: (pago: string | null) => Promise<void>;
  onCerrar: () => void;
}) {
  const [datos, setDatos] = useState<{ cuentas: CuentaCliente[]; metodos: MetodoCliente[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elegida, setElegida] = useState<Opcion | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<string | null>(null);

  useEffect(() => {
    cargar().then(setDatos).catch((e: Error) => setError(e.message));
  }, [cargar]);

  const cuentas = datos?.cuentas ?? [];
  const moneda = cuentas[0]?.moneda ?? 'COP';
  const saldoEn = (m: Moneda) => cuentas.reduce((t, c) => t + Number(m === c.moneda ? c.saldo : c.equivalentes.saldo[m] ?? 0), 0);
  const opciones: Opcion[] = (datos?.metodos ?? []).flatMap((metodo) => metodo.monedas.map((m) => ({ metodo, moneda: m })));

  const copiar = async (texto: string) => {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch { /* sin portapapeles */ }
  };
  const confirmar = async () => {
    setEnviando(true);
    try {
      const pago = elegida ? `${elegida.metodo.nombre} en ${NOMBRE[elegida.moneda]} (${dinero(saldoEn(elegida.moneda), elegida.moneda)})` : null;
      await avisar(pago);
      setListo(elegida
        ? (elegida.metodo.es_efectivo ? 'Listo: ya avisamos. En un momento pasan a cobrarte.' : 'Listo: ya avisamos. Cuando hagas la transferencia, muéstrale el comprobante a tu mesero.')
        : 'Listo: ya avisamos que pediste la cuenta. En un momento te la llevan.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal titulo="Mi cuenta" subtitulo="Lo que lleva tu mesa y cómo pagar" onCerrar={onCerrar} ancho="max-w-lg"
      pie={datos && cuentas.length > 0 && !listo ? (
        <Boton variante="oro" tam="lg" className="!h-14 w-full !text-base" cargando={enviando} onClick={confirmar}>
          <Receipt size={19} /> {elegida ? `Pedir la cuenta · pago con ${elegida.metodo.nombre}` : 'Pedir la cuenta'}
        </Boton>
      ) : listo ? <Boton tam="lg" className="w-full" onClick={onCerrar}>Volver a la carta</Boton> : undefined}>
      {error ? <p className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</p>
        : !datos ? <p className="flex items-center justify-center gap-2 py-10 text-smoke"><Loader2 size={18} className="animate-spin text-gold" /> Buscando tu cuenta…</p>
        : !cuentas.length ? <p className="py-10 text-center text-smoke">Tu mesa todavía no tiene consumos.</p>
        : listo ? (
          <div className="py-6 text-center">
            <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-venom/20"><Check size={36} className="text-venom" /></span>
            <p className="mt-4 text-lg">{listo}</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Lo consumido */}
            {cuentas.map((c) => (
              <section key={c.numero}>
                {cuentas.length > 1 && <p className="mb-1 text-xs text-smoke">Cuenta {c.numero}{c.nombre_cliente ? ` · ${c.nombre_cliente}` : ''}</p>}
                <ul className="divide-y divide-white/5 rounded-2xl border border-gold/10 bg-void/40 px-3">
                  {c.lineas.map((l, k) => (
                    <li key={k} className="flex items-baseline gap-2 py-2 text-sm">
                      <b className="text-gold-light tabular-nums">{Number(l.cantidad)}×</b>
                      <span className="min-w-0 flex-1">{l.nombre}{l.presentacion && !/^(unidad|botella|porci[oó]n)$/i.test(l.presentacion) && <span className="text-smoke"> · {l.presentacion}</span>}</span>
                      <span className="text-smoke tabular-nums">{dinero(l.subtotal, c.moneda)}</span>
                    </li>
                  ))}
                </ul>
                <dl className="mt-2 space-y-0.5 px-1 text-sm">
                  {c.servicio > 0 && <div className="flex justify-between text-smoke"><dt>Servicio</dt><dd>{dinero(c.servicio, c.moneda)}</dd></div>}
                  {c.descuento > 0 && <div className="flex justify-between text-smoke"><dt>Descuento</dt><dd>−{dinero(c.descuento, c.moneda)}</dd></div>}
                  {c.pagado > 0 && <div className="flex justify-between text-venom"><dt>Ya pagado</dt><dd>−{dinero(c.pagado, c.moneda)}</dd></div>}
                </dl>
              </section>
            ))}

            {/* Total en las tres monedas */}
            <section className="rounded-2xl border-2 border-gold/40 bg-gold/5 p-3 text-center">
              <p className="text-xs tracking-wider text-smoke uppercase">Total a pagar</p>
              <p className="font-display text-4xl text-gold-light">{dinero(saldoEn(moneda), moneda)}</p>
              <p className="mt-1 flex justify-center gap-4 text-sm">
                {(['COP', 'USD', 'VES'] as Moneda[]).filter((m) => m !== moneda).map((m) => <span key={m} className={COLOR[m]}>{dinero(saldoEn(m), m)}</span>)}
              </p>
            </section>

            {/* Cómo quiere pagar */}
            {opciones.length > 0 && (
              <section>
                <h3 className="mb-2 text-xs tracking-wider text-gold uppercase">¿Cómo quieres pagar?</h3>
                <div className="grid grid-cols-2 gap-2">
                  {opciones.map((o) => {
                    const activa = elegida?.metodo.nombre === o.metodo.nombre && elegida.moneda === o.moneda;
                    return (
                      <button key={`${o.metodo.nombre}-${o.moneda}`} onClick={() => setElegida(activa ? null : o)}
                        className={`flex items-center gap-2 rounded-2xl border-2 p-2.5 text-left transition ${activa ? 'border-gold bg-gold/15' : 'border-gold/15'}`}>
                        {o.metodo.es_efectivo ? <Banknote size={17} className="shrink-0 text-venom" /> : <CreditCard size={17} className="shrink-0 text-gold" />}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{o.metodo.nombre}</span>
                          <span className={`block text-xs font-semibold ${COLOR[o.moneda]}`}>{dinero(saldoEn(o.moneda), o.moneda)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                {elegida && (
                  <div className="mt-3 rounded-2xl border border-gold/30 bg-[#06140f] p-3">
                    <p className="text-sm text-smoke">Son</p>
                    <p className={`font-display text-3xl ${COLOR[elegida.moneda]}`}>{dinero(saldoEn(elegida.moneda), elegida.moneda)}</p>
                    {elegida.metodo.datos_pago ? (
                      <div className="mt-2">
                        <p className="text-xs tracking-wider text-gold uppercase">Datos para pagar con {elegida.metodo.nombre}</p>
                        <p className="mt-1 rounded-xl bg-void/60 p-3 text-base whitespace-pre-line">{elegida.metodo.datos_pago}</p>
                        <button onClick={() => copiar(elegida.metodo.datos_pago!)} className="mt-2 flex items-center gap-1.5 text-sm text-gold-light">
                          {copiado ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar datos</>}
                        </button>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-smoke">{elegida.metodo.es_efectivo ? 'Te cobran en la mesa.' : 'Pídele los datos a tu mesero.'}</p>
                    )}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
    </Modal>
  );
}
