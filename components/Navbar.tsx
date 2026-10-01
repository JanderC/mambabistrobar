'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV } from '@/lib/nav';
import type { Horario } from '@/lib/types';
import { IconClose, IconMenu } from './icons';
import { LiveStatus } from './LiveStatus';


export function Navbar({ horarios }: { horarios: Horario[] }) {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(scrollY > 30);
    on();
    addEventListener('scroll', on, { passive: true });
    return () => removeEventListener('scroll', on);
  }, []);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
  }, [open]);

  const active = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
          scrolled ? 'border-b border-gold/10 bg-void/70 py-2 backdrop-blur-xl' : 'py-4'
        }`}
      >
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 lg:px-16">
          <Link href="/" className="flex items-center gap-3" aria-label="Mamba Bistro Bar — inicio">
            <span className="relative h-11 w-11 overflow-hidden rounded-full ring-1 ring-gold/40 shadow-[0_0_24px_rgba(212,175,55,.25)]">
              <Image src="/brand/logo.webp" alt="" fill unoptimized className="object-cover" priority />
            </span>
            <span className="hidden leading-none sm:block">
              <span className="block font-display text-sm font-light tracking-[0.5em] text-ivory">MAMBA</span>
              <span className="block font-display text-[9px] tracking-[0.42em] text-gold">BISTRO BAR 2.0</span>
            </span>
          </Link>

          <ul className="hidden items-center gap-1 md:flex">
            {NAV.slice(1).map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className={`relative rounded-full px-4 py-2 font-display text-[11px] tracking-[0.25em] uppercase transition ${
                    active(n.href) ? 'text-gold' : 'text-ivory/70 hover:text-ivory'
                  }`}
                >
                  {n.label}
                  {active(n.href) && <span className="absolute inset-x-4 -bottom-0.5 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3">
            <LiveStatus horarios={horarios} className="hidden lg:inline-flex" />
            <Link href="/reservas" className="btn-gold hidden !px-5 !py-2.5 !text-[10px] md:inline-flex">Reservar</Link>
            <button
              onClick={() => setOpen((o) => !o)}
              className="grid h-11 w-11 place-items-center rounded-full border border-gold/30 text-gold md:hidden"
              aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={open}
            >
              {open ? <IconClose /> : <IconMenu />}
            </button>
          </div>
        </nav>
      </header>

      {/* Menú móvil a pantalla completa */}
      <div
        className={`fixed inset-0 z-40 flex flex-col justify-center bg-void/95 px-8 backdrop-blur-2xl transition-all duration-500 md:hidden ${
          open ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
      >
        <div className="scales pointer-events-none absolute inset-0 opacity-[.06]" />
        <ul className="relative space-y-2">
          {NAV.map((n, i) => (
            <li
              key={n.href}
              style={{ transitionDelay: open ? `${80 + i * 55}ms` : '0ms' }}
              className={`transition-all duration-500 ${open ? 'translate-x-0 opacity-100' : '-translate-x-6 opacity-0'}`}
            >
              <Link href={n.href} className="flex items-baseline gap-4 py-2">
                <span className="font-display text-xs text-gold/60">0{i + 1}</span>
                <span className={`title-xl text-4xl ${active(n.href) ? 'text-gold' : 'text-ivory'}`}>{n.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <LiveStatus horarios={horarios} className="relative mt-10" />
      </div>
    </>
  );
}
