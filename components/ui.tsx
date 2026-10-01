import type { ReactNode } from 'react';

export function SectionHeading({
  eyebrow, title, children, align = 'left',
}: { eyebrow: string; title: ReactNode; children?: ReactNode; align?: 'left' | 'center' }) {
  return (
    <div className={`reveal mb-10 max-w-2xl ${align === 'center' ? 'mx-auto text-center' : ''}`}>
      <p className="eyebrow mb-4 flex items-center gap-3 [.text-center_&]:justify-center">
        <span className="h-px w-8 bg-gold/60" /> {eyebrow}
      </p>
      <h2 className="title-xl text-[clamp(2.2rem,7vw,4.2rem)] text-ivory">{title}</h2>
      {children && <p className="mt-5 text-base leading-relaxed text-smoke">{children}</p>}
    </div>
  );
}

export function Marquee({ items, className = '' }: { items: string[]; className?: string }) {
  const row = [...items, ...items];
  return (
    <div className={`relative overflow-hidden border-y border-gold/20 bg-gradient-to-r from-emerald/40 via-jungle to-emerald/40 py-4 ${className}`}>
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
        {row.map((t, i) => (
          <span key={i} className="flex items-center gap-10 font-display text-lg font-extralight tracking-[0.35em] text-ivory/90 uppercase sm:text-2xl">
            {t} <span className="text-foil">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function PageHero({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative isolate overflow-hidden px-4 pt-36 pb-14 lg:px-16">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(90%_70%_at_50%_0%,#0b4a35_0%,#03110c_50%,#010604_100%)]" />
      <div className="scales absolute inset-0 -z-10 opacity-[.07] [mask-image:linear-gradient(to_bottom,#000,transparent)]" />
      <div className="mx-auto max-w-7xl">
        <p className="eyebrow mb-5 flex items-center gap-3"><span className="h-px w-8 bg-gold/60" /> {eyebrow}</p>
        <h1 className="title-xl text-[clamp(2.8rem,11vw,6.5rem)]">{title}</h1>
        {children && <div className="mt-6 max-w-xl text-smoke">{children}</div>}
      </div>
    </section>
  );
}

export function Tag({ children, gold = false }: { children: ReactNode; gold?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] tracking-[0.15em] uppercase ${
        gold ? 'bg-gold/15 text-gold-light ring-1 ring-gold/40' : 'bg-emerald/40 text-venom/90 ring-1 ring-venom/20'
      }`}
    >
      {children}
    </span>
  );
}
