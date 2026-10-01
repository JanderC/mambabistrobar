import Link from 'next/link';
import { EventCard } from '@/components/EventCard';
import { Hero } from '@/components/Hero';
import { IconArrow, IconClock, IconInstagram, IconPin, IconStar } from '@/components/icons';
import { LiveStatus } from '@/components/LiveStatus';
import { Marquee, SectionHeading } from '@/components/ui';
import { api } from '@/lib/api';
import { DIAS, fechaEvento, formatCOP, formatMoneda, linksMapa } from '@/lib/format';

export const revalidate = 60;

export default async function HomePage() {
  const [local, eventos, promos, destacados, opciones] = await Promise.all([
    api.local(), api.eventos('proximos', 6), api.promociones(), api.destacados(), api.opcionesReserva(),
  ]);
  const proximo = eventos[0];
  const mapa = linksMapa(local);

  return (
    <>
      <Hero
        eslogan={local.eslogan}
        proximo={proximo ? { titulo: proximo.titulo, slug: proximo.slug, fecha: `${fechaEvento(proximo.inicia_en).semana} ${fechaEvento(proximo.inicia_en).dia}` } : null}
      />

      <Marquee items={['Coctelería de autor', 'DJs en vivo', 'Zonas VIP', 'Cocina hasta tarde', 'Noches temáticas', 'Bistro Bar 2.0']} className="-rotate-1" />

      {/* Cartelera */}
      <section className="mx-auto max-w-7xl px-4 py-24 lg:px-16">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading eyebrow="Cartelera" title={<>Este <span className="text-foil">finde</span></>}>
            Fiestas, DJs invitados y noches temáticas. Reserva antes de que se llenen las mesas.
          </SectionHeading>
          <Link href="/eventos" className="btn-ghost reveal mb-10 self-start md:self-auto">Ver todos <IconArrow width={16} /></Link>
        </div>
        {eventos.length ? (
          <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
            {eventos.slice(0, 3).map((e, i) => (
              <div key={e.id} className="reveal w-[80vw] shrink-0 snap-center md:w-auto" style={{ transitionDelay: `${i * 120}ms` }}>
                <EventCard evento={e} priority={i === 0} />
              </div>
            ))}
          </div>
        ) : (
          <p className="glass rounded-2xl p-8 text-center text-smoke">Muy pronto anunciamos la próxima fiesta. Síguenos en redes 🐍</p>
        )}
      </section>

      {/* Promos */}
      {promos.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-24 lg:px-16">
          <div className="grid gap-4 md:grid-cols-3">
            {promos.map((p, i) => (
              <article key={p.id} className="reveal border-gold-gradient group relative overflow-hidden rounded-3xl p-7" style={{ transitionDelay: `${i * 100}ms` }}>
                <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-emerald-glow/30 blur-3xl transition group-hover:bg-gold/30" />
                <p className="eyebrow !text-[9px]">{p.dias_semana.length ? p.dias_semana.map((d) => DIAS[d]).join(' · ') : 'Todos los días'}</p>
                <h3 className="mt-3 font-display text-2xl font-light text-ivory">{p.titulo}</h3>
                <p className="mt-2 text-sm text-smoke">{p.descripcion}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* La carta */}
      <section className="relative overflow-hidden py-24">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-void via-jungle/60 to-void" />
        <div className="mx-auto max-w-7xl px-4 lg:px-16">
          <SectionHeading eyebrow="La carta" title={<>Veneno <span className="font-serif text-gold normal-case italic">líquido</span> & bocados</>}>
            Licores premium por botella, media o trago; coctelería de autor, hamburguesas, desgranados y picadas para compartir.
          </SectionHeading>
          <div className="grid gap-px overflow-hidden rounded-3xl bg-gold/15 sm:grid-cols-2 lg:grid-cols-4">
            {destacados.slice(0, 8).map((p, i) => (
              <Link href="/menu" key={p.id} className="reveal group relative bg-abyss p-6 transition hover:bg-jungle" style={{ transitionDelay: `${(i % 4) * 80}ms` }}>
                <span className="text-3xl">{p.icono}</span>
                <p className="mt-4 text-[10px] tracking-[0.3em] text-gold uppercase">{p.categoria}</p>
                <h3 className="mt-1 font-display text-xl text-ivory">{p.nombre}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-smoke">{p.descripcion}</p>
                {p.precios[0] && <p className="mt-4 font-display text-lg text-gold-light">{p.precios.length > 1 ? 'Desde ' : ''}{formatMoneda(Math.min(...p.precios.map((x) => x.precio)), p.precios[0].moneda)}</p>}
                <IconArrow className="absolute top-6 right-6 text-gold opacity-0 transition group-hover:opacity-100" width={18} />
              </Link>
            ))}
          </div>
          <div className="mt-10 text-center"><Link href="/menu" className="btn-gold">Ver menú completo</Link></div>
        </div>
      </section>

      {/* Zonas VIP */}
      {opciones.zonas.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-24 lg:px-16">
          <SectionHeading eyebrow="Reservas" title={<>Tu <span className="text-foil">nido</span> para la noche</>}>
            Del Salón General al Nido de la Mamba. Reserva en 30 segundos y confirma con nuestro RRPP por WhatsApp.
          </SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {opciones.zonas.map((z, i) => (
              <Link
                href="/reservas"
                key={z.slug}
                className={`reveal group relative flex min-h-64 flex-col justify-end overflow-hidden rounded-3xl p-6 transition hover:-translate-y-1 ${z.es_vip ? 'border-gold-gradient' : 'glass'}`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className={`scales absolute inset-0 opacity-[.08] transition group-hover:opacity-20 ${z.es_vip ? '' : 'hue-rotate-90'}`} />
                {z.es_vip && <span className="absolute top-5 left-6 flex items-center gap-1 font-display text-[10px] tracking-[0.3em] text-gold"><IconStar width={12} /> VIP</span>}
                <p className="relative font-display text-5xl font-extralight text-gold/25">0{i + 1}</p>
                <h3 className="relative mt-2 font-display text-xl text-ivory">{z.nombre}</h3>
                <p className="relative mt-1 text-sm text-smoke">{z.descripcion}</p>
                <p className="relative mt-4 text-xs text-gold-light">{z.consumo_minimo_cop ? `Consumo mín. ${formatCOP(z.consumo_minimo_cop)}` : 'Sin consumo mínimo'}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Ubicación */}
      <section className="mx-auto max-w-7xl px-4 py-12 lg:px-16">
        <div className="reveal border-gold-gradient grid overflow-hidden rounded-[2rem] md:grid-cols-2">
          <div className="p-8 sm:p-12">
            <p className="eyebrow mb-4">Encuéntranos</p>
            <h2 className="title-xl text-4xl sm:text-5xl">Sigue el <span className="text-foil">rastro</span></h2>
            <p className="mt-6 flex gap-2 text-smoke"><IconPin className="mt-0.5 shrink-0 text-gold" width={18} /> {local.direccion}{local.ciudad && `, ${local.ciudad}`}</p>
            <p className="mt-3 flex gap-2 text-smoke"><IconClock className="mt-0.5 shrink-0 text-gold" width={18} /> <LiveStatus horarios={local.horarios} className="!text-sm" /></p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={mapa.google} target="_blank" rel="noopener noreferrer" className="btn-gold">Cómo llegar</a>
              <a href={mapa.waze} target="_blank" rel="noopener noreferrer" className="btn-ghost">Waze</a>
            </div>
          </div>
          <iframe
            title="Mapa de ubicación"
            src={mapa.embed}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-80 w-full border-0 opacity-90 [filter:invert(.92)_hue-rotate(160deg)_saturate(.6)_contrast(.9)] md:h-full"
          />
        </div>
      </section>

      {/* Redes */}
      {local.instagram && (
        <section className="mx-auto max-w-7xl px-4 py-24 text-center lg:px-16">
          <SectionHeading align="center" eyebrow="Síguenos" title={<>@{local.instagram}</>}>
            Fotos, reels y anuncios de las fiestas antes que nadie.
          </SectionHeading>
          <div className="flex justify-center gap-3">
            <a href={`https://instagram.com/${local.instagram}`} target="_blank" rel="noopener noreferrer" className="btn-ghost"><IconInstagram width={16} /> Instagram</a>
            <Link href="/galeria" className="btn-gold">Ver galería</Link>
          </div>
        </section>
      )}
    </>
  );
}
