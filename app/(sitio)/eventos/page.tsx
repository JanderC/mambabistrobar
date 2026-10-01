import type { Metadata } from 'next';
import { EventCard } from '@/components/EventCard';
import { PageHero, SectionHeading } from '@/components/ui';
import { api } from '@/lib/api';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Eventos y Fiestas',
  description: 'Cartelera de Mamba Bistro Bar: fiestas temáticas, DJs invitados, artistas en vivo y cover de cada noche.',
  alternates: { canonical: '/eventos' },
};

export default async function EventosPage() {
  const [proximos, pasados] = await Promise.all([api.eventos('proximos', 30), api.eventos('pasados', 9)]);
  return (
    <>
      <PageHero eyebrow="Cartelera" title={<>Las <span className="text-foil">noches</span></>}>
        Cada fin de semana la Mamba muda de piel. Mira lo que viene, comparte con tu parche y reserva.
      </PageHero>

      <section className="mx-auto max-w-7xl px-4 lg:px-16">
        {proximos.length ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {proximos.map((e, i) => (
              <div key={e.id} className="reveal" style={{ transitionDelay: `${(i % 3) * 100}ms` }}>
                <EventCard evento={e} priority={i < 2} />
              </div>
            ))}
          </div>
        ) : (
          <p className="glass rounded-2xl p-10 text-center text-smoke">
            Estamos preparando la próxima fiesta. Síguenos en Instagram para enterarte primero 🐍
          </p>
        )}
      </section>

      {pasados.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-28 lg:px-16">
          <SectionHeading eyebrow="Ya pasó" title="Noches que dejaron huella" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pasados.map((e) => (
              <div key={e.id} className="reveal">
                <EventCard evento={e} pasado />
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
