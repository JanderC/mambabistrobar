'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { formatMoneda } from '@/lib/format';
import type { Categoria, Producto } from '@/lib/types';
import { IconSearch, IconStar } from './icons';
import { Tag } from './ui';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function MenuBrowser({ categorias, mesa }: { categorias: Categoria[]; mesa?: string }) {
  const [q, setQ] = useState('');
  const [activa, setActiva] = useState(categorias[0]?.slug ?? '');
  const chipsRef = useRef<HTMLDivElement>(null);

  const filtradas = useMemo(() => {
    if (!q.trim()) return categorias;
    const n = norm(q);
    return categorias
      .map((c) => ({
        ...c,
        productos: c.productos.filter((p) => norm(`${p.nombre} ${p.descripcion ?? ''} ${p.ingredientes.join(' ')} ${p.etiquetas.join(' ')}`).includes(n)),
      }))
      .filter((c) => c.productos.length);
  }, [q, categorias]);

  // Scrollspy: resalta la categoría visible
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setActiva(vis.target.id.replace('cat-', ''));
      },
      { rootMargin: '-140px 0px -60% 0px' },
    );
    document.querySelectorAll('[id^="cat-"]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [filtradas]);

  // Mantiene el chip activo visible
  useEffect(() => {
    chipsRef.current?.querySelector(`[data-slug="${activa}"]`)?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activa]);

  const ir = (slug: string) => {
    const el = document.getElementById(`cat-${slug}`);
    if (el) scrollTo({ top: el.getBoundingClientRect().top + scrollY - 130, behavior: 'smooth' });
  };

  if (!categorias.length)
    return <p className="glass mx-auto max-w-md rounded-2xl p-8 text-center text-smoke">El menú se está preparando. Pídelo a tu mesero o escríbenos por WhatsApp. 🐍</p>;

  return (
    <div>
      {mesa && (
        <div className="border-gold-gradient mb-6 flex items-center justify-between rounded-2xl px-5 py-4">
          <div>
            <p className="eyebrow !text-[9px]">Estás en</p>
            <p className="title-xl text-2xl text-gold-light">Mesa {mesa}</p>
          </div>
          <p className="max-w-[55%] text-right text-xs text-smoke">Haz tu pedido a tu mesero con el nombre del producto 🙌</p>
        </div>
      )}

      {/* Barra fija: búsqueda + categorías */}
      <div className="sticky top-[60px] z-30 -mx-4 border-b border-gold/10 bg-void/85 px-4 pt-3 pb-3 backdrop-blur-xl lg:-mx-16 lg:px-16">
        <label className="relative mb-3 block">
          <IconSearch className="absolute top-1/2 left-4 -translate-y-1/2 text-gold/70" width={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Busca: whisky, picada, mojito…"
            className="w-full rounded-full border border-gold/20 bg-abyss/80 py-3 pr-4 pl-11 text-sm text-ivory placeholder:text-smoke/60 focus:border-gold focus:outline-none"
          />
        </label>
        <div ref={chipsRef} className="no-scrollbar flex gap-2 overflow-x-auto">
          {filtradas.map((c) => (
            <button
              key={c.slug}
              data-slug={c.slug}
              onClick={() => ir(c.slug)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs whitespace-nowrap transition ${
                activa === c.slug ? 'bg-gold text-void shadow-[0_0_20px_rgba(212,175,55,.4)]' : 'border border-gold/20 text-ivory/80'
              }`}
            >
              <span>{c.icono}</span> {c.nombre}
            </button>
          ))}
        </div>
      </div>

      {!filtradas.length && <p className="py-16 text-center text-smoke">No encontramos “{q}”. Prueba con otra palabra.</p>}

      <div className="mt-8 space-y-16">
        {filtradas.map((c) => (
          <section key={c.slug} id={`cat-${c.slug}`} className="scroll-mt-40">
            <header className="mb-6 flex items-end gap-4">
              <span className="text-4xl">{c.icono}</span>
              <div className="flex-1 border-b border-gold/20 pb-2">
                <h2 className="title-xl text-3xl text-gold-light sm:text-4xl">{c.nombre}</h2>
                {c.descripcion && <p className="mt-1 text-sm text-smoke">{c.descripcion}</p>}
              </div>
            </header>
            <div className="grid gap-4 md:grid-cols-2">
              {c.productos.map((p) => <ProductoCard key={p.id} p={p} />)}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-14 text-center text-xs text-smoke/60">Precios con impuestos incluidos. Propina voluntaria sugerida del 10%. Recibimos pesos, dólares y bolívares a la tasa del día.</p>
    </div>
  );
}

function ProductoCard({ p }: { p: Producto }) {
  return (
    <article className={`group relative overflow-hidden rounded-2xl p-5 transition ${p.destacado ? 'border-gold-gradient' : 'glass'} hover:-translate-y-0.5`}>
      {p.destacado && <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-gold/15 blur-2xl" />}
      <div className="flex gap-4">
        {p.imagen_url && (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
            <Image src={p.imagen_url} alt={p.nombre} fill sizes="80px" className="object-cover" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg font-medium text-ivory">{p.nombre}</h3>
            {p.destacado && <IconStar width={14} className="text-gold" />}
          </div>
          {p.descripcion && <p className="mt-1 text-sm leading-relaxed text-smoke">{p.descripcion}</p>}
          {p.etiquetas.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.etiquetas.map((t) => <Tag key={t} gold={t === 'premium' || t === 'insignia'}>{t}</Tag>)}
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {p.precios.map((pr) => (
          <div key={pr.presentacion} className="flex items-baseline gap-2 rounded-xl bg-void/50 px-3 py-2 ring-1 ring-gold/15">
            <span className="text-[10px] tracking-[0.15em] text-smoke uppercase">{pr.presentacion}</span>
            <span className="font-display text-base font-medium text-gold-light">{formatMoneda(pr.precio, pr.moneda)}</span>
          </div>
        ))}
      </div>
    </article>
  );
}
