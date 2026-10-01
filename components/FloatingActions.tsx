'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { waLink } from '@/lib/format';
import { IconCalendar, IconWhatsApp } from './icons';

/** WhatsApp siempre visible + barra inferior de reserva en móvil */
export function FloatingActions({ whatsapp }: { whatsapp: string }) {
  const path = usePathname();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const on = () => setVisible(scrollY > 400);
    on();
    addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, []);

  const enReservas = path.startsWith('/reservas');

  return (
    <>
      {whatsapp && (
        <a
          href={waLink(whatsapp, 'Hola Mamba 🐍 quiero información')}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Escríbenos por WhatsApp"
          className="group fixed right-4 bottom-24 z-50 grid h-14 w-14 place-items-center rounded-full bg-[#25d366] text-white shadow-[0_10px_40px_-8px_rgba(37,211,102,.7)] transition hover:scale-110 md:bottom-6"
        >
          <span className="absolute inset-0 animate-ping rounded-full bg-[#25d366]/40 [animation-duration:2.5s]" />
          <IconWhatsApp width={28} height={28} className="relative" />
          <span className="pointer-events-none absolute right-16 hidden rounded-full bg-void/90 px-3 py-1.5 text-xs whitespace-nowrap text-ivory opacity-0 ring-1 ring-gold/20 transition group-hover:opacity-100 md:block">
            ¿Hablamos?
          </span>
        </a>
      )}

      {/* Barra inferior móvil */}
      {!enReservas && (
        <div
          className={`fixed inset-x-3 bottom-3 z-50 transition-all duration-500 md:hidden ${
            visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-24 opacity-0'
          }`}
        >
          <div className="glass flex items-center gap-2 rounded-full p-1.5 shadow-2xl">
            <Link href="/eventos" className="flex flex-1 items-center justify-center gap-2 rounded-full py-3 font-display text-[10px] tracking-[0.2em] text-gold-light uppercase">
              <IconCalendar width={16} /> Eventos
            </Link>
            <Link href="/reservas" className="btn-gold flex-[1.4] !py-3 !text-[10px]">Reservar mesa</Link>
          </div>
        </div>
      )}
    </>
  );
}
