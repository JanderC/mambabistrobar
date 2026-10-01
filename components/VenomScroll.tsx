'use client';

import { useEffect, useRef } from 'react';

/**
 * Una serpiente dorada recorre el borde de la pantalla y se va dibujando
 * a medida que el usuario baja. La cabeza brilla en la punta del trazo.
 * También activa las animaciones `.reveal` de todo el sitio.
 */
const PATH = 'M20 0 C40 60 0 120 20 180 S40 300 20 360 S0 480 20 540 S40 660 20 720 S0 840 20 900 S40 1020 20 1080';

export function VenomScroll() {
  const pathRef = useRef<SVGPathElement>(null);
  const headRef = useRef<SVGCircleElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const path = pathRef.current!;
    const len = path.getTotalLength();
    path.style.strokeDasharray = `${len}`;
    let raf = 0;
    const update = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(1, scrollY / max) : 0;
      path.style.strokeDashoffset = `${len * (1 - p)}`;
      const pt = path.getPointAtLength(len * p);
      headRef.current?.setAttribute('cx', `${pt.x}`);
      headRef.current?.setAttribute('cy', `${pt.y}`);
      if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
      raf = 0;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);

    // Revelado de secciones
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add('is-visible'), io.unobserve(e.target))),
      { rootMargin: '0px 0px -8% 0px' },
    );
    const observeAll = () => document.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => io.observe(el));
    observeAll();
    const mo = new MutationObserver(observeAll);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <>
      {/* Escritorio: serpiente lateral */}
      <svg
        className="pointer-events-none fixed top-0 left-3 z-40 hidden h-screen w-10 lg:block"
        viewBox="0 0 40 1080"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={PATH} fill="none" stroke="rgba(212,175,55,.08)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <path ref={pathRef} d={PATH} fill="none" stroke="url(#venom-g)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
        <defs>
          <linearGradient id="venom-g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8a6a1b" />
            <stop offset=".5" stopColor="#f6e3a1" />
            <stop offset="1" stopColor="#3dffb0" />
          </linearGradient>
        </defs>
        <circle ref={headRef} r="5" fill="#f6e3a1" style={{ filter: 'drop-shadow(0 0 6px #d4af37)' }} />
      </svg>
      {/* Móvil: barra de progreso dorada */}
      <div
        ref={barRef}
        className="fixed inset-x-0 top-0 z-[70] h-[2px] origin-left scale-x-0 bg-gradient-to-r from-gold-dark via-gold-light to-venom lg:hidden"
      />
    </>
  );
}
