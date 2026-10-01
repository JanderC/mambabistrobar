import Link from 'next/link';
import { SerpentMark } from '@/components/SerpentMark';

export default function NotFound() {
  return (
    <section className="flex min-h-[80svh] flex-col items-center justify-center px-4 pt-24 text-center">
      <SerpentMark className="w-64 opacity-80" />
      <p className="eyebrow mt-8">Error 404</p>
      <h1 className="title-xl mt-3 text-5xl">La serpiente <span className="text-foil">se escondió</span></h1>
      <p className="mt-4 text-smoke">Esta página mudó de piel. Volvamos a la pista.</p>
      <Link href="/" className="btn-gold mt-8">Ir al inicio</Link>
    </section>
  );
}
