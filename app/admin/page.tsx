'use client';

import { AlertTriangle, ArrowRight, CalendarCheck, ChefHat, Lock, Martini, PartyPopper, Unlock, Users } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useSesion } from '@/components/admin/Sesion';
import { Cargando, Dato, ErrorCaja, Insignia, Tarjeta, useDatos } from '@/components/admin/ui';
import { areasPara } from '@/lib/admin/modulos';
import { type Moneda, type Tasa, dinero, fechaHora, numero } from '@/lib/admin/moneda';

type Tablero = {
  moneda: Moneda; tasa: Tasa | null;
  ventas: { total: number; usd: number; cuentas: number; ticket_promedio: number; por_cobrar: number; por_hora: { hora: string; total: number }[] } | null;
  cuentas_abiertas: number; personas_con_cuenta: number; capacidad: number;
  top_productos: { nombre: string; cantidad: number }[]; stock_bajo: number;
  reservas_hoy: { pendientes: number; confirmadas: number; personas: number };
  proximos_eventos: { id: number; titulo: string; inicia_en: string; suscritos: number }[];
  comandas: { cocina: number; barra: number };
  cajas: { nombre: string; abierta_por: string | null }[];
};

export default function InicioPage() {
  const { usuario } = useSesion();
  const router = useRouter();
  const { datos: t, cargando, error, recargar } = useDatos<Tablero>('/reportes/tablero', 30_000);

  // Cada rol aterriza en su pantalla de trabajo
  const destino = usuario?.rol === 'mesonero' ? '/admin/mesero' : usuario?.rol === 'cocina' ? '/admin/comandas' : null;
  useEffect(() => {
    if (destino) router.replace(destino);
  }, [destino, router]);
  const areas = useMemo(() => areasPara(usuario?.rol), [usuario?.rol]);
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  if (cargando || destino) return <Cargando />;
  if (error || !t) return <ErrorCaja mensaje={error ?? 'Sin datos'} onReintentar={recargar} />;
  const maxHora = Math.max(...(t.ventas?.por_hora.map((h) => h.total) ?? [1]), 1);
  const sinTasa = !t.tasa || t.tasa.fuente === 'inicial';

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-5">
        <h1 className="font-display text-3xl font-light">{saludo}, <span className="text-gold-light">{usuario?.nombre.split(' ')[0]}</span></h1>
        <p className="text-sm text-smoke">Así va la noche en Mamba.</p>
      </div>

      {/* Avisos que bloquean la operación */}
      <div className="mb-4 space-y-2">
        {sinTasa && (
          <Link href="/admin/tasas" className="flex items-center gap-3 rounded-2xl border border-red-400/40 bg-red-950/30 p-3 text-sm text-red-100">
            <AlertTriangle size={18} className="shrink-0" /> La tasa de cambio es referencial. Actualízala antes de vender. <ArrowRight size={15} className="ml-auto" />
          </Link>
        )}
        {t.cajas.every((c) => !c.abierta_por) && (
          <Link href="/admin/caja" className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-3 text-sm text-gold-light">
            <Lock size={18} className="shrink-0" /> No hay ninguna caja abierta: sin caja no se puede cobrar. <ArrowRight size={15} className="ml-auto" />
          </Link>
        )}
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {t.ventas ? (
          <>
            <Dato etiqueta="Cobrado esta noche" valor={dinero(t.ventas.total, t.moneda)} sub={`≈ ${dinero(t.ventas.usd, 'USD')} · ${t.ventas.cuentas} cuentas`} acento />
            <Dato etiqueta="Por cobrar (cuentas abiertas)" valor={dinero(t.ventas.por_cobrar, t.moneda)} sub={`${t.cuentas_abiertas} cuentas abiertas`} />
            <Dato etiqueta="Ticket promedio" valor={dinero(t.ventas.ticket_promedio, t.moneda)} />
          </>
        ) : (
          <Dato etiqueta="Cuentas abiertas" valor={t.cuentas_abiertas} />
        )}
        <Dato etiqueta="Personas con cuenta" valor={<>{t.personas_con_cuenta}<span className="text-base text-smoke"> / {t.capacidad}</span></>} sub={`${Math.round((t.personas_con_cuenta / t.capacidad) * 100)}% del aforo`} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Operación en vivo */}
        <Tarjeta className="p-4">
          <h2 className="mb-3 font-display text-base text-gold-light">En este momento</h2>
          <ul className="space-y-2 text-sm">
            <li><Link href="/admin/comandas" className="flex items-center justify-between rounded-xl p-2 hover:bg-white/5">
              <span className="flex items-center gap-2"><ChefHat size={16} className="text-gold" /> Comandas en cocina</span><Insignia color={Number(t.comandas.cocina) ? 'oro' : 'gris'}>{t.comandas.cocina}</Insignia></Link></li>
            <li><Link href="/admin/comandas" className="flex items-center justify-between rounded-xl p-2 hover:bg-white/5">
              <span className="flex items-center gap-2"><Martini size={16} className="text-venom" /> Comandas en barra</span><Insignia color={Number(t.comandas.barra) ? 'verde' : 'gris'}>{t.comandas.barra}</Insignia></Link></li>
            <li><Link href="/admin/reservas" className="flex items-center justify-between rounded-xl p-2 hover:bg-white/5">
              <span className="flex items-center gap-2"><CalendarCheck size={16} className="text-sky-300" /> Reservas hoy</span>
              <span className="flex gap-1">{Number(t.reservas_hoy.pendientes) > 0 && <Insignia color="oro">{t.reservas_hoy.pendientes} por confirmar</Insignia>}<Insignia color="azul">{t.reservas_hoy.confirmadas} confirmadas</Insignia></span></Link></li>
            <li><Link href="/admin/reservas" className="flex items-center justify-between rounded-xl p-2 hover:bg-white/5">
              <span className="flex items-center gap-2"><Users size={16} className="text-smoke" /> Personas esperadas por reserva</span><b>{t.reservas_hoy.personas}</b></Link></li>
            <li><Link href="/admin/inventario" className="flex items-center justify-between rounded-xl p-2 hover:bg-white/5">
              <span className="flex items-center gap-2"><AlertTriangle size={16} className={t.stock_bajo ? 'text-red-300' : 'text-smoke'} /> Insumos en stock bajo</span><Insignia color={t.stock_bajo ? 'rojo' : 'gris'}>{t.stock_bajo}</Insignia></Link></li>
          </ul>
          <div className="mt-3 border-t border-white/5 pt-3">
            {t.cajas.map((c) => (
              <p key={c.nombre} className="flex items-center justify-between py-1 text-sm">
                <span className="flex items-center gap-2">{c.abierta_por ? <Unlock size={15} className="text-venom" /> : <Lock size={15} className="text-smoke" />} {c.nombre}</span>
                <span className="text-xs text-smoke">{c.abierta_por ? `Abierta · ${c.abierta_por}` : 'Cerrada'}</span>
              </p>
            ))}
          </div>
        </Tarjeta>

        {/* Ventas por hora */}
        <Tarjeta className="p-4">
          <h2 className="mb-3 font-display text-base text-gold-light">{t.ventas ? 'Ventas por hora' : 'Lo más pedido esta noche'}</h2>
          {t.ventas ? (
            t.ventas.por_hora.length ? (
              <div className="flex h-44 items-end gap-1.5">
                {t.ventas.por_hora.map((h) => (
                  <div key={h.hora} className="group flex max-w-16 flex-1 flex-col items-center gap-1" title={`${h.hora} · ${dinero(h.total, t.moneda)}`}>
                    <div className="w-full rounded-t-md bg-gradient-to-t from-emerald to-venom/80 transition group-hover:brightness-125" style={{ height: `${Math.max(4, (h.total / maxHora) * 140)}px` }} />
                    <span className="text-[9px] text-smoke">{h.hora.slice(0, 2)}h</span>
                  </div>
                ))}
              </div>
            ) : <p className="py-12 text-center text-sm text-smoke">Aún no hay cobros esta noche</p>
          ) : null}
          {t.top_productos.length > 0 && (
            <div className={t.ventas ? 'mt-4 border-t border-white/5 pt-3' : ''}>
              {t.ventas && <p className="mb-2 text-[11px] tracking-wider text-smoke uppercase">Lo más pedido</p>}
              {t.top_productos.map((p) => <p key={p.nombre} className="flex justify-between py-0.5 text-sm"><span className="truncate">{p.nombre}</span><b className="font-medium text-gold-light">{numero(p.cantidad)}</b></p>)}
            </div>
          )}
        </Tarjeta>

        {/* Eventos */}
        <Tarjeta className="p-4">
          <h2 className="mb-3 flex items-center gap-2 font-display text-base text-gold-light"><PartyPopper size={16} /> Próximos eventos</h2>
          {t.proximos_eventos.length ? (
            <ul className="space-y-2">
              {t.proximos_eventos.map((e) => (
                <li key={e.id}>
                  <Link href="/admin/eventos" className="block rounded-xl border border-gold/10 p-3 hover:border-gold/40">
                    <p className="font-medium">{e.titulo}</p>
                    <p className="text-xs text-smoke">{fechaHora(e.inicia_en)}</p>
                    {Number(e.suscritos) > 0 && <p className="mt-1 text-xs text-venom">🔔 {e.suscritos} clientes pidieron recordatorio</p>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : <p className="py-8 text-center text-sm text-smoke">No hay eventos publicados.</p>}
          <Link href="/admin/recordatorios" className="mt-3 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 text-sm hover:bg-white/10">Ver recordatorios del equipo <ArrowRight size={15} /></Link>
        </Tarjeta>
      </div>

      {/* Lanzador de módulos */}
      <div className="mt-8 space-y-6">
        {areas.map((a) => (
          <section key={a.id}>
            <h2 className="mb-2 flex items-center gap-2 font-display text-xs tracking-[0.3em] uppercase" style={{ color: a.color }}><a.icono size={14} /> {a.nombre}</h2>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {a.modulos.map((m) => (
                <Link key={m.href} href={m.href} className="group flex gap-3 rounded-2xl border border-gold/10 bg-[#06140f]/90 p-4 transition hover:-translate-y-0.5 hover:border-gold/40">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-void/70 transition group-hover:scale-110" style={{ color: a.color }}><m.icono size={20} /></span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{m.nombre}</span>
                    <span className="line-clamp-2 text-xs leading-snug text-smoke">{m.descripcion}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
