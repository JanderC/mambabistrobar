import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Manrope, Outfit } from 'next/font/google';
import { api } from '@/lib/api';
import { SITE_URL } from '@/lib/format';
import './globals.css';

const outfit = Outfit({ subsets: ['latin'], weight: ['200', '300', '400', '500'], variable: '--font-outfit', display: 'swap' });
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope', display: 'swap' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500'], style: ['italic'], variable: '--font-cormorant', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const local = await api.local();
  const ciudad = local.ciudad || 'tu ciudad';
  const title = `${local.nombre} | Discoteca, Bar y Restaurante en ${ciudad}`;
  const description = `${local.descripcion ?? ''} Menú de licores y comida rápida, eventos cada fin de semana y reservas VIP en línea en ${ciudad}.`.trim();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s | ${local.nombre}` },
    description,
    keywords: [`discotecas en ${ciudad}`, `bar en ${ciudad}`, `restaurante bar ${ciudad}`, 'restaurante bar cerca de mí', 'zona VIP', 'coctelería de autor', 'Mamba Bistro Bar'],
    openGraph: { type: 'website', locale: 'es_CO', siteName: local.nombre, title, description },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = { themeColor: '#010604', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

/** Layout raíz: solo fuentes y estilos. El sitio público vive en (sitio)/ y el panel en admin/. */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" className={`${outfit.variable} ${manrope.variable} ${cormorant.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
