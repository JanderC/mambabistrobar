import type { Metadata, Viewport } from 'next';
import { PedirQR } from '@/components/PedirQR';

export const metadata: Metadata = {
  title: 'Pide desde tu mesa',
  description: 'Carta digital de Mamba Bistro Bar: elige y envía tu pedido a la barra desde el celular.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#010604', width: 'device-width', initialScale: 1, maximumScale: 1, viewportFit: 'cover' };

/** Lo que abre el QR pegado en cada mesa: /pedir/<código de la mesa> */
export default async function PedirPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PedirQR token={token} />;
}
