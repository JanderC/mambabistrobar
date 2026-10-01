'use client';

import { Crud } from '@/components/admin/Crud';
import { useSesion } from '@/components/admin/Sesion';
import { Insignia } from '@/components/admin/ui';

type Metodo = { id: number; nombre: string; es_efectivo: boolean; monedas: string[]; requiere_referencia: boolean; orden: number; activo: boolean };

export default function MetodosPagoPage() {
  const { es } = useSesion();
  return (
    <Crud<Metodo>
      titulo="Métodos de pago"
      descripcion="Con qué pueden pagar los clientes y en qué monedas se recibe cada uno."
      ruta="/metodos-pago"
      rutaLista="/metodos-pago?todos=1"
      puedeEditar={es('gerente')}
      textoNuevo="Nuevo método"
      nuevo={{ nombre: '', es_efectivo: false, monedas: ['COP'], requiere_referencia: true, orden: 10, activo: true }}
      columnas={[
        { titulo: 'Método', celda: (m) => <span className="font-medium">{m.nombre}</span> },
        { titulo: 'Monedas', celda: (m) => <div className="flex gap-1">{m.monedas.map((x) => <Insignia key={x} color="oro">{x}</Insignia>)}</div> },
        { titulo: 'Tipo', celda: (m) => (m.es_efectivo ? <Insignia color="verde">Efectivo · cuenta en caja</Insignia> : <Insignia>Electrónico</Insignia>) },
        { titulo: 'Referencia', celda: (m) => (m.requiere_referencia ? 'Obligatoria' : '—') },
        { titulo: 'Estado', celda: (m) => (m.activo ? <Insignia color="verde">Activo</Insignia> : <Insignia color="rojo">Inactivo</Insignia>) },
      ]}
      campos={[
        { nombre: 'nombre', etiqueta: 'Nombre', placeholder: 'Pago Móvil, Zelle, Nequi…', ancho: true },
        { nombre: 'monedas', etiqueta: 'Monedas que recibe', tipo: 'multi', opciones: [{ valor: 'COP', etiqueta: 'Pesos (COP)' }, { valor: 'USD', etiqueta: 'Dólares (USD)' }, { valor: 'VES', etiqueta: 'Bolívares (VES)' }] },
        { nombre: 'es_efectivo', etiqueta: 'Es efectivo', tipo: 'si_no', ayuda: 'Entra al cajón: se cuenta en el cierre de caja y puede dar vuelto.' },
        { nombre: 'requiere_referencia', etiqueta: 'Exigir número de referencia', tipo: 'si_no' },
        { nombre: 'orden', etiqueta: 'Orden en pantalla', tipo: 'numero' },
        { nombre: 'activo', etiqueta: 'Activo', tipo: 'si_no' },
      ]}
    />
  );
}
