import type { Horario, Local } from './types';

export const TZ = 'America/Bogota';
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
export const formatCOP = (v: number) => cop.format(v);
/** Precio en la moneda del producto: $ 36.000 · US$ 10,50 · Bs 380,00 */
export function formatMoneda(v: number, moneda: string = 'COP') {
  if (moneda === 'USD') return `US$ ${Number(v).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (moneda === 'VES') return `Bs ${Number(v).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return cop.format(v);
}
/** $280.000 → "280K" (para flyers y pases) */
export const shortCOP = (v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${v}`);

export const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export function fechaEvento(iso: string) {
  const d = new Date(iso);
  const f = (o: Intl.DateTimeFormatOptions) => d.toLocaleString('es-CO', { timeZone: TZ, ...o });
  return {
    dia: f({ day: '2-digit' }),
    mes: f({ month: 'short' }).replace('.', '').toUpperCase(),
    semana: f({ weekday: 'long' }),
    hora: f({ hour: 'numeric', minute: '2-digit', hour12: true }),
    larga: f({ weekday: 'long', day: 'numeric', month: 'long' }),
  };
}

/** "21:00" → "9:00 p.m." */
export function hora12(h: string | null | undefined) {
  if (!h) return '';
  const [hh, mm] = h.split(':').map(Number);
  return `${((hh + 11) % 12) + 1}${mm ? ':' + String(mm).padStart(2, '0') : ''} ${hh >= 12 ? 'p.m.' : 'a.m.'}`;
}

/** Hora y día actuales en Colombia */
export function ahoraColombia(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const dia = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { dia, hhmm: `${get('hour').replace('24', '00')}:${get('minute')}` };
}

/** Estado en vivo: abierto ahora / abre hoy / próximo día de apertura */
export function estadoApertura(horarios: Horario[], date = new Date()) {
  if (!horarios.length) return null;
  const { dia, hhmm } = ahoraColombia(date);
  const by = (d: number) => horarios.find((h) => h.dia_semana === ((d + 7) % 7));

  // ¿Seguimos abiertos desde ayer (cierre después de medianoche)?
  const ayer = by(dia - 1);
  if (ayer?.abierto && ayer.hora_cierre && ayer.hora_apertura && ayer.hora_cierre < ayer.hora_apertura && hhmm < ayer.hora_cierre)
    return { abierto: true, texto: `Abierto · cierra ${hora12(ayer.hora_cierre)}` };

  const hoy = by(dia);
  if (hoy?.abierto && hoy.hora_apertura && hoy.hora_cierre) {
    const cruza = hoy.hora_cierre < hoy.hora_apertura;
    if (hhmm >= hoy.hora_apertura && (cruza || hhmm < hoy.hora_cierre))
      return { abierto: true, texto: `Abierto · cierra ${hora12(hoy.hora_cierre)}` };
    if (hhmm < hoy.hora_apertura) return { abierto: false, texto: `Hoy abrimos ${hora12(hoy.hora_apertura)}` };
  }
  for (let i = 1; i <= 7; i++) {
    const h = by(dia + i);
    if (h?.abierto && h.hora_apertura)
      return { abierto: false, texto: `Abrimos ${i === 1 ? 'mañana' : DIAS[h.dia_semana].toLowerCase()} ${hora12(h.hora_apertura)}` };
  }
  return null;
}

export const waLink = (numero: string, texto?: string) =>
  `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;

export function linksMapa(local: Local) {
  const { latitud: lat, longitud: lng } = local;
  const q = encodeURIComponent(`${local.nombre}, ${local.direccion}, ${local.ciudad}`);
  const tieneGeo = lat != null && lng != null;
  return {
    embed: tieneGeo
      ? `https://www.google.com/maps?q=${lat},${lng}&z=17&output=embed`
      : `https://www.google.com/maps?q=${q}&output=embed`,
    google: tieneGeo
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    waze: tieneGeo ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes` : `https://waze.com/ul?q=${q}&navigate=yes`,
  };
}

/** Color único y estable por evento para flyers generativos */
export function hueDe(texto: string) {
  let h = 0;
  for (const c of texto) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
