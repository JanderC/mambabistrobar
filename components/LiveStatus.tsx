'use client';

import { useEffect, useState } from 'react';
import { estadoApertura } from '@/lib/format';
import type { Horario } from '@/lib/types';

/** "Abierto · cierra 3 a.m." en vivo (se calcula en el navegador para evitar desfaces de caché) */
export function LiveStatus({ horarios, className = '' }: { horarios: Horario[]; className?: string }) {
  const [estado, setEstado] = useState<ReturnType<typeof estadoApertura>>(null);
  useEffect(() => {
    const upd = () => setEstado(estadoApertura(horarios));
    upd();
    const id = setInterval(upd, 60_000);
    return () => clearInterval(id);
  }, [horarios]);
  if (!estado) return null;
  return (
    <span className={className}>
      <span className="inline-flex items-center gap-2 text-xs">
      <span className={`h-2 w-2 rounded-full ${estado.abierto ? 'bg-venom animate-pulse-ring' : 'bg-gold/70'}`} />
      <span className={estado.abierto ? 'text-venom' : 'text-smoke'}>{estado.texto}</span>
      </span>
    </span>
  );
}
