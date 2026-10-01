import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EventFlyer } from '@/components/EventFlyer';
import { IconArrow, IconCalendar, IconClock, IconInstagram } from '@/components/icons';
import { RecordarEvento } from '@/components/RecordarEvento';
import { ShareButtons } from '@/components/ShareButtons';
import { api } from '@/lib/api';
import { SITE_URL, fechaEvento, formatCOP } from '@/lib/format';

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const evento = await api.evento((await params).slug);
  if (!evento) return { title: 'Evento no encontrado' };
  const f = fechaEvento(evento.inicia_en);
  return {
    title: `${evento.titulo} — ${f.larga}`,
    description: evento.descripcion ?? `${evento.titulo} en Mamba Bistro Bar`,
    alternates: { canonical: `/eventos/${evento.slug}` },
    openGraph: evento.flyer_url ? { images: [evento.flyer_url] } : undefined,
  };
}

export default async function EventoPage({ params }: Props) {
  const { slug } = await params;
  const [evento, local] = await Promise.all([api.evento(slug), api.local()]);
  if (!evento) notFound();
  const f = fechaEvento(evento.inicia_en);
  const fin = evento.termina_en ? fechaEvento(evento.termina_en) : null;
  const pasado = new Date(evento.termina_en ?? evento.inicia_en).getTime() < Date.now();
  const url = `${SITE_URL}/eventos/${evento.slug}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: evento.titulo,
    description: evento.descripcion,
    startDate: evento.inicia_en,
    endDate: evento.termina_en ?? undefined,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: local.nombre, address: `${local.direccion}, ${local.ciudad}` },
    performer: evento.artistas.map((a) => ({ '@type': 'Person', name: a.nombre })),
    offers: { '@type': 'Offer', price: evento.cover_cop ?? 0, priceCurrency: 'COP', url },
    image: evento.flyer_url ?? undefined,
  };

  return (
    <article className="relative isolate px-4 pt-32 pb-10 lg:px-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="absolute inset-x-0 top-0 -z-10 h-[70vh] bg-[radial-gradient(80%_70%_at_30%_0%,#0b4a35,transparent)]" />
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <EventFlyer evento={evento} className="rounded-3xl shadow-[0_40px_120px_-30px_rgba(212,175,55,.35)] ring-1 ring-gold/30" priority />
        </div>

        <div>
          <Link href="/eventos" className="eyebrow mb-6 inline-flex items-center gap-2 !text-smoke hover:!text-gold">
            <IconArrow width={14} className="rotate-180" /> Cartelera
          </Link>
          {evento.tematica && <p className="eyebrow mb-3">{evento.tematica}</p>}
          <h1 className="title-xl text-[clamp(2.8rem,10vw,5.5rem)] text-foil">{evento.titulo}</h1>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="glass rounded-2xl p-4">
              <IconCalendar className="text-gold" width={18} />
              <p className="mt-2 text-xs text-smoke">Fecha</p>
              <p className="font-display first-letter:uppercase">{f.larga}</p>
            </div>
            <div className="glass rounded-2xl p-4">
              <IconClock className="text-gold" width={18} />
              <p className="mt-2 text-xs text-smoke">Hora</p>
              <p className="font-display">
                {f.hora}
                {fin && ` – ${fin.hora}`}
              </p>
            </div>
            <div className="border-gold-gradient col-span-2 rounded-2xl p-4">
              <p className="text-xs text-smoke">Cover / Entrada</p>
              <p className="font-display text-2xl text-gold-light">{evento.cover_cop ? formatCOP(evento.cover_cop) : 'Entrada libre'}</p>
              {evento.nota_cover && <p className="mt-1 text-sm text-smoke">{evento.nota_cover}</p>}
            </div>
          </div>

          {evento.descripcion && <p className="mt-8 text-lg leading-relaxed text-ivory/85">{evento.descripcion}</p>}

          {evento.artistas.length > 0 && (
            <div className="mt-10">
              <p className="eyebrow mb-4">Line-up</p>
              <ul className="divide-y divide-gold/10 border-y border-gold/10">
                {evento.artistas.map((a) => (
                  <li key={a.nombre} className="flex items-center justify-between py-4">
                    <div>
                      <p className="font-display text-2xl font-light">{a.nombre}</p>
                      <p className="text-xs tracking-[0.2em] text-gold uppercase">{a.rol}</p>
                    </div>
                    {a.instagram && (
                      <a
                        href={`https://instagram.com/${a.instagram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="grid h-10 w-10 place-items-center rounded-full border border-gold/30 text-gold hover:bg-gold hover:text-void"
                        aria-label={`Instagram de ${a.nombre}`}
                      >
                        <IconInstagram width={18} />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!pasado && (
            <Link href={`/reservas?evento=${evento.slug}`} className="btn-gold mt-10 w-full sm:w-auto">
              Reservar mesa para esta noche <IconArrow width={16} />
            </Link>
          )}

          {!pasado && (
            <div className="mt-8">
              <p className="eyebrow mb-4">Que no se te pase</p>
              <RecordarEvento slug={evento.slug} titulo={evento.titulo} iniciaEn={evento.inicia_en} terminaEn={evento.termina_en} lugar={`${local.nombre}, ${local.direccion}, ${local.ciudad}`} />
            </div>
          )}

          <div className="mt-10">
            <p className="eyebrow mb-4">Compártelo con tu parche</p>
            <ShareButtons url={url} titulo={evento.titulo} texto={`🐍 ${evento.titulo} en Mamba Bistro Bar — ${f.larga}, ${f.hora}`} />
          </div>
        </div>
      </div>
    </article>
  );
}
