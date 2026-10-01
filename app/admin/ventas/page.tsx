'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Cargando, Dato, Encabezado, ErrorCaja, Input, Insignia, Pestanas, Tabla, useDatos } from '@/components/admin/ui';
import { type Moneda, dinero, fechaHora, jornadaHoy } from '@/lib/admin/moneda';

type Cuenta = {
  id: number; numero: string; tipo: string; estado: 'abierta' | 'pagada' | 'anulada' | 'fiada'; moneda: Moneda; cliente: string | null; fiado_monto: number | null; fiado_motivo: string | null; personas: number; nombre_cliente: string | null;
  total: number; pagado: number; total_usd: number; abierta_en: string; cerrada_en: string | null; mesa_numero: number | null; zona: string | null; mesonero: string | null; items: number;
};

export default function VentasPage() {
  const router = useRouter();
  const [estado, setEstado] = useState<'pagada' | 'abierta' | 'fiada' | 'anulada'>('pagada');
  const [desde, setDesde] = useState(jornadaHoy());
  const [hasta, setHasta] = useState(jornadaHoy());
  const [q, setQ] = useState('');
  const ruta = `/cuentas?estado=${estado}${estado === 'abierta' ? '' : `&desde=${desde}&hasta=${hasta}`}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`;
  const { datos, cargando, error, recargar } = useDatos<Cuenta[]>(ruta);

  const totalUsd = (datos ?? []).reduce((s, c) => s + Number(c.total_usd), 0);
  const personas = (datos ?? []).reduce((s, c) => s + c.personas, 0);

  return (
    <div>
      <Encabezado titulo="Ventas" descripcion="Todas las cuentas. Toca una para ver el detalle, los pagos y reimprimir.">
        <Pestanas valor={estado} onCambio={setEstado} opciones={[{ valor: 'pagada', etiqueta: 'Cobradas' }, { valor: 'abierta', etiqueta: 'Abiertas' }, { valor: 'fiada', etiqueta: 'Fiadas' }, { valor: 'anulada', etiqueta: 'Anuladas' }]} />
      </Encabezado>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        {estado !== 'abierta' && (
          <>
            <label className="text-xs text-smoke">Desde<Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="mt-1 w-40" /></label>
            <label className="text-xs text-smoke">Hasta<Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="mt-1 w-40" /></label>
          </>
        )}
        <label className="relative">
          <Search size={15} className="absolute bottom-3 left-3 text-smoke" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="N.º de cuenta o cliente" className="w-56 pl-9" />
        </label>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Dato etiqueta="Cuentas" valor={datos?.length ?? 0} />
        <Dato etiqueta={estado === 'abierta' ? 'Por cobrar (equiv.)' : 'Total (equiv.)'} valor={dinero(totalUsd, 'USD')} acento />
        <Dato etiqueta="Personas atendidas" valor={personas} />
        <Dato etiqueta="Ticket promedio" valor={dinero(datos?.length ? totalUsd / datos.length : 0, 'USD')} />
      </div>

      {cargando ? <Cargando /> : error ? <ErrorCaja mensaje={error} onReintentar={recargar} /> : (
        <Tabla<Cuenta>
          filas={datos ?? []}
          clave={(c) => c.id}
          onFila={(c) => router.push(`/admin/cuenta/${c.id}`)}
          vacio="No hay cuentas en este rango"
          columnas={[
            { titulo: 'Cuenta', celda: (c) => <span className="font-medium">{c.numero}</span> },
            { titulo: 'Dónde', celda: (c) => (c.mesa_numero ? <span>{c.tipo === 'barra' ? 'Barra' : `Mesa ${c.mesa_numero}`} <span className="text-xs text-smoke">· {c.zona}</span></span> : c.tipo === 'llevar' ? 'Para llevar' : 'Barra') },
            { titulo: 'Cliente', celda: (c) => <span className="text-smoke">{c.nombre_cliente ?? '—'} · {c.personas} pers.</span> },
            { titulo: 'Atendió', celda: (c) => <span className="text-smoke">{c.mesonero ?? '—'}</span> },
            { titulo: estado === 'abierta' ? 'Abierta' : 'Cerrada', celda: (c) => <span className="text-smoke">{fechaHora(c.cerrada_en ?? c.abierta_en)}</span> },
            { titulo: 'Ítems', celda: (c) => c.items, alinear: 'centro' },
            { titulo: 'Total', celda: (c) => <b className="font-medium">{dinero(c.total, c.moneda)}</b>, alinear: 'der' },
            { titulo: '', celda: (c) => (
              c.estado === 'abierta' ? (c.pagado > 0 ? <Insignia color="oro">Abonado {dinero(c.pagado, c.moneda)}</Insignia> : <Insignia color="verde">Abierta</Insignia>)
              : c.estado === 'pagada' ? <Insignia color="azul">Pagada</Insignia>
              : c.estado === 'fiada' ? <Insignia color="oro">{c.fiado_motivo === 'se_fue' ? 'Se fue' : 'Fiada'} · {dinero(c.fiado_monto, c.moneda)} · {c.cliente}</Insignia>
              : <Insignia color="rojo">Anulada</Insignia>
            ) },
          ]}
        />
      )}
    </div>
  );
}
