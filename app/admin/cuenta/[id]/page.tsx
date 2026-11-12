'use client';

import { ArrowLeft, Ban, BellRing, Check, ChefHat, ChevronRight, HandCoins, Martini, Minus, MoreHorizontal, Percent, Plus, Printer, Search, Send, Trash2, UserRound, Users, Wallet, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useSesion } from '@/components/admin/Sesion';
import { Cobro } from '@/components/admin/pos/Cobro';
import { PasarACaja } from '@/components/admin/pos/PasarACaja';
import { Configurador } from '@/components/admin/pos/Configurador';
import { Fiar } from '@/components/admin/pos/Fiar';
import { NombreCliente } from '@/components/admin/pos/NombreCliente';
import { type Borrador, type Catalogo, type CategoriaCat, type Cuenta, type ItemCuenta, type ProductoCat, tituloCuenta } from '@/components/admin/pos/tipos';
import { Area, Boton, Campo, Cargando, ErrorCaja, Input, InputNum, Insignia, Interruptor, Modal, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { useVivo } from '@/lib/admin/vivo';
import { MONEDAS, dinero, fechaHora, hace, soloHora } from '@/lib/admin/moneda';

const ESTADO_ITEM: Record<string, { texto: string; color: 'gris' | 'oro' | 'verde' | 'azul' | 'rojo' }> = {
  pendiente: { texto: 'En cola', color: 'gris' }, preparando: { texto: 'Preparando', color: 'oro' }, listo: { texto: '¡Listo!', color: 'verde' },
  entregado: { texto: 'Entregado', color: 'azul' }, anulado: { texto: 'Anulado', color: 'rojo' },
};
const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function CuentaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { es, usuario } = useSesion();
  const cuenta = useDatos<Cuenta>(`/cuentas/${id}`, 30_000);
  const catalogo = useDatos<Catalogo>('/pos/catalogo', 60_000);
  const avisos = useAvisos();

  // null = automático: arranca en «Más pedidos» si ya hay ventas, si no en «Todo»
  const [catSel, setCatId] = useState<number | 'todas' | 'top' | null>(null);
  const [renombrar, setRenombrar] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [config, setConfig] = useState<{ producto: ProductoCat; categoria: CategoriaCat } | null>(null);
  const [borrador, setBorrador] = useState<Borrador[]>([]);
  const [directo, setDirecto] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [anular, setAnular] = useState<ItemCuenta | 'cuenta' | null>(null);
  const [motivo, setMotivo] = useState('');
  const [ajustes, setAjustes] = useState<Record<string, any> | null>(null);
  const [menu, setMenu] = useState(false);
  const [vistaMovil, setVistaMovil] = useState<'carta' | 'cuenta'>('carta');
  const [ocupado, setOcupado] = useState(false);
  const [aCaja, setACaja] = useState(false);
  const [fiando, setFiando] = useState(false);

  // En vivo: si barra/cocina marcan algo listo o caja cobra, esta pantalla se entera al instante
  useVivo((e) => {
    if (e.tipo === 'reconectado') return cuenta.recargar();
    const esMia = e.tipo === 'comanda' ? e.items.some((i) => String(i.cuenta_id) === id) : 'cuenta_id' in e && String(e.cuenta_id) === id;
    if (esMia) cuenta.recargar();
  });

  const c = cuenta.datos;
  const cat = catalogo.datos;
  const abierta = c?.estado === 'abierta';
  const moneda = c?.moneda ?? 'COP';
  const puedeCobrar = es('gerente', 'cajero', 'barra');
  const esDirecto = directo ?? c?.tipo === 'barra';
  const asientos = c?.mesa_tipo === 'barra' ? 0 : (c?.mesa_capacidad ?? 0);

  const hayTop = !!cat?.categorias.some((x) => x.productos.some((p) => (p.vendidos ?? 0) > 0));
  const catId = catSel ?? (hayTop ? 'top' : 'todas');

  const productos = useMemo(() => {
    if (!cat) return [];
    const n = sinTildes(q.trim());
    // Lo que más sale, primero: los 16 productos más vendidos de los últimos 30 días
    if (catId === 'top' && !n)
      return cat.categorias
        .flatMap((categoria) => categoria.productos.map((producto) => ({ producto, categoria })))
        .filter(({ producto }) => (producto.vendidos ?? 0) > 0)
        .sort((a, b) => (b.producto.vendidos ?? 0) - (a.producto.vendidos ?? 0))
        .slice(0, 16);
    return cat.categorias
      .filter((x) => n || catId === 'todas' || catId === 'top' || x.id === catId)
      .flatMap((categoria) => categoria.productos.filter((p) => !n || sinTildes(p.nombre).includes(n)).map((producto) => ({ producto, categoria })));
  }, [cat, catId, q]);

  /** Un toque agrega una unidad si el producto no obliga a elegir nada (los adicionales se piden con el botón de opciones) */
  const esRapido = (p: ProductoCat) => p.variantes.length === 1 && !p.variantes[0].removibles.length && !p.variantes[0].seleccion;

  const elegir = (producto: ProductoCat, categoria: CategoriaCat) => {
    const v = producto.variantes[0];
    if (!esRapido(producto)) return setConfig({ producto, categoria });
    // Producto sin opciones: un toque = una unidad más
    setBorrador((b) => {
      const igual = b.find((x) => x.variante.id === v.id && !x.detalle.length && !x.notas && x.asiento == null);
      if (igual) return b.map((x) => (x === igual ? { ...x, cantidad: x.cantidad + 1 } : x));
      return [...b, { clave: `${v.id}-${Date.now()}`, producto, variante: v, cantidad: 1, asiento: null, notas: '', sin: [], adicionales: [], seleccion: [], unitario: v.precios[moneda], detalle: [] }];
    });
  };

  /** −/+ directo sobre lo que está por enviar; en 0 se quita la línea */
  const cambiarCantidad = (clave: string, delta: number) =>
    setBorrador((b) => b.flatMap((x) => (x.clave !== clave ? [x] : x.cantidad + delta <= 0 ? [] : [{ ...x, cantidad: x.cantidad + delta }])));

  /** A qué estación va cada producto (para que el mesero vea si sale de cocina o de barra) */
  const estacionDe = useMemo(() => new Map((cat?.categorias ?? []).flatMap((x) => x.productos.map((p) => [p.id, x.estacion] as const))), [cat]);

  // Que no se pierda un pedido sin enviar al cerrar o recargar la pestaña
  useEffect(() => {
    if (!borrador.length) return;
    const k = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener('beforeunload', k);
    return () => removeEventListener('beforeunload', k);
  }, [borrador.length]);

  const enviar = async () => {
    if (!c || !borrador.length) return;
    setEnviando(true);
    try {
      const nueva = await adm<Cuenta>(`/cuentas/${c.id}/items`, {
        method: 'POST',
        body: {
          directo: esDirecto,
          items: borrador.map((b) => ({ variante_id: b.variante.id, cantidad: b.cantidad, asiento: b.asiento, notas: b.notas || null, sin: b.sin, adicionales: b.adicionales, seleccion: b.seleccion })),
        },
      });
      cuenta.setDatos(nueva);
      setBorrador([]);
      catalogo.recargar();
      const enBarra = nueva.items.some((i) => i.en_barra_desde);
      avisos.ok(esDirecto ? 'Agregado a la cuenta' : enBarra ? 'Pedido enviado a la barra: allá lo pasan a cocina' : 'Pedido enviado a preparación');
      setVistaMovil('cuenta');
    } catch (e) {
      avisos.error(e);
    } finally {
      setEnviando(false);
    }
  };

  const accion = async (fn: () => Promise<Cuenta>, ok: string) => {
    setOcupado(true);
    try {
      cuenta.setDatos(await fn());
      avisos.ok(ok);
      return true;
    } catch (e) {
      avisos.error(e);
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const confirmarAnulacion = async () => {
    if (!c || !anular) return;
    const ok = anular === 'cuenta'
      ? await accion(() => adm(`/cuentas/${c.id}/anular`, { method: 'POST', body: { motivo } }), 'Cuenta anulada')
      : await accion(() => adm(`/cuentas/${c.id}/items/${anular.id}`, { method: 'DELETE', body: { motivo } }), 'Ítem anulado y devuelto al inventario');
    if (ok) {
      setAnular(null);
      setMotivo('');
      catalogo.recargar();
    }
  };

  if (cuenta.cargando || catalogo.cargando) return <Cargando texto="Abriendo cuenta…" />;
  if (cuenta.error || !c) return <div className="p-5"><ErrorCaja mensaje={cuenta.error ?? 'Cuenta no encontrada'} onReintentar={cuenta.recargar} /></div>;
  if (catalogo.error || !cat) return <div className="p-5"><ErrorCaja mensaje={catalogo.error ?? 'No se pudo cargar la carta'} onReintentar={catalogo.recargar} /></div>;

  const totalBorrador = borrador.reduce((s, b) => s + b.unitario * b.cantidad, 0);
  const visibles = c.items.filter((i) => i.estado !== 'anulado');
  const anulados = c.items.filter((i) => i.estado === 'anulado');
  const listos = visibles.filter((i) => i.estado === 'listo').length;
  const unidadesBorrador = borrador.reduce((s, b) => s + b.cantidad, 0);
  const textoEnviar = esDirecto ? 'Agregar a la cuenta' : 'Enviar pedido';

  return (
    <div className="flex h-[calc(100dvh-56px)] flex-col pb-14 lg:pb-0">
      {/* ------------------------------------------------------------ Cabecera de la cuenta */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-gold/10 bg-[#04110c] px-3 py-2.5 sm:px-5">
        <Link href={usuario?.rol === 'mesonero' ? '/admin/mesero' : c.tipo === 'barra' && !c.mesa_id ? '/admin/barra' : '/admin/salon'} onClick={(e) => { if (borrador.length && !confirm(`Tienes ${unidadesBorrador} producto(s) sin enviar. ¿Salir y descartarlos?`)) e.preventDefault(); }}
          className="grid h-11 w-11 place-items-center rounded-xl border border-gold/20 text-smoke hover:text-ivory" aria-label="Volver"><ArrowLeft size={19} /></Link>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 font-display text-xl leading-tight">
            {tituloCuenta(c)}
            {/* A nombre de quién va la cuenta: siempre visible y se cambia en un toque */}
            {c.nombre_cliente ? (
              <button onClick={() => abierta && setRenombrar(c.nombre_cliente ?? '')} className="rounded-lg px-1 text-gold-light hover:bg-white/5" title="Cambiar nombre">· {c.nombre_cliente}</button>
            ) : abierta && (
              <button onClick={() => setRenombrar('')} className="flex h-9 items-center gap-1.5 rounded-full border border-red-400/50 bg-red-500/10 px-3 font-sans text-sm text-red-200 active:bg-red-500/20">
                <UserRound size={15} /> ¿A nombre de quién?
              </button>
            )}
          </p>
          <p className="flex flex-wrap items-center gap-x-3 text-xs text-smoke">
            <span>{c.numero}</span>{c.zona && <span>{c.zona}</span>}
            <span className="flex items-center gap-1"><Users size={12} /> {c.personas}</span>
            <span>{c.mesonero}</span><span>{abierta ? `abierta hace ${hace(c.abierta_en)}` : fechaHora(c.cerrada_en)}</span>
          </p>
        </div>
        {!abierta && (
          <Insignia color={c.estado === 'pagada' ? 'azul' : c.estado === 'fiada' ? 'oro' : 'rojo'} className="!text-sm">
            {c.estado === 'pagada' ? 'Cuenta pagada' : c.estado === 'fiada' ? `${c.fiado_motivo === 'se_fue' ? 'Se fue sin pagar' : 'Fiada'} · ${dinero(c.fiado_monto, moneda)} a nombre de ${c.cliente ?? 'cliente'}` : `Anulada: ${c.anulada_motivo}`}
          </Insignia>
        )}
        {abierta && c.cobro_solicitado_en && <Insignia color="azul" className="!text-sm"><Wallet size={13} /> En caja desde {soloHora(c.cobro_solicitado_en)}</Insignia>}
        {listos > 0 && abierta && <Insignia color="oro" className="animate-pulse !text-sm"><BellRing size={13} /> {listos} listos para llevar a la mesa</Insignia>}
        <div className="ml-auto flex gap-1 rounded-full border border-gold/15 p-1 lg:hidden">
          {(['carta', 'cuenta'] as const).map((v) => (
            <button key={v} onClick={() => setVistaMovil(v)} className={`flex h-10 items-center gap-1.5 rounded-full px-4 text-sm capitalize ${vistaMovil === v ? 'bg-gold font-semibold text-void' : 'text-smoke'}`}>
              {v}
              {v === 'cuenta' && unidadesBorrador > 0 && <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-bold ${vistaMovil === v ? 'bg-void/25' : 'bg-gold text-void'}`}>{unidadesBorrador}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[1fr_420px]">
        {/* ---------------------------------------------------------- Carta */}
        <section className={`min-h-0 min-w-0 flex-col ${vistaMovil === 'carta' ? 'flex' : 'hidden'} lg:flex`}>
          {abierta ? (
            <>
              <div className="space-y-2 border-b border-white/5 px-3 py-2.5 sm:px-5">
                <label className="relative block">
                  <Search size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-smoke" />
                  <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en la carta…" className="pl-10" />
                  {q && <button onClick={() => setQ('')} className="absolute top-1/2 right-3 -translate-y-1/2 text-smoke" aria-label="Limpiar"><X size={15} /></button>}
                </label>
                <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
                  {hayTop && <button onClick={() => { setCatId('top'); setQ(''); }} className={`h-10 shrink-0 rounded-full px-4 text-sm whitespace-nowrap ${catId === 'top' ? 'bg-gold font-semibold text-void' : 'border border-gold/15 text-smoke'}`}>🔥 Más pedidos</button>}
                  <button onClick={() => setCatId('todas')} className={`h-10 shrink-0 rounded-full px-4 text-sm ${catId === 'todas' ? 'bg-gold font-semibold text-void' : 'border border-gold/15 text-smoke'}`}>Todo</button>
                  {cat.categorias.map((x) => (
                    <button key={x.id} onClick={() => { setCatId(x.id); setQ(''); }} className={`h-10 shrink-0 rounded-full px-4 text-sm whitespace-nowrap ${catId === x.id ? 'bg-gold font-semibold text-void' : 'border border-gold/15 text-smoke hover:text-ivory'}`}>
                      {x.icono} {x.nombre}
                    </button>
                  ))}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {productos.map(({ producto: p, categoria }) => {
                    const agotado = !p.disponible || p.variantes.every((v) => v.disponibles === 0);
                    const min = Math.min(...p.variantes.map((v) => v.precios[moneda]));
                    const quedan = p.variantes.length === 1 ? p.variantes[0].disponibles : null;
                    const enBorrador = borrador.filter((b) => b.producto.id === p.id).reduce((s, b) => s + b.cantidad, 0);
                    return (
                      <div key={p.id} className="relative">
                      <button disabled={agotado} onClick={() => elegir(p, categoria)}
                        className={`relative flex min-h-28 w-full flex-col justify-between rounded-2xl border p-3 text-left transition active:scale-[.97] disabled:opacity-40 ${enBorrador ? 'border-gold bg-gold/10' : 'border-gold/10 bg-[#06140f] hover:border-gold/40'}`}>
                        <span>
                          <span className="block text-[10px] tracking-wider text-smoke uppercase">{categoria.icono} {categoria.nombre}</span>
                          <span className="mt-0.5 block leading-tight font-medium">{p.nombre}</span>
                        </span>
                        <span className="mt-2 flex items-end justify-between gap-1">
                          <span className="font-display text-lg text-gold-light">{p.variantes.length > 1 && <span className="text-[10px] text-smoke">desde </span>}{dinero(min, moneda)}</span>
                          {agotado ? <Insignia color="rojo">Agotado</Insignia> : p.variantes[0].seleccion ? <Insignia color="verde">Surtido</Insignia> : quedan != null && quedan <= 10 ? <Insignia color="oro">Quedan {quedan}</Insignia> : null}
                        </span>
                        {enBorrador > 0 && <span className="absolute -top-2 -right-2 grid h-6 min-w-6 place-items-center rounded-full bg-gold px-1.5 text-xs font-bold text-void">{enBorrador}</span>}
                      </button>
                      {esRapido(p) && !agotado && (categoria.adicionales.length > 0 || asientos > 0) && (
                        <button onClick={() => setConfig({ producto: p, categoria })} title="Adicionales, puesto y nota" aria-label={`Opciones de ${p.nombre}`}
                          className="absolute top-1 right-1 grid h-10 w-10 place-items-center rounded-full bg-void/70 text-smoke ring-1 ring-gold/20 hover:text-gold">
                          <MoreHorizontal size={17} />
                        </button>
                      )}
                      </div>
                    );
                  })}
                </div>
                {!productos.length && <p className="py-16 text-center text-smoke">No hay productos con “{q}”.</p>}
              </div>

              {/* Tablet en vertical / celular: el pedido siempre a la vista y se envía sin cambiar de pantalla */}
              {borrador.length > 0 && (
                <div className="flex items-center gap-2 border-t-2 border-gold/40 bg-[#04110c] p-2.5 lg:hidden">
                  <button onClick={() => setVistaMovil('cuenta')} className="flex h-14 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-gold/25 px-3 text-left active:bg-white/5">
                    <span className="grid h-9 min-w-9 place-items-center rounded-full bg-gold px-2 font-display text-lg font-medium text-void">{unidadesBorrador}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{borrador.map((b) => `${b.cantidad} ${b.producto.nombre}`).join(' · ')}</span>
                      <span className="block text-xs text-gold">Ver y ajustar el pedido</span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-smoke" />
                  </button>
                  <Boton variante="oro" className="h-14 shrink-0 px-5 text-base" cargando={enviando} onClick={enviar}>
                    {esDirecto ? <Check size={19} /> : <Send size={19} />} <span className="hidden sm:inline">{textoEnviar} ·</span> {dinero(totalBorrador, moneda)}
                  </Boton>
                </div>
              )}
            </>
          ) : (
            <div className="grid flex-1 place-items-center p-8 text-center text-smoke">
              <div>
                <p className="font-display text-2xl text-ivory">Esta cuenta ya está {c.estado === 'fiada' ? 'cerrada a crédito' : c.estado}</p>
                <p className="mt-2 text-sm">Puedes revisar el detalle y reimprimir el ticket.</p>
                <Boton className="mt-5" onClick={() => router.push('/admin/salon')}>Volver al salón</Boton>
              </div>
            </div>
          )}
        </section>

        {/* ---------------------------------------------------------- Ticket */}
        <aside className={`min-h-0 min-w-0 flex-col border-l border-gold/10 bg-[#04110c] ${vistaMovil === 'cuenta' ? 'flex' : 'hidden'} lg:flex`}>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* Por enviar */}
            {borrador.length > 0 && (
              <div className="border-b-2 border-dashed border-gold/40 bg-gold/5 p-3">
                <p className="mb-2 flex items-center justify-between text-xs tracking-wider text-gold uppercase">
                  Por enviar · {unidadesBorrador} {unidadesBorrador === 1 ? 'producto' : 'productos'}
                  <button onClick={() => confirm('¿Vaciar todo lo que está por enviar?') && setBorrador([])} className="px-2 py-1 text-smoke normal-case hover:text-red-300">Vaciar</button>
                </p>
                <ul className="space-y-2">
                  {borrador.map((b) => {
                    const cocina = estacionDe.get(b.producto.id) === 'cocina';
                    return (
                      <li key={b.clave} className="rounded-xl bg-void/40 p-2.5 text-sm">
                        <div className="flex items-start gap-2">
                          <span className="min-w-0 flex-1">
                            <span className="block leading-tight font-medium">{b.producto.nombre} {b.producto.variantes.length > 1 && <span className="font-normal text-smoke">· {b.variante.presentacion}</span>}</span>
                            <span className={`mt-0.5 inline-flex items-center gap-1 text-[11px] ${cocina ? 'text-gold' : 'text-venom'}`}>{cocina ? <ChefHat size={12} /> : <Martini size={12} />} {cocina ? 'Cocina' : 'Barra'}</span>
                            {b.detalle.map((d) => <span key={d} className={`block text-xs ${d.startsWith('SIN') ? 'text-red-300' : d.startsWith('+') ? 'text-venom' : 'text-smoke'}`}>{d}</span>)}
                            {b.notas && <span className="block text-xs text-smoke">📝 {b.notas}</span>}
                          </span>
                          <span className="font-display text-lg leading-tight text-gold-light tabular-nums">{dinero(b.unitario * b.cantidad, moneda)}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex items-center rounded-full border border-gold/25">
                            <button onClick={() => cambiarCantidad(b.clave, -1)} className="grid h-10 w-10 place-items-center rounded-full text-gold active:bg-gold/20" aria-label="Uno menos">{b.cantidad === 1 ? <Trash2 size={16} className="text-red-300" /> : <Minus size={17} />}</button>
                            <span className="w-8 text-center font-display text-xl tabular-nums">{b.cantidad}</span>
                            <button onClick={() => cambiarCantidad(b.clave, 1)} disabled={b.variante.disponibles != null && b.cantidad >= b.variante.disponibles} className="grid h-10 w-10 place-items-center rounded-full text-gold active:bg-gold/20 disabled:opacity-30" aria-label="Uno más"><Plus size={17} /></button>
                          </div>
                          {asientos > 0 && (
                            <select value={b.asiento ?? ''} onChange={(e) => setBorrador(borrador.map((x) => (x.clave === b.clave ? { ...x, asiento: e.target.value ? Number(e.target.value) : null } : x)))}
                              className="h-10 rounded-xl border border-gold/20 bg-void px-2 text-sm text-smoke" aria-label="Puesto">
                              <option value="">Toda la mesa</option>
                              {Array.from({ length: asientos }, (_, n) => <option key={n + 1} value={n + 1}>Puesto {n + 1}</option>)}
                            </select>
                          )}                        </div>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3 flex items-center gap-2">
                  <Boton variante="oro" tam="lg" className="flex-1" cargando={enviando} onClick={enviar}>
                    {esDirecto ? <Check size={18} /> : <Send size={18} />} {textoEnviar} · {dinero(totalBorrador, moneda)}
                  </Boton>
                </div>
                <div className="mt-2"><Interruptor activo={!esDirecto} onCambio={(v) => setDirecto(!v)} etiqueta={<span className="flex items-center gap-1 text-xs text-smoke"><ChefHat size={13} /> Pasar por comandas (cocina / barra)</span>} /></div>
              </div>
            )}

            {/* Ítems de la cuenta */}
            <ul className="divide-y divide-white/5">
              {visibles.map((i) => (
                <li key={i.id} className="flex gap-2 px-3 py-2.5 text-sm">
                  <span className="font-display text-lg leading-tight text-gold-light">{i.cantidad}×</span>
                  <div className="min-w-0 flex-1">
                    <p className="leading-tight">{i.nombre} {i.presentacion && <span className="text-smoke">· {i.presentacion}</span>}</p>
                    {i.modificadores.map((m, k) => (
                      <p key={k} className={`text-xs ${m.tipo === 'sin' ? 'text-red-300' : m.tipo === 'adicional' ? 'text-venom' : 'text-smoke'}`}>
                        {m.tipo === 'sin' ? `SIN ${m.nombre}` : m.tipo === 'adicional' ? `+ ${m.cantidad > 1 ? `${m.cantidad}× ` : ''}${m.nombre}` : `${m.cantidad} × ${m.nombre}`}
                        {m.precio_extra > 0 && <span className="text-smoke"> (+{dinero(m.precio_extra, moneda)})</span>}
                      </p>
                    ))}
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-smoke">
                      {abierta && (i.en_barra_desde && i.estado === 'pendiente'
                        ? <Insignia color="oro">En barra</Insignia>
                        : <Insignia color={ESTADO_ITEM[i.estado].color}>{ESTADO_ITEM[i.estado].texto}</Insignia>)}
                      {i.asiento && <span>Puesto {i.asiento}</span>}
                      <span>{soloHora(i.creado_en)}</span>
                      {i.notas && <span>📝 {i.notas}</span>}
                    </p>
                  </div>
                  <span className="tabular-nums">{dinero(i.subtotal, moneda)}</span>
                  {abierta && <button onClick={() => setAnular(i)} className="text-smoke/60 hover:text-red-300" aria-label="Anular ítem"><X size={15} /></button>}
                </li>
              ))}
              {!visibles.length && !borrador.length && <li className="px-4 py-12 text-center text-sm text-smoke">Cuenta vacía. Toca los productos de la carta para empezar.</li>}
            </ul>
            {anulados.length > 0 && (
              <details className="border-t border-white/5 px-3 py-2 text-xs text-smoke">
                <summary className="cursor-pointer">{anulados.length} ítems anulados</summary>
                {anulados.map((i) => <p key={i.id} className="mt-1 line-through">{i.cantidad}× {i.nombre} — {i.anulado_motivo}</p>)}
              </details>
            )}
            {c.pagos.length > 0 && (
              <div className="border-t border-gold/10 px-3 py-2.5">
                <p className="mb-1.5 text-xs tracking-wider text-gold uppercase">Pagos</p>
                {c.pagos.map((p) => (
                  <p key={p.id} className="flex justify-between gap-2 py-0.5 text-sm">
                    <span className="text-smoke">{soloHora(p.fecha)} · {p.metodo}{p.asiento && ` · puesto ${p.asiento}`}{p.referencia && ` · ${p.referencia}`}</span>
                    <span className="text-venom tabular-nums">{dinero(p.monto, p.moneda)}</span>
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Totales y acciones */}
          <div className="border-t border-gold/15 p-3">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between text-smoke"><dt>Subtotal</dt><dd className="tabular-nums">{dinero(c.subtotal, moneda)}</dd></div>
              {c.descuento > 0 && <div className="flex justify-between text-venom"><dt>Descuento {c.descuento_motivo && `(${c.descuento_motivo})`}</dt><dd className="tabular-nums">−{dinero(c.descuento, moneda)}</dd></div>}
              {c.servicio > 0 && <div className="flex justify-between text-smoke"><dt>Servicio {c.servicio_pct}%</dt><dd className="tabular-nums">{dinero(c.servicio, moneda)}</dd></div>}
              {c.pagado > 0 && <div className="flex justify-between text-venom"><dt>Pagado</dt><dd className="tabular-nums">−{dinero(c.pagado, moneda)}</dd></div>}
              <div className="flex items-end justify-between pt-1">
                <dt className="font-display text-lg">{c.pagado > 0 ? 'Saldo' : 'Total'}</dt>
                <dd className="font-display text-3xl font-light text-gold-light tabular-nums">{dinero(abierta ? c.saldo : c.total, moneda)}</dd>
              </div>
              <div className="flex justify-end gap-3 text-xs text-smoke">
                {MONEDAS.filter((m) => m !== moneda).map((m) => <span key={m}>{dinero((abierta ? c.equivalentes.saldo : c.equivalentes.total)[m], m)}</span>)}
              </div>
            </dl>

            <div className="mt-3 flex gap-2">
              {abierta && puedeCobrar && (
                c.saldo <= 0 && c.total > 0
                  ? <Boton variante="verde" tam="lg" className="flex-1" cargando={ocupado} onClick={() => accion(() => adm(`/cuentas/${c.id}/cerrar`, { method: 'POST' }), 'Cuenta cerrada')}><Check size={18} /> Cerrar cuenta</Boton>
                  : <Boton variante="oro" tam="lg" className="flex-1" disabled={c.total <= 0 || borrador.length > 0} onClick={() => setCobrando(true)} title={borrador.length ? 'Envía primero lo pendiente' : ''}><Wallet size={18} /> Cobrar</Boton>
              )}
              {/* El mesonero cobra en la mesa (entra a la caja abierta) o la pasa a caja */}
              {abierta && !puedeCobrar && es('mesonero') && c.saldo > 0 && (
                <Boton variante="verde" tam="lg" className="flex-1" disabled={borrador.length > 0} onClick={() => setCobrando(true)} title={borrador.length ? 'Envía primero lo pendiente' : ''}>
                  <Wallet size={18} /> Cobrar aquí
                </Boton>
              )}
              {abierta && !puedeCobrar && (c.cobro_solicitado_en ? (
                <Boton tam="lg" className="flex-1 !border-sky-400/50 !text-sky-200" cargando={ocupado} onClick={() => accion(() => adm(`/cuentas/${c.id}/solicitar-cobro`, { method: 'DELETE' }), 'Cuenta retirada de caja')}>
                  <Wallet size={18} /> En caja · retirar
                </Boton>
              ) : (
                <Boton variante="oro" tam="lg" className="flex-1" disabled={c.total <= 0 || borrador.length > 0} onClick={() => setACaja(true)} title={borrador.length ? 'Envía primero lo pendiente' : ''}>
                  <Wallet size={18} /> Pasar a caja
                </Boton>
              ))}
              <Boton tam="lg" onClick={() => window.print()} aria-label="Imprimir"><Printer size={18} /></Boton>
              {abierta && (
                <div className="relative">
                  <Boton tam="lg" onClick={() => setMenu((m) => !m)} aria-label="Más opciones"><MoreHorizontal size={18} /></Boton>
                  {menu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
                      <div className="absolute right-0 bottom-14 z-20 w-64 rounded-2xl border border-gold/20 bg-[#04130d] p-2 shadow-2xl">
                        <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/5" onClick={() => { setMenu(false); setAjustes({ personas: c.personas, nombre_cliente: c.nombre_cliente ?? '', servicio_pct: c.servicio_pct, descuento: c.descuento, descuento_motivo: c.descuento_motivo ?? '', notas: c.notas ?? '' }); }}>
                          <Percent size={15} className="text-gold" /> Servicio, descuento y datos
                        </button>
                        {puedeCobrar && c.saldo > 0 && (
                          <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm hover:bg-white/5 disabled:opacity-40" disabled={borrador.length > 0} onClick={() => { setMenu(false); setFiando(true); }}>
                            <HandCoins size={15} className="text-gold" /> Fiar o «se fue sin pagar»
                          </button>
                        )}
                        {es('gerente', 'cajero') && (
                          <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-red-300 hover:bg-red-500/10" onClick={() => { setMenu(false); setAnular('cuenta'); }}>
                            <Ban size={15} /> Anular cuenta completa
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* ------------------------------------------------------------ Modales */}
      {config && (
        <Configurador
          key={config.producto.id}
          producto={config.producto} categoria={config.categoria} moneda={moneda} asientos={asientos} asientoInicial={null}
          onCerrar={() => setConfig(null)}
          onAgregar={(b) => { setBorrador([...borrador, b]); setConfig(null); }}
        />
      )}

      {renombrar != null && (
        <Modal titulo="¿A nombre de quién va la cuenta?" subtitulo="Nombre o seña para encontrarla rápido en barra y caja" onCerrar={() => setRenombrar(null)} ancho="max-w-lg"
          pie={<><Boton variante="sutil" onClick={() => setRenombrar(null)}>Cancelar</Boton>
            <Boton variante="oro" tam="lg" cargando={ocupado} disabled={!renombrar.trim()} onClick={async () => {
              if (await accion(() => adm(`/cuentas/${c.id}`, { method: 'PATCH', body: { nombre_cliente: renombrar.trim() } }), 'Nombre guardado')) setRenombrar(null);
            }}>Guardar</Boton></>}>
          <NombreCliente valor={renombrar} onCambio={setRenombrar} autoFocus onEnter={async () => {
            if (renombrar.trim() && await accion(() => adm(`/cuentas/${c.id}`, { method: 'PATCH', body: { nombre_cliente: renombrar.trim() } }), 'Nombre guardado')) setRenombrar(null);
          }} />
        </Modal>
      )}

      {aCaja && <PasarACaja cuentaId={c.id} onCerrar={() => setACaja(false)} onEnviada={(nueva) => { cuenta.setDatos(nueva); setACaja(false); }} />}

      {fiando && <Fiar cuenta={c} onCerrar={() => setFiando(false)} onFiada={(nueva) => { cuenta.setDatos(nueva); setFiando(false); }} />}

      {cobrando && <Cobro cuenta={c} tasa={cat.tasa} onCerrar={() => setCobrando(false)} onPagado={(nueva) => cuenta.setDatos(nueva)} />}

      {anular && (
        <Modal titulo={anular === 'cuenta' ? `Anular la cuenta ${c.numero}` : `Anular ${anular.cantidad}× ${anular.nombre}`} subtitulo="Lo que ya se descontó vuelve al inventario. Queda registrado quién anuló y por qué."
          onCerrar={() => { setAnular(null); setMotivo(''); }} ancho="max-w-md"
          pie={<><Boton variante="sutil" onClick={() => setAnular(null)}>Volver</Boton><Boton variante="peligro" cargando={ocupado} disabled={motivo.trim().length < 3} onClick={confirmarAnulacion}>Anular</Boton></>}>
          <Campo etiqueta="Motivo">
            <Input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Error al marcar, el cliente cambió de opinión…" />
          </Campo>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {['Error al marcar', 'Cliente cambió de opinión', 'Producto agotado', 'Cortesía de la casa'].map((m) => (
              <button key={m} onClick={() => setMotivo(m)} className="rounded-full border border-gold/20 px-2.5 py-1 text-xs text-smoke hover:text-ivory">{m}</button>
            ))}
          </div>
        </Modal>
      )}

      {ajustes && (
        <Modal titulo="Datos de la cuenta" onCerrar={() => setAjustes(null)} ancho="max-w-md"
          pie={<><Boton variante="sutil" onClick={() => setAjustes(null)}>Cancelar</Boton>
            <Boton variante="oro" cargando={ocupado} onClick={async () => {
              const cuerpo: Record<string, unknown> = { personas: ajustes.personas ?? 1, nombre_cliente: ajustes.nombre_cliente || null, notas: ajustes.notas || null };
              if (es('gerente', 'cajero')) Object.assign(cuerpo, { servicio_pct: ajustes.servicio_pct ?? 0, descuento: ajustes.descuento ?? 0, descuento_motivo: ajustes.descuento_motivo || null });
              if (await accion(() => adm(`/cuentas/${c.id}`, { method: 'PATCH', body: cuerpo }), 'Cuenta actualizada')) setAjustes(null);
            }}>Guardar</Boton></>}>
          <div className="space-y-4">
            <div className="grid grid-cols-[100px_1fr] gap-3">
              <Campo etiqueta="Personas"><InputNum min={1} valor={ajustes.personas} onCambio={(v) => setAjustes({ ...ajustes, personas: v })} /></Campo>
              <Campo etiqueta="Nombre"><Input value={ajustes.nombre_cliente} onChange={(e) => setAjustes({ ...ajustes, nombre_cliente: e.target.value })} /></Campo>
            </div>
            {es('gerente', 'cajero') ? (
              <>
                <Campo etiqueta="Servicio / propina (%)" ayuda="Voluntario: confírmalo con el cliente.">
                  <div className="flex gap-2">
                    <InputNum valor={ajustes.servicio_pct} onCambio={(v) => setAjustes({ ...ajustes, servicio_pct: v })} />
                    {[0, 10].map((p) => <Boton key={p} onClick={() => setAjustes({ ...ajustes, servicio_pct: p })}>{p}%</Boton>)}
                  </div>
                </Campo>
                <div className="grid grid-cols-2 gap-3">
                  <Campo etiqueta={`Descuento (${moneda})`}><InputNum valor={ajustes.descuento} onCambio={(v) => setAjustes({ ...ajustes, descuento: v })} /></Campo>
                  <Campo etiqueta="Motivo"><Input value={ajustes.descuento_motivo} onChange={(e) => setAjustes({ ...ajustes, descuento_motivo: e.target.value })} placeholder="Cumpleañero, cortesía…" /></Campo>
                </div>
              </>
            ) : <p className="text-xs text-smoke">El servicio y los descuentos los aplica caja o gerencia.</p>}
            <Campo etiqueta="Notas"><Area rows={2} value={ajustes.notas} onChange={(e) => setAjustes({ ...ajustes, notas: e.target.value })} /></Campo>
          </div>
        </Modal>
      )}

      <Ticket cuenta={c} />
    </div>
  );
}

/** Ticket de 72 mm que solo se ve al imprimir (pre-cuenta o comprobante) */
function Ticket({ cuenta: c }: { cuenta: Cuenta }) {
  const items = c.items.filter((i) => i.estado !== 'anulado');
  return (
    <div id="ticket" className="hidden">
      <p style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, letterSpacing: 4 }}>MAMBA</p>
      <p style={{ textAlign: 'center', fontSize: 10, letterSpacing: 2 }}>BISTRO BAR 2.0</p>
      <hr />
      <p>{c.estado === 'pagada' ? 'COMPROBANTE' : c.estado === 'fiada' ? 'CUENTA A CRÉDITO' : 'PRE-CUENTA'} {c.numero}</p>
      <p>{tituloCuenta(c)}{c.nombre_cliente ? ` · ${c.nombre_cliente}` : ''}</p>
      <p>{fechaHora(c.cerrada_en ?? new Date().toISOString())} · Atendió: {c.mesonero ?? ''}</p>
      <hr />
      {items.map((i) => (
        <div key={i.id}>
          <p style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span>{i.cantidad} x {i.nombre}{i.presentacion ? ` (${i.presentacion})` : ''}</span><span>{dinero(i.subtotal, c.moneda)}</span></p>
          {i.modificadores.map((m, k) => <p key={k} style={{ paddingLeft: 12, fontSize: 10 }}>{m.tipo === 'sin' ? `sin ${m.nombre}` : m.tipo === 'adicional' ? `+ ${m.cantidad} ${m.nombre}` : `${m.cantidad} ${m.nombre}`}</p>)}
        </div>
      ))}
      <hr />
      <p style={{ display: 'flex', justifyContent: 'space-between' }}><span>Subtotal</span><span>{dinero(c.subtotal, c.moneda)}</span></p>
      {c.descuento > 0 && <p style={{ display: 'flex', justifyContent: 'space-between' }}><span>Descuento</span><span>-{dinero(c.descuento, c.moneda)}</span></p>}
      {c.servicio > 0 && <p style={{ display: 'flex', justifyContent: 'space-between' }}><span>Servicio voluntario {c.servicio_pct}%</span><span>{dinero(c.servicio, c.moneda)}</span></p>}
      <p style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700 }}><span>TOTAL</span><span>{dinero(c.total, c.moneda)}</span></p>
      {MONEDAS.filter((m) => m !== c.moneda).map((m) => <p key={m} style={{ display: 'flex', justifyContent: 'space-between' }}><span>En {m}</span><span>{dinero(c.equivalentes.total[m], m)}</span></p>)}
      {c.pagos.length > 0 && <hr />}
      {c.pagos.map((p) => <p key={p.id} style={{ display: 'flex', justifyContent: 'space-between' }}><span>{p.metodo}</span><span>{dinero(p.monto, p.moneda)}</span></p>)}
      {c.estado === 'abierta' && c.pagado > 0 && <p style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>SALDO</span><span>{dinero(c.saldo, c.moneda)}</span></p>}
      {c.estado === 'fiada' && <p style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}><span>QUEDA DEBIENDO ({c.cliente})</span><span>{dinero(c.fiado_monto, c.moneda)}</span></p>}
      <hr />
      <p style={{ textAlign: 'center' }}>¡Gracias por tu visita!</p>
    </div>
  );
}
