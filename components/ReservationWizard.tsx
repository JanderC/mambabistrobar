'use client';

import { useMemo, useState } from 'react';
import { API_URL } from '@/lib/api';
import { DIAS, TZ, fechaEvento, formatCOP, hora12, waLink } from '@/lib/format';
import type { OpcionesReserva } from '@/lib/types';
import { IconArrow, IconCheck, IconStar, IconUsers, IconWhatsApp } from './icons';
import { VipPass } from './VipPass';

const MOTIVOS = [
  { v: 'casual', l: 'Salida casual', e: '🍸' },
  { v: 'cumpleanos', l: 'Cumpleaños', e: '🎂' },
  { v: 'corporativo', l: 'Corporativo', e: '💼' },
  { v: 'despedida', l: 'Despedida', e: '🎉' },
  { v: 'aniversario', l: 'Aniversario', e: '💍' },
  { v: 'otro', l: 'Otro', e: '✨' },
] as const;

const PASOS = ['Cuándo', 'Dónde', 'Quién'];

const hoyColombia = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());

/** Horas disponibles cada 30 min, desde apertura hasta 1 h antes del cierre */
function slots(ap: string, ci: string) {
  const toMin = (h: string) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
  const start = toMin(ap);
  let end = toMin(ci);
  if (end <= start) end += 24 * 60;
  const out: string[] = [];
  for (let m = start; m <= end - 60; m += 30) {
    const mm = m % (24 * 60);
    out.push(`${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(mm % 60).padStart(2, '0')}`);
  }
  return out;
}

type Resultado = { codigo: string; whatsapp_url: string };

export function ReservationWizard({ opciones, whatsapp, eventoInicial }: { opciones: OpcionesReserva; whatsapp: string; eventoInicial?: string }) {
  const evInicial = opciones.eventos.find((e) => e.slug === eventoInicial);
  const [paso, setPaso] = useState(0);
  const [f, setF] = useState({
    fecha: evInicial ? new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(evInicial.inicia_en)) : '',
    hora: '',
    evento: evInicial?.slug ?? '',
    personas: 4,
    zona: '',
    motivo: 'casual',
    nombre_completo: '',
    telefono: '',
    email: '',
    notas: '',
    acepta_politicas: false,
    sitio_web: '',
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((s) => ({ ...s, [k]: v })); setErrores((e) => ({ ...e, [k]: '' })); };

  const hoy = hoyColombia();
  const dia = f.fecha ? new Date(`${f.fecha}T12:00:00`).getDay() : null;
  const horario = dia != null ? opciones.horarios.find((h) => h.dia_semana === dia) : undefined;
  const horas = horario?.abierto && horario.hora_apertura && horario.hora_cierre ? slots(horario.hora_apertura, horario.hora_cierre) : [];
  const eventosDelDia = opciones.eventos.filter((e) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(e.inicia_en)) === f.fecha);
  const zona = opciones.zonas.find((z) => z.slug === f.zona);
  const motivo = MOTIVOS.find((m) => m.v === f.motivo);

  // Próximas 14 noches abiertas como accesos rápidos
  const proximas = useMemo(() => {
    const out: string[] = [];
    const base = new Date(`${hoy}T12:00:00`);
    for (let i = 0; i < 21 && out.length < 10; i++) {
      const d = new Date(base); d.setDate(base.getDate() + i);
      const h = opciones.horarios.find((x) => x.dia_semana === d.getDay());
      if (!opciones.horarios.length || h?.abierto) out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, [hoy, opciones.horarios]);

  const validarPaso = (p: number) => {
    const e: Record<string, string> = {};
    if (p === 0) {
      if (!f.fecha) e.fecha = 'Elige una fecha';
      else if (f.fecha < hoy) e.fecha = 'Esa fecha ya pasó';
      else if (horario && !horario.abierto) e.fecha = `Los ${DIAS[dia!].toLowerCase()} no abrimos`;
      if (!f.hora) e.hora = 'Elige una hora';
    }
    if (p === 1) {
      if (!f.zona) e.zona = 'Elige una zona';
      else if (zona && f.personas > zona.max_personas) e.zona = `Máximo ${zona.max_personas} personas en esta zona`;
    }
    if (p === 2) {
      if (f.nombre_completo.trim().length < 3) e.nombre_completo = 'Escribe tu nombre completo';
      if (f.telefono.replace(/\D/g, '').length < 10) e.telefono = 'Número de WhatsApp inválido';
      if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = 'Email inválido';
      if (!f.acepta_politicas) e.acepta_politicas = 'Debes aceptar las condiciones';
    }
    setErrores(e);
    return !Object.keys(e).length;
  };

  const siguiente = () => validarPaso(paso) && setPaso((p) => p + 1);

  const enviar = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validarPaso(2)) return;
    setEnviando(true);
    try {
      const tel = f.telefono.replace(/\D/g, '');
      const res = await fetch(`${API_URL}/reservas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, telefono: tel.length === 10 ? `57${tel}` : tel, evento: f.evento || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        const campos = Object.fromEntries(Object.entries(data.campos ?? {}).map(([k, v]) => [k, (v as string[])[0]]));
        setErrores({ ...campos, general: data.error ?? 'No pudimos registrar la reserva' });
        return;
      }
      setResultado(data);
      scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setErrores({ general: 'Sin conexión con el servidor. Escríbenos por WhatsApp y te reservamos de una.' });
    } finally {
      setEnviando(false);
    }
  };

  const pass = {
    nombre: f.nombre_completo, fecha: f.fecha, hora: f.hora, personas: f.personas,
    zona: zona?.nombre ?? '', vip: !!zona?.es_vip, motivo: motivo ? `${motivo.e} ${motivo.l}` : '', codigo: resultado?.codigo,
  };

  if (resultado) {
    return (
      <div className="mx-auto grid max-w-5xl items-center gap-12 lg:grid-cols-2">
        <VipPass data={pass} />
        <div className="text-center lg:text-left">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-venom/15 text-venom ring-1 ring-venom/40 lg:mx-0"><IconCheck width={28} /></div>
          <h2 className="title-xl text-4xl text-gold-light">¡Solicitud recibida!</h2>
          <p className="mt-4 text-smoke">
            Tu código es <strong className="font-mono text-ivory">{resultado.codigo}</strong>. Nuestro RRPP te confirmará por WhatsApp en minutos.
            Para acelerar la confirmación, envíanos el resumen:
          </p>
          <a href={resultado.whatsapp_url} target="_blank" rel="noopener noreferrer" className="btn-gold mt-8 !bg-none !bg-[#25d366] !text-white">
            <IconWhatsApp width={18} /> Enviar por WhatsApp
          </a>
          {zona && zona.consumo_minimo_cop > 0 && (
            <p className="mt-6 text-xs text-smoke">Recuerda: consumo mínimo de {formatCOP(zona.consumo_minimo_cop)} (100% consumible).</p>
          )}
        </div>
      </div>
    );
  }

  const inputCls = 'w-full rounded-2xl border border-gold/20 bg-abyss/80 px-4 py-3.5 text-ivory placeholder:text-smoke/50 focus:border-gold focus:outline-none';
  const Err = ({ k }: { k: string }) => (errores[k] ? <p className="mt-1.5 text-xs text-red-300">{errores[k]}</p> : null);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.25fr_1fr] lg:gap-16 [&>*]:min-w-0">
      <form onSubmit={enviar} noValidate className="order-2 lg:order-1">
        {/* Progreso */}
        <ol className="mb-8 flex items-center gap-2">
          {PASOS.map((p, i) => (
            <li key={p} className="flex flex-1 items-center gap-2">
              <button
                type="button"
                onClick={() => i < paso && setPaso(i)}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-display text-xs transition ${
                  i < paso ? 'bg-gold text-void' : i === paso ? 'bg-gold/15 text-gold ring-1 ring-gold' : 'text-smoke ring-1 ring-gold/20'
                }`}
              >
                {i < paso ? <IconCheck width={16} /> : i + 1}
              </button>
              <span className={`hidden font-display text-[11px] tracking-[0.2em] uppercase sm:inline ${i === paso ? 'text-gold' : 'text-smoke'}`}>{p}</span>
              {i < PASOS.length - 1 && <span className={`h-px flex-1 ${i < paso ? 'bg-gold' : 'bg-gold/15'}`} />}
            </li>
          ))}
        </ol>

        {/* Paso 1 — Cuándo */}
        {paso === 0 && (
          <div className="space-y-7">
            <div>
              <p className="eyebrow mb-3">¿Qué noche?</p>
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                {proximas.map((d) => {
                  const dt = new Date(`${d}T12:00:00`);
                  const ev = opciones.eventos.some((e) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(e.inicia_en)) === d);
                  return (
                    <button
                      type="button"
                      key={d}
                      onClick={() => { set('fecha', d); set('hora', ''); set('evento', ''); }}
                      className={`relative flex w-16 shrink-0 flex-col items-center rounded-2xl py-3 transition ${
                        f.fecha === d ? 'bg-gold text-void shadow-[0_0_30px_rgba(212,175,55,.45)]' : 'glass text-ivory'
                      }`}
                    >
                      <span className="text-[10px] uppercase opacity-70">{dt.toLocaleDateString('es-CO', { weekday: 'short' }).replace('.', '')}</span>
                      <span className="font-display text-2xl font-light">{dt.getDate()}</span>
                      <span className="text-[9px] uppercase opacity-70">{dt.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')}</span>
                      {ev && <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-venom" title="Hay evento" />}
                    </button>
                  );
                })}
              </div>
              <label className="mt-3 flex items-center gap-3 text-xs text-smoke">
                ¿Otra fecha?
                <input type="date" min={hoy} value={f.fecha} onChange={(e) => { set('fecha', e.target.value); set('hora', ''); }} className="rounded-xl border border-gold/20 bg-abyss px-3 py-2 text-ivory [color-scheme:dark]" />
              </label>
              <Err k="fecha" />
            </div>

            {f.fecha && (
              <div>
                <p className="eyebrow mb-3">¿A qué hora llegan?</p>
                {horas.length ? (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {horas.map((h) => (
                      <button
                        type="button"
                        key={h}
                        onClick={() => set('hora', h)}
                        className={`rounded-xl py-2.5 text-xs transition ${f.hora === h ? 'bg-gold text-void' : 'border border-gold/15 text-ivory/85 hover:border-gold/50'}`}
                      >
                        {hora12(h)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-smoke">Ese día no abrimos. Elige otra noche 🌙</p>
                )}
                <Err k="hora" />
              </div>
            )}

            {eventosDelDia.length > 0 && (
              <div>
                <p className="eyebrow mb-3">Esa noche hay evento 🔥</p>
                {eventosDelDia.map((e) => (
                  <label key={e.slug} className={`flex cursor-pointer items-center gap-3 rounded-2xl p-4 transition ${f.evento === e.slug ? 'border-gold-gradient' : 'glass'}`}>
                    <input type="checkbox" checked={f.evento === e.slug} onChange={(x) => set('evento', x.target.checked ? e.slug : '')} className="h-4 w-4 accent-[#d4af37]" />
                    <span className="flex-1"><span className="font-medium">{e.titulo}</span> <span className="text-xs text-smoke">· {fechaEvento(e.inicia_en).hora}</span></span>
                  </label>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Paso 2 — Dónde */}
        {paso === 1 && (
          <div className="space-y-7">
            <div>
              <p className="eyebrow mb-3">¿Cuántos son?</p>
              <div className="glass flex items-center justify-between rounded-2xl p-2">
                <button type="button" onClick={() => set('personas', Math.max(1, f.personas - 1))} className="grid h-12 w-12 place-items-center rounded-xl text-2xl text-gold hover:bg-gold/10" aria-label="Menos personas">−</button>
                <div className="flex items-center gap-3">
                  <IconUsers className="text-gold" />
                  <span className="font-display text-3xl font-light">{f.personas}</span>
                  <span className="text-sm text-smoke">personas</span>
                </div>
                <button type="button" onClick={() => set('personas', Math.min(60, f.personas + 1))} className="grid h-12 w-12 place-items-center rounded-xl text-2xl text-gold hover:bg-gold/10" aria-label="Más personas">+</button>
              </div>
            </div>

            <div>
              <p className="eyebrow mb-3">Elige tu zona</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {opciones.zonas.map((z) => {
                  const lleno = f.personas > z.max_personas;
                  const sel = f.zona === z.slug;
                  return (
                    <button
                      type="button"
                      key={z.slug}
                      disabled={lleno}
                      onClick={() => set('zona', z.slug)}
                      className={`relative overflow-hidden rounded-2xl p-5 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        sel ? (z.es_vip ? 'bg-gradient-to-br from-gold-dark via-gold to-gold-light text-void' : 'bg-emerald ring-2 ring-venom/60') : z.es_vip ? 'border-gold-gradient' : 'glass'
                      }`}
                    >
                      {z.es_vip && <span className={`absolute top-4 right-4 flex items-center gap-1 font-display text-[9px] tracking-[0.3em] ${sel ? 'text-void' : 'text-gold'}`}><IconStar width={12} /> VIP</span>}
                      <p className="font-display text-lg font-medium">{z.nombre}</p>
                      <p className={`mt-1 text-xs ${sel && z.es_vip ? 'text-void/75' : 'text-smoke'}`}>{z.descripcion}</p>
                      <p className={`mt-3 text-xs font-medium ${sel && z.es_vip ? 'text-void' : 'text-gold-light'}`}>
                        {z.consumo_minimo_cop ? `Consumo mínimo ${formatCOP(z.consumo_minimo_cop)}` : 'Sin consumo mínimo'}
                      </p>
                      {lleno && <p className="mt-1 text-[11px] text-red-300">Máx. {z.max_personas} personas</p>}
                    </button>
                  );
                })}
              </div>
              <Err k="zona" />
              {zona && zona.beneficios.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {zona.beneficios.map((b) => <li key={b} className="flex items-center gap-1.5 rounded-full bg-gold/10 px-3 py-1 text-xs text-gold-light"><IconCheck width={12} /> {b}</li>)}
                </ul>
              )}
            </div>

            <div>
              <p className="eyebrow mb-3">¿Qué celebramos?</p>
              <div className="flex flex-wrap gap-2">
                {MOTIVOS.map((m) => (
                  <button type="button" key={m.v} onClick={() => set('motivo', m.v)} className={`rounded-full px-4 py-2 text-sm transition ${f.motivo === m.v ? 'bg-gold text-void' : 'border border-gold/20 text-ivory/85'}`}>
                    {m.e} {m.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Paso 3 — Quién */}
        {paso === 2 && (
          <div className="space-y-5">
            <div>
              <label className="eyebrow mb-2 block" htmlFor="nombre">Nombre completo</label>
              <input id="nombre" autoComplete="name" className={inputCls} value={f.nombre_completo} onChange={(e) => set('nombre_completo', e.target.value)} placeholder="Como aparece en tu cédula" />
              <Err k="nombre_completo" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="eyebrow mb-2 block" htmlFor="tel">WhatsApp</label>
                <input id="tel" type="tel" inputMode="tel" autoComplete="tel" className={inputCls} value={f.telefono} onChange={(e) => set('telefono', e.target.value)} placeholder="300 123 4567" />
                <Err k="telefono" />
              </div>
              <div>
                <label className="eyebrow mb-2 block" htmlFor="email">Email <span className="text-smoke/60 normal-case">(opcional)</span></label>
                <input id="email" type="email" autoComplete="email" className={inputCls} value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="tu@correo.com" />
                <Err k="email" />
              </div>
            </div>
            <div>
              <label className="eyebrow mb-2 block" htmlFor="notas">Notas <span className="text-smoke/60 normal-case">(opcional)</span></label>
              <textarea id="notas" rows={3} maxLength={500} className={inputCls} value={f.notas} onChange={(e) => set('notas', e.target.value)} placeholder="¿Traes torta? ¿Sorpresa? ¿Alguna botella en especial?" />
            </div>
            {/* honeypot anti-bots */}
            <input type="text" name="sitio_web" tabIndex={-1} autoComplete="off" className="hidden" value={f.sitio_web} onChange={(e) => set('sitio_web', e.target.value)} />

            <details className="glass rounded-2xl p-4 text-sm">
              <summary className="cursor-pointer font-display text-xs tracking-[0.2em] text-gold uppercase">Condiciones de reserva</summary>
              <ul className="mt-3 space-y-3">
                {opciones.politicas.map((p) => (
                  <li key={p.titulo} className="flex gap-3"><span>{p.icono}</span><span><strong className="text-ivory">{p.titulo}.</strong> <span className="text-smoke">{p.cuerpo}</span></span></li>
                ))}
              </ul>
            </details>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-smoke">
              <input type="checkbox" checked={f.acepta_politicas} onChange={(e) => set('acepta_politicas', e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#d4af37]" />
              Acepto las condiciones de reserva, el dress code y confirmo que todos somos mayores de edad.
            </label>
            <Err k="acepta_politicas" />
          </div>
        )}

        {errores.general && (
          <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-950/30 p-4 text-sm text-red-200">
            {errores.general}{' '}
            {whatsapp && <a className="underline" href={waLink(whatsapp, 'Hola Mamba, quiero reservar una mesa 🐍')} target="_blank" rel="noopener noreferrer">Escribir por WhatsApp</a>}
          </div>
        )}

        <div className="mt-10 flex items-center justify-between gap-3">
          {paso > 0 ? (
            <button type="button" onClick={() => setPaso((p) => p - 1)} className="btn-ghost">Atrás</button>
          ) : <span />}
          {paso < 2 ? (
            <button type="button" onClick={siguiente} className="btn-gold">Continuar <IconArrow width={16} /></button>
          ) : (
            <button type="submit" disabled={enviando} className="btn-gold disabled:opacity-60">
              {enviando ? 'Enviando…' : 'Solicitar reserva'} <IconArrow width={16} />
            </button>
          )}
        </div>
      </form>

      {/* Pase en vivo */}
      <aside className="order-1 lg:order-2">
        <div className="lg:sticky lg:top-28">
          <VipPass data={pass} />
          <p className="mt-4 text-center text-xs text-smoke">Tu pase se arma mientras reservas ✨ {zona?.es_vip ? 'Zona VIP: acceso sin fila.' : ''}</p>
        </div>
      </aside>
    </div>
  );
}
