'use client';

import { useState } from 'react';
import { IconCheck, IconInstagram, IconLink, IconShare, IconWhatsApp } from './icons';

/** Compartir por WhatsApp, Stories (menú nativo del celular) o copiar enlace */
export function ShareButtons({ url, titulo, texto }: { url: string; titulo: string; texto: string }) {
  const [copiado, setCopiado] = useState(false);
  const mensaje = `${texto}\n${url}`;

  const nativo = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: titulo, text: texto, url }); } catch { /* cancelado */ }
    } else copiar();
  };
  const copiar = async () => {
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  const cls = 'flex items-center gap-2 rounded-full border border-gold/25 px-4 py-2.5 text-xs text-ivory/90 transition hover:border-gold hover:bg-gold/10';
  return (
    <div className="flex flex-wrap gap-2">
      <a href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`} target="_blank" rel="noopener noreferrer" className={cls}>
        <IconWhatsApp width={16} className="text-[#25d366]" /> WhatsApp
      </a>
      <button onClick={nativo} className={cls} title="En el celular abre el menú para compartir en Instagram Stories">
        <IconInstagram width={16} className="text-[#e1306c]" /> Stories
      </button>
      <button onClick={nativo} className={`${cls} sm:hidden`}>
        <IconShare width={16} className="text-gold" /> Más
      </button>
      <button onClick={copiar} className={cls}>
        {copiado ? <IconCheck width={16} className="text-venom" /> : <IconLink width={16} className="text-gold" />}
        {copiado ? '¡Copiado!' : 'Copiar enlace'}
      </button>
    </div>
  );
}
