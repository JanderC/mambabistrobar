import type { Metadata } from 'next';
import { IconInstagram, IconTikTok } from '@/components/icons';
import { SerpentMark } from '@/components/SerpentMark';
import { PageHero } from '@/components/ui';
import { api } from '@/lib/api';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Galería — Fotos y Reels',
  description: 'Fotos y reels de las noches en Mamba Bistro Bar: ambiente, luces, shows en vivo y zonas VIP.',
  alternates: { canonical: '/galeria' },
};

export default async function GaleriaPage() {
  const [media, local] = await Promise.all([api.galeria(), api.local()]);

  return (
    <>
      <PageHero eyebrow="Galería" title={<>El <span className="text-foil">ambiente</span></>}>
        Luces, humo, bengalas y buena música. Así se vive una noche en la Mamba.
      </PageHero>

      <section className="mx-auto max-w-7xl px-4 lg:px-16">
        {media.length ? (
          <div className="columns-2 gap-3 md:columns-3 lg:columns-4 [&>*]:mb-3">
            {media.map((m, i) => (
              <a
                key={m.id}
                href={m.enlace ?? m.url}
                target="_blank"
                rel="noopener noreferrer"
                className="reveal group relative block break-inside-avoid overflow-hidden rounded-2xl ring-1 ring-gold/15"
                style={{ transitionDelay: `${(i % 4) * 80}ms` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.miniatura_url ?? m.url}
                  alt={m.descripcion?.slice(0, 120) ?? 'Mamba Bistro Bar'}
                  loading="lazy"
                  className="w-full transition duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 flex items-end bg-gradient-to-t from-void/90 via-transparent to-transparent p-4 opacity-0 transition group-hover:opacity-100">
                  <p className="line-clamp-2 text-xs text-ivory">{m.descripcion}</p>
                </div>
                {m.tipo !== 'foto' && (
                  <span className="absolute top-3 right-3 rounded-full bg-void/70 px-2 py-1 text-[10px] tracking-widest text-gold uppercase">Reel</span>
                )}
              </a>
            ))}
          </div>
        ) : (
          // Mosaico de marca mientras se cargan las fotos reales
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className={`reveal relative grid place-items-center overflow-hidden rounded-2xl ring-1 ring-gold/15 ${i % 3 === 0 ? 'aspect-[3/4]' : 'aspect-square'}`}
                style={{ background: `radial-gradient(circle at ${20 + i * 9}% ${30 + (i % 3) * 20}%, #12805a55, #03110c 70%)`, transitionDelay: `${i * 60}ms` }}
              >
                <div className="scales absolute inset-0 opacity-10" />
                <SerpentMark animate={false} className="w-2/3 opacity-30" />
              </div>
            ))}
          </div>
        )}

        <div className="mt-16 grid gap-4 sm:grid-cols-2">
          {local.instagram && (
            <a
              href={`https://instagram.com/${local.instagram}`}
              target="_blank"
              rel="noopener noreferrer"
              className="reveal group flex items-center gap-5 overflow-hidden rounded-3xl bg-gradient-to-br from-[#833ab4]/30 via-[#fd1d1d]/20 to-[#fcb045]/20 p-8 ring-1 ring-white/10 transition hover:ring-gold/50"
            >
              <IconInstagram width={44} height={44} />
              <div>
                <p className="eyebrow !text-ivory/70">Instagram</p>
                <p className="font-display text-2xl">@{local.instagram}</p>
              </div>
            </a>
          )}
          {local.tiktok && (
            <a
              href={`https://tiktok.com/@${local.tiktok}`}
              target="_blank"
              rel="noopener noreferrer"
              className="reveal group flex items-center gap-5 overflow-hidden rounded-3xl bg-gradient-to-br from-[#25f4ee]/20 via-void to-[#fe2c55]/20 p-8 ring-1 ring-white/10 transition hover:ring-gold/50"
            >
              <IconTikTok width={44} height={44} />
              <div>
                <p className="eyebrow !text-ivory/70">TikTok</p>
                <p className="font-display text-2xl">@{local.tiktok}</p>
              </div>
            </a>
          )}
        </div>
      </section>
    </>
  );
}
