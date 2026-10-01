'use client';

import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';
import { adm, sesion } from '@/lib/admin/api';
import type { Rol } from '@/lib/admin/modulos';
import { Cargando } from './ui';

export type Usuario = { id: number; nombre: string; email: string; rol: Rol };

const Ctx = createContext<{ usuario: Usuario | null; salir: () => void; es: (...roles: Rol[]) => boolean }>({
  usuario: null, salir: () => {}, es: () => false,
});
export const useSesion = () => useContext(Ctx);

/** Protege todo /admin: sin sesión válida manda al login */
export function SesionProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const enLogin = pathname === '/admin/login';
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (enLogin) {
      setListo(true);
      return;
    }
    if (usuario) return;
    if (!sesion.token()) {
      router.replace('/admin/login');
      return;
    }
    adm<Usuario>('/auth/yo')
      .then((u) => {
        setUsuario(u);
        setListo(true);
      })
      .catch(() => router.replace('/admin/login'));
  }, [enLogin, router, usuario]);

  const salir = useCallback(() => {
    sesion.borrar();
    setUsuario(null);
    router.replace('/admin/login');
  }, [router]);

  const es = useCallback((...roles: Rol[]) => !!usuario && (usuario.rol === 'admin' || roles.includes(usuario.rol)), [usuario]);

  if (!enLogin && (!listo || !usuario)) return <div className="grid min-h-dvh place-items-center"><Cargando texto="Abriendo el panel…" /></div>;
  return <Ctx.Provider value={{ usuario, salir, es }}>{children}</Ctx.Provider>;
}
