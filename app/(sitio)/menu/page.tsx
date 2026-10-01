import type { Metadata } from 'next';
import { MenuBrowser } from '@/components/MenuBrowser';
import { PageHero } from '@/components/ui';
import { api } from '@/lib/api';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Menú — Licores, Coctelería y Comida Rápida',
  description:
    'Carta digital de Mamba Bistro Bar: licores premium por botella, media o trago, coctelería de autor, cervezas, hamburguesas, desgranados, picadas y combos.',
  alternates: { canonical: '/menu' },
};

// El QR de cada mesa apunta a /menu?mesa=7
export default async function MenuPage({ searchParams }: { searchParams: Promise<{ mesa?: string }> }) {
  const [{ mesa }, categorias] = await Promise.all([searchParams, api.menu()]);
  return (
    <>
      <PageHero eyebrow="Carta digital" title={<>El <span className="text-foil">menú</span></>}>
        Licores premium, coctelería de autor y comida para compartir. Precios claros, sin sorpresas.
      </PageHero>
      <section className="mx-auto max-w-5xl px-4 pb-10 lg:px-16">
        <MenuBrowser categorias={categorias} mesa={mesa?.slice(0, 6)} />
      </section>
    </>
  );
}
