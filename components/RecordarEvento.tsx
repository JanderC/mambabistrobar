'use client';

import { useState } from 'react';
import { API_URL } from '@/lib/api';
import { IconCalendar, IconCheck } from './icons';

type Props = { slug: string; titulo: string; iniciaEn: string; terminaEn: string | null; lugar: string; horasAntes?: number };

const gcal = (d: string) => new Date(d).toISOString().replace(/[-:]|\.\d{3}/g, '');

/** "Recuérdamelo": deja tu WhatsApp y te avisamos antes del evento; o agrégalo a tu calendario */
export function RecordarEvento({ slug, titulo, iniciaEn, terminaEn, lugar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'ok'>('idle');
  const [error, setError] = useState('');

  const fin = terminaEn ?? new Date(new Date(iniciaEn).getTime() + 5 * 3600e3).toISOString();
  const calendario = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${titulo} — Mamba Bistro Bar`)}&dates=${gcal(iniciaEn)}/${gcal(fin)}&location=${encodeURIComponent(lugar)}`;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEstado('enviando');
    setError('');
    try {
      const res = await fetch(`${API_URL}/eventos/${slug}/recordatorio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre, telefono }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(Object.values((data.campos ?? {}) as Record<string, string[]>).flat()[0] ?? data.error ?? 'No pudimos anotarte');
      setEstado('ok');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos anotarte');
      setEstado('idle');
    }
  };

  if (estado === 'ok')
    return (
      <div className="border-gold-gradient flex items-center gap-3 rounded-2xl p-4 text-sm">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-venom/15 text-venom"><IconCheck width={18} /></span>
        <p>¡Listo, {nombre.split(' ')[0]}! Te escribiremos por WhatsApp antes de <b className="text-gold-light">{titulo}</b>.</p>
      </div>
    );

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setAbierto((a) => !a)} className="btn-ghost !py-3">🔔 Recuérdamelo</button>
        <a href={calendario} target="_blank" rel="noopener noreferrer" className="btn-ghost !py-3"><IconCalendar width={16} /> Añadir al calendario</a>
      </div>
      {abierto && (
        <form onSubmit={enviar} className="glass mt-3 grid gap-3 rounded-2xl p-4 sm:grid-cols-[1fr_1fr_auto]">
          <input required minLength={2} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" autoComplete="name"
            className="rounded-xl border border-gold/20 bg-abyss/80 px-4 py-3 text-sm text-ivory placeholder:text-smoke/50 focus:border-gold focus:outline-none" />
          <input required type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Tu WhatsApp" autoComplete="tel"
            className="rounded-xl border border-gold/20 bg-abyss/80 px-4 py-3 text-sm text-ivory placeholder:text-smoke/50 focus:border-gold focus:outline-none" />
          <button type="submit" disabled={estado === 'enviando'} className="btn-gold !py-3 disabled:opacity-60">{estado === 'enviando' ? 'Anotando…' : 'Avísame'}</button>
          {error && <p className="text-xs text-red-300 sm:col-span-3">{error}</p>}
          <p className="text-[11px] text-smoke sm:col-span-3">Solo usamos tu número para recordarte este evento.</p>
        </form>
      )}
    </div>
  );
}
