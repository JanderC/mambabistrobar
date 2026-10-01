import { API_URL } from '@/lib/api';

const CLAVE_TOKEN = 'mamba_token';

export const sesion = {
  token: () => (typeof window === 'undefined' ? null : localStorage.getItem(CLAVE_TOKEN)),
  guardar: (t: string) => localStorage.setItem(CLAVE_TOKEN, t),
  borrar: () => localStorage.removeItem(CLAVE_TOKEN),
};

export class ApiError extends Error {
  constructor(public status: number, message: string, public campos?: Record<string, string[]>) {
    super(message);
  }
}

type Opciones = { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown };

/** Llama a /api/admin/* con el token de la sesión. Lanza ApiError con el mensaje del servidor. */
export async function adm<T = any>(ruta: string, { method = 'GET', body }: Opciones = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/admin${ruta}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(sesion.token() && { Authorization: `Bearer ${sesion.token()}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'Sin conexión con el servidor. Revisa que el backend esté encendido.');
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && !ruta.startsWith('/auth/login')) {
      sesion.borrar();
      if (!location.pathname.startsWith('/admin/login')) location.href = '/admin/login';
    }
    const campos = data.campos as Record<string, string[]> | undefined;
    const detalle = campos ? Object.values(campos).flat().slice(0, 3).join(' · ') : '';
    throw new ApiError(res.status, detalle ? `${data.error}: ${detalle}` : (data.error ?? 'Ocurrió un error'), campos);
  }
  return data as T;
}

export const mensajeError = (e: unknown) => (e instanceof Error ? e.message : 'Ocurrió un error');
