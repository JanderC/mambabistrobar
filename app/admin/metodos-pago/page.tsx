'use client';

import { Crud } from '@/components/admin/Crud';
import { useSesion } from '@/components/admin/Sesion';
import { Insignia } from '@/components/admin/ui';

type Metodo = { id: number; nombre: string; es_efectivo: boolean; monedas: string[]; requiere_referencia: boolean; orden: number; activo: boolean; datos_pago: string | null };

export default function MetodosPagoPage() {
  const { es } = useSesion();
  return (
    <Crud<Metodo>
      titulo="Métodos de pago"
      descripcion="Con qué pueden pagar los clientes, en qué monedas y los datos que ven en el QR para transferir."
      ruta="/metodos-pago"
      rutaLista="/metodos-pago?todos=1"
      puedeEditar={es('gerente')}
      textoNuevo="Nuevo método"
      nuevo={{ nombre: '', es_efectivo: false, monedas: ['COP'], requiere_referencia: true, orden: 10, activo: true, datos_pago: '' }}
      columnas={[
        { titulo: 'Método', celda: (m) => <span className="font-medium">{m.nombre}</span> },
        { titulo: 'Monedas', celda: (m) => <div className="flex gap-1">{m.monedas.map((x) => <Insignia key={x} color="oro">{x}</Insignia>)}</div> },
        { titulo: 'Tipo', celda: (m) => (m.es_efectivo ? <Insignia color="verde">Efectivo · cuenta en caja</Insignia> : <Insignia>Electrónico</Insignia>) },
        { titulo: 'Referencia', celda: (m) => (m.requiere_referencia ? 'Obligatoria' : '—') },
        { titulo: 'Datos para el cliente', celda: (m) => (m.datos_pago ? <span className="line-clamp-2 max-w-64 text-xs text-smoke">{m.datos_pago}</span> : m.es_efectivo ? '—' : <span className="text-xs text-red-300">Sin datos</span>) },
        { titulo: 'Estado', celda: (m) => (m.activo ? <Insignia color="verde">Activo</Insignia> : <Insignia color="rojo">Inactivo</Insignia>) },
      ]}
      campos={[
        { nombre: 'nombre', etiqueta: 'Nombre', placeholder: 'Pago Móvil, Zelle, Nequi…', ancho: true },
        { nombre: 'monedas', etiqueta: 'Monedas que recibe', tipo: 'multi', opciones: [{ valor: 'COP', etiqueta: 'Pesos (COP)' }, { valor: 'USD', etiqueta: 'Dólares (USD)' }, { valor: 'VES', etiqueta: 'Bolívares (VES)' }] },
        { nombre: 'es_efectivo', etiqueta: 'Es efectivo', tipo: 'si_no', ayuda: 'Entra al cajón: se cuenta en el cierre de caja y puede dar vuelto.' },
        { nombre: 'requiere_referencia', etiqueta: 'Exigir número de referencia', tipo: 'si_no' },
        { nombre: 'datos_pago', etiqueta: 'Datos para que el cliente pague (se ven en el QR)', tipo: 'area', placeholder: 'Nequi 300 123 4567 · a nombre de Mamba Bistro Bar · Pago Móvil: Banco de Venezuela · 0412 1234567 · J-12345678',
          ayuda: 'Número, banco, cédula o correo: lo que el cliente necesita para transferir. Vacío en efectivo.' },
        { nombre: 'orden', etiqueta: 'Orden en pantalla', tipo: 'numero' },
        { nombre: 'activo', etiqueta: 'Activo', tipo: 'si_no' },
      ]}
    />
  );
}
