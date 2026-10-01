'use client';

import { Star } from 'lucide-react';
import { Crud } from '@/components/admin/Crud';
import { Insignia } from '@/components/admin/ui';
import { dinero, fechaCorta } from '@/lib/admin/moneda';

type Cliente = { id: number; nombre: string; telefono: string | null; documento: string | null; email: string | null; fecha_nacimiento: string | null; vip: boolean; notas: string | null; visitas: number; consumo_usd: number };

export default function ClientesPage() {
  return (
    <Crud<Cliente>
      titulo="Clientes"
      descripcion="Tu base de clientes: márcalos VIP, guarda su cumpleaños y mira cuánto han consumido."
      ruta="/clientes"
      textoNuevo="Nuevo cliente"
      buscarEn={(c) => `${c.nombre} ${c.telefono ?? ''} ${c.documento ?? ''}`}
      nuevo={{ nombre: '', telefono: '', documento: '', email: '', fecha_nacimiento: '', vip: false, notas: '' }}
      aForm={(c) => ({ ...c, fecha_nacimiento: c.fecha_nacimiento ?? '' })}
      columnas={[
        { titulo: 'Cliente', celda: (c) => <span className="flex items-center gap-2 font-medium">{c.vip && <Star size={14} className="fill-gold text-gold" />}{c.nombre}</span> },
        { titulo: 'WhatsApp', celda: (c) => c.telefono ? <a className="text-venom hover:underline" href={`https://wa.me/${c.telefono.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>{c.telefono}</a> : '—' },
        { titulo: 'Cumpleaños', celda: (c) => <span className="text-smoke">{c.fecha_nacimiento ? fechaCorta(c.fecha_nacimiento) : '—'}</span> },
        { titulo: 'Visitas', celda: (c) => c.visitas, alinear: 'der' },
        { titulo: 'Consumo', celda: (c) => dinero(c.consumo_usd, 'USD'), alinear: 'der' },
        { titulo: '', celda: (c) => c.vip && <Insignia color="oro">VIP</Insignia> },
      ]}
      campos={[
        { nombre: 'nombre', etiqueta: 'Nombre completo', ancho: true },
        { nombre: 'telefono', etiqueta: 'WhatsApp', placeholder: '573001234567' },
        { nombre: 'documento', etiqueta: 'Documento' },
        { nombre: 'email', etiqueta: 'Correo' },
        { nombre: 'fecha_nacimiento', etiqueta: 'Fecha de nacimiento', tipo: 'fecha' },
        { nombre: 'vip', etiqueta: 'Cliente VIP', tipo: 'si_no' },
        { nombre: 'notas', etiqueta: 'Notas', tipo: 'area', placeholder: 'Bebida favorita, mesa preferida, alergias…' },
      ]}
    />
  );
}
