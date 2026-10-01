import type { Moneda, PorMoneda, Tasa } from '@/lib/admin/moneda';

export type VarianteCat = {
  id: number;
  presentacion: string;
  precios: PorMoneda;
  /** Unidades vendibles según el inventario (null = sin receta, no se controla) */
  disponibles: number | null;
  removibles: { id: number; etiqueta: string }[];
  seleccion: { cantidad: number; opciones: { insumo_id: number; nombre: string; stock: number; recargo: PorMoneda }[] } | null;
};
export type ProductoCat = { id: number; nombre: string; descripcion: string | null; disponible: boolean; destacado: boolean; variantes: VarianteCat[] };
export type AdicionalCat = { id: number; nombre: string; precios: PorMoneda };
export type CategoriaCat = { id: number; nombre: string; icono: string | null; tipo: string; estacion: string; adicionales: AdicionalCat[]; productos: ProductoCat[] };
export type Catalogo = { tasa: Tasa; categorias: CategoriaCat[] };

/** Línea que aún no se ha enviado a cocina/barra */
export type Borrador = {
  clave: string;
  producto: ProductoCat;
  variante: VarianteCat;
  cantidad: number;
  asiento: number | null;
  notas: string;
  sin: number[];
  adicionales: { id: number; cantidad: number }[];
  seleccion: { insumo_id: number; cantidad: number }[];
  /** Precio unitario estimado en la moneda de la cuenta (el servidor confirma) */
  unitario: number;
  /** Texto de los modificadores para mostrar en el ticket */
  detalle: string[];
};

export type ItemCuenta = {
  id: number; nombre: string; presentacion: string | null; cantidad: number; precio_base: number; extras: number; subtotal: number; asiento: number | null;
  notas: string | null; estado: 'pendiente' | 'preparando' | 'listo' | 'entregado' | 'anulado'; estacion: string; ronda: number; creado_en: string; usuario: string | null;
  anulado_motivo: string | null; modificadores: { tipo: 'sin' | 'adicional' | 'seleccion'; nombre: string; cantidad: number; precio_extra: number }[];
};

export type PagoCuenta = {
  id: number; metodo: string; moneda: Moneda; monto: number; monto_recibido: number; monto_cuenta: number; vuelto_monto: number | null; vuelto_moneda: Moneda | null;
  referencia: string | null; asiento: number | null; fecha: string; usuario: string | null;
};

export type Cuenta = {
  id: number; numero: string; tipo: 'mesa' | 'barra' | 'llevar'; estado: 'abierta' | 'pagada' | 'anulada'; moneda: Moneda; personas: number; nombre_cliente: string | null;
  mesa_id: number | null; mesa_numero: number | null; mesa_nombre: string | null; mesa_capacidad: number | null; mesa_tipo: string | null; zona: string | null; asiento: number | null;
  mesonero: string | null; servicio_pct: number; descuento: number; descuento_motivo: string | null; subtotal: number; servicio: number; total: number; pagado: number;
  saldo: number; equivalentes: { total: PorMoneda; saldo: PorMoneda }; notas: string | null; abierta_en: string; cerrada_en: string | null; anulada_motivo: string | null;
  items: ItemCuenta[]; pagos: PagoCuenta[];
};

export type MetodoPago = { id: number; nombre: string; es_efectivo: boolean; monedas: Moneda[]; requiere_referencia: boolean };

export const tituloCuenta = (c: Pick<Cuenta, 'tipo' | 'mesa_numero' | 'mesa_nombre' | 'mesa_tipo' | 'asiento' | 'nombre_cliente' | 'numero'>) =>
  c.mesa_tipo === 'barra' || (c.tipo === 'barra' && !c.mesa_numero)
    ? `Barra${c.asiento ? ` · puesto ${c.asiento}` : ''}`
    : c.tipo === 'llevar'
      ? 'Para llevar'
      : `Mesa ${c.mesa_numero}`;
