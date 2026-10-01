import {
  type LucideIcon, Armchair, BarChart3, Bell, Beer, Boxes, CalendarCheck, ChefHat, CreditCard, HandCoins, Home, LayoutGrid, Megaphone,
  PartyPopper, Receipt, Settings, ShieldCheck, Sparkles, TabletSmartphone, TrendingUp, UserCog, Users, UtensilsCrossed, Wallet,
} from 'lucide-react';

export type Rol = 'admin' | 'gerente' | 'cajero' | 'mesonero' | 'barra' | 'cocina' | 'rrpp';
export const ROLES: { valor: Rol; nombre: string; descripcion: string }[] = [
  { valor: 'admin', nombre: 'Administrador', descripcion: 'Acceso total' },
  { valor: 'gerente', nombre: 'Gerente', descripcion: 'Todo menos usuarios y configuración' },
  { valor: 'cajero', nombre: 'Cajero', descripcion: 'Cobra, abre y cierra caja' },
  { valor: 'mesonero', nombre: 'Mesonero', descripcion: 'Toma pedidos en mesas' },
  { valor: 'barra', nombre: 'Barra', descripcion: 'Despacha y cobra en barra' },
  { valor: 'cocina', nombre: 'Cocina', descripcion: 'Solo ve comandas de cocina' },
  { valor: 'rrpp', nombre: 'RRPP', descripcion: 'Reservas, eventos y clientes' },
];

export type Modulo = {
  href: string;
  nombre: string;
  descripcion: string;
  icono: LucideIcon;
  /** Roles que lo ven (el admin ve todo) */
  roles: Rol[];
  /** Palabras extra para el buscador (Ctrl+K) */
  claves?: string;
};

export type Area = { id: string; nombre: string; icono: LucideIcon; color: string; modulos: Modulo[] };

const SERVICIO: Rol[] = ['gerente', 'cajero', 'mesonero', 'barra'];
const COBRO: Rol[] = ['gerente', 'cajero', 'barra'];
const GESTION: Rol[] = ['gerente'];
const COMERCIAL: Rol[] = ['gerente', 'rrpp', 'cajero'];

/**
 * Mapa del panel. La navegación (riel de áreas, pestañas, lanzador de inicio y buscador Ctrl+K)
 * se genera desde aquí: para agregar un módulo basta con registrarlo.
 */
export const AREAS: Area[] = [
  {
    id: 'operacion', nombre: 'Operación', icono: UtensilsCrossed, color: '#3dffb0',
    modulos: [
      { href: '/admin/mesero', nombre: 'Mis mesas', descripcion: 'Tablet del mesonero: abre mesas, toma pedidos, entrega y pasa a caja', icono: TabletSmartphone, roles: SERVICIO, claves: 'tablet mesonero mesero pedidos tomar orden' },
      { href: '/admin/salon', nombre: 'Salón', descripcion: 'Plano de mesas y asientos en vivo, aforo y cuentas abiertas', icono: Armchair, roles: [...SERVICIO, 'rrpp'], claves: 'mesas plano asientos aforo puerta' },
      { href: '/admin/barra', nombre: 'Barra', descripcion: 'Venta rápida: los clientes van cancelando', icono: Beer, roles: COBRO, claves: 'venta rapida taburete tobo cerveza' },
      { href: '/admin/comandas', nombre: 'Comandas', descripcion: 'Pantalla de cocina y barra con los pedidos por preparar', icono: ChefHat, roles: [...SERVICIO, 'cocina'], claves: 'cocina kds pedidos' },
      { href: '/admin/caja', nombre: 'Caja', descripcion: 'Apertura, ingresos, egresos y cierre con conteo', icono: Wallet, roles: COBRO, claves: 'arqueo cierre fondo efectivo' },
      { href: '/admin/creditos', nombre: 'Por cobrar', descripcion: 'Clientes que fiaron o se fueron sin pagar, su deuda y las mesas con saldo', icono: HandCoins, roles: COBRO, claves: 'creditos fiado deuda deben cobrar abonos cartera se fue' },
      { href: '/admin/ventas', nombre: 'Ventas', descripcion: 'Historial de cuentas cobradas, abiertas y anuladas', icono: Receipt, roles: ['gerente', 'cajero', 'barra'], claves: 'cuentas facturas tickets historial' },
    ],
  },
  {
    id: 'catalogo', nombre: 'Catálogo', icono: LayoutGrid, color: '#d4af37',
    modulos: [
      { href: '/admin/productos', nombre: 'Productos', descripcion: 'Carta, presentaciones, precios por moneda, recetas y adicionales', icono: Sparkles, roles: GESTION, claves: 'menu carta precios recetas adicionales categorias hamburguesas cocteles' },
      { href: '/admin/inventario', nombre: 'Inventario', descripcion: 'Existencias, entradas, conteos, mermas y kardex', icono: Boxes, roles: [...GESTION, 'barra', 'cocina', 'cajero'], claves: 'stock insumos compras kardex cervezas botellas' },
      { href: '/admin/mesas', nombre: 'Mesas y zonas', descripcion: 'Numeración de mesas, asientos y zonas del local', icono: Armchair, roles: GESTION, claves: 'zonas vip asientos capacidad numerar' },
    ],
  },
  {
    id: 'comercial', nombre: 'Comercial', icono: Megaphone, color: '#4aa3df',
    modulos: [
      { href: '/admin/reservas', nombre: 'Reservas', descripcion: 'Confirma, asigna mesa y sienta a los clientes', icono: CalendarCheck, roles: [...COMERCIAL, 'mesonero'], claves: 'rrpp vip confirmar' },
      { href: '/admin/eventos', nombre: 'Eventos', descripcion: 'Cartelera, DJs, cover y flyers', icono: PartyPopper, roles: COMERCIAL, claves: 'fiestas cartelera dj flyer' },
      { href: '/admin/recordatorios', nombre: 'Recordatorios', descripcion: 'Tareas del equipo y avisos de eventos a clientes', icono: Bell, roles: ['gerente', 'rrpp', 'cajero', 'barra', 'cocina', 'mesonero'], claves: 'tareas avisos whatsapp pendientes' },
      { href: '/admin/clientes', nombre: 'Clientes', descripcion: 'Base de clientes, VIP y cumpleaños', icono: Users, roles: [...COMERCIAL, 'mesonero', 'barra'], claves: 'vip cumpleaños contactos' },
    ],
  },
  {
    id: 'administracion', nombre: 'Administración', icono: ShieldCheck, color: '#f6e3a1',
    modulos: [
      { href: '/admin/reportes', nombre: 'Reportes', descripcion: 'Ventas por día, producto, método de pago, zona y mesonero', icono: BarChart3, roles: GESTION, claves: 'estadisticas informes ventas' },
      { href: '/admin/tasas', nombre: 'Tasas', descripcion: 'Dólar BCV, TRM y cruce bolívar/peso', icono: TrendingUp, roles: [...GESTION, 'cajero', 'barra'], claves: 'dolar bcv trm cambio bolivar peso' },
      { href: '/admin/metodos-pago', nombre: 'Métodos de pago', descripcion: 'Efectivo, Pago Móvil, Zelle, Nequi… y sus monedas', icono: CreditCard, roles: GESTION, claves: 'zelle pago movil nequi transferencia' },
      { href: '/admin/usuarios', nombre: 'Usuarios', descripcion: 'Equipo, roles y contraseñas', icono: UserCog, roles: [], claves: 'roles permisos personal' },
      { href: '/admin/configuracion', nombre: 'Configuración', descripcion: 'Datos del local, horarios, moneda, servicio y aforo', icono: Settings, roles: [], claves: 'ajustes horarios moneda servicio propina aforo local' },
    ],
  },
];

export const INICIO: Modulo = { href: '/admin', nombre: 'Inicio', descripcion: 'Resumen de la noche', icono: Home, roles: [] };

export const puedeVer = (m: Modulo, rol: Rol | undefined) => !!rol && (rol === 'admin' || m.roles.includes(rol));

export const areasPara = (rol: Rol | undefined) =>
  AREAS.map((a) => ({ ...a, modulos: a.modulos.filter((m) => puedeVer(m, rol)) })).filter((a) => a.modulos.length);

/** Área y módulo a los que pertenece una ruta */
export function ubicar(pathname: string) {
  if (pathname.startsWith('/admin/cuenta/')) pathname = '/admin/mesero';
  for (const area of AREAS) {
    const modulo = area.modulos.find((m) => pathname === m.href || pathname.startsWith(`${m.href}/`));
    if (modulo) return { area, modulo };
  }
  return { area: null, modulo: null };
}
