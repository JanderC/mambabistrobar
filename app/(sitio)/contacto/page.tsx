import type { Metadata } from 'next';
import { IconInstagram, IconPin, IconTikTok, IconWaze, IconWhatsApp } from '@/components/icons';
import { LiveStatus } from '@/components/LiveStatus';
import { PageHero } from '@/components/ui';
import { api } from '@/lib/api';
import { DIAS, ahoraColombia, hora12, linksMapa, waLink } from '@/lib/format';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Ubicación, Horarios y Contacto',
  description: 'Cómo llegar a Mamba Bistro Bar con Google Maps o Waze, horarios de atención, cierre de cocina y barra, y redes sociales.',
  alternates: { canonical: '/contacto' },
};

export default async function ContactoPage() {
  const local = await api.local();
  const mapa = linksMapa(local);
  const hoy = ahoraColombia().dia;

  return (
    <>
      <PageHero eyebrow="Contacto" title={<>Ven a la <span className="text-foil">guarida</span></>}>
        <LiveStatus horarios={local.horarios} className="!text-sm" />
      </PageHero>

      <section className="mx-auto grid max-w-7xl gap-8 px-4 lg:grid-cols-[1.3fr_1fr] lg:px-16">
        <div className="reveal border-gold-gradient overflow-hidden rounded-[2rem]">
          <iframe
            title="Mapa de ubicación de Mamba Bistro Bar"
            src={mapa.embed}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="h-[380px] w-full border-0 [filter:invert(.92)_hue-rotate(160deg)_saturate(.6)_contrast(.9)] lg:h-[520px]"
          />
          <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex gap-2 text-smoke">
              <IconPin className="mt-0.5 shrink-0 text-gold" width={18} />
              {local.direccion}
              {local.ciudad && `, ${local.ciudad}`}
            </p>
            <div className="flex gap-2">
              <a href={mapa.google} target="_blank" rel="noopener noreferrer" className="btn-gold !px-5">Google Maps</a>
              <a href={mapa.waze} target="_blank" rel="noopener noreferrer" className="btn-ghost !px-5"><IconWaze width={16} /> Waze</a>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="reveal glass rounded-[2rem] p-6">
            <p className="eyebrow mb-4">Horarios</p>
            <ul className="space-y-1">
              {local.horarios.map((h) => (
                <li
                  key={h.dia_semana}
                  className={`rounded-xl px-3 py-2.5 ${h.dia_semana === hoy ? 'bg-gold/10 ring-1 ring-gold/30' : ''}`}
                >
                  <div className="flex justify-between gap-4">
                    <span className={h.dia_semana === hoy ? 'font-medium text-gold' : 'text-ivory/85'}>
                      {DIAS[h.dia_semana]} {h.dia_semana === hoy && <span className="text-[10px] tracking-widest uppercase">· hoy</span>}
                    </span>
                    <span className={h.abierto ? 'text-ivory' : 'text-smoke/50'}>
                      {h.abierto ? `${hora12(h.hora_apertura)} – ${hora12(h.hora_cierre)}` : 'Cerrado'}
                    </span>
                  </div>
                  {h.abierto && (h.cierre_cocina || h.cierre_barra) && (
                    <p className="mt-0.5 text-[11px] text-smoke">
                      {h.cierre_cocina && `Cocina hasta ${hora12(h.cierre_cocina)}`}
                      {h.cierre_cocina && h.cierre_barra && ' · '}
                      {h.cierre_barra && `Barra hasta ${hora12(h.cierre_barra)}`}
                    </p>
                  )}
                  {h.nota && h.abierto && <p className="text-[11px] text-venom/80">{h.nota}</p>}
                </li>
              ))}
            </ul>
          </div>

          <div className="reveal glass rounded-[2rem] p-6">
            <p className="eyebrow mb-4">Escríbenos</p>
            <div className="grid gap-2">
              {local.whatsapp && (
                <a href={waLink(local.whatsapp, 'Hola Mamba 🐍')} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl bg-[#25d366]/10 p-4 ring-1 ring-[#25d366]/30 transition hover:bg-[#25d366]/20">
                  <IconWhatsApp className="text-[#25d366]" /> <span>WhatsApp {local.telefono && <span className="text-smoke">· {local.telefono}</span>}</span>
                </a>
              )}
              {local.instagram && (
                <a href={`https://instagram.com/${local.instagram}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl p-4 ring-1 ring-gold/15 transition hover:bg-gold/5">
                  <IconInstagram className="text-gold" /> @{local.instagram}
                </a>
              )}
              {local.tiktok && (
                <a href={`https://tiktok.com/@${local.tiktok}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl p-4 ring-1 ring-gold/15 transition hover:bg-gold/5">
                  <IconTikTok className="text-gold" /> @{local.tiktok}
                </a>
              )}
            </div>
          </div>

          {local.dress_code && (
            <div className="reveal border-gold-gradient rounded-[2rem] p-6">
              <p className="eyebrow mb-2">Dress code</p>
              <p className="text-sm text-smoke">{local.dress_code}</p>
              <p className="mt-3 text-xs text-smoke/70">Solo mayores de {local.edad_minima} años con documento original.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
