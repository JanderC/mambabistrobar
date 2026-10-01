import { ImageResponse } from 'next/og';
import { SERPENT_PATH } from '@/components/SerpentMark';

export const alt = 'Mamba Bistro Bar 2.0';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Imagen para compartir en WhatsApp / redes (se genera sola) */
export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 0%, #0b4a35 0%, #03110c 55%, #010604 100%)', color: '#f4eedc',
        }}
      >
        <svg width="560" height="256" viewBox="0 0 480 220">
          <path d={SERPENT_PATH} fill="none" stroke="#d4af37" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" />
          <path d={SERPENT_PATH} fill="none" stroke="#06110d" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{ fontSize: 110, letterSpacing: 40, color: '#d4af37', marginTop: 10, fontWeight: 200 }}>MAMBA</div>
        <div style={{ fontSize: 30, letterSpacing: 16, color: '#f6e3a1' }}>BISTRO BAR 2.0</div>
      </div>
    ),
    size,
  );
}
