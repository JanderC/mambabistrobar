'use client';

import { BellRing, Check, ChefHat, Clock, Flame, Martini, Printer, QrCode, Send, UserRound, Wallet, X, Zap } from 'lucide-react';
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
  mesa_tipo: string | null; mesonero: string | null; mesonero_id: number | null; asignado: string | null; modificadores: { tipo: string; nombre: string; cantidad: number }[];
};
/** Lo que se mandó junto: una ronda de una cuenta */
type Pedido = { clave: string; cuenta_id: number; lugar: string; cliente: string | null; mesonero: string | null; mesonero_id: number | null; asignado: string | null; desde: string; items: Item[] };
type Miembro = { id: number; nombre: string; rol: string };

const lugarDe = (i: { tipo: string; mesa_numero: number | null; mesa_nombre: string | null; mesa_tipo: string | null }) =>
  i.tipo === 'llevar' ? 'Para llevar' : i.mesa_tipo === 'barra' || !i.mesa_numero ? 'Barra' : (i.mesa_nombre ?? `Mesa ${i.mesa_numero}`);

function agrupar(items: Item[]): Pedido[] {
  const m = new Map<string, Pedido>();
  for (const i of items) {
    const clave = `${i.cuenta_id}-${i.ronda}`;
    if (!m.has(clave)) m.set(clave, { clave, cuenta_id: i.cuenta_id, lugar: lugarDe(i), cliente: i.nombre_cliente, mesonero: i.mesonero, mesonero_id: i.mesonero_id ?? null, asignado: i.asignado ?? null, desde: i.creado_en, items: [] });
    m.get(clave)!.items.push(i);
  }
  return [...m.values()].sort((a, b) => a.desde.localeCompare(b.desde));
}

const minutos = (iso: string) => (Date.now() - new Date(iso).getTime()) / 60_000;
const MOTIVOS = ['Se agotó, ¿quieres otra cosa?', 'Ya te lo tomó tu mesero', 'Pedido repetido', 'La cocina ya cerró'];

/**
 * La pantalla principal de quien atiende, en tres partes:
 *   1. Estado general: cuánto hay por aceptar, en cocina, en barra, listos, la espera, por cobrar y lo cobrado.
 *   2. Fila por aceptar: lo que llega (QR y lo de cocina de los mesoneros) en orden de llegada.
 *   3. Zona de comandas: todo lo aceptado (En cola → Preparando → Listos → Pidieron la cuenta), filtrable y ordenable.
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
  // Quién puede llevar pedidos a las mesas
  const equipo = useDatos<Miembro[]>('/usuarios/equipo');
  const llevan = (equipo.datos ?? []).filter((m) => ['mesonero', 'cajero', 'barra', 'gerente'].includes(m.rol));
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

  const [estacion, setEstacion] = useState<'todo' | 'cocina' | 'barra'>('todo');
  const [orden, setOrden] = useState<'tiempo' | 'mesa'>('tiempo');
  const [buscar, setBuscar] = useState('');
  const diario = useDatos<{ totales: { cobrado: number; por_cobrar: number; cuentas_abiertas: number; cuentas_cobradas: number }; moneda: 'COP' | 'USD' | 'VES' }>('/caja/diario', 60_000);

  const qrPendientes = (qr.datos ?? []).filter((p) => p.estado === 'pendiente');
  const enBarra = useMemo(() => agrupar(porEnviar.datos ?? []), [porEnviar.datos]);

  // Fila por aceptar: todo lo que llegó y espera a alguien, en orden de llegada
  type EnFila = { tipo: 'qr'; desde: string; p: PedidoQR } | { tipo: 'barra'; desde: string; g: Pedido };
  const fila: EnFila[] = [
    ...qrPendientes.map((p) => ({ tipo: 'qr' as const, desde: p.creado_en, p })),
    ...enBarra.map((g) => ({ tipo: 'barra' as const, desde: g.desde, g })),
  ].sort((a, b) => a.desde.localeCompare(b.desde));

  // Zona de comandas: todo lo aceptado, filtrado por estación / búsqueda y ordenado como se prefiera
  const sinTildes = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const grupos = useMemo(() => {
    const n = sinTildes(buscar.trim());
    const items = (comandas.datos ?? []).filter((i) => estacion === 'todo' || i.estacion === estacion);
    const g = agrupar(items).filter((x) => !n || sinTildes(`${x.lugar} ${x.cliente ?? ''} ${x.mesonero ?? ''}`).includes(n));
    return orden === 'mesa' ? g.sort((a, b) => a.lugar.localeCompare(b.lugar, 'es', { numeric: true }) || a.desde.localeCompare(b.desde)) : g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comandas.datos, estacion, buscar, orden]);
  const enCola = grupos.filter((g) => g.items.every((i) => i.estado === 'pendiente'));
  const preparando = grupos.filter((g) => !g.items.every((i) => i.estado === 'pendiente') && !g.items.every((i) => i.estado === 'listo'));
  const listos = grupos.filter((g) => g.items.every((i) => i.estado === 'listo'));
  const pidieron = (cola.datos ?? []).filter((c) => !buscar.trim() || sinTildes(`mesa ${c.mesa_numero ?? 'barra'} ${c.nombre_cliente ?? ''}`).includes(sinTildes(buscar.trim())));

  // Estado general
  const todasComandas = comandas.datos ?? [];
  const todosGrupos = agrupar(todasComandas);
  const enCurso = todosGrupos.filter((g) => g.items.some((i) => i.estado !== 'listo'));
  const esperaProm = enCurso.length ? Math.round(enCurso.reduce((t, g) => t + minutos(g.desde), 0) / enCurso.length) : 0;
  const masViejo = enCurso.length ? Math.round(Math.max(...enCurso.map((g) => minutos(g.desde)))) : 0;
  const unidades = (est: string) => todasComandas.filter((i) => i.estacion === est && i.estado !== 'listo').reduce((t, i) => t + Number(i.cantidad), 0);
  const listosTotal = todosGrupos.filter((g) => g.items.every((i) => i.estado === 'listo')).length;

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
    if (cuentaId == null && p.cuentas_abiertas.length > 1 && !p.cuenta_nueva && !p.cuenta_destino) return setElegirCuenta(p);
    setElegirCuenta(null);
    return hacer(`qr-${p.id}`, () => adm(`/pedidos-qr/${p.id}/aceptar`, { method: 'POST', body: { cuenta_id: cuentaId } }), `${p.mesa_tipo === 'barra' ? 'Barra' : `Mesa ${p.mesa_numero}`}: aceptado`);
  };
  const estado = (g: Pedido, ids: number[], nuevo: 'preparando' | 'listo' | 'entregado', ok?: string) =>
    hacer(`${g.clave}-${nuevo}`, () => adm('/comandas/lote', { method: 'POST', body: { ids, estado: nuevo } }), ok);
  const asignar = (g: Pedido, mesoneroId: number | null) =>
    hacer(`asig-${g.clave}`, () => adm(`/cuentas/${g.cuenta_id}`, { method: 'PATCH', body: { mesonero_id: mesoneroId } }),
      mesoneroId ? `${g.lugar}: lo lleva ${llevan.find((m) => m.id === mesoneroId)?.nombre ?? 'el mesonero'}` : `${g.lugar}: sin mesonero`);
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

      {/* ============================================================ Estado general */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        <Cifra titulo="Por aceptar" valor={fila.length} sub={fila.length ? 'esperando en la fila' : 'nada esperando'} alerta={fila.length > 0} color="sky" />
        <Cifra titulo="Cocina" valor={unidades('cocina')} sub="platos en curso" alerta={unidades('cocina') > 0} color="gold" />
        <Cifra titulo="Barra" valor={unidades('barra')} sub="bebidas en curso" alerta={unidades('barra') > 0} color="venom" />
        <Cifra titulo="Listos" valor={listosTotal} sub="por llevar a la mesa" alerta={listosTotal > 0} color="venom" />
        <Cifra titulo="Espera" valor={`${esperaProm} min`} sub={masViejo ? `el más viejo: ${masViejo} min` : 'sin pedidos en curso'} alerta={masViejo > 20} color={masViejo > 20 ? 'red' : 'gold'} />
        <Cifra titulo="Pidieron la cuenta" valor={cola.datos?.length ?? 0} alerta={(cola.datos?.length ?? 0) > 0} color="violet" />
        <Cifra titulo="Cuentas abiertas" valor={diario.datos?.totales.cuentas_abiertas ?? '—'} sub={diario.datos ? `${dinero(diario.datos.totales.por_cobrar, diario.datos.moneda)} por cobrar` : undefined} color="gold" />
        <Cifra titulo="Cobrado hoy" valor={diario.datos ? dinero(diario.datos.totales.cobrado, diario.datos.moneda) : '—'} sub={diario.datos ? `${diario.datos.totales.cuentas_cobradas} cuentas · ver caja →` : undefined} color="venom" onClick={() => router.push('/admin/caja')} />
      </div>

      {/* ============================================================ Fila por aceptar */}
      <section className={`mb-4 rounded-3xl border-2 p-3 ${fila.length ? 'border-sky-400/60 bg-sky-400/5' : 'border-white/5 bg-[#03100b]'}`}>
        <h2 className="mb-2 flex flex-wrap items-center gap-2 px-1 font-display text-lg text-sky-200">
          <BellRing size={18} className={fila.length ? 'animate-bounce' : ''} /> Fila por aceptar
          <span className={`grid h-7 min-w-7 place-items-center rounded-full px-2 text-sm font-bold ${fila.length ? 'bg-sky-400 text-void' : 'bg-white/10 text-smoke'}`}>{fila.length}</span>
          <span className="text-xs font-normal text-smoke">en orden de llegada · al aceptarlos pasan a la zona de comandas</span>
        </h2>
        {!fila.length ? (
          <p className="px-1 py-2 text-sm text-smoke">Nada esperando. Los pedidos del QR y lo que manden los mesoneros para cocina aparecen aquí con sonido.</p>
        ) : (
          <div className="flex snap-x gap-3 overflow-x-auto pb-1">
            {fila.map((f, k) => (
              <div key={f.tipo === 'qr' ? `qr-${f.p.id}` : `b-${f.g.clave}`} className="w-72 shrink-0 snap-start">
                {f.tipo === 'qr' ? (
                  <Tarjeta color="sky" numero={k + 1} lugar={f.p.mesa_tipo === 'barra' ? 'Barra' : `Mesa ${f.p.mesa_numero}`} cliente={f.p.nombre_cliente}
                    etiqueta={<><QrCode size={12} /> Pidió desde el QR · {dinero(f.p.total, f.p.moneda)}</>} desde={f.p.creado_en}>
                    {f.p.cuenta_nueva ? <p className="mb-1.5 rounded-lg bg-orange-500/15 px-2 py-1 text-xs font-semibold text-orange-200">Clientes nuevos · cuenta aparte</p>
                      : f.p.destino_numero ? <p className="mb-1.5 rounded-lg bg-venom/15 px-2 py-1 text-xs text-venom">Se suma a {f.p.destino_numero}</p>
                      : f.p.cuentas_abiertas.length === 1 ? <p className="mb-1.5 rounded-lg bg-white/5 px-2 py-1 text-xs text-smoke">Va a {f.p.cuentas_abiertas[0].numero}{f.p.cuentas_abiertas[0].nombre_cliente ? ` · ${f.p.cuentas_abiertas[0].nombre_cliente}` : ''}</p> : null}
                    <ul className="space-y-1">
                      {f.p.resumen.map((l, x) => (
                        <li key={x}>
                          <Linea cantidad={l.cantidad} nombre={l.nombre} presentacion={l.presentacion} estacion={l.estacion}
                            extra={[...l.detalle, ...(l.notas ? [`“${l.notas}”`] : [])]} />
                        </li>
                      ))}
                      {f.p.nota && <li className="text-xs text-sky-200">“{f.p.nota}”</li>}
                    </ul>
                    <div className="mt-2 grid grid-cols-[auto_1fr] gap-2">
                      <Boton onClick={() => { setRechazar(f.p); setMotivo(''); }} aria-label="Rechazar"><X size={16} /></Boton>
                      <Boton variante="oro" cargando={ocupado === `qr-${f.p.id}`} onClick={() => aceptar(f.p)}><Check size={17} /> Aceptar</Boton>
                    </div>
                  </Tarjeta>
                ) : (
                  <Tarjeta color="orange" numero={k + 1} lugar={f.g.lugar} cliente={f.g.cliente} etiqueta={<><ChefHat size={12} /> {f.g.mesonero ?? 'Mesonero'} · para cocina</>} desde={f.g.desde}
                    onAbrir={() => router.push(`/admin/cuenta/${f.g.cuenta_id}`)}>
                    <ul className="space-y-1">{f.g.items.map((i) => <li key={i.id}><LineaItem i={i} /></li>)}</ul>
                    <Boton variante="oro" className="mt-2 w-full" cargando={ocupado === `env-${f.g.clave}`}
                      onClick={() => hacer(`env-${f.g.clave}`, () => adm('/comandas/enviar-cocina', { method: 'POST', body: { ids: f.g.items.map((i) => i.id) } }), `${f.g.lugar}: enviado a cocina`)}>
                      <Printer size={16} /> Enviar a cocina
                    </Boton>
                  </Tarjeta>
                )}
              </div>
            ))}
            {fila.length > 1 && fila.every((f) => f.tipo === 'barra' || f.p.cuentas_abiertas.length <= 1) && (
              <button onClick={() => hacer('todo', async () => {
                for (const f of fila) {
                  if (f.tipo === 'qr') await adm(`/pedidos-qr/${f.p.id}/aceptar`, { method: 'POST', body: { cuenta_id: null } });
                  else await adm('/comandas/enviar-cocina', { method: 'POST', body: { ids: f.g.items.map((i) => i.id) } });
                }
              }, `${fila.length} pedidos aceptados`)} disabled={ocupado === 'todo'}
                className="grid w-40 shrink-0 place-items-center rounded-2xl border-2 border-dashed border-sky-400/50 p-4 text-center text-sm font-semibold text-sky-200 hover:bg-sky-400/10 disabled:opacity-50">
                <span><Check size={26} className="mx-auto mb-1" />Aceptar los {fila.length}</span>
              </button>
            )}
          </div>
        )}
      </section>

      {/* ============================================================ Zona de comandas */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h2 className="mr-2 flex items-center gap-2 font-display text-lg text-gold-light"><ChefHat size={18} /> Zona de comandas</h2>
        <div className="flex rounded-xl border border-gold/20 p-0.5">
          {([['todo', 'Todo'], ['cocina', 'Cocina'], ['barra', 'Barra']] as const).map(([v, t]) => (
            <button key={v} onClick={() => setEstacion(v)} className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm ${estacion === v ? 'bg-gold font-semibold text-void' : 'text-smoke hover:text-ivory'}`}>
              {v === 'cocina' && <ChefHat size={13} />}{v === 'barra' && <Martini size={13} />}{t}
            </button>
          ))}
        </div>
        <div className="flex rounded-xl border border-gold/20 p-0.5">
          {([['tiempo', 'Más antiguo primero'], ['mesa', 'Por mesa']] as const).map(([v, t]) => (
            <button key={v} onClick={() => setOrden(v)} className={`rounded-lg px-3 py-1.5 text-sm ${orden === v ? 'bg-gold/20 text-gold-light' : 'text-smoke hover:text-ivory'}`}>{t}</button>
          ))}
        </div>
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar mesa o cliente…"
          className="h-9 min-w-40 flex-1 rounded-xl border border-gold/20 bg-void/60 px-3 text-sm text-ivory outline-none placeholder:text-smoke/60 sm:max-w-60" />
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Columna titulo="En cola" icono={<Clock size={17} />} n={enCola.length} color="sky" vacio="Lo aceptado espera aquí a que empiecen a prepararlo.">
          {enCola.map((g) => (
            <Comanda key={g.clave} g={g} equipo={llevan} onAsignar={(id) => asignar(g, id)} onAbrir={() => router.push(`/admin/cuenta/${g.cuenta_id}`)}
              onItem={(i) => estado(g, [i.id], 'listo')}
              acciones={<div className="grid grid-cols-2 gap-2">
                <Boton cargando={ocupado === `${g.clave}-preparando`} onClick={() => estado(g, g.items.map((i) => i.id), 'preparando')}><Flame size={15} /> Empezar</Boton>
                <Boton variante="verde" cargando={ocupado === `${g.clave}-listo`} onClick={() => estado(g, g.items.map((i) => i.id), 'listo', `${g.lugar}: listo`)}><Check size={16} /> Listo</Boton>
              </div>} />
          ))}
        </Columna>

        <Columna titulo="Preparando" icono={<Flame size={17} />} n={preparando.length} color="gold" vacio="Nada al fuego en este momento.">
          {preparando.map((g) => (
            <Comanda key={g.clave} g={g} equipo={llevan} onAsignar={(id) => asignar(g, id)} onAbrir={() => router.push(`/admin/cuenta/${g.cuenta_id}`)}
              onItem={(i) => estado(g, [i.id], 'listo')}
              acciones={<Boton variante="verde" className="w-full" cargando={ocupado === `${g.clave}-listo`}
                onClick={() => estado(g, g.items.filter((i) => i.estado !== 'listo').map((i) => i.id), 'listo', `${g.lugar}: listo para llevar`)}><Check size={17} /> ¡Listo!</Boton>} />
          ))}
        </Columna>

        <Columna titulo="Listos para llevar" icono={<Check size={17} />} n={listos.length} color="venom" vacio="Cuando algo esté listo aparece aquí.">
          {listos.map((g) => (
            <Comanda key={g.clave} g={g} equipo={llevan} onAsignar={(id) => asignar(g, id)} onAbrir={() => router.push(`/admin/cuenta/${g.cuenta_id}`)}
              acciones={<Boton variante="oro" className="w-full" cargando={ocupado === `${g.clave}-entregado`}
                onClick={() => estado(g, g.items.map((i) => i.id), 'entregado', `${g.lugar}: entregado`)}><Send size={15} /> Entregado</Boton>} />
          ))}
        </Columna>

        <Columna titulo="Pidieron la cuenta" icono={<Wallet size={17} />} n={pidieron.length} color="violet" vacio="Cuando una mesa pida la cuenta aparece aquí.">
          {pidieron.map((c) => (
            <Tarjeta key={c.id} color="violet" lugar={lugarDe({ tipo: c.tipo, mesa_numero: c.mesa_numero, mesa_nombre: null, mesa_tipo: c.mesa_tipo })} cliente={c.nombre_cliente}
              etiqueta={c.cobro_nota ?? c.mesonero ?? undefined} desde={c.cobro_solicitado_en} onAbrir={() => router.push(`/admin/cuenta/${c.id}`)}>
              <p className="font-display text-3xl font-light text-gold-light">{dinero(c.total - c.pagado, c.moneda)}</p>
              <p className="text-xs text-smoke">{c.items} {Number(c.items) === 1 ? 'producto' : 'productos'} · {c.personas} {c.personas === 1 ? 'persona' : 'personas'}</p>
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

function Tarjeta({ color, lugar, cliente, etiqueta, desde, onAbrir, numero, children }: {
  color: Color; lugar: string; cliente: string | null; etiqueta?: ReactNode; desde: string; onAbrir?: () => void; numero?: number; children: ReactNode;
}) {
  const tarde = minutos(desde) > 15;
  return (
    <article className={`rounded-2xl border-2 bg-[#06140f] p-3 ${COLORES[color].borde}`}>
      <button className="block w-full text-left" onClick={onAbrir} disabled={!onAbrir}>
        <div className="flex items-start gap-2">
          {numero != null && <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-bold text-void ${COLORES[color].burbuja}`}>{numero}</span>}
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

/** Una cifra del estado general */
function Cifra({ titulo, valor, sub, color, alerta = false, onClick }: { titulo: string; valor: ReactNode; sub?: string; color: Color; alerta?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`rounded-2xl border px-3 py-2 text-left transition ${alerta ? `${COLORES[color].borde} bg-white/[.03]` : 'border-white/5 bg-[#03100b]'} ${onClick ? 'hover:border-gold/40' : 'cursor-default'}`}>
      <span className="block text-[10px] tracking-wider text-smoke uppercase">{titulo}</span>
      <span className={`block truncate font-display text-2xl leading-tight ${alerta ? COLORES[color].titulo : 'text-ivory'}`}>{valor}</span>
      {sub && <span className="block truncate text-[11px] text-smoke">{sub}</span>}
    </button>
  );
}

/** Tarjeta de la zona de comandas: el pedido completo; cada producto se toca para marcarlo listo */
function Comanda({ g, equipo, onAsignar, onAbrir, onItem, acciones }: { g: Pedido; equipo: Miembro[]; onAsignar: (id: number | null) => void; onAbrir: () => void; onItem?: (i: Item) => void; acciones: ReactNode }) {
  const enCurso = g.items.some((i) => i.estado !== 'listo');
  return (
    <Tarjeta color={enCurso && minutos(g.desde) > 20 ? 'red' : enCurso ? 'gold' : 'venom'} lugar={g.lugar} cliente={g.cliente} desde={g.desde} onAbrir={onAbrir}>
      {/* Quién lleva este pedido a la mesa: le llega el aviso «listo para llevar» */}
      <label className={`mb-2 flex items-center gap-2 rounded-xl border px-2 py-1 text-xs ${g.mesonero_id ? 'border-venom/30 bg-emerald/20 text-venom' : 'border-orange-400/50 bg-orange-500/10 text-orange-200'}`}>
        <UserRound size={13} className="shrink-0" />
        <span className="shrink-0">{g.mesonero_id ? 'Lleva:' : 'Sin mesonero:'}</span>
        <select value={g.mesonero_id ?? ''} onChange={(e) => onAsignar(e.target.value ? Number(e.target.value) : null)}
          className="min-w-0 flex-1 bg-transparent font-semibold outline-none [&>option]:bg-[#06140f] [&>option]:text-ivory">
          <option value="">— asignar —</option>
          {equipo.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          {g.mesonero_id && !equipo.some((m) => m.id === g.mesonero_id) && <option value={g.mesonero_id}>{g.asignado ?? 'Asignado'}</option>}
        </select>
      </label>
      <ul className="space-y-1">
        {g.items.map((i) => (
          <li key={i.id}>
            {onItem ? (
              <button className="w-full rounded-lg text-left hover:bg-white/5" disabled={i.estado === 'listo'} onClick={() => onItem(i)} title="Tocar para marcar este producto listo">
                <LineaItem i={i} conEstado />
              </button>
            ) : <LineaItem i={i} />}
          </li>
        ))}
      </ul>
      <div className="mt-2">{acciones}</div>
    </Tarjeta>
  );
}
