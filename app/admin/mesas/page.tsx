'use client';

import { useState } from 'react';
import { Crud } from '@/components/admin/Crud';
import { Encabezado, Insignia, Pestanas, useDatos } from '@/components/admin/ui';
import { dinero } from '@/lib/admin/moneda';

type Zona = { id: number; nombre: string; descripcion: string | null; capacidad_mesa: number; max_personas: number; consumo_minimo_cop: number; es_vip: boolean; reservable: boolean; color: string; beneficios: string[]; orden: number; activo: boolean; mesas: number; puestos: number };
type Mesa = { id: number; zona_id: number; zona: string; numero: number; nombre: string | null; tipo: string; forma: string; capacidad: number; pos_x: number; pos_y: number; activo: boolean; asientos: { numero: number; etiqueta: string }[] };

export default function MesasPage() {
  const [tab, setTab] = useState<'mesas' | 'zonas'>('mesas');
  const zonas = useDatos<Zona[]>('/salon/zonas');
  const total = zonas.datos?.filter((z) => z.activo).reduce((s, z) => s + Number(z.puestos), 0) ?? 0;

  return (
    <div>
      <Encabezado titulo="Mesas y zonas" descripcion={`Numeración del local. Cada mesa genera sus asientos numerados (M12-3, B-07). Capacidad sentada total: ${total} personas.`}>
        <Pestanas valor={tab} onCambio={setTab} opciones={[{ valor: 'mesas', etiqueta: 'Mesas y asientos' }, { valor: 'zonas', etiqueta: 'Zonas' }]} />
      </Encabezado>

      {tab === 'mesas' ? (
        <Crud<Mesa>
          sinEncabezado
          titulo="Mesa"
          ruta="/salon/mesas"
          textoNuevo="Nueva mesa"
          buscarEn={(m) => `${m.numero} ${m.nombre ?? ''} ${m.zona}`}
          nuevo={{ zona_id: zonas.datos?.[0]?.id ?? null, numero: null, nombre: '', tipo: 'mesa', forma: 'redonda', capacidad: 6, pos_x: 50, pos_y: 50, activo: true }}
          columnas={[
            { titulo: 'N.º', celda: (m) => <span className="font-display text-lg text-gold-light">{m.numero}</span> },
            { titulo: 'Nombre', celda: (m) => m.nombre ?? <span className="text-smoke">Mesa {m.numero}</span> },
            { titulo: 'Zona', celda: (m) => m.zona },
            { titulo: 'Tipo', celda: (m) => <Insignia color={m.tipo === 'vip' ? 'oro' : m.tipo === 'barra' ? 'verde' : 'gris'}>{m.tipo}</Insignia> },
            { titulo: 'Puestos', celda: (m) => m.capacidad, alinear: 'centro' },
            { titulo: 'Asientos', celda: (m) => <span className="text-xs text-smoke">{m.asientos[0]?.etiqueta} … {m.asientos.at(-1)?.etiqueta}</span> },
            { titulo: 'Estado', celda: (m) => (m.activo ? <Insignia color="verde">Activa</Insignia> : <Insignia color="rojo">Retirada</Insignia>) },
          ]}
          campos={[
            { nombre: 'numero', etiqueta: 'Número de mesa', tipo: 'numero' },
            { nombre: 'nombre', etiqueta: 'Nombre (opcional)', placeholder: 'Palco Esmeralda I' },
            { nombre: 'zona_id', etiqueta: 'Zona', tipo: 'select', opciones: (zonas.datos ?? []).filter((z) => z.activo).map((z) => ({ valor: z.id, etiqueta: z.nombre })) },
            { nombre: 'capacidad', etiqueta: 'Puestos (asientos)', tipo: 'numero', ayuda: 'Los asientos se numeran solos del 1 a este número.' },
            { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: [{ valor: 'mesa', etiqueta: 'Mesa' }, { valor: 'vip', etiqueta: 'VIP / palco' }, { valor: 'barra', etiqueta: 'Barra (taburetes)' }] },
            { nombre: 'forma', etiqueta: 'Forma en el plano', tipo: 'select', opciones: [{ valor: 'redonda', etiqueta: 'Redonda' }, { valor: 'cuadrada', etiqueta: 'Cuadrada' }, { valor: 'rectangular', etiqueta: 'Rectangular' }, { valor: 'barra', etiqueta: 'Barra' }] },
            { nombre: 'activo', etiqueta: 'Activa', tipo: 'si_no', ayuda: 'La posición en el plano se ajusta arrastrando la mesa en Operación → Salón.' },
          ]}
        />
      ) : (
        <Crud<Zona>
          sinEncabezado
          titulo="Zona"
          ruta="/salon/zonas"
          textoNuevo="Nueva zona"
          nuevo={{ nombre: '', descripcion: '', capacidad_mesa: 6, max_personas: 20, consumo_minimo_cop: 0, es_vip: false, reservable: true, color: '#12805a', beneficios: [], orden: 10, activo: true }}
          columnas={[
            { titulo: 'Zona', celda: (z) => <span className="flex items-center gap-2 font-medium"><span className="h-3 w-3 rounded-full" style={{ background: z.color }} />{z.nombre}</span> },
            { titulo: 'Mesas', celda: (z) => z.mesas, alinear: 'centro' },
            { titulo: 'Puestos', celda: (z) => z.puestos, alinear: 'centro' },
            { titulo: 'Consumo mínimo', celda: (z) => (z.consumo_minimo_cop ? dinero(z.consumo_minimo_cop, 'COP') : '—'), alinear: 'der' },
            { titulo: '', celda: (z) => <div className="flex gap-1">{z.es_vip && <Insignia color="oro">VIP</Insignia>}{z.reservable ? <Insignia color="azul">Reservable en web</Insignia> : <Insignia>Solo local</Insignia>}{!z.activo && <Insignia color="rojo">Inactiva</Insignia>}</div> },
          ]}
          campos={[
            { nombre: 'nombre', etiqueta: 'Nombre' },
            { nombre: 'color', etiqueta: 'Color en el plano', tipo: 'color' },
            { nombre: 'descripcion', etiqueta: 'Descripción (se ve en la web)', tipo: 'area' },
            { nombre: 'max_personas', etiqueta: 'Máx. personas por reserva', tipo: 'numero' },
            { nombre: 'consumo_minimo_cop', etiqueta: 'Consumo mínimo (COP)', tipo: 'numero' },
            { nombre: 'es_vip', etiqueta: 'Zona VIP', tipo: 'si_no' },
            { nombre: 'reservable', etiqueta: 'Se puede reservar desde la web', tipo: 'si_no' },
            { nombre: 'beneficios', etiqueta: 'Beneficios', tipo: 'lista', placeholder: 'Ingreso sin fila, mesero exclusivo…' },
            { nombre: 'orden', etiqueta: 'Orden', tipo: 'numero' },
            { nombre: 'activo', etiqueta: 'Activa', tipo: 'si_no' },
          ]}
        />
      )}
    </div>
  );
}
