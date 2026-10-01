import type { Metadata } from 'next';
import { ReservationWizard } from '@/components/ReservationWizard';
import { PageHero } from '@/components/ui';
import { api } from '@/lib/api';
import { waLink } from '@/lib/format';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Reservas — Mesas y Zonas VIP',
  description: 'Reserva tu mesa en Mamba Bistro Bar: Salón General, Terraza o Zonas VIP. Confirmación inmediata por WhatsApp.',
  alternates: { canonical: '/reservas' },
};

export default async function ReservasPage({ searchParams }: { searchParams: Promise<{ evento?: string }> }) {
  const [{ evento }, opciones, local] = await Promise.all([searchParams, api.opcionesReserva(), api.local()]);
  return (
    <>
      <PageHero eyebrow="Reservas" title={<>Aparta tu <span className="text-foil">mesa</span></>}>
        Elige la noche, la zona y tu parche. Te confirmamos por WhatsApp en minutos.
      </PageHero>
      <section className="mx-auto max-w-7xl px-4 lg:px-16">
        {opciones.zonas.length ? (
          <ReservationWizard opciones={opciones} whatsapp={local.whatsapp} eventoInicial={evento} />
        ) : (
          <div className="glass mx-auto max-w-lg rounded-3xl p-10 text-center">
            <p className="text-smoke">Las reservas en línea no están disponibles en este momento.</p>
            {local.whatsapp && (
              <a className="btn-gold mt-6" href={waLink(local.whatsapp, 'Hola Mamba, quiero reservar una mesa 🐍')}>
                Reservar por WhatsApp
              </a>
            )}
          </div>
        )}
      </section>
    </>
  );
}
