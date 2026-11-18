'use client';

import { BellRing, Check, ChefHat, Clock, Flame, Martini, Printer, QrCode, Send, Wallet, X, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useSesion } from '@/components/admin/Sesion';
import type { PedidoQR } from '@/components/admin/pos/BandejaQR';
import type { EnCola } from '@/components/admin/pos/ColaCobro';
import { Cobro } from '@/components/admin/pos/Cobro';
import type { Cuenta } from '@/components/admin/pos/tipos';
import { Boton, Interruptor, Modal, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { type Tasa, dinero, hace } from '@/lib/admin/moneda';
import { useVivo } from '@/lib/admin/vivo';

/** Un producto tal como lo ve la pantalla de comandas */
type Item = {
  id: number; cuenta_id: number; nombre: string; presentacion: string | null; cantidad: number; notas: string | null; estado: 'pendiente' | 'preparando' | 'listo';
  estacion: string; ronda: number; creado_en: string; cuenta: string; tipo: string; nombre_cliente: string | null; mesa_numero: number | null; mesa_nombre: string | null;
  mesa_tipo: string | null; mesonero: string | null; modificadores: { tipo: string; nombre: string; cantidad: number }[];
};
/** Lo que se mandó junto: una ronda de una cuenta */
type Pedido = { clave: string; cuenta_id: number; lugar: string; cliente: string | null; mesonero: string | null; desde: string; items: Item[] };

const lugarDe = (i: { tipo: string; mesa_numero: number | null; mesa_nombre: string | null; mesa_tipo: string | null }) =>
  i.tipo === 'llevar' ? 'Para llevar' : i.mesa_tipo === 'barra' || !i.mesa_numero ? 'Barra' : (i.mesa_nombre ?? `Mesa ${i.mesa_numero}`);

function agrupar(items: Item[]): Pedido[] {
  const m = new Map<string, Pedido>();
  for (const i of items) {
    const clave = `${i.cuenta_id}-${i.ronda}`;
    if (!m.has(clave)) m.set(clave, { clave, cuenta_id: i.cuenta_id, lugar: lugarDe(i), cliente: i.nombre_cliente, mesonero: i.mesonero, desde: i.creado_en, items: [] });
    m.get(clave)!.items.push(i);
  }
  return [...m.values()].sort((a, b) => a.desde.localeCompare(b.desde));
}

const minutos = (iso: string) => (Date.now() - new Date(iso).getTime()) / 60_000;
const MOTIVOS = ['Se agotó, ¿quieres otra cosa?', 'Ya te lo tomó tu mesero', 'Pedido repetido', 'La cocina ya cerró'];

/**
 * La pantalla principal de quien atiende: TODOS los pedidos en vivo, en columnas, y cada uno avanza con un toque.
 *   Nuevos (QR por aceptar · de mesoneros por mandar a cocina) → En preparación → Listos para llevar → Pidieron la cuenta
 */
export function TableroPedidos() {
  const router = useRouter();
  const avisos = useAvisos();
  const { es } = useSesion();
  const qr = useDatos<PedidoQR[]>('/pedidos-qr', 20_000);
  const porEnviar = useDatos<Item[]>('/comandas/por-enviar', 20_000);
  const comandas = useDatos<Item[]>('/comandas', 20_000);
  const cola = useDatos<EnCola[]>('/cuentas/cola-cobro', 20_000);
  const ajustes = useDatos<{ qr_auto_aceptar: boolean; cocina_pasa_por_barra: boolean }>('/config/ajustes');
  const tasa = useDatos<Tasa>('/tasas/actual');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [rechazar, setRechazar] = useState<PedidoQR | null>(null);
  const [motivo, setMotivo] = useState('');
  const [elegirCuenta, setElegirCuenta] = useState<PedidoQR | null>(null);
  const [cobrar, setCobrar] = useState<Cuenta | null>(null);
  const [, tic] = useState(0);

  const recargarTodo = () => { qr.recargar(); porEnviar.recargar(); comandas.recargar(); cola.recargar(); };
  useVivo((e) => {
    if (['pedido', 'comanda', 'pedido_qr', 'cuenta', 'cobro', 'reconectado'].includes(e.tipo)) recargarTodo();
  });
  useEffect(() => {
    const id = setInterval(() => tic((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const qrPendientes = (qr.datos ?? []).filter((p) => p.estado === 'pendiente');
  const enBarra = useMemo(() => agrupar(porEnviar.datos ?? []), [porEnviar.datos]);
  const grupos = useMemo(() => agrupar(comandas.datos ?? []), [comandas.datos]);
  const enPreparacion = grupos.filter((g) => g.items.some((i) => i.estado !== 'listo'));
  const listos = grupos.filter((g) => g.items.every((i) => i.estado === 'listo'));
  const nuevos = qrPendientes.length + enBarra.length;

  /** Corre una acción, marca el botón ocupado y recarga */
  const hacer = async (clave: string, fn: () => Promise<unknown>, ok?: string) => {
    setOcupado(clave);
    try {
      await fn();
      if (ok) avisos.ok(ok);
      recargarTodo();
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(null);
    }
  };

  const aceptar = (p: PedidoQR, cuentaId: number | null = null) => {
    if (cuentaId == null && p.cuentas_abiertas.length > 1) return setElegirCuenta(p);
    setElegirCuenta(null);
    return hacer(`qr-${p.id}`, () => adm(`/pedidos-qr/${p.id}/aceptar`, { method: 'POST', body: { cuenta_id: cuentaId } }), `${p.mesa_tipo === 'barra' ? 'Barra' : `Mesa ${p.mesa_numero}`}: aceptado`);
  };
  const estado = (g: Pedido, ids: number[], nuevo: 'preparando' | 'listo' | 'entregado', ok?: string) =>
    hacer(`${g.clave}-${nuevo}`, () => adm('/comandas/lote', { method: 'POST', body: { ids, estado: nuevo } }), ok);
  const abrirCobro = (id: number) => hacer(`cobro-${id}`, async () => setCobrar(await adm<Cuenta>(`/cuentas/${id}`)));
  const cambiarAjuste = (clave: 'qr_auto_aceptar' | 'cocina_pasa_por_barra', valor: boolean) =>
    hacer(`aj-${clave}`, async () => ajustes.setDatos(await adm('/config/operacion', { method: 'PUT', body: { [clave]: valor } })));

  return (
    <div>
      {/* Automatización: lo que el sistema hace solo */}
      {es('gerente') && ajustes.datos && (
        <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-gold/15 bg-gold/5 px-4 py-2.5 text-sm">
          <span className="flex items-center gap-1.5 text-gold-light"><Zap size={15} /> Automático</span>
          <Interruptor activo={ajustes.datos.qr_auto_aceptar} onCambio={(v) => cambiarAjuste('qr_auto_aceptar', v)} etiqueta="Aceptar solos los pedidos del QR" />
          <Interruptor activo={!ajustes.datos.cocina_pasa_por_barra} onCambio={(v) => cambiarAjuste('cocina_pasa_por_barra', !v)} etiqueta="Lo de cocina de los mesoneros va directo a cocina" />
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {/* ------------------------------------------------------------ 1. Nuevos */}
        <Columna titulo="Nuevos" icono={<BellRing size={17} />} n={nuevos} color="sky" vacio="Los pedidos nuevos llegan aquí con sonido.">
          {qrPendientes.map((p) => (
            <Tarjeta key={`qr-${p.id}`} color="sky" lugar={p.mesa_tipo === 'barra' ? 'Barra' : `Mesa ${p.mesa_numero}`} cliente={p.nombre_cliente}
              etiqueta={<><QrCode size={12} /> Pidió desde el QR</>} desde={p.creado_en}>
              <ul className="space-y-1">
                {p.resumen.map((l, k) => (
                  <Linea key={k} cantidad={l.cantidad} nombre={l.nombre} presentacion={l.presentacion} estacion={l.estacion}
                    extra={[...l.detalle, ...(l.notas ? [`“${l.notas}”`] : [])]} />
                ))}
                {p.nota && <li className="text-xs text-sky-200">“{p.nota}”</li>}
              </ul>
              <p className="mt-2 text-right text-sm text-smoke">{dinero(p.total, p.moneda)}</p>
              <div className="mt-2 grid grid-cols-[auto_1fr] gap-2">
                <Boton onClick={() => { setRechazar(p); setMotivo(''); }} aria-label="Rechazar"><X size={16} /></Boton>
                <Boton variante="oro" cargando={ocupado === `qr-${p.id}`} onClick={() => aceptar(p)}><Check size={17} /> Aceptar</Boton>
              </div>
            </Tarjeta>
          ))}
          {enBarra.map((g) => (
            <Tarjeta key={`b-${g.clave}`} color="orange" lugar={g.lugar} cliente={g.cliente} etiqueta={<><ChefHat size={12} /> {g.mesonero ?? 'Mesonero'} · para cocina</>} desde={g.desde}
              onAbrir={() => router.push(`/admin/cuenta/${g.cuenta_id}`)}>
              <ul className="space-y-1">{g.items.map((i) => <LineaItem key={i.id} i={i} />)}</ul>
              <Boton variante="oro" className="mt-2 w-full" cargando={ocupado === `env-${g.clave}`}
                onClick={() => hacer(`env-${g.clave}`, () => adm('/comandas/enviar-cocina', { method: 'POST', body: { ids: g.items.map((i) => i.id) } }), `${g.lugar}: enviado a cocina`)}>
                <Printer size={16} /> Enviar a cocina
              </Boton>
            </Tarjeta>
          ))}
        </Columna>

        {/* ------------------------------------------------------------ 2. En preparación */}
        <Columna titulo="En preparación" icono={<Flame size={17} />} n={enPreparacion.length} color="gold" vacio="Nada en cocina ni en barra.">
          {enPreparacion.map((g) => {
            const pendientes = g.items.filter((i) => i.estado === 'pendiente');
            return (
              <Tarjeta key={g.clave} color={minutos(g.desde) > 20 ? 'red' : 'gold'} lugar={g.lugar} cliente={g.cliente} etiqueta={g.mesonero ?? undefined} desde={g.desde}
                onAbrir={() => router.push(`/admin/cuenta/${g.cuenta_id}`)}>
                <p className="mb-1 text-[10px] text-smoke">Toca un producto para marcarlo listo</p>
                <ul className="space-y-1">
                  {g.items.map((i) => (
                    <li key={i.id}>
                      <button className="w-full rounded-lg text-left hover:bg-white/5" disabled={i.estado === 'listo'} onClick={() => estado(g, [i.id], 'listo')}>
                        <LineaItem i={i} conEstado />
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 grid grid-cols-[auto_1fr] gap-2">
                  {pendientes.length > 0
                    ? <Boton cargando={ocupado === `${g.clave}-preparando`} onClick={() => estado(g, pendientes.map((i) => i.id), 'preparando')} title="Ya lo están preparando"><Flame size={15} /></Boton>
                    : <span />}
                  <Boton variante="verde" cargando={ocupado === `${g.clave}-listo`} onClick={() => estado(g, g.items.filter((i) => i.estado !== 'listo').map((i) => i.id), 'listo', `${g.lugar}: listo para llevar`)}>
                    <Check size={17} /> ¡Listo!
                  </Boton>
                </div>
              </Tarjeta>
            );
          })}
        </Columna>

        {/* ------------------------------------------------------------ 3. Listos para llevar */}
        <Columna titulo="Listos para llevar" icono={<Check size={17} />} n={listos.length} color="venom" vacio="Cuando algo esté listo aparece aquí.">
          {listos.map((g) => (
            <Tarjeta key={g.clave} color="venom" lugar={g.lugar} cliente={g.cliente} etiqueta={g.mesonero ?? undefined} desde={g.items[0]?.creado_en ?? g.desde}
              onAbrir={() => router.push(`/admin/cuenta/${g.cuenta_id}`)}>
              <ul className="space-y-1">{g.items.map((i) => <LineaItem key={i.id} i={i} />)}</ul>
              <Boton variante="oro" className="mt-2 w-full" cargando={ocupado === `${g.clave}-entregado`}
                onClick={() => estado(g, g.items.map((i) => i.id), 'entregado', `${g.lugar}: entregado`)}>
                <Send size={15} /> Entregado
              </Boton>
            </Tarjeta>
          ))}
        </Columna>

        {/* ------------------------------------------------------------ 4. Pidieron la cuenta */}
        <Columna titulo="Pidieron la cuenta" icono={<Wallet size={17} />} n={cola.datos?.length ?? 0} color="violet" vacio="Cuando una mesa pida la cuenta aparece aquí.">
          {(cola.datos ?? []).map((c) => (
            <Tarjeta key={c.id} color="violet" lugar={lugarDe({ tipo: c.tipo, mesa_numero: c.mesa_numero, mesa_nombre: null, mesa_tipo: c.mesa_tipo })} cliente={c.nombre_cliente}
              etiqueta={c.cobro_nota ?? c.mesonero ?? undefined} desde={c.cobro_solicitado_en} onAbrir={() => router.push(`/admin/cuenta/${c.id}`)}>
              <p className="font-display text-3xl font-light text-gold-light">{dinero(c.total - c.pagado, c.moneda)}</p>
              <p className="text-xs text-smoke">{c.items} {Number(c.items) === 1 ? 'producto' : 'productos'} · {c.personas} {c.personas === 1 ? 'persona' : 'personas'}{c.mesonero ? ` · ${c.mesonero}` : ''}</p>
              <Boton variante="oro" className="mt-2 w-full" cargando={ocupado === `cobro-${c.id}`} onClick={() => abrirCobro(c.id)}><Wallet size={16} /> Cobrar</Boton>
            </Tarjeta>
          ))}
        </Columna>
      </div>

      {/* La mesa tiene varias cuentas: a cuál va el pedido del QR */}
      {elegirCuenta && (
        <Modal titulo={`Mesa ${elegirCuenta.mesa_numero}: ¿a qué cuenta va?`} onCerrar={() => setElegirCuenta(null)} ancho="max-w-md">
          <div className="grid gap-2">
            {elegirCuenta.cuentas_abiertas.map((c) => (
              <Boton key={c.id} tam="lg" onClick={() => aceptar(elegirCuenta, c.id)}>{c.numero}{c.nombre_cliente ? ` · ${c.nombre_cliente}` : ''}{c.mesonero ? ` · ${c.mesonero}` : ''}</Boton>
            ))}
          </div>
        </Modal>
      )}

      {rechazar && (
        <Modal titulo={`Rechazar el pedido de ${rechazar.mesa_tipo === 'barra' ? 'la barra' : `la mesa ${rechazar.mesa_numero}`}`} subtitulo="El cliente lo ve en su celular con el motivo." onCerrar={() => setRechazar(null)} ancho="max-w-md"
          pie={<><Boton variante="sutil" onClick={() => setRechazar(null)}>Volver</Boton>
            <Boton variante="peligro" disabled={motivo.trim().length < 3} cargando={ocupado === `rech-${rechazar.id}`}
              onClick={() => hacer(`rech-${rechazar.id}`, async () => { await adm(`/pedidos-qr/${rechazar.id}/rechazar`, { method: 'POST', body: { motivo } }); setRechazar(null); }, 'Pedido rechazado')}>Rechazar</Boton></>}>
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS.map((m) => <button key={m} onClick={() => setMotivo(m)} className={`rounded-full border px-3 py-1.5 text-sm ${motivo === m ? 'border-gold bg-gold/15' : 'border-gold/20 text-smoke'}`}>{m}</button>)}
          </div>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="U otro motivo…" className="mt-3 h-11 w-full rounded-xl border border-gold/20 bg-void/60 px-3 text-ivory outline-none" />
        </Modal>
      )}

      {cobrar && tasa.datos && <Cobro cuenta={cobrar} tasa={tasa.datos} onCerrar={() => { setCobrar(null); recargarTodo(); }} onPagado={() => recargarTodo()} />}
    </div>
  );
}

// ====================================================================== Piezas
const COLORES = {
  sky: { borde: 'border-sky-400/60', titulo: 'text-sky-200', burbuja: 'bg-sky-400' },
  orange: { borde: 'border-orange-400/60', titulo: 'text-orange-200', burbuja: 'bg-orange-400' },
  gold: { borde: 'border-gold/50', titulo: 'text-gold-light', burbuja: 'bg-gold' },
  red: { borde: 'border-red-400/70', titulo: 'text-red-200', burbuja: 'bg-red-400' },
  venom: { borde: 'border-venom/60', titulo: 'text-venom', burbuja: 'bg-venom' },
  violet: { borde: 'border-violet-400/60', titulo: 'text-violet-200', burbuja: 'bg-violet-400' },
};
type Color = keyof typeof COLORES;

function Columna({ titulo, icono, n, color, vacio, children }: { titulo: string; icono: ReactNode; n: number; color: Color; vacio: string; children: ReactNode }) {
  return (
    <section className="flex min-h-40 flex-col rounded-3xl border border-white/5 bg-[#03100b] p-2.5">
      <h2 className={`mb-2 flex items-center gap-2 px-1.5 pt-1 font-display text-base ${COLORES[color].titulo}`}>
        {icono} {titulo}
        <span className={`ml-auto grid h-7 min-w-7 place-items-center rounded-full px-2 text-sm font-bold text-void ${n ? COLORES[color].burbuja : 'bg-white/10 text-smoke'}`}>{n}</span>
      </h2>
      <div className="flex flex-1 flex-col gap-2.5">
        {n === 0 ? <p className="grid flex-1 place-items-center rounded-2xl border-2 border-dashed border-white/5 px-4 py-8 text-center text-sm text-smoke">{vacio}</p> : children}
      </div>
    </section>
  );
}

function Tarjeta({ color, lugar, cliente, etiqueta, desde, onAbrir, children }: {
  color: Color; lugar: string; cliente: string | null; etiqueta?: ReactNode; desde: string; onAbrir?: () => void; children: ReactNode;
}) {
  const tarde = minutos(desde) > 15;
  return (
    <article className={`rounded-2xl border-2 bg-[#06140f] p-3 ${COLORES[color].borde}`}>
      <button className="block w-full text-left" onClick={onAbrir} disabled={!onAbrir}>
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 truncate font-display text-xl leading-tight">{lugar}{cliente && <span className="text-base text-smoke"> · {cliente}</span>}</p>
          <span className={`flex shrink-0 items-center gap-1 text-xs ${tarde ? 'font-semibold text-red-300' : 'text-smoke'}`}><Clock size={11} /> {hace(desde)}</span>
        </div>
        {etiqueta && <p className="mt-0.5 flex items-center gap-1 text-[11px] text-smoke">{etiqueta}</p>}
      </button>
      <div className="mt-2">{children}</div>
    </article>
  );
}

function Linea({ cantidad, nombre, presentacion, estacion, extra = [], chip }: { cantidad: number; nombre: string; presentacion: string | null; estacion: string; extra?: string[]; chip?: ReactNode }) {
  return (
    <div className="flex items-start gap-1.5 text-sm">
      <b className="text-gold-light tabular-nums">{Number(cantidad)}×</b>
      {estacion === 'cocina' ? <ChefHat size={13} className="mt-0.5 shrink-0 text-gold" /> : <Martini size={13} className="mt-0.5 shrink-0 text-venom" />}
      <span className="min-w-0 flex-1 leading-tight">
        {nombre}{presentacion && !/^(unidad|botella|porci[oó]n|única)$/i.test(presentacion) && <span className="text-smoke"> · {presentacion}</span>}
        {extra.map((x) => <span key={x} className={`block text-xs ${x.startsWith('SIN') ? 'text-red-300' : x.startsWith('“') ? 'text-sky-200' : 'text-venom'}`}>{x}</span>)}
      </span>
      {chip}
    </div>
  );
}

function LineaItem({ i, conEstado = false }: { i: Item; conEstado?: boolean }) {
  const extra = [
    ...i.modificadores.map((m) => (m.tipo === 'sin' ? `SIN ${m.nombre}` : m.tipo === 'adicional' ? `+ ${m.cantidad > 1 ? `${m.cantidad}× ` : ''}${m.nombre}` : `${m.cantidad}× ${m.nombre}`)),
    ...(i.notas ? [`“${i.notas}”`] : []),
  ];
  const chip = conEstado
    ? i.estado === 'listo' ? <span className="shrink-0 rounded-full bg-venom/25 px-2 text-[10px] text-venom">Listo</span>
      : i.estado === 'preparando' ? <span className="shrink-0 rounded-full bg-gold/20 px-2 text-[10px] text-gold-light">Preparando</span>
      : <span className="shrink-0 rounded-full bg-white/10 px-2 text-[10px] text-smoke">En cola</span>
    : undefined;
  return <Linea cantidad={i.cantidad} nombre={i.nombre} presentacion={i.presentacion} estacion={i.estacion} extra={extra} chip={chip} />;
}
