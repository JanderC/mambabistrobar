import type { MetadataRoute } from 'next';

/**
 * PWA: al añadir la app a la pantalla de inicio (tablets del local) abre directo el panel.
 * Next.js sirve esto en /manifest.webmanifest y agrega el <link rel="manifest"> en todas las páginas.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/admin',
    name: 'Mamba Bistro Bar 2.0',
    short_name: 'Mamba',
    description: 'Panel de Mamba Bistro Bar: mesas, comandas, caja e inventario',
    lang: 'es-CO',
    dir: 'ltr',
    start_url: '/admin',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'any',
    background_color: '#010604',
    theme_color: '#010604',
    categories: ['business', 'food'],
    icons: [
      { src: '/brand/logo-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png', purpose: 'any' },
    ],
  };
}
