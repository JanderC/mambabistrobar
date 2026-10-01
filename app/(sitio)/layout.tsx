import type { Metadata } from 'next';
import { FloatingActions } from '@/components/FloatingActions';
import { Footer } from '@/components/Footer';
import { Navbar } from '@/components/Navbar';
import { VenomScroll } from '@/components/VenomScroll';
import { api } from '@/lib/api';
import { SITE_URL } from '@/lib/format';

export const metadata: Metadata = { alternates: { canonical: '/' } };

/** Sitio público: navegación, pie, botones flotantes y datos estructurados para Google */
export default async function SitioLayout({ children }: { children: React.ReactNode }) {
  const local = await api.local();

  // Negocio local: ayuda a aparecer en "bar cerca de mí"
  const diasSchema = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': ['BarOrPub', 'NightClub', 'Restaurant'],
    name: local.nombre,
    description: local.descripcion,
    url: SITE_URL,
    image: `${SITE_URL}/brand/logo-esmeralda.png`,
    logo: `${SITE_URL}/brand/logo-esmeralda.png`,
    telephone: local.telefono,
    servesCuisine: ['Comida rápida', 'Picadas', 'Coctelería'],
    priceRange: '$$',
    menu: `${SITE_URL}/menu`,
    acceptsReservations: true,
    address: { '@type': 'PostalAddress', streetAddress: local.direccion, addressLocality: local.ciudad, addressRegion: local.departamento, addressCountry: 'CO' },
    ...(local.latitud != null && { geo: { '@type': 'GeoCoordinates', latitude: local.latitud, longitude: local.longitud } }),
    openingHoursSpecification: local.horarios.filter((h) => h.abierto).map((h) => ({
      '@type': 'OpeningHoursSpecification', dayOfWeek: diasSchema[h.dia_semana], opens: h.hora_apertura, closes: h.hora_cierre,
    })),
    sameAs: [local.instagram && `https://instagram.com/${local.instagram}`, local.tiktok && `https://tiktok.com/@${local.tiktok}`].filter(Boolean),
  };

  return (
    <div className="grain">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <VenomScroll />
      <Navbar horarios={local.horarios} />
      <main>{children}</main>
      <Footer local={local} />
      <FloatingActions whatsapp={local.whatsapp} />
    </div>
  );
}
