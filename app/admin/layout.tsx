'use client';

import { usePathname } from 'next/navigation';
import { SesionProvider } from '@/components/admin/Sesion';
import { Shell } from '@/components/admin/Shell';
import { AvisosProvider } from '@/components/admin/ui';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const enLogin = usePathname() === '/admin/login';
  return (
    <AvisosProvider>
      <SesionProvider>{enLogin ? children : <Shell>{children}</Shell>}</SesionProvider>
    </AvisosProvider>
  );
}
