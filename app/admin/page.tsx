'use client';

import { AlertTriangle, BarChart3, Lock, TabletSmartphone, Unlock, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSesion } from '@/components/admin/Sesion';
import { TableroPedidos } from '@/components/admin/TableroPedidos';
import { AbrirCajaRapida, type CajaEstado } from '@/components/admin/pos/AbrirCaja';
import { Cargando, Modal, useDatos } from '@/components/admin/ui';
import type { Tasa } from '@/lib/admin/moneda';
import { soloHora } from '@/lib/admin/moneda';

/**
 * Pantalla principal de quien atiende (administración, gerencia, caja y barra): los pedidos en vivo en un solo
 * tablero, y arriba lo que más se usa (caja, venta rápida, mesas). El mesonero entra a «Mis mesas», la cocina a
 * sus comandas y RRPP a reservas.
 */
export default function InicioPage() {
  const { usuario, es } = useSesion();
  const router = useRouter();
  const destino = usuario?.rol === 'mesonero' ? '/admin/mesero' : usuario?.rol === 'cocina' ? '/admin/comandas' : usuario?.rol === 'rrpp' ? '/admin/reservas' : null;
  useEffect(() => {
    if (destino) router.replace(destino);
  }, [destino, router]);

  const cajas = useDatos<CajaEstado[]>(destino ? null : '/caja', 30_000);
  const tasa = useDatos<Tasa>(destino ? null : '/tasas/actual');
  const [abrirCaja, setAbrirCaja] = useState(false);

  if (!usuario || destino) return <Cargando />;
  const abiertas = (cajas.datos ?? []).filter((c) => c.sesion);
  const sinTasa = tasa.datos && tasa.datos.fuente === 'inicial';
  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* Encabezado con lo que más se usa */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto font-display text-2xl font-light">{saludo}, <span className="text-gold-light">{usuario.nombre.split(' ')[0]}</span></h1>

        {cajas.datos && (abiertas.length ? (
          <Link href="/admin/caja" className="flex h-11 items-center gap-2 rounded-xl border border-venom/40 px-3 text-sm text-venom hover:bg-venom/10" title="Ver la caja">
            <Unlock size={16} /> {abiertas.map((c) => c.nombre).join(' · ')} <span className="hidden text-xs text-smoke sm:inline">desde {soloHora(abiertas[0].sesion!.fecha_apertura)}</span>
          </Link>
        ) : (
          <button onClick={() => setAbrirCaja(true)} className="flex h-11 animate-pulse items-center gap-2 rounded-xl border-2 border-gold bg-gold/15 px-4 text-sm font-semibold text-gold-light">
            <Lock size={16} /> Abrir caja
          </button>
        ))}
        <Link href="/admin/caja" className="flex h-11 items-center gap-2 rounded-xl border border-gold/25 px-3 text-sm text-smoke hover:text-ivory"><BarChart3 size={16} /> Movimientos</Link>
        <Link href="/admin/mesero" className="flex h-11 items-center gap-2 rounded-xl border border-gold/25 px-3 text-sm text-smoke hover:text-ivory"><TabletSmartphone size={16} /> Mesas</Link>
        <Link href="/admin/vender" className="flex h-11 items-center gap-2 rounded-xl bg-gold px-4 text-sm font-semibold text-void hover:brightness-110"><Zap size={16} /> Venta rápida</Link>
      </div>

      {sinTasa && (
        <Link href="/admin/tasas" className="mb-3 flex items-center gap-3 rounded-2xl border border-red-400/40 bg-red-950/30 p-3 text-sm text-red-100">
          <AlertTriangle size={18} className="shrink-0" /> La tasa de cambio es referencial. Actualízala antes de vender.
        </Link>
      )}

      {/* Todos los pedidos en vivo */}
      {es('gerente', 'cajero', 'barra') ? <TableroPedidos /> : <p className="text-smoke">Elige un módulo en el menú.</p>}

      {abrirCaja && (
        <Modal titulo="Abrir caja" subtitulo="Confirma con cuánto efectivo arrancas y listo." onCerrar={() => setAbrirCaja(false)} ancho="max-w-md">
          <AbrirCajaRapida onAbierta={() => { setAbrirCaja(false); cajas.recargar(); }} />
        </Modal>
      )}
    </div>
  );
}
