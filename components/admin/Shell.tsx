'use client';

import { AlertTriangle, Bell, CalendarCheck, ChevronRight, Command, DoorOpen, KeyRound, LogOut, Minus, Plus, Search, TrendingUp, Users } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { adm } from '@/lib/admin/api';
import { type Area, INICIO, ROLES, areasPara, ubicar } from '@/lib/admin/modulos';
import { type Tasa, fechaCorta, fechaHora, numero } from '@/lib/admin/moneda';
import { sonar, useVivo, useVivoConectado } from '@/lib/admin/vivo';
import { useSesion } from './Sesion';
import { Boton, Campo, Input, Modal, useAvisos, useDatos } from './ui';

type Alertas = {
  total: number;
  tareas: { id: number; titulo: string; vence_en: string; vencido: boolean; evento: string | null }[];
  stock_bajo: { id: number; nombre: string; stock: number; stock_minimo: number; unidad: string }[];
  reservas_pendientes: { id: string; nombre_completo: string; fecha: string; hora: string; personas: number }[];
  recordatorios_por_enviar: number;
};
type Aforo = { actual: number; en_puerta: number; con_cuenta: number; maximo: number };

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { usuario } = useSesion();
  const areas = useMemo(() => areasPara(usuario?.rol), [usuario?.rol]);
  const { area, modulo } = ubicar(pathname);
  const [areaAbierta, setAreaAbierta] = useState<string | null>(null);
  const [paleta, setPaleta] = useState(false);

  useEffect(() => setAreaAbierta(null), [pathname]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaleta((p) => !p);
      }
    };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, []);

  const areaActual = areas.find((a) => a.id === area?.id);
  const flyout = areas.find((a) => a.id === areaAbierta);
  // La pantalla de pedido usa todo el alto: sin pestañas
  const pantallaCompleta = pathname.startsWith('/admin/cuenta/');

  return (
    <div className="min-h-dvh bg-[#020a07] text-ivory">
      {/* ---------------------------------------------------------------- Riel de áreas (escritorio) */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[76px] flex-col items-center border-r border-gold/10 bg-[#03100b] py-3 lg:flex" onMouseLeave={() => setAreaAbierta(null)}>
        <Link href="/admin" className="relative mb-4 h-11 w-11 overflow-hidden rounded-full ring-1 ring-gold/40" aria-label="Inicio">
          <Image src="/brand/logo.webp" alt="" fill unoptimized className="object-cover" />
        </Link>
        <RielItem href="/admin" activo={pathname === '/admin'} nombre="Inicio" Icono={INICIO.icono} onHover={() => setAreaAbierta(null)} />
        {areas.map((a) => (
          <RielItem
            key={a.id}
            activo={areaActual?.id === a.id}
            abierto={areaAbierta === a.id}
            nombre={a.nombre}
            Icono={a.icono}
            color={a.color}
            onHover={() => setAreaAbierta(a.id)}
            onClick={() => setAreaAbierta((x) => (x === a.id ? null : a.id))}
          />
        ))}
        <div className="mt-auto">
          <MenuUsuario />
        </div>

        {/* Panel desplegable del área */}
        {flyout && (
          <div className="absolute top-0 left-[76px] h-full w-80 border-r border-gold/15 bg-[#04130d]/98 p-4 shadow-[30px_0_60px_-20px_rgba(0,0,0,.8)] backdrop-blur-xl">
            <p className="mb-1 flex items-center gap-2 font-display text-xs tracking-[0.3em] uppercase" style={{ color: flyout.color }}>
              <flyout.icono size={14} /> {flyout.nombre}
            </p>
            <p className="mb-4 text-xs text-smoke">{flyout.modulos.length} módulos</p>
            <ListaModulos area={flyout} pathname={pathname} />
          </div>
        )}
      </aside>

      {/* ---------------------------------------------------------------- Barra superior */}
      <header className="sticky top-0 z-40 border-b border-gold/10 bg-[#020a07]/90 backdrop-blur-xl lg:pl-[76px]">
        <div className="flex h-14 items-center gap-3 px-3 sm:px-5">
          <Link href="/admin" className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-gold/40 lg:hidden">
            <Image src="/brand/logo.webp" alt="Inicio" fill unoptimized className="object-cover" />
          </Link>
          <nav className="flex min-w-0 items-center gap-1.5 text-sm" aria-label="Ubicación">
            <Link href="/admin" className="hidden text-smoke hover:text-ivory sm:inline">Mamba</Link>
            {area && (
              <>
                <ChevronRight size={14} className="hidden text-smoke/50 sm:block" />
                <span className="hidden text-smoke sm:inline">{area.nombre}</span>
              </>
            )}
            <ChevronRight size={14} className="hidden text-smoke/50 sm:block" />
            <span className="truncate font-medium text-ivory">{modulo?.nombre ?? (pathname === '/admin' ? 'Inicio' : '')}</span>
          </nav>

          <button
            onClick={() => setPaleta(true)}
            className="ml-auto flex h-9 items-center gap-2 rounded-xl border border-gold/15 bg-void/50 px-3 text-sm text-smoke hover:border-gold/40 md:w-64"
          >
            <Search size={15} /> <span className="hidden md:inline">Buscar módulo, mesa…</span>
            <kbd className="ml-auto hidden items-center gap-0.5 rounded bg-white/10 px-1.5 text-[10px] md:flex"><Command size={10} />K</kbd>
          </button>
          <Estado />
          <div className="lg:hidden"><MenuUsuario /></div>
        </div>

        {/* Pestañas del área actual */}
        {areaActual && !pantallaCompleta && (
          <div className="no-scrollbar flex gap-1 overflow-x-auto border-t border-white/5 px-3 sm:px-5">
            {areaActual.modulos.map((m) => {
              const activo = modulo?.href === m.href;
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  className={`relative flex shrink-0 items-center gap-2 px-3 py-2.5 text-sm transition ${activo ? 'text-gold' : 'text-smoke hover:text-ivory'}`}
                >
                  <m.icono size={15} /> {m.nombre}
                  {activo && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-gold" />}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      <main className="lg:pl-[76px]">
        <div className={pantallaCompleta ? '' : 'px-3 py-5 pb-24 sm:px-6 lg:pb-8'}>{children}</div>
      </main>

      {/* ---------------------------------------------------------------- Navegación inferior (móvil) */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t border-gold/15 bg-[#03100b]/95 backdrop-blur-xl lg:hidden">
        <Link href="/admin" className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${pathname === '/admin' ? 'text-gold' : 'text-smoke'}`}>
          <INICIO.icono size={19} /> Inicio
        </Link>
        {areas.map((a) => (
          <button key={a.id} onClick={() => setAreaAbierta((x) => (x === a.id ? null : a.id))} className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${areaActual?.id === a.id ? 'text-gold' : 'text-smoke'}`}>
            <a.icono size={19} /> {a.nombre}
          </button>
        ))}
      </nav>
      {flyout && (
        <div className="fixed inset-0 z-[45] flex items-end bg-black/60 lg:hidden" onClick={() => setAreaAbierta(null)}>
          <div className="max-h-[75dvh] w-full overflow-y-auto rounded-t-3xl border-t border-gold/20 bg-[#04130d] p-4 pb-20" onClick={(e) => e.stopPropagation()}>
            <p className="mb-3 font-display text-xs tracking-[0.3em] uppercase" style={{ color: flyout.color }}>{flyout.nombre}</p>
            <ListaModulos area={flyout} pathname={pathname} />
          </div>
        </div>
      )}

      {paleta && <Paleta areas={areas} onCerrar={() => setPaleta(false)} />}
    </div>
  );
}

function RielItem({
  href, activo, abierto, nombre, Icono, color, onHover, onClick,
}: { href?: string; activo: boolean; abierto?: boolean; nombre: string; Icono: Area['icono']; color?: string; onHover: () => void; onClick?: () => void }) {
  const cls = `group relative mb-1 flex w-[64px] flex-col items-center gap-1 rounded-xl py-2 text-[9.5px] leading-tight transition ${
    activo ? 'bg-gold/10 text-gold' : abierto ? 'bg-white/5 text-ivory' : 'text-smoke hover:text-ivory'
  }`;
  const inner = (
    <>
      {activo && <span className="absolute top-2 bottom-2 -left-1.5 w-1 rounded-full" style={{ background: color ?? '#d4af37' }} />}
      <Icono size={20} strokeWidth={1.6} />
      {nombre}
    </>
  );
  return href ? (
    <Link href={href} className={cls} onMouseEnter={onHover}>{inner}</Link>
  ) : (
    <button className={cls} onMouseEnter={onHover} onClick={onClick}>{inner}</button>
  );
}

function ListaModulos({ area, pathname }: { area: Area; pathname: string }) {
  return (
    <ul className="space-y-1">
      {area.modulos.map((m) => {
        const activo = pathname === m.href || pathname.startsWith(`${m.href}/`);
        return (
          <li key={m.href}>
            <Link href={m.href} className={`flex gap-3 rounded-xl p-3 transition ${activo ? 'bg-gold/10 ring-1 ring-gold/30' : 'hover:bg-white/5'}`}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-void/70" style={{ color: area.color }}><m.icono size={18} /></span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ivory">{m.nombre}</span>
                <span className="block text-xs leading-snug text-smoke">{m.descripcion}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ====================================================================== Estado en vivo: tasa, aforo, alertas
function Estado() {
  const { es } = useSesion();
  const tasa = useDatos<Tasa>('/tasas/actual', 5 * 60_000);
  const aforo = useDatos<Aforo>('/salon/aforo', 30_000);
  const alertas = useDatos<Alertas>('/recordatorios/alertas', 60_000);
  const [abierto, setAbierto] = useState<'aforo' | 'alertas' | null>(null);
  const avisos = useAvisos();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const c = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setAbierto(null);
    addEventListener('mousedown', c);
    return () => removeEventListener('mousedown', c);
  }, []);

  const mover = async (delta: number) => {
    try {
      aforo.setDatos(await adm<Aforo>('/salon/aforo', { method: 'POST', body: { delta } }));
    } catch (e) {
      avisos.error(e);
    }
  };

  const a = aforo.datos;
  const pct = a ? Math.min(100, (a.actual / a.maximo) * 100) : 0;
  const n = alertas.datos?.total ?? 0;

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      <EnVivo />
      {tasa.datos && (
        <Link href="/admin/tasas" className="hidden h-9 items-center gap-2 rounded-xl border border-gold/15 px-3 text-xs text-smoke hover:border-gold/40 xl:flex" title="Tasa vigente">
          <TrendingUp size={14} className="text-gold" />
          <span>US$ 1 = <b className="font-medium text-ivory">${numero(tasa.datos.usd_cop)}</b></span>
          <span className="text-smoke/40">·</span>
          <span><b className="font-medium text-ivory">Bs {numero(tasa.datos.usd_ves, 2)}</b></span>
        </Link>
      )}

      {a && (
        <button onClick={() => setAbierto((x) => (x === 'aforo' ? null : 'aforo'))} className="flex h-9 items-center gap-2 rounded-xl border border-gold/15 px-3 text-xs hover:border-gold/40" title="Aforo">
          <Users size={14} className={pct >= 90 ? 'text-red-300' : 'text-venom'} />
          <b className="font-medium text-ivory">{a.actual}</b><span className="text-smoke">/ {a.maximo}</span>
        </button>
      )}

      <button onClick={() => setAbierto((x) => (x === 'alertas' ? null : 'alertas'))} className="relative grid h-9 w-9 place-items-center rounded-xl border border-gold/15 text-smoke hover:border-gold/40 hover:text-ivory" aria-label={`${n} alertas`}>
        <Bell size={16} />
        {n > 0 && <span className="absolute -top-1 -right-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{n > 99 ? '99+' : n}</span>}
      </button>

      {abierto === 'aforo' && a && (
        <div className="absolute top-11 right-0 z-50 w-72 rounded-2xl border border-gold/20 bg-[#04130d] p-4 shadow-2xl">
          <p className="mb-1 flex items-center gap-2 text-xs tracking-wider text-gold uppercase"><DoorOpen size={14} /> Control de puerta</p>
          <p className="font-display text-4xl font-light">{a.actual}<span className="text-lg text-smoke"> / {a.maximo}</span></p>
          <div className="my-3 h-2 overflow-hidden rounded-full bg-white/10">
            <div className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-gold' : 'bg-venom'}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="mb-3 text-xs text-smoke">{a.en_puerta} contados en puerta · {a.con_cuenta} con cuenta abierta · quedan {Math.max(0, a.maximo - a.actual)} cupos</p>
          {es('gerente', 'cajero', 'mesonero', 'barra', 'rrpp') && (
            <div className="grid grid-cols-4 gap-2">
              <Boton tam="sm" onClick={() => mover(-5)}>−5</Boton>
              <Boton tam="sm" onClick={() => mover(-1)}><Minus size={14} /></Boton>
              <Boton tam="sm" variante="verde" onClick={() => mover(1)}><Plus size={14} /></Boton>
              <Boton tam="sm" variante="verde" onClick={() => mover(5)}>+5</Boton>
            </div>
          )}
        </div>
      )}

      {abierto === 'alertas' && alertas.datos && (
        <div className="absolute top-11 right-0 z-50 max-h-[70dvh] w-[min(92vw,360px)] overflow-y-auto rounded-2xl border border-gold/20 bg-[#04130d] p-2 shadow-2xl">
          {n === 0 && <p className="p-6 text-center text-sm text-smoke">Todo al día ✨</p>}
          {alertas.datos.recordatorios_por_enviar > 0 && (
            <Link href="/admin/recordatorios" onClick={() => setAbierto(null)} className="flex gap-3 rounded-xl p-3 hover:bg-white/5">
              <Bell size={16} className="mt-0.5 shrink-0 text-venom" />
              <span className="text-sm">{alertas.datos.recordatorios_por_enviar} recordatorios de evento por enviar a clientes</span>
            </Link>
          )}
          {alertas.datos.tareas.map((t) => (
            <Link key={`t${t.id}`} href="/admin/recordatorios" onClick={() => setAbierto(null)} className="flex gap-3 rounded-xl p-3 hover:bg-white/5">
              <Bell size={16} className={`mt-0.5 shrink-0 ${t.vencido ? 'text-red-300' : 'text-gold'}`} />
              <span className="min-w-0 text-sm">
                {t.titulo}
                <span className="block text-xs text-smoke">{t.vencido ? 'Venció' : 'Vence'} {fechaHora(t.vence_en)}{t.evento && ` · ${t.evento}`}</span>
              </span>
            </Link>
          ))}
          {alertas.datos.reservas_pendientes.map((r) => (
            <Link key={`r${r.id}`} href="/admin/reservas" onClick={() => setAbierto(null)} className="flex gap-3 rounded-xl p-3 hover:bg-white/5">
              <CalendarCheck size={16} className="mt-0.5 shrink-0 text-sky-300" />
              <span className="min-w-0 text-sm">
                Reserva por confirmar: {r.nombre_completo}
                <span className="block text-xs text-smoke">{fechaCorta(r.fecha)} · {r.hora} · {r.personas} personas</span>
              </span>
            </Link>
          ))}
          {alertas.datos.stock_bajo.length > 0 && (
            <Link href="/admin/inventario" onClick={() => setAbierto(null)} className="flex gap-3 rounded-xl p-3 hover:bg-white/5">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-300" />
              <span className="min-w-0 text-sm">
                {alertas.datos.stock_bajo.length} insumos en stock bajo
                <span className="block truncate text-xs text-smoke">{alertas.datos.stock_bajo.slice(0, 4).map((s) => s.nombre).join(', ')}…</span>
              </span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Indicador de conexión en vivo + avisos que le importan a cada rol, esté en la pantalla que esté:
 *  - al mesonero: "tu pedido está listo" y "tu mesa ya pagó"
 *  - a caja/barra: "una mesa pasó a caja"
 */
function EnVivo() {
  const { usuario, es } = useSesion();
  const conectado = useVivoConectado();
  const avisos = useAvisos();
  const cobra = es('gerente', 'cajero', 'barra');

  useVivo((e) => {
    if (e.tipo === 'comanda' && e.estado === 'listo') {
      const mios = e.items.filter((i) => i.mesonero_id === usuario?.id);
      if (!mios.length) return;
      sonar('listo');
      avisos.info(`🔔 ${mios[0].lugar}${mios[0].cliente ? ` · ${mios[0].cliente}` : ''}: ${mios.map((i) => `${i.cantidad}× ${i.nombre}`).join(', ')} listo para llevar`);
    }
    if (e.tipo === 'cobro' && e.accion === 'solicitado' && cobra) {
      sonar('cobro');
      avisos.info(`💳 ${e.lugar}${e.cliente ? ` · ${e.cliente}` : ''} pasó a caja (${e.mesonero ?? 'mesonero'})`);
    }
    if (e.tipo === 'cobro' && e.accion === 'cobrado' && e.mesonero_id === usuario?.id && !cobra) avisos.ok(`✓ ${e.lugar}: cuenta cobrada en caja`);
  });

  return (
    <span title={conectado ? 'Conectado en vivo: los pedidos llegan al instante' : 'Sin conexión en vivo: reconectando…'}
      className={`hidden h-9 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] sm:flex ${conectado ? 'border-venom/30 text-venom' : 'border-red-400/40 text-red-300'}`}>
      <span className={`h-2 w-2 rounded-full ${conectado ? 'animate-pulse bg-venom' : 'bg-red-400'}`} />
      {conectado ? 'En vivo' : 'Reconectando'}
    </span>
  );
}

// ====================================================================== Usuario
function MenuUsuario() {
  const { usuario, salir } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const [cambiar, setCambiar] = useState(false);
  const [f, setF] = useState({ actual: '', nueva: '' });
  const [guardando, setGuardando] = useState(false);
  const avisos = useAvisos();
  if (!usuario) return null;
  const iniciales = usuario.nombre.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

  const guardar = async () => {
    setGuardando(true);
    try {
      await adm('/auth/cambiar-password', { method: 'POST', body: f });
      avisos.ok('Contraseña actualizada');
      setCambiar(false);
      setF({ actual: '', nueva: '' });
    } catch (e) {
      avisos.error(e);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="relative">
      <button onClick={() => setAbierto((a) => !a)} className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold-dark text-sm font-bold text-void" aria-label="Mi cuenta">
        {iniciales}
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-gold/20 bg-[#04130d] p-2 shadow-2xl lg:right-auto lg:bottom-0 lg:left-12 lg:mt-0">
            <div className="border-b border-white/5 px-3 py-2">
              <p className="truncate text-sm font-medium">{usuario.nombre}</p>
              <p className="truncate text-xs text-smoke">{ROLES.find((r) => r.valor === usuario.rol)?.nombre} · {usuario.email}</p>
            </div>
            <button onClick={() => { setCambiar(true); setAbierto(false); }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-smoke hover:bg-white/5 hover:text-ivory"><KeyRound size={15} /> Cambiar contraseña</button>
            <Link href="/" target="_blank" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-smoke hover:bg-white/5 hover:text-ivory"><ChevronRight size={15} /> Ver sitio web</Link>
            <button onClick={salir} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-300 hover:bg-red-500/10"><LogOut size={15} /> Cerrar sesión</button>
          </div>
        </>
      )}
      {cambiar && (
        <Modal titulo="Cambiar contraseña" onCerrar={() => setCambiar(false)} ancho="max-w-sm"
          pie={<><Boton variante="sutil" onClick={() => setCambiar(false)}>Cancelar</Boton><Boton variante="oro" cargando={guardando} onClick={guardar}>Guardar</Boton></>}>
          <div className="space-y-3">
            <Campo etiqueta="Contraseña actual"><Input type="password" autoComplete="current-password" value={f.actual} onChange={(e) => setF({ ...f, actual: e.target.value })} /></Campo>
            <Campo etiqueta="Nueva contraseña" ayuda="Mínimo 8 caracteres"><Input type="password" autoComplete="new-password" value={f.nueva} onChange={(e) => setF({ ...f, nueva: e.target.value })} /></Campo>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ====================================================================== Buscador (Ctrl+K)
const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Paleta({ areas, onCerrar }: { areas: Area[]; onCerrar: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);

  const resultados = useMemo(() => {
    const n = sinTildes(q.trim());
    const mods = areas.flatMap((a) => a.modulos.map((m) => ({ ...m, area: a.nombre, color: a.color })));
    const base = [{ ...INICIO, area: 'General', color: '#d4af37' }, ...mods];
    const lista = n ? base.filter((m) => sinTildes(`${m.nombre} ${m.descripcion} ${m.claves ?? ''} ${m.area}`).includes(n)) : base;
    // "mesa 12" o "12" → ir directo a esa mesa en el salón
    const mesa = q.match(/^\s*(?:mesa\s*)?(\d{1,3})\s*$/i)?.[1];
    return mesa
      ? [{ href: `/admin/salon?mesa=${mesa}`, nombre: `Ir a la mesa ${mesa}`, descripcion: 'Abrir la mesa en el plano del salón', icono: INICIO.icono, area: 'Atajo', color: '#3dffb0', roles: [] }, ...lista]
      : lista;
  }, [q, areas]);

  useEffect(() => setSel(0), [q]);
  const ir = (href: string) => {
    onCerrar();
    router.push(href);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/70 p-4 pt-[12dvh] backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-gold/25 bg-[#04130d] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-gold/10 px-4">
          <Search size={18} className="text-gold" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCerrar();
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(resultados.length - 1, s + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
              if (e.key === 'Enter' && resultados[sel]) ir(resultados[sel].href);
            }}
            placeholder="¿A dónde vamos? Escribe un módulo o el número de una mesa…"
            className="h-14 flex-1 bg-transparent text-base text-ivory placeholder:text-smoke/60 focus:outline-none"
          />
          <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-smoke">Esc</kbd>
        </div>
        <ul className="max-h-[50dvh] overflow-y-auto p-2">
          {resultados.map((m, i) => (
            <li key={m.href}>
              <button onMouseEnter={() => setSel(i)} onClick={() => ir(m.href)} className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left ${i === sel ? 'bg-gold/10' : ''}`}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-void/70" style={{ color: m.color }}><m.icono size={17} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-ivory">{m.nombre}</span>
                  <span className="block truncate text-xs text-smoke">{m.descripcion}</span>
                </span>
                <span className="text-[10px] tracking-wider text-smoke/70 uppercase">{m.area}</span>
              </button>
            </li>
          ))}
          {!resultados.length && <li className="p-6 text-center text-sm text-smoke">Nada con “{q}”</li>}
        </ul>
      </div>
    </div>
  );
}
