import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mamba Bistro Bar 2.0',
    short_name: 'Mamba',
    description: 'Menú, eventos y reservas VIP',
    start_url: '/',
    display: 'standalone',
    background_color: '#010604',
    theme_color: '#010604',
    icons: [{ src: '/brand/logo-512.png', sizes: '512x512', type: 'image/png' }],
  };
}
