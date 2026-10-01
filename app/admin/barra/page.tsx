'use client';

import { Armchair, Clock, Plus, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Boton, Cargando, Encabezado, ErrorCaja, Input, Insignia, Tarjeta, Vacio, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { type Moneda, dinero, hace } from '@/lib/admin/moneda';
import { useVivo } from '@/lib/admin/vivo';

type Cuenta = { id: number; numero: string; nombre_cliente: string | null; total: number; pagado: number; moneda: Moneda; abierta_en: string; mesa_numero: number | null; items: number; mesonero: string | null };

export default function BarraPage() {
  const router = useRouter();
  const { datos, cargando, error, recargar } = useDatos<Cuenta[]>('/cuentas?estado=abierta&tipo=barra', 30_000);
  useVivo(() => recargar());
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const avisos = useAvisos();

  const nueva = async () => {
    setOcupado(true);
    try {
      const c = await adm<{ id: number }>('/cuentas', { method: 'POST', body: { tipo: 'barra', personas: 1, nombre_cliente: nombre.trim() || null } });
      router.push(`/admin/cuenta/${c.id}`);
    } catch (e) {
      avisos.error(e);
      setOcupado(false);
    }
  };

  const porCobrar = (datos ?? []).filter((c) => c.total - c.pagado > 0);

  return (
    <div className="max-w-6xl">
      <Encabezado titulo="Barra" descripcion="Venta rápida: marca, cobra y entrega. Si el cliente sigue pidiendo, su cuenta queda abierta y va cancelando ronda por ronda.">
        <Link href="/admin/salon" className="inline-flex h-10 items-center gap-2 rounded-xl border border-gold/30 px-4 text-sm text-gold-light hover:bg-gold/10"><Armchair size={15} /> Ver taburetes</Link>
      </Encabezado>

      <Tarjeta className="mb-5 flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-52 flex-1">
          <span className="mb-1 block text-[11px] tracking-wider text-gold/80 uppercase">Nombre del cliente (opcional)</span>
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && nueva()} placeholder="Para encontrar su cuenta después: “Carlos, camisa negra”" />
        </label>
        <Boton variante="oro" tam="lg" cargando={ocupado} onClick={nueva}><Zap size={18} /> Nueva venta</Boton>
      </Tarjeta>

      <h2 className="mb-2 flex items-center gap-2 font-display text-lg">
        Cuentas abiertas en barra {datos && <Insignia color={porCobrar.length ? 'oro' : 'gris'}>{porCobrar.length} por cobrar</Insignia>}
      </h2>
      {cargando ? <Cargando /> : error ? <ErrorCaja mensaje={error} onReintentar={recargar} /> : !datos?.length ? (
        <Vacio titulo="Sin cuentas abiertas">Toca “Nueva venta” para empezar.</Vacio>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {datos.map((c) => {
            const saldo = c.total - c.pagado;
            return (
              <button key={c.id} onClick={() => router.push(`/admin/cuenta/${c.id}`)} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${saldo > 0 ? 'border-gold/40 bg-gold/5' : 'border-venom/30 bg-emerald/20'}`}>
                <p className="truncate font-medium">{c.nombre_cliente ?? c.numero}</p>
                <p className="flex items-center gap-2 text-xs text-smoke"><span>{c.numero}</span><span className="flex items-center gap-1"><Clock size={11} /> {hace(c.abierta_en)}</span><span>{c.items} ítems</span></p>
                <p className={`mt-3 font-display text-2xl font-light ${saldo > 0 ? 'text-gold-light' : 'text-venom'}`}>{saldo > 0 ? dinero(saldo, c.moneda) : 'Al día ✓'}</p>
                {c.pagado > 0 && saldo > 0 && <p className="text-[11px] text-smoke">Ya abonó {dinero(c.pagado, c.moneda)}</p>}
              </button>
            );
          })}
          <button onClick={nueva} className="grid min-h-28 place-items-center rounded-2xl border border-dashed border-gold/25 text-smoke hover:border-gold hover:text-gold"><Plus size={26} /></button>
        </div>
      )}
    </div>
  );
}
