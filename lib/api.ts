import type { Categoria, Evento, Local, Media, OpcionesReserva, Producto, Promocion } from './types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api';

/**
 * GET al backend desde el servidor con revalidación (ISR).
 * Si la API no responde, devuelve `fallback` para que el sitio nunca se caiga.
 */
async function get<T>(path: string, fallback: T, revalidate = 60): Promise<T> {
  try {
    const res = await fetch(`${API_URL}${path}`, { next: { revalidate }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export const LOCAL_FALLBACK: Local = {
  nombre: 'Mamba Bistro Bar 2.0',
  eslogan: 'Muda de piel cada fin de semana',
  descripcion: 'Bistro, coctelería de autor y la mejor rumba de la ciudad.',
  direccion: '',
  ciudad: '',
  departamento: null,
  pais: 'Colombia',
  latitud: null,
  longitud: null,
  whatsapp: '',
  telefono: null,
  email_reservas: null,
  instagram: null,
  tiktok: null,
  facebook: null,
  dress_code: null,
  edad_minima: 18,
  horarios: [],
};

export const api = {
  local: () => get<Local>('/local', LOCAL_FALLBACK, 300),
  promociones: () => get<Promocion[]>('/local/promociones', []),
  menu: () => get<Categoria[]>('/menu', []),
  destacados: () => get<Producto[]>('/menu/destacados', []),
  eventos: (cuando: 'proximos' | 'pasados' = 'proximos', limite = 20) =>
    get<Evento[]>(`/eventos?cuando=${cuando}&limite=${limite}`, []),
  evento: (slug: string) => get<Evento | null>(`/eventos/${encodeURIComponent(slug)}`, null),
  opcionesReserva: () =>
    get<OpcionesReserva>('/reservas/opciones', { zonas: [], politicas: [], eventos: [], horarios: [] }),
  galeria: () => get<Media[]>('/galeria', [], 300),
};
