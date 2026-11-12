'use client';

import { Beer, ChefHat, Lock, Minus, PenLine, Plus, Receipt, Search, Trash2, Unlock, Wallet, X, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { AbrirCajaRapida, type CajaEstado } from '@/components/admin/pos/AbrirCaja';
import { BandejaQR } from '@/components/admin/pos/BandejaQR';
import { PorEnviarCocina } from '@/components/admin/pos/PorEnviarCocina';
import { Cobro } from '@/components/admin/pos/Cobro';
import { type CuentaAbierta, PorCobrar, lugarCuenta } from '@/components/admin/pos/PorCobrar';
import { Configurador } from '@/components/admin/pos/Configurador';
import { type Borrador, type Catalogo, type CategoriaCat, type Cuenta, type ProductoCat, type VarianteCat } from '@/components/admin/pos/tipos';
import { Boton, Cargando, ErrorCaja, Input, Modal, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { type Moneda, dinero } from '@/lib/admin/moneda';

type Opcion = { clave: string; producto: ProductoCat; categoria: CategoriaCat; variante: VarianteCat; texto: string; agotado: boolean };

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’´.]/g, '').toLowerCase().trim();

/** «3 aguila», «3x aguila», «aguila x3» → cantidad y lo que se busca */
function leer(q: string): { cantidad: number; texto: string } {
  const t = q.trim();
  const a = t.match(/^(\d{1,2})\s*[x*]?\s+(.+)$/i) ?? t.match(/^(\d{1,2})\s*[x*]\s*(.+)$/i);
  if (a) return { cantidad: Math.max(1, Number(a[1])), texto: a[2] };
  const b = t.match(/^(.+?)\s*[x*]\s*(\d{1,2})$/i);
  if (b) return { cantidad: Math.max(1, Number(b[2])), texto: b[1] };
  return { cantidad: 1, texto: t };
}

/**
 * Venta rápida para la barra: escribes lo que piden («tobo», «2 agua»), Enter lo suma al ticket, y F2 cobra.
 * Crea una cuenta de barra, la cobra y la cierra en un solo paso. Lo de cocina sale con su comanda.
 */
// useSearchParams necesita un Suspense para que Next pueda prerenderizar la página
export default function VenderPage() {
  return <Suspense fallback={<Cargando />}><Vender /></Suspense>;
}

function Vender() {
  const router = useRouter();
  const avisos = useAvisos();
  const catalogo = useDatos<Catalogo>('/pos/catalogo', 60_000);
  const ajustes = useDatos<{ moneda_principal: Moneda }>('/config/ajustes');
  const moneda: Moneda = ajustes.datos?.moneda_principal ?? 'COP';
  const buscador = useRef<HTMLInputElement>(null);
  const cajas = useDatos<CajaEstado[]>('/caja', 15_000);
  // La caja de ESTA computadora (la última en que se abrió o cobró aquí); si no, la primera abierta
  const miCaja = typeof window === 'undefined' ? 0 : Number(localStorage.getItem('mamba_caja'));
  const cajaAbierta = cajas.datos?.find((c) => c.sesion && c.id === miCaja) ?? cajas.datos?.find((c) => c.sesion);
  const [abrirCaja, setAbrirCaja] = useState(false);

  const [q, setQ] = useState('');
  const [cat, setCat] = useState<number | 'top' | 'todo'>('top');
  const [sel, setSel] = useState(0);
  const [ticket, setTicket] = useState<Borrador[]>([]);
  const [nombre, setNombre] = useState('');
  const [config, setConfig] = useState<{ producto: ProductoCat; categoria: CategoriaCat; cantidad: number } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [cobrar, setCobrar] = useState<Cuenta | null>(null);
  const [sinCobrar, setSinCobrar] = useState<Cuenta | null>(null);
  const [vista, setVista] = useState<'vender' | 'cobrar'>('vender');
  const [pidieronCuenta, setPidieronCuenta] = useState(0);
  // «Anotar»: lo del ticket se agrega a una cuenta que ya existe (una mesa, un cliente de barra)
  const [destino, setDestino] = useState<CuentaAbierta | null>(null);
  const [editando, setEditando] = useState<Borrador | null>(null);

  /** Abre el cobro de una cuenta existente (desde Por cobrar o desde la notificación) */
  const cobrarCuenta = async (id: number) => {
    try {
      setCobrar(await adm<Cuenta>(`/cuentas/${id}`));
    } catch (e) {
      avisos.error(e);
    }
  };
  // /admin/vender?cobrar=123 → viene de la notificación «la mesa pasó a caja»
  const params = useSearchParams();
  useEffect(() => {
    const id = Number(params.get('cobrar'));
    if (!id) return;
    void cobrarCuenta(id);
    router.replace('/admin/vender');
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const enfocar = () => setTimeout(() => buscador.current?.focus(), 30);

  // Cada presentación es su propio botón: «Gaseosa · Litro» se vende de un toque
  const opciones = useMemo<Opcion[]>(() => {
    if (!catalogo.datos) return [];
    return catalogo.datos.categorias.flatMap((categoria) =>
      categoria.productos.flatMap((producto) =>
        producto.variantes.map((variante) => ({
          clave: `${producto.id}-${variante.id}`, producto, categoria, variante,
          texto: sinTildes(`${producto.nombre} ${producto.variantes.length > 1 ? variante.presentacion : ''} ${categoria.nombre}`),
          agotado: !producto.disponible || variante.disponibles === 0,
        })),
      ),
    );
  }, [catalogo.datos]);

  const { cantidad, texto } = leer(q);
  const visibles = useMemo(() => {
    const n = sinTildes(texto);
    if (n) {
      const palabras = n.split(/\s+/);
      return opciones
        .filter((o) => palabras.every((p) => o.texto.includes(p)))
        // Disponibles primero; luego el nombre exacto («agua» antes que «aguardiente»), la palabra completa,
        // lo que empieza igual, y por último lo que más se vende
        .map((o) => {
          const nombre = sinTildes(o.producto.nombre);
          const primera = nombre.split(/\s+/)[0];
          const puntos = nombre === n ? 0 : primera === palabras[0] ? 1 : nombre.split(/\s+/).includes(palabras[0]) ? 2 : nombre.startsWith(palabras[0]) ? 3 : 4;
          return { o, puntos };
        })
        .sort((a, b) => Number(a.o.agotado) - Number(b.o.agotado) || a.puntos - b.puntos || (b.o.producto.vendidos ?? 0) - (a.o.producto.vendidos ?? 0))
        .map((x) => x.o)
        .slice(0, 40);
    }
    if (cat === 'top') {
      // Lo más vendido primero; si aún hay pocas ventas, se completa con los destacados y el resto de la carta
      return opciones
        .filter((o) => !o.agotado)
        .map((o, i) => ({ o, i }))
        .sort((a, b) => (b.o.producto.vendidos ?? 0) - (a.o.producto.vendidos ?? 0) || Number(b.o.producto.destacado) - Number(a.o.producto.destacado) || a.i - b.i)
        .slice(0, 24)
        .map((x) => x.o);
    }
    return opciones.filter((o) => cat === 'todo' || o.categoria.id === cat);
  }, [opciones, texto, cat]);

  useEffect(() => setSel(0), [texto, cat]);

  const total = ticket.reduce((s, l) => s + l.unitario * l.cantidad, 0);
  const unidades = ticket.reduce((s, l) => s + l.cantidad, 0);

  const sumar = (o: Opcion, n = 1) => {
    if (o.agotado) return avisos.error(`${o.producto.nombre} está agotado`);
    // Lo que obliga a elegir (cervezas del tobo, sabores…) abre sus opciones
    if (o.variante.seleccion) return setConfig({ producto: o.producto, categoria: o.categoria, cantidad: n });
    const v = o.variante;
    setTicket((t) => {
      const igual = t.find((x) => x.variante.id === v.id && !x.detalle.length && !x.notas);
      if (igual) return t.map((x) => (x === igual ? { ...x, cantidad: x.cantidad + n } : x));
      return [...t, { clave: `${v.id}-${Date.now()}`, producto: o.producto, variante: v, cantidad: n, asiento: null, notas: '', sin: [], adicionales: [], seleccion: [], unitario: v.precios[moneda], detalle: [] }];
    });
  };

  const elegir = (o: Opcion) => {
    sumar(o, cantidad);
    setQ('');
    enfocar();
  };

  const cambiar = (clave: string, d: number) =>
    setTicket((t) => t.flatMap((x) => (x.clave !== clave ? [x] : x.cantidad + d <= 0 ? [] : [{ ...x, cantidad: x.cantidad + d }])));

  /** Crea la cuenta de barra con lo del ticket. Lo de barra entra directo; lo de cocina sale con comanda. */
  const crearCuenta = async (en?: CuentaAbierta | null) => {
    const c = en ? { id: en.id } as Cuenta : await adm<Cuenta>('/cuentas', { method: 'POST', body: { tipo: 'barra', personas: 1, nombre_cliente: nombre.trim() || null, moneda } });
    const cuerpo = (l: Borrador) => ({ variante_id: l.variante.id, cantidad: l.cantidad, asiento: null, notas: l.notas || null, sin: l.sin, adicionales: l.adicionales, seleccion: l.seleccion });
    const estacion = new Map((catalogo.datos?.categorias ?? []).flatMap((x) => x.productos.map((p) => [p.id, x.estacion] as const)));
    const cocina = ticket.filter((l) => estacion.get(l.producto.id) === 'cocina');
    const barra = ticket.filter((l) => estacion.get(l.producto.id) !== 'cocina');
    let cuenta = c as Cuenta;
    if (barra.length) cuenta = await adm<Cuenta>(`/cuentas/${c.id}/items`, { method: 'POST', body: { directo: true, items: barra.map(cuerpo) } });
    if (cocina.length) cuenta = await adm<Cuenta>(`/cuentas/${c.id}/items`, { method: 'POST', body: { directo: false, items: cocina.map(cuerpo) } });
    setTicket([]);
    setNombre('');
    catalogo.recargar();
    return cuenta;
  };

  const irACobrar = async () => {
    if (sinCobrar) return setCobrar(sinCobrar);
    if (!ticket.length || ocupado) return;
    setOcupado(true);
    try {
      const c = await crearCuenta();
      setSinCobrar(c);
      setCobrar(c);
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(false);
    }
  };

  /** Agrega el ticket a la cuenta elegida con «Anotar»; si `yCobrar`, abre el cobro de esa cuenta */
  const anotar = async (yCobrar = false) => {
    if (!destino || !ticket.length || ocupado) return;
    setOcupado(true);
    try {
      const c = await crearCuenta(destino);
      avisos.ok(`Anotado en ${lugarCuenta(destino)}${destino.nombre_cliente ? ` · ${destino.nombre_cliente}` : ''}`);
      setDestino(null);
      if (yCobrar) setCobrar(c);
      enfocar();
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(false);
    }
  };

  /** Para el que va a seguir pidiendo: queda su cuenta abierta en Barra */
  const dejarAbierta = async () => {
    if (!ticket.length || ocupado) return;
    if (!nombre.trim()) {
      avisos.error('Escribe a nombre de quién queda la cuenta');
      return document.getElementById('venta-nombre')?.focus();
    }
    setOcupado(true);
    try {
      const c = await crearCuenta();
      avisos.ok(`Cuenta abierta a nombre de ${c.nombre_cliente}`);
      enfocar();
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(false);
    }
  };

  // F2 cobra desde cualquier parte; Esc limpia la búsqueda
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (config || cobrar) return;
      if (e.key === 'F2' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) { e.preventDefault(); void (destino ? anotar(true) : irACobrar()); }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  });

  // Que no se pierda un ticket sin cobrar al salir
  useEffect(() => {
    if (!ticket.length) return;
    const k = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener('beforeunload', k);
    return () => removeEventListener('beforeunload', k);
  }, [ticket.length]);

  if (catalogo.cargando) return <Cargando />;
  if (catalogo.error || !catalogo.datos) return <ErrorCaja mensaje={catalogo.error ?? 'Sin carta'} onReintentar={catalogo.recargar} />;
  const tasa = catalogo.datos.tasa;

  return (
    <div className="mx-auto max-w-7xl">
      <BandejaQR compacta />
      <PorEnviarCocina />

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        {/* ------------------------------------------------------------ Carta */}
        <section className="min-w-0">
          {/* Vender lo que piden en la barra · cobrar o anotar en las cuentas abiertas (mesas y barra) */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button onClick={() => { setVista('vender'); enfocar(); }}
              className={`flex h-12 items-center justify-center gap-2 rounded-2xl text-base font-semibold transition ${vista === 'vender' ? 'bg-gold text-void' : 'border border-gold/25 text-smoke hover:text-ivory'}`}>
              <Zap size={18} /> Vender
            </button>
            <button onClick={() => setVista('cobrar')}
              className={`relative flex h-12 items-center justify-center gap-2 rounded-2xl text-base font-semibold transition ${vista === 'cobrar' ? 'bg-gold text-void' : 'border border-gold/25 text-smoke hover:text-ivory'}`}>
              <Wallet size={18} /> Mesas y por cobrar
              {pidieronCuenta > 0 && <span className="absolute -top-2 -right-1 grid h-6 min-w-6 place-items-center rounded-full bg-sky-400 px-1.5 text-xs font-bold text-void">{pidieronCuenta}</span>}
            </button>
          </div>

          <div className={vista === 'cobrar' ? '' : 'hidden'}>
            <PorCobrar onCobrar={cobrarCuenta} onAnotar={(c) => { setDestino(c); setVista('vender'); enfocar(); }} anotando={destino?.id ?? null} onCantidad={setPidieronCuenta} />
          </div>

          <div className={vista === 'vender' ? '' : 'hidden'}>
          <div className="sticky top-14 z-20 -mx-3 bg-[#020a07]/95 px-3 pt-1 pb-3 backdrop-blur-xl sm:mx-0 sm:px-0">
            <label className="relative block">
              <Search size={22} className="absolute top-1/2 left-4 -translate-y-1/2 text-gold" />
              <input
                ref={buscador}
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); setSel((s) => Math.min(s + 1, visibles.length - 1)); }
                  else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { if (e.key === 'ArrowUp' || !q) { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); } }
                  else if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); if (visibles[sel]) elegir(visibles[sel]); else if (!q.trim() && ticket.length) void irACobrar(); }
                  else if (e.key === 'Escape') setQ('');
                }}
                placeholder="¿Qué piden? Escribe: tobo, agua, 3 aguila…"
                className="h-16 w-full rounded-2xl border-2 border-gold/40 bg-void/80 pr-4 pl-13 text-xl text-ivory outline-none placeholder:text-smoke/60 focus:border-gold"
              />
            </label>
            <p className="mt-1.5 px-1 text-xs text-smoke">
              <b className="text-gold-light">Enter</b> agrega el resaltado · <b className="text-gold-light">↑ ↓</b> cambia · <b className="text-gold-light">«3 aguila»</b> agrega tres · <b className="text-gold-light">F2</b> cobra
              {cantidad > 1 && <span className="ml-2 rounded-full bg-gold px-2 py-0.5 font-semibold text-void">× {cantidad}</span>}
            </p>
            {!texto && (
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                {([['top', '⭐ Más vendidos'], ['todo', 'Todo'], ...catalogo.datos.categorias.map((c) => [c.id, `${c.icono ?? ''} ${c.nombre}`])] as [number | 'top' | 'todo', string][]).map(([v, t]) => (
                  <button key={v} onClick={() => { setCat(v); enfocar(); }}
                    className={`shrink-0 rounded-full px-3.5 py-2 text-sm transition ${cat === v ? 'bg-gold font-semibold text-void' : 'border border-gold/20 text-smoke hover:text-ivory'}`}>{t}</button>
                ))}
              </div>
            )}
          </div>

          {!visibles.length ? (
            <p className="rounded-3xl border-2 border-dashed border-gold/20 px-6 py-12 text-center text-smoke">No hay nada con «{texto}». Prueba con otra palabra.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
              {visibles.map((o, i) => (
                <button key={o.clave} onClick={() => { sumar(o, texto ? cantidad : 1); if (texto) setQ(''); enfocar(); }} onMouseEnter={() => setSel(i)}
                  disabled={o.agotado}
                  className={`relative flex min-h-24 flex-col justify-between rounded-2xl border-2 p-3 text-left transition active:scale-[.97] disabled:opacity-40 ${
                    i === sel && texto ? 'border-gold bg-gold/15' : 'border-gold/15 bg-[#06140f] hover:border-gold/50'}`}>
                  <span>
                    <span className="block leading-tight font-medium">{o.producto.nombre}</span>
                    {o.producto.variantes.length > 1 || !/^(unidad|botella|porci[oó]n|vaso)$/i.test(o.variante.presentacion)
                      ? <span className="text-xs text-gold/90">{o.variante.presentacion}</span> : null}
                  </span>
                  <span className="mt-2 flex items-end justify-between gap-1">
                    <span className="font-display text-lg text-gold-light">{dinero(o.variante.precios[moneda], moneda)}</span>
                    {o.agotado ? <span className="text-[10px] text-red-300 uppercase">Agotado</span>
                      : o.categoria.estacion === 'cocina' ? <ChefHat size={14} className="text-smoke" /> : o.variante.seleccion ? <span className="text-[10px] text-smoke">Elegir</span> : null}
                  </span>
                </button>
              ))}
            </div>
          )}
          </div>
        </section>

        {/* ------------------------------------------------------------ Ticket */}
        <aside className="lg:sticky lg:top-16 lg:self-start">
          <div className="flex max-h-[calc(100dvh-5.5rem)] flex-col rounded-3xl border border-gold/25 bg-[#04110c]">
            <div className="flex items-center justify-between border-b border-gold/10 px-4 py-3">
              <h1 className="flex items-center gap-2 font-display text-lg"><Zap size={18} className="text-gold" /> Venta rápida</h1>
              <Link href="/admin/barra" className="text-xs text-smoke hover:text-gold-light">Cuentas abiertas →</Link>
            </div>

            {/* Estado de la caja: sin caja abierta no se puede cobrar, y se abre desde aquí mismo */}
            {cajas.datos && (cajaAbierta ? (
              <p className="flex items-center gap-2 border-b border-gold/10 px-4 py-2 text-xs text-smoke">
                <Unlock size={13} className="text-venom" /> <b className="text-ivory">{cajaAbierta.nombre}</b> abierta · {cajaAbierta.sesion!.usuario}
                <Link href="/admin/caja" className="ml-auto hover:text-gold-light">Ver caja →</Link>
              </p>
            ) : (
              <button onClick={() => setAbrirCaja(true)} className="m-3 flex items-center gap-3 rounded-2xl border-2 border-gold/60 bg-gold/10 p-3 text-left transition hover:bg-gold/20">
                <Lock size={22} className="shrink-0 text-gold" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-gold-light">La caja está cerrada</span>
                  <span className="block text-xs text-smoke">Toca aquí para abrirla y empezar a cobrar</span>
                </span>
                <span className="rounded-xl bg-gold px-3 py-2 text-sm font-semibold text-void">Abrir caja</span>
              </button>
            ))}

            {sinCobrar && !cobrar && (
              <div className="m-3 rounded-2xl border border-gold/40 bg-gold/10 p-3 text-sm">
                <p>La venta <b>{sinCobrar.numero}</b> quedó <b>sin cobrar</b> ({dinero(sinCobrar.saldo, sinCobrar.moneda)}).</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Boton tam="sm" variante="oro" onClick={() => setCobrar(sinCobrar)}>Cobrar</Boton>
                  <Boton tam="sm" variante="sutil" onClick={() => router.push(`/admin/cuenta/${sinCobrar.id}`)}>Abrir la cuenta</Boton>
                  <Boton tam="sm" variante="sutil" onClick={() => { setSinCobrar(null); enfocar(); }}>Dejarla abierta</Boton>
                </div>
              </div>
            )}

            <div className="min-h-32 flex-1 overflow-y-auto px-3 py-2">
              {!ticket.length ? (
                <div className="py-10 text-center text-sm text-smoke">
                  <Receipt className="mx-auto mb-2 text-gold/60" />
                  Lo que agregues sale aquí.
                </div>
              ) : ticket.map((l) => (
                <div key={l.clave} className="flex items-center gap-2 border-b border-white/5 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.producto.nombre}{l.producto.variantes.length > 1 && <span className="text-gold/80"> · {l.variante.presentacion}</span>}</p>
                    {(l.detalle.length > 0 || l.notas) && <p className="truncate text-[11px] text-gold/90">{[...l.detalle, l.notas].filter(Boolean).join(' · ')}</p>}
                    <button onClick={() => setEditando(l)} className="flex items-center gap-1 text-[11px] text-smoke hover:text-gold-light">
                      <PenLine size={11} /> {l.variante.removibles.length ? 'Quitar ingredientes / nota' : 'Agregar nota'}
                    </button>
                    <p className="text-xs text-smoke">{dinero(l.unitario * l.cantidad, moneda)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => cambiar(l.clave, -1)} className="grid h-9 w-9 place-items-center rounded-xl border border-gold/20 hover:bg-white/5" aria-label="Uno menos">{l.cantidad === 1 ? <Trash2 size={15} className="text-red-300" /> : <Minus size={15} />}</button>
                    <span className="w-7 text-center font-display text-lg">{l.cantidad}</span>
                    <button onClick={() => cambiar(l.clave, 1)} className="grid h-9 w-9 place-items-center rounded-xl border border-gold/20 hover:bg-white/5" aria-label="Uno más"><Plus size={15} /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 border-t border-gold/10 p-3">
              {destino ? (
                <div className="flex items-center gap-2 rounded-2xl border-2 border-gold bg-gold/10 px-3 py-2">
                  <PenLine size={16} className="shrink-0 text-gold" />
                  <p className="min-w-0 flex-1 text-sm">Anotando en <b className="text-gold-light">{lugarCuenta(destino)}{destino.nombre_cliente ? ` · ${destino.nombre_cliente}` : ''}</b></p>
                  <button onClick={() => setDestino(null)} className="text-smoke hover:text-ivory" aria-label="Dejar de anotar en esa cuenta"><X size={16} /></button>
                </div>
              ) : (
              <Input id="venta-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="A nombre de (opcional)" />
              )}
              <div className="flex items-baseline justify-between px-1">
                <span className="text-sm text-smoke">{unidades ? `${unidades} ${unidades === 1 ? 'producto' : 'productos'}` : 'Total'}</span>
                <span className="font-display text-4xl font-light text-gold-light">{dinero(total, moneda)}</span>
              </div>
              {destino ? (
                <>
                  <Boton variante="oro" tam="lg" className="!h-16 w-full !text-lg" disabled={!ticket.length} cargando={ocupado} onClick={() => anotar(false)}>
                    <PenLine size={20} /> Anotar en la cuenta
                  </Boton>
                  <Boton variante="borde" className="w-full" disabled={!ticket.length || ocupado} onClick={() => anotar(true)}>
                    <Wallet size={15} /> Anotar y cobrar <span className="ml-1 rounded-md bg-white/10 px-1.5 text-xs">F2</span>
                  </Boton>
                </>
              ) : (
              <Boton variante="oro" tam="lg" className="!h-16 w-full !text-lg" disabled={!ticket.length} cargando={ocupado} onClick={irACobrar}>
                <Zap size={20} /> Cobrar <span className="ml-1 rounded-md bg-void/20 px-1.5 text-xs">F2</span>
              </Boton>
              )}
              <div className={`grid grid-cols-[1fr_auto] gap-2 ${destino ? 'hidden' : ''}`}>
                <Boton variante="borde" disabled={!ticket.length || ocupado} onClick={dejarAbierta} title="Para el que va a seguir pidiendo">
                  <Beer size={15} /> Dejar en cuenta abierta
                </Boton>
                <Boton variante="sutil" disabled={!ticket.length} onClick={() => { if (confirm('¿Vaciar el ticket?')) { setTicket([]); enfocar(); } }} aria-label="Vaciar ticket"><X size={16} /></Boton>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {config && (
        <Configurador
          key={config.producto.id}
          producto={config.producto} categoria={config.categoria} moneda={moneda} asientos={0} asientoInicial={null}
          onCerrar={() => { setConfig(null); enfocar(); }}
          onAgregar={(b) => { setTicket((t) => [...t, b]); setConfig(null); enfocar(); }}
        />
      )}

      {editando && (
        <Configurador
          key={`e-${editando.clave}`}
          producto={editando.producto}
          categoria={catalogo.datos.categorias.find((c) => c.productos.some((p) => p.id === editando.producto.id))!}
          moneda={moneda} asientos={0} asientoInicial={null}
          onCerrar={() => { setEditando(null); enfocar(); }}
          onAgregar={(b) => { setTicket((t) => t.map((x) => (x.clave === editando.clave ? { ...b, cantidad: b.cantidad === 1 ? editando.cantidad : b.cantidad } : x))); setEditando(null); enfocar(); }}
        />
      )}

      {abrirCaja && (
        <Modal titulo="Abrir caja" subtitulo="Confirma con cuánto efectivo arrancas y listo." onCerrar={() => { setAbrirCaja(false); enfocar(); }} ancho="max-w-md">
          <AbrirCajaRapida onAbierta={() => { setAbrirCaja(false); cajas.recargar(); enfocar(); }} />
        </Modal>
      )}

      {cobrar && (
        <Cobro
          cuenta={cobrar} tasa={tasa} cerrarAlPagar={sinCobrar?.id === cobrar.id ? true : undefined}
          onPagado={(c) => { if (sinCobrar?.id === c.id) setSinCobrar(c.saldo <= 0 ? null : c); }}
          onCerrar={() => { setCobrar(null); cajas.recargar(); enfocar(); }}
        />
      )}
    </div>
  );
}
