import type { MetadataRoute } from 'next';
import { api } from '@/lib/api';
import { SITE_URL } from '@/lib/format';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const eventos = await api.eventos('proximos', 50);
  const estaticas = ['', '/menu', '/eventos', '/reservas', '/galeria', '/contacto'].map((p) => ({
    url: `${SITE_URL}${p}`,
    changeFrequency: p === '/eventos' || p === '' ? ('daily' as const) : ('weekly' as const),
    priority: p === '' ? 1 : 0.8,
  }));
  return [
    ...estaticas,
    ...eventos.map((e) => ({ url: `${SITE_URL}/eventos/${e.slug}`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.7 })),
  ];
}
