'use client';

import { ArrowDownLeft, ArrowUpRight, Lock, Unlock } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Area, Boton, Campo, Cargando, Encabezado, ErrorCaja, Input, InputNum, Insignia, Modal, Pestanas, Select, Tabla, Tarjeta, Vacio, useAvisos, useDatos } from '@/components/admin/ui';
import { ColaCobro } from '@/components/admin/pos/ColaCobro';
import { adm } from '@/lib/admin/api';
import { MONEDAS, type Moneda, type PorMoneda, dinero, fechaHora, soloHora } from '@/lib/admin/moneda';

type Caja = { id: number; nombre: string; descripcion: string | null; sesion: { id: number; fecha_apertura: string; usuario: string } | null; arrastre: { usd: number; cop: number; ves: number; fecha_cierre: string } | null };
type Resumen = {
  sesion: Record<string, any>;
  efectivo_recibido: PorMoneda; vueltos: PorMoneda; ingresos: PorMoneda; egresos: PorMoneda; esperado: PorMoneda;
  por_metodo: { metodo: string; es_efectivo: boolean; moneda: Moneda; total: number; total_usd: number; pagos: number }[];
  cuentas_cobradas: number; total_usd: number;
};
type Linea = { id: number; fecha: string; tipo: 'cobro' | 'ingreso' | 'egreso'; moneda: Moneda; monto: number; concepto?: string; metodo?: string; cuenta?: string; cuenta_id?: number; vuelto_monto?: number | null; vuelto_moneda?: Moneda | null; referencia?: string | null; usuario: string | null };
type SesionHist = Record<string, any>;

const cero = (): Record<Moneda, number | null> => ({ COP: null, USD: null, VES: null });

export default function CajaPage() {
  const cajas = useDatos<Caja[]>('/caja', 30_000);
  const [cajaId, setCajaId] = useState<number | null>(null);
  const [vista, setVista] = useState<'cola' | 'turno' | 'historial'>('cola');
  const [enCola, setEnCola] = useState<number | undefined>(undefined);
  const caja = cajas.datos?.find((c) => c.id === cajaId) ?? cajas.datos?.[0];

  useEffect(() => {
    if (!cajaId && cajas.datos?.length) setCajaId(Number(localStorage.getItem('mamba_caja')) || cajas.datos[0].id);
  }, [cajas.datos, cajaId]);

  if (cajas.cargando) return <Cargando />;
  if (cajas.error) return <ErrorCaja mensaje={cajas.error} onReintentar={cajas.recargar} />;

  return (
    <div className="max-w-6xl">
      <Encabezado titulo="Caja" descripcion="Las cuentas que pasan los mesoneros llegan a «Por cobrar». Cada punto de cobro lleva su turno con fondo, ingresos, egresos y conteo al cerrar.">
        <Pestanas valor={vista} onCambio={setVista} opciones={[{ valor: 'cola', etiqueta: 'Por cobrar', cuenta: enCola }, { valor: 'turno', etiqueta: 'Turno actual' }, { valor: 'historial', etiqueta: 'Cierres anteriores' }]} />
      </Encabezado>

      {vista === 'cola' && (
        <>
          {cajas.datos?.every((c) => !c.sesion) && (
            <button onClick={() => setVista('turno')} className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-3 text-left text-sm text-gold-light">
              <Lock size={18} className="shrink-0" /> No hay ninguna caja abierta: abre el turno para poder cobrar.
            </button>
          )}
          <ColaCobro onCambio={setEnCola} />
        </>
      )}

      {vista === 'turno' && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {cajas.datos?.map((c) => (
              <button key={c.id} onClick={() => { setCajaId(c.id); localStorage.setItem('mamba_caja', String(c.id)); }}
                className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${caja?.id === c.id ? 'border-gold bg-gold/10' : 'border-gold/15 hover:border-gold/40'}`}>
                {c.sesion ? <Unlock size={18} className="text-venom" /> : <Lock size={18} className="text-smoke" />}
                <span>
                  <span className="block text-sm font-medium">{c.nombre}</span>
                  <span className="block text-xs text-smoke">{c.sesion ? `Abierta por ${c.sesion.usuario} · ${soloHora(c.sesion.fecha_apertura)}` : 'Cerrada'}</span>
                </span>
              </button>
            ))}
          </div>
          {caja && (caja.sesion ? <Turno key={caja.sesion.id} sesionId={caja.sesion.id} alCambiar={cajas.recargar} /> : <Abrir key={caja.id} caja={caja} alAbrir={cajas.recargar} />)}
        </>
      )}
      {vista === 'historial' && <Historial />}
    </div>
  );
}

// ====================================================================== Abrir
function Abrir({ caja, alAbrir }: { caja: Caja; alAbrir: () => void }) {
  const [fondo, setFondo] = useState<Record<Moneda, number | null>>({ COP: caja.arrastre?.cop ?? null, USD: caja.arrastre?.usd ?? null, VES: caja.arrastre?.ves ?? null });
  const [ocupado, setOcupado] = useState(false);
  const avisos = useAvisos();
  const abrir = async () => {
    setOcupado(true);
    try {
      await adm('/caja/abrir', { method: 'POST', body: { caja_id: caja.id, fondo_inicial_cop: fondo.COP ?? 0, fondo_inicial_usd: fondo.USD ?? 0, fondo_inicial_ves: fondo.VES ?? 0 } });
      localStorage.setItem('mamba_caja', String(caja.id));
      avisos.ok(`${caja.nombre} abierta`);
      alAbrir();
    } catch (e) {
      avisos.error(e);
      setOcupado(false);
    }
  };
  return (
    <Tarjeta className="max-w-xl p-6">
      <h2 className="font-display text-xl">Abrir {caja.nombre}</h2>
      <p className="mt-1 text-sm text-smoke">
        Cuenta el efectivo que hay en el cajón para empezar.
        {caja.arrastre && ` El último cierre (${fechaHora(caja.arrastre.fecha_cierre)}) dejó este fondo:`}
      </p>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {MONEDAS.map((m) => <Campo key={m} etiqueta={`Fondo en ${m}`}><InputNum valor={fondo[m]} onCambio={(v) => setFondo({ ...fondo, [m]: v })} placeholder="0" /></Campo>)}
      </div>
      <Boton variante="oro" tam="lg" className="mt-5 w-full" cargando={ocupado} onClick={abrir}><Unlock size={17} /> Abrir caja</Boton>
    </Tarjeta>
  );
}

// ====================================================================== Turno abierto
function Turno({ sesionId, alCambiar }: { sesionId: number; alCambiar: () => void }) {
  const resumen = useDatos<Resumen>(`/caja/sesiones/${sesionId}`, 20_000);
  const linea = useDatos<Linea[]>(`/caja/sesiones/${sesionId}/movimientos`, 20_000);
  const [mov, setMov] = useState<{ tipo: 'ingreso' | 'egreso'; concepto: string; moneda: Moneda; monto: number | null } | null>(null);
  const [cierre, setCierre] = useState(false);
  const [conteo, setConteo] = useState(cero());
  const [fondo, setFondo] = useState(cero());
  const [notas, setNotas] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const avisos = useAvisos();

  if (resumen.cargando || !resumen.datos) return <Cargando />;
  const r = resumen.datos;

  const guardarMov = async () => {
    if (!mov?.monto) return avisos.error('Escribe el monto');
    setOcupado(true);
    try {
      resumen.setDatos(await adm<Resumen>(`/caja/sesiones/${sesionId}/movimientos`, { method: 'POST', body: mov }));
      linea.recargar();
      avisos.ok(mov.tipo === 'ingreso' ? 'Ingreso registrado' : 'Egreso registrado');
      setMov(null);
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(false);
    }
  };

  const cerrar = async () => {
    setOcupado(true);
    try {
      await adm(`/caja/sesiones/${sesionId}/cerrar`, {
        method: 'POST',
        body: {
          conteo_cop: conteo.COP ?? 0, conteo_usd: conteo.USD ?? 0, conteo_ves: conteo.VES ?? 0,
          fondo_siguiente_cop: fondo.COP ?? 0, fondo_siguiente_usd: fondo.USD ?? 0, fondo_siguiente_ves: fondo.VES ?? 0, notas_cierre: notas || null,
        },
      });
      avisos.ok('Caja cerrada');
      alCambiar();
    } catch (e) {
      avisos.error(e);
      setOcupado(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Insignia color="verde"><Unlock size={12} /> Abierta desde {fechaHora(r.sesion.fecha_apertura)} · {r.sesion.usuario}</Insignia>
        <span className="text-sm text-smoke">{r.cuentas_cobradas} cuentas cobradas · {dinero(r.total_usd, 'USD')} equivalentes</span>
        <div className="ml-auto flex gap-2">
          <Boton variante="verde" onClick={() => setMov({ tipo: 'ingreso', concepto: '', moneda: 'COP', monto: null })}><ArrowDownLeft size={15} /> Ingreso</Boton>
          <Boton variante="peligro" onClick={() => setMov({ tipo: 'egreso', concepto: '', moneda: 'COP', monto: null })}><ArrowUpRight size={15} /> Egreso</Boton>
          <Boton variante="oro" onClick={() => setCierre(true)}><Lock size={15} /> Cerrar caja</Boton>
        </div>
      </div>

      {/* Efectivo esperado en el cajón */}
      <div className="grid gap-3 md:grid-cols-3">
        {MONEDAS.map((m) => (
          <Tarjeta key={m} className="p-4">
            <p className="text-[11px] tracking-wider text-smoke uppercase">Efectivo esperado en {m}</p>
            <p className="mt-1 font-display text-3xl font-light text-gold-light">{dinero(r.esperado[m], m)}</p>
            <dl className="mt-3 space-y-1 text-xs text-smoke">
              <div className="flex justify-between"><dt>Fondo inicial</dt><dd>{dinero(r.sesion[`fondo_inicial_${m.toLowerCase()}`], m)}</dd></div>
              <div className="flex justify-between"><dt>+ Efectivo recibido</dt><dd className="text-venom">{dinero(r.efectivo_recibido[m], m)}</dd></div>
              <div className="flex justify-between"><dt>− Vueltos entregados</dt><dd className="text-red-300">{dinero(r.vueltos[m], m)}</dd></div>
              <div className="flex justify-between"><dt>+ Ingresos</dt><dd>{dinero(r.ingresos[m], m)}</dd></div>
              <div className="flex justify-between"><dt>− Egresos</dt><dd>{dinero(r.egresos[m], m)}</dd></div>
            </dl>
          </Tarjeta>
        ))}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 font-display text-lg">Cobrado por método</h2>
          {r.por_metodo.length ? (
            <Tarjeta className="divide-y divide-white/5">
              {r.por_metodo.map((p) => (
                <div key={`${p.metodo}${p.moneda}`} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="flex items-center gap-2">{p.metodo} <Insignia color={p.es_efectivo ? 'verde' : 'gris'}>{p.moneda}</Insignia> <span className="text-xs text-smoke">{p.pagos} pagos</span></span>
                  <b className="font-medium">{dinero(p.total, p.moneda)}</b>
                </div>
              ))}
            </Tarjeta>
          ) : <Vacio titulo="Aún no hay cobros en este turno" />}
        </section>

        <section>
          <h2 className="mb-2 font-display text-lg">Movimientos del turno</h2>
          {linea.datos?.length ? (
            <Tarjeta className="max-h-[420px] divide-y divide-white/5 overflow-y-auto">
              {linea.datos.map((l) => (
                <div key={`${l.tipo}${l.id}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="w-14 shrink-0 text-xs text-smoke">{soloHora(l.fecha)}</span>
                  <span className="min-w-0 flex-1">
                    {l.tipo === 'cobro' ? (
                      <><Link href={`/admin/cuenta/${l.cuenta_id}`} className="font-medium hover:text-gold">{l.cuenta}</Link> <span className="text-smoke">· {l.metodo}{l.referencia && ` · ref ${l.referencia}`}</span>
                        {l.vuelto_monto ? <span className="block text-xs text-red-300">Vuelto {dinero(l.vuelto_monto, l.vuelto_moneda!)}</span> : null}</>
                    ) : (
                      <><Insignia color={l.tipo === 'ingreso' ? 'verde' : 'rojo'}>{l.tipo}</Insignia> <span className="text-smoke">{l.concepto}</span></>
                    )}
                    <span className="block text-[11px] text-smoke/70">{l.usuario}</span>
                  </span>
                  <b className={`font-medium ${l.tipo === 'egreso' ? 'text-red-300' : ''}`}>{l.tipo === 'egreso' && '−'}{dinero(l.monto, l.moneda)}</b>
                </div>
              ))}
            </Tarjeta>
          ) : <Vacio titulo="Sin movimientos" />}
        </section>
      </div>

      {mov && (
        <Modal titulo={mov.tipo === 'ingreso' ? 'Ingreso de efectivo' : 'Egreso de efectivo'} subtitulo={mov.tipo === 'egreso' ? 'Compra de hielo, pago a proveedor, adelanto…' : 'Cambio, aporte de sencillo…'} onCerrar={() => setMov(null)} ancho="max-w-md"
          pie={<><Boton variante="sutil" onClick={() => setMov(null)}>Cancelar</Boton><Boton variante="oro" cargando={ocupado} onClick={guardarMov}>Registrar</Boton></>}>
          <div className="space-y-4">
            <Campo etiqueta="Concepto"><Input autoFocus value={mov.concepto} onChange={(e) => setMov({ ...mov, concepto: e.target.value })} /></Campo>
            <div className="grid grid-cols-[110px_1fr] gap-3">
              <Campo etiqueta="Moneda"><Select value={mov.moneda} onChange={(e) => setMov({ ...mov, moneda: e.target.value as Moneda })}>{MONEDAS.map((m) => <option key={m}>{m}</option>)}</Select></Campo>
              <Campo etiqueta="Monto"><InputNum valor={mov.monto} onCambio={(v) => setMov({ ...mov, monto: v })} /></Campo>
            </div>
          </div>
        </Modal>
      )}

      {cierre && (
        <Modal titulo="Cerrar caja" subtitulo="Cuenta el efectivo físico de cada moneda. El sistema lo compara con lo esperado." onCerrar={() => setCierre(false)} ancho="max-w-2xl"
          pie={<><Boton variante="sutil" onClick={() => setCierre(false)}>Cancelar</Boton><Boton variante="oro" cargando={ocupado} onClick={cerrar}><Lock size={15} /> Cerrar turno</Boton></>}>
          <div className="space-y-3">
            {MONEDAS.map((m) => {
              const dif = (conteo[m] ?? 0) - r.esperado[m];
              const contado = conteo[m] != null;
              return (
                <div key={m} className="grid items-end gap-3 rounded-2xl border border-gold/10 p-3 sm:grid-cols-[1fr_1fr_1fr_1.1fr]">
                  <div>
                    <p className="text-[11px] tracking-wider text-smoke uppercase">Esperado {m}</p>
                    <p className="font-display text-xl text-gold-light">{dinero(r.esperado[m], m)}</p>
                  </div>
                  <Campo etiqueta="Contado"><InputNum valor={conteo[m]} onCambio={(v) => setConteo({ ...conteo, [m]: v })} placeholder="0" /></Campo>
                  <Campo etiqueta="Dejo para mañana"><InputNum valor={fondo[m]} onCambio={(v) => setFondo({ ...fondo, [m]: v })} placeholder="0" /></Campo>
                  <p className={`pb-2 text-sm font-medium ${!contado ? 'text-smoke' : Math.abs(dif) < 0.01 ? 'text-venom' : dif > 0 ? 'text-sky-300' : 'text-red-300'}`}>
                    {!contado ? 'Sin contar' : Math.abs(dif) < 0.01 ? '✓ Cuadra' : dif > 0 ? `Sobran ${dinero(dif, m)}` : `Faltan ${dinero(-dif, m)}`}
                  </p>
                </div>
              );
            })}
            <Campo etiqueta="Notas del cierre"><Area rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Explica cualquier diferencia…" /></Campo>
          </div>
        </Modal>
      )}
    </>
  );
}

// ====================================================================== Historial
function Historial() {
  const { datos, cargando } = useDatos<SesionHist[]>('/caja/sesiones');
  if (cargando) return <Cargando />;
  const dif = (s: SesionHist) =>
    MONEDAS.map((m) => ({ m, d: Number(s[`diferencia_${m.toLowerCase()}`] ?? 0) })).filter((x) => Math.abs(x.d) >= 0.01);
  return (
    <Tabla<SesionHist>
      filas={datos ?? []}
      clave={(s) => s.id}
      vacio="Todavía no hay turnos registrados"
      columnas={[
        { titulo: 'Caja', celda: (s) => <span className="font-medium">{s.caja}</span> },
        { titulo: 'Apertura', celda: (s) => <span className="text-smoke">{fechaHora(s.fecha_apertura)} · {s.usuario}</span> },
        { titulo: 'Cierre', celda: (s) => (s.estado === 'abierta' ? <Insignia color="verde">Abierta</Insignia> : <span className="text-smoke">{fechaHora(s.fecha_cierre)} · {s.usuario_cierre}</span>) },
        { titulo: 'Cobrado', celda: (s) => dinero(s.total_usd, 'USD'), alinear: 'der' },
        { titulo: 'Diferencias', celda: (s) => s.estado === 'abierta' ? '—' : dif(s).length ? (
          <div className="flex flex-wrap gap-1">{dif(s).map((x) => <Insignia key={x.m} color={x.d > 0 ? 'azul' : 'rojo'}>{x.d > 0 ? '+' : ''}{dinero(x.d, x.m)}</Insignia>)}</div>
        ) : <Insignia color="verde">Cuadró</Insignia> },
        { titulo: 'Notas', celda: (s) => <span className="text-xs text-smoke">{s.notas_cierre ?? ''}</span> },
      ]}
    />
  );
}
