'use client';

import { BellRing, Check, ChefHat, Clock, Flame, Loader2, Martini, Minus, Plus, Search, Send, ShoppingBag, Trash2, X, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Configurador } from '@/components/admin/pos/Configurador';
import type { Borrador, CategoriaCat, ProductoCat } from '@/components/admin/pos/tipos';
import { Boton, Input, Modal } from '@/components/admin/ui';
import { API_URL } from '@/lib/api';
import { type Moneda, dinero } from '@/lib/admin/moneda';

type Carta = {
  local: { nombre: string };
  mesa: { numero: number; nombre: string | null; zona: string | null; lugar: string };
  moneda: Moneda;
  pedidos_activos: boolean;
  categorias: CategoriaCat[];
};
type Linea = { nombre: string; presentacion: string | null; cantidad: number; detalle: string[]; subtotal: number };
type EstadoItem = 'pendiente' | 'preparando' | 'listo' | 'entregado';
type MiPedido = {
  id: number; estado: 'pendiente' | 'aceptado' | 'rechazado'; motivo: string | null; resumen: Linea[]; total: number; moneda: Moneda; creado_en: string;
  /** Ya aceptado: cada producto con su estado en cocina / barra */
  items?: { nombre: string; presentacion: string | null; cantidad: number; estado: EstadoItem; estacion: string }[];
};

/** Etapas que ve el cliente: recibido → confirmado → preparando → ¡listo! → entregado */
const ETAPAS = ['Recibido', 'Confirmado', 'Preparando', '¡Listo!', 'Entregado'] as const;
function etapa(p: MiPedido): number {
  if (p.estado === 'pendiente') return 0;
  const it = p.items ?? [];
  if (!it.length) return 1;
  if (it.every((i) => i.estado === 'entregado')) return 4;
  if (it.every((i) => i.estado === 'listo' || i.estado === 'entregado')) return 3;
  if (it.some((i) => i.estado !== 'pendiente')) return 2;
  return 1;
}
const enCurso = (p: MiPedido) => p.estado === 'pendiente' || (p.estado === 'aceptado' && etapa(p) < 4 && Date.now() - new Date(p.creado_en).getTime() < 4 * 3600_000);
const TEXTO_ITEM: Record<EstadoItem, { texto: string; clase: string }> = {
  pendiente: { texto: 'En cola', clase: 'bg-white/10 text-smoke' },
  preparando: { texto: 'Preparando', clase: 'bg-gold/20 text-gold-light' },
  listo: { texto: '¡Listo!', clase: 'bg-venom/25 text-venom' },
  entregado: { texto: 'Entregado', clase: 'bg-sky-500/20 text-sky-200' },
};

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });

async function api<T>(ruta: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/qr/${ruta}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new Error('Sin conexión. Revisa el internet de tu celular e inténtalo de nuevo.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Algo salió mal. Inténtalo de nuevo.');
  return data as T;
}

/**
 * Carta del cliente que abre el QR de la mesa. Arma su pedido con las mismas opciones del POS
 * (presentaciones, sin ingredientes, adicionales, surtidos) y lo envía a la barra, que lo confirma.
 */
export function PedirQR({ token }: { token: string }) {
  const [carta, setCarta] = useState<Carta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [catId, setCatId] = useState<number | 'todas'>('todas');
  const [q, setQ] = useState('');
  const [carrito, setCarrito] = useState<Borrador[]>([]);
  const [config, setConfig] = useState<{ producto: ProductoCat; categoria: CategoriaCat } | null>(null);
  const [verCarrito, setVerCarrito] = useState(false);
  const [nombre, setNombre] = useState('');
  const [nota, setNota] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [misPedidos, setMisPedidos] = useState<MiPedido[]>([]);
  const [recienEnviado, setRecienEnviado] = useState<number | null>(null);

  const clave = `mamba_qr_${token}`;
  const leerIds = useCallback((): number[] => {
    try { return JSON.parse(localStorage.getItem(clave) ?? '[]'); } catch { return []; }
  }, [clave]);

  useEffect(() => {
    api<Carta>(token).then(setCarta).catch((e: Error) => setError(e.message));
    try { setNombre(localStorage.getItem('mamba_qr_nombre') ?? ''); } catch { /* sin almacenamiento */ }
  }, [token]);

  // Estado de lo que este teléfono ya pidió: se consulta seguido mientras haya algo por confirmar
  const refrescarPedidos = useCallback(async () => {
    const ids = leerIds();
    if (!ids.length) return;
    try { setMisPedidos(await api<MiPedido[]>(`${token}/pedidos?ids=${ids.join(',')}`)); } catch { /* reintenta en el próximo ciclo */ }
  }, [token, leerIds]);
  useEffect(() => { refrescarPedidos(); }, [refrescarPedidos]);
  // Mientras haya algo por confirmar o preparándose, se consulta seguido para que el cliente vea cada cambio
  const hayEnCurso = misPedidos.some(enCurso);
  useEffect(() => {
    if (!hayEnCurso) return;
    const t = setInterval(refrescarPedidos, 5000);
    const alVolver = () => document.visibilityState === 'visible' && refrescarPedidos();
    document.addEventListener('visibilitychange', alVolver);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', alVolver); };
  }, [hayEnCurso, refrescarPedidos]);

  const moneda = carta?.moneda ?? 'COP';
  const puedePedir = !!carta?.pedidos_activos;

  const productos = useMemo(() => {
    if (!carta) return [];
    const n = sinTildes(q.trim());
    return carta.categorias
      .filter((c) => n || catId === 'todas' || c.id === catId)
      .map((c) => ({ categoria: c, productos: c.productos.filter((p) => !n || sinTildes(`${p.nombre} ${p.descripcion ?? ''}`).includes(n)) }))
      .filter((g) => g.productos.length);
  }, [carta, catId, q]);

  const esRapido = (p: ProductoCat) => p.variantes.length === 1 && !p.variantes[0].removibles.length && !p.variantes[0].seleccion;
  const agotado = (p: ProductoCat) => !p.disponible || p.variantes.every((v) => v.disponibles === 0);

  const sumar = (producto: ProductoCat, categoria: CategoriaCat) => {
    if (!puedePedir || agotado(producto)) return;
    if (!esRapido(producto) || categoria.adicionales.length) return setConfig({ producto, categoria });
    const v = producto.variantes[0];
    setCarrito((b) => {
      const igual = b.find((x) => x.variante.id === v.id && !x.detalle.length && !x.notas);
      if (igual) return b.map((x) => (x === igual ? { ...x, cantidad: x.cantidad + 1 } : x));
      return [...b, { clave: `${v.id}-${Date.now()}`, producto, variante: v, cantidad: 1, asiento: null, notas: '', sin: [], adicionales: [], seleccion: [], unitario: v.precios[moneda], detalle: [] }];
    });
  };
  const cambiar = (clave: string, delta: number) =>
    setCarrito((b) => b.flatMap((x) => (x.clave !== clave ? [x] : x.cantidad + delta <= 0 ? [] : [{ ...x, cantidad: x.cantidad + delta }])));
  const enCarrito = (p: ProductoCat) => carrito.filter((b) => b.producto.id === p.id).reduce((s, b) => s + b.cantidad, 0);

  const unidades = carrito.reduce((s, b) => s + b.cantidad, 0);
  const total = carrito.reduce((s, b) => s + b.unitario * b.cantidad, 0);

  const [confirmar, setConfirmar] = useState(false);
  const enviar = async () => {
    setEnviando(true);
    setErrorEnvio(null);
    try {
      const p = await api<MiPedido>(`${token}/pedidos`, {
        nombre_cliente: nombre.trim() || null,
        nota: nota.trim() || null,
        items: carrito.map((b) => ({ variante_id: b.variante.id, cantidad: b.cantidad, notas: b.notas || null, sin: b.sin, adicionales: b.adicionales, seleccion: b.seleccion })),
      });
      try {
        localStorage.setItem(clave, JSON.stringify([p.id, ...leerIds()].slice(0, 20)));
        if (nombre.trim()) localStorage.setItem('mamba_qr_nombre', nombre.trim());
      } catch { /* sin almacenamiento: igual se ve el estado mientras la página siga abierta */ }
      setMisPedidos((m) => [p, ...m]);
      setCarrito([]);
      setNota('');
      setVerCarrito(false);
      setConfirmar(false);
      setRecienEnviado(p.id);
    } catch (e) {
      setErrorEnvio((e as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  // ------------------------------------------------------------------ Pantallas de carga / error
  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center bg-void px-6 text-center">
        <div>
          <XCircle size={48} className="mx-auto text-red-300" />
          <p className="mt-4 font-display text-2xl text-ivory">No pudimos abrir la carta</p>
          <p className="mt-2 text-smoke">{error}</p>
          <Boton variante="oro" tam="lg" className="mt-6" onClick={() => location.reload()}>Intentar de nuevo</Boton>
        </div>
      </main>
    );
  }
  if (!carta) {
    return (
      <main className="grid min-h-dvh place-items-center bg-void">
        <div className="text-center">
          <img src="/brand/logo.webp" alt="" className="mx-auto h-20 w-20 animate-pulse rounded-full ring-1 ring-gold/40" />
          <p className="mt-4 flex items-center gap-2 text-sm text-smoke"><Loader2 size={15} className="animate-spin text-gold" /> Abriendo la carta…</p>
        </div>
      </main>
    );
  }

  const seguimiento = recienEnviado ? misPedidos.find((p) => p.id === recienEnviado) : null;

  return (
    <main className="min-h-dvh bg-void pb-32 text-ivory">
      {/* ------------------------------------------------------------ Cabecera */}
      <header className="sticky top-0 z-30 border-b border-gold/15 bg-[#020a07]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-3">
          <img src="/brand/logo.webp" alt="" className="h-11 w-11 shrink-0 rounded-full ring-1 ring-gold/40" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg leading-tight">{carta.local.nombre}</p>
            <p className="text-xs text-smoke">Carta digital · pide desde tu mesa</p>
          </div>
          <div className="shrink-0 rounded-2xl border border-gold/40 bg-gold/10 px-3 py-1.5 text-center">
            <p className="text-[9px] tracking-widest text-gold uppercase">{carta.mesa.lugar.startsWith('Mesa') ? 'Mesa' : 'Tu lugar'}</p>
            <p className="font-display text-xl leading-none text-gold-light">{carta.mesa.lugar.startsWith('Mesa') ? carta.mesa.numero : carta.mesa.lugar}</p>
          </div>
        </div>
        <div className="mx-auto max-w-3xl space-y-2 px-4 pb-3">
          <label className="relative block">
            <Search size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-smoke" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="¿Qué se te antoja?" className="!h-11 pl-10" />
            {q && <button onClick={() => setQ('')} className="absolute top-1/2 right-2 grid h-8 w-8 -translate-y-1/2 place-items-center text-smoke" aria-label="Limpiar"><X size={15} /></button>}
          </label>
          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
            <button onClick={() => setCatId('todas')} className={`h-10 shrink-0 rounded-full px-4 text-sm ${catId === 'todas' ? 'bg-gold font-semibold text-void' : 'border border-gold/20 text-smoke'}`}>Todo</button>
            {carta.categorias.map((c) => (
              <button key={c.id} onClick={() => { setCatId(c.id); setQ(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`h-10 shrink-0 rounded-full px-4 text-sm whitespace-nowrap ${catId === c.id ? 'bg-gold font-semibold text-void' : 'border border-gold/20 text-smoke'}`}>
                {c.icono} {c.nombre}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4">
        {!puedePedir && (
          <p className="mt-4 rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm text-sky-100">
            Mira la carta con calma. Para pedir, llama a tu mesero y con gusto te atiende.
          </p>
        )}

        {/* ------------------------------------------------------------ Mis pedidos */}
        {misPedidos.length > 0 && (
          <section className="mt-4 space-y-2">
            {misPedidos.slice(0, 3).map((p) => <EstadoPedido key={p.id} p={p} />)}
          </section>
        )}

        {/* ------------------------------------------------------------ Carta */}
        {productos.map(({ categoria, productos: lista }) => (
          <section key={categoria.id} className="mt-6">
            <h2 className="mb-2 flex items-center gap-2 font-display text-xl text-gold-light">
              <span>{categoria.icono}</span> {categoria.nombre}
            </h2>
            <ul className="space-y-2">
              {lista.map((p) => {
                const sinStock = agotado(p);
                const min = Math.min(...p.variantes.map((v) => v.precios[moneda]));
                const n = enCarrito(p);
                const rapido = esRapido(p) && !categoria.adicionales.length;
                return (
                  <li key={p.id}>
                    <div className={`flex items-center gap-3 rounded-2xl border p-3 transition ${n ? 'border-gold/60 bg-gold/10' : 'border-gold/10 bg-[#06140f]'} ${sinStock ? 'opacity-45' : ''}`}>
                      <button className="min-w-0 flex-1 text-left" disabled={!puedePedir || sinStock} onClick={() => sumar(p, categoria)}>
                        <p className="leading-tight font-medium">{p.nombre}</p>
                        {p.descripcion && <p className="mt-0.5 line-clamp-2 text-xs text-smoke">{p.descripcion}</p>}
                        <p className="mt-1.5 font-display text-lg text-gold-light">
                          {p.variantes.length > 1 && <span className="mr-1 text-[11px] text-smoke">desde</span>}{dinero(min, moneda)}
                          {p.variantes.length > 1 && <span className="ml-2 text-[11px] text-smoke">{p.variantes.map((v) => v.presentacion).join(' · ')}</span>}
                        </p>
                        {sinStock && <p className="text-xs text-red-300">Agotado por ahora</p>}
                        {p.variantes[0].seleccion && !sinStock && <p className="text-xs text-venom">Arma tu surtido</p>}
                      </button>
                      {puedePedir && !sinStock && (
                        rapido && n > 0 ? (
                          <div className="flex shrink-0 flex-col items-center gap-1 rounded-full border border-gold/30 p-0.5">
                            <button onClick={() => sumar(p, categoria)} className="grid h-10 w-10 place-items-center rounded-full bg-gold text-void" aria-label="Uno más"><Plus size={18} /></button>
                            <span className="font-display text-lg leading-none tabular-nums">{n}</span>
                            <button onClick={() => { const l = carrito.find((b) => b.producto.id === p.id); if (l) cambiar(l.clave, -1); }} className="grid h-10 w-10 place-items-center rounded-full text-gold" aria-label="Uno menos"><Minus size={18} /></button>
                          </div>
                        ) : (
                          <button onClick={() => sumar(p, categoria)} className="relative grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gold text-void shadow-lg shadow-gold/20 active:scale-95" aria-label={`Agregar ${p.nombre}`}>
                            <Plus size={22} />
                            {n > 0 && <span className="absolute -top-1 -right-1 grid h-5 min-w-5 place-items-center rounded-full bg-venom px-1 text-[11px] font-bold text-void">{n}</span>}
                          </button>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
        {!productos.length && <p className="py-16 text-center text-smoke">No encontramos “{q}” en la carta.</p>}
        <p className="mt-10 text-center text-[11px] text-smoke/70">Precios en {moneda}. Tu pedido lo confirma la barra antes de prepararlo.</p>
      </div>

      {/* ------------------------------------------------------------ Barra inferior */}
      {unidades > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gold/30 bg-[#020a07]/95 p-3 pb-[max(env(safe-area-inset-bottom),12px)] backdrop-blur-xl">
          <button onClick={() => setVerCarrito(true)} className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 rounded-2xl bg-gold px-4 font-semibold text-void active:scale-[.99]">
            <span className="grid h-9 min-w-9 place-items-center rounded-full bg-void/20 px-2 font-display text-lg">{unidades}</span>
            <span className="flex-1 text-left">Ver mi pedido</span>
            <span className="font-display text-xl">{dinero(total, moneda)}</span>
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------ Mi pedido */}
      {verCarrito && (
        <Modal titulo="Tu pedido" subtitulo={`${carta.mesa.lugar}${carta.mesa.zona ? ` · ${carta.mesa.zona}` : ''}`} onCerrar={() => { setVerCarrito(false); setConfirmar(false); }} ancho="max-w-lg"
          pie={
            <div className="w-full space-y-2">
              {errorEnvio && <p className="rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{errorEnvio}</p>}
              {/* Un toque más para corroborar: «¿Está todo bien?» antes de mandarlo a la barra */}
              {confirmar ? (
                <>
                  <p className="text-center text-sm text-gold-light">¿Está todo bien? Revisa tu pedido arriba.</p>
                  <div className="grid grid-cols-[auto_1fr] gap-2">
                    <Boton tam="lg" className="!h-14" onClick={() => setConfirmar(false)}>Corregir</Boton>
                    <Boton variante="oro" tam="lg" className="!h-14 !text-base" cargando={enviando} onClick={enviar}>
                      <Send size={19} /> Sí, enviar · {dinero(total, moneda)}
                    </Boton>
                  </div>
                </>
              ) : (
                <Boton variante="oro" tam="lg" className="w-full !h-14 !text-base" disabled={!carrito.length} onClick={() => setConfirmar(true)}>
                  <Send size={19} /> Enviar a la barra · {dinero(total, moneda)}
                </Boton>
              )}
            </div>
          }>
          {!carrito.length ? <p className="py-8 text-center text-smoke">Tu pedido está vacío.</p> : (
            <div className="space-y-5">
              <ul className="space-y-2">
                {carrito.map((b) => {
                  const cocina = carta.categorias.find((c) => c.productos.some((p) => p.id === b.producto.id))?.estacion === 'cocina';
                  return (
                    <li key={b.clave} className="rounded-2xl border border-gold/10 bg-void/40 p-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="leading-tight font-medium">{b.producto.nombre}{b.producto.variantes.length > 1 && <span className="font-normal text-smoke"> · {b.variante.presentacion}</span>}</p>
                          <p className={`mt-0.5 inline-flex items-center gap-1 text-[11px] ${cocina ? 'text-gold' : 'text-venom'}`}>{cocina ? <ChefHat size={12} /> : <Martini size={12} />} {cocina ? 'Sale de cocina' : 'Sale de barra'}</p>
                          {b.detalle.map((d) => <p key={d} className={`text-xs ${d.startsWith('SIN') ? 'text-red-300' : d.startsWith('+') ? 'text-venom' : 'text-smoke'}`}>{d}</p>)}
                          {b.notas && <p className="text-xs text-smoke">📝 {b.notas}</p>}
                        </div>
                        <p className="font-display text-lg text-gold-light tabular-nums">{dinero(b.unitario * b.cantidad, moneda)}</p>
                      </div>
                      <div className="mt-2 flex items-center rounded-full border border-gold/25 w-fit">
                        <button onClick={() => cambiar(b.clave, -1)} className="grid h-11 w-11 place-items-center rounded-full text-gold" aria-label="Uno menos">{b.cantidad === 1 ? <Trash2 size={17} className="text-red-300" /> : <Minus size={18} />}</button>
                        <span className="w-8 text-center font-display text-xl tabular-nums">{b.cantidad}</span>
                        <button onClick={() => cambiar(b.clave, 1)} disabled={b.variante.disponibles != null && b.cantidad >= b.variante.disponibles} className="grid h-11 w-11 place-items-center rounded-full text-gold disabled:opacity-30" aria-label="Uno más"><Plus size={18} /></button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div>
                <p className="mb-1.5 text-xs tracking-wider text-gold uppercase">¿A nombre de quién?</p>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre (opcional)" maxLength={60} className="!h-12" />
              </div>
              <div>
                <p className="mb-1.5 text-xs tracking-wider text-gold uppercase">Algo más que debamos saber</p>
                <Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Bien frías, con limón, traer 4 vasos…" maxLength={200} className="!h-12" />
              </div>
              <p className="text-center text-xs text-smoke">La barra confirma tu pedido y te lo llevan a la mesa. Se paga al final con tu cuenta.</p>
            </div>
          )}
        </Modal>
      )}

      {/* ------------------------------------------------------------ Seguimiento justo después de enviar */}
      {seguimiento && (
        <Modal titulo={seguimiento.estado === 'pendiente' ? '¡Pedido enviado!' : seguimiento.estado === 'aceptado' ? ETAPAS[etapa(seguimiento)] : 'No pudimos tomar tu pedido'} onCerrar={() => setRecienEnviado(null)} ancho="max-w-md"
          pie={<Boton variante="oro" tam="lg" className="w-full" onClick={() => setRecienEnviado(null)}>{seguimiento.estado === 'rechazado' ? 'Entendido' : 'Seguir viendo la carta'}</Boton>}>
          <div className="py-4 text-center">
            {seguimiento.estado === 'pendiente' && (
              <>
                <span className="relative mx-auto grid h-20 w-20 place-items-center rounded-full bg-gold/15"><Loader2 size={40} className="animate-spin text-gold" /></span>
                <p className="mt-4 text-lg">La barra está revisando tu pedido</p>
                <p className="mt-1 text-sm text-smoke">Esta pantalla se actualiza sola. No hace falta enviarlo otra vez.</p>
              </>
            )}
            {seguimiento.estado === 'aceptado' && <Seguimiento p={seguimiento} grande />}
            {seguimiento.estado === 'rechazado' && (
              <>
                <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-red-500/15"><XCircle size={44} className="text-red-300" /></span>
                <p className="mt-4 text-lg">{seguimiento.motivo}</p>
                <p className="mt-1 text-sm text-smoke">Puedes pedir otra cosa o llamar a tu mesero.</p>
              </>
            )}
          </div>
        </Modal>
      )}

      {config && (
        <Configurador
          key={config.producto.id}
          publico
          producto={config.producto} categoria={config.categoria} moneda={moneda} asientos={0} asientoInicial={null}
          onCerrar={() => setConfig(null)}
          onAgregar={(b) => { setCarrito((c) => [...c, b]); setConfig(null); }}
        />
      )}
    </main>
  );
}

/** Barra de progreso del pedido y el estado de cada producto: cambia sola mientras lo preparan */
function Seguimiento({ p, grande = false }: { p: MiPedido; grande?: boolean }) {
  const e = etapa(p);
  const mensaje = ['La barra está revisando tu pedido', 'Confirmado: entró a la cocina y la barra', 'Lo están preparando', '¡Listo! Ya te lo llevan a la mesa', 'Entregado. ¡Disfruta!'][e];
  return (
    <div className={grande ? 'text-left' : ''}>
      <p className={`mb-3 flex items-center gap-2 ${grande ? 'justify-center text-lg' : 'text-sm font-medium'} ${e >= 3 ? 'text-venom' : 'text-gold-light'}`}>
        {e === 2 ? <Flame size={grande ? 22 : 16} className="animate-pulse" /> : e === 3 ? <BellRing size={grande ? 22 : 16} className="animate-bounce" /> : e === 4 ? <Check size={grande ? 22 : 16} /> : <Clock size={grande ? 22 : 16} />}
        {mensaje}
      </p>
      {/* Pasos */}
      <div className="flex items-center gap-1">
        {ETAPAS.map((n, k) => (
          <div key={n} className="flex flex-1 flex-col items-center gap-1">
            <div className={`h-1.5 w-full rounded-full transition-all duration-700 ${k <= e ? (e >= 3 ? 'bg-venom' : 'bg-gold') : 'bg-white/10'} ${k === e && e < 4 ? 'animate-pulse' : ''}`} />
            <span className={`text-[10px] ${k === e ? 'font-semibold text-ivory' : k < e ? 'text-smoke' : 'text-smoke/50'}`}>{n}</span>
          </div>
        ))}
      </div>
      {/* Cada producto */}
      {(p.items ?? []).length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {p.items!.map((i, k) => (
            <li key={k} className="flex items-center gap-2 text-sm">
              {i.estacion === 'cocina' ? <ChefHat size={13} className="shrink-0 text-gold" /> : <Martini size={13} className="shrink-0 text-venom" />}
              <span className="min-w-0 flex-1 truncate text-ivory/90">{Number(i.cantidad)}× {i.nombre}</span>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${TEXTO_ITEM[i.estado].clase}`}>{TEXTO_ITEM[i.estado].texto}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EstadoPedido({ p }: { p: MiPedido }) {
  const est = {
    pendiente: { icono: <Clock size={16} />, texto: 'Esperando confirmación de la barra', clase: 'border-gold/40 bg-gold/10 text-gold-light' },
    aceptado: { icono: <Check size={16} />, texto: 'Confirmado · en preparación', clase: 'border-venom/40 bg-emerald/30 text-venom' },
    rechazado: { icono: <XCircle size={16} />, texto: p.motivo ? `No se tomó: ${p.motivo}` : 'No se pudo tomar', clase: 'border-red-400/30 bg-red-500/10 text-red-200' },
  }[p.estado];
  const unidades = p.resumen.reduce((s, l) => s + l.cantidad, 0);
  if (p.estado === 'aceptado')
    return (
      <div className={`rounded-2xl border px-3 py-3 ${etapa(p) >= 3 ? 'border-venom/40 bg-emerald/20' : 'border-gold/30 bg-gold/5'}`}>
        <Seguimiento p={p} />
        <p className="mt-2 text-[11px] text-smoke">Pedido de las {hora(p.creado_en)}</p>
      </div>
    );
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${est.clase}`}>
      <span className={p.estado === 'pendiente' ? 'animate-pulse' : ''}>{est.icono}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{est.texto}</p>
        <p className="truncate text-xs text-ivory/70"><ShoppingBag size={11} className="mr-1 inline" />{unidades} {unidades === 1 ? 'producto' : 'productos'} · {p.resumen.map((l) => `${l.cantidad} ${l.nombre}`).join(', ')} · {hora(p.creado_en)}</p>
      </div>
    </div>
  );
}
