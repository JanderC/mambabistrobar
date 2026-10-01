export const MONEDAS = ['COP', 'USD', 'VES'] as const;
export type Moneda = (typeof MONEDAS)[number];
export type PorMoneda = Record<Moneda, number>;

export type Tasa = { id: number; fecha: string; usd_ves: number; usd_cop: number; ves_cop: number; ves_cop_manual: boolean; fuente: string; created_at: string };

const DEC: Record<Moneda, number> = { USD: 2, COP: 0, VES: 2 };
const SIMBOLO: Record<Moneda, string> = { USD: 'US$', COP: '$', VES: 'Bs' };
export const NOMBRE_MONEDA: Record<Moneda, string> = { USD: 'Dólares', COP: 'Pesos', VES: 'Bolívares' };

/** $ 36.000 · US$ 10,88 · Bs 9.359,14 */
export function dinero(monto: number | null | undefined, moneda: Moneda | string = 'COP') {
  const m = (MONEDAS as readonly string[]).includes(moneda) ? (moneda as Moneda) : 'COP';
  const n = Number(monto ?? 0);
  return `${SIMBOLO[m]} ${n.toLocaleString('es-CO', { minimumFractionDigits: DEC[m], maximumFractionDigits: DEC[m] })}`;
}

export const redondear = (n: number, moneda: Moneda) => {
  const f = 10 ** DEC[moneda];
  return Math.round((n + Number.EPSILON) * f) / f;
};

export const tolerancia = (m: Moneda) => (m === 'COP' ? 1 : 0.01);

const usdVes = (t: Tasa) => (t.ves_cop_manual ? t.usd_cop / t.ves_cop : t.usd_ves);

/** Misma lógica que el backend: solo para previsualizar; el servidor siempre recalcula */
export function convertir(monto: number, origen: Moneda, destino: Moneda, t: Tasa) {
  if (origen === destino) return monto;
  const usd = origen === 'USD' ? monto : origen === 'COP' ? monto / t.usd_cop : monto / usdVes(t);
  return destino === 'USD' ? usd : destino === 'COP' ? usd * t.usd_cop : usd * usdVes(t);
}

export const numero = (n: number | null | undefined, dec = 0) =>
  Number(n ?? 0).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: dec });

const TZ = 'America/Bogota';
export const fechaHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString('es-CO', { timeZone: TZ, day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : '—';
export const soloHora = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString('es-CO', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }) : '—';
export const fechaCorta = (f: string | null | undefined) =>
  f ? new Date(f.length === 10 ? `${f}T12:00:00` : f).toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' }) : '—';

/** "hace 4 min" */
export function hace(iso: string) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return 'ahora';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${min % 60} min`;
}

/** Fecha de jornada de hoy (antes de las 6 a.m. cuenta como el día anterior), en YYYY-MM-DD */
export function jornadaHoy(offsetDias = 0) {
  const d = new Date(Date.now() - 6 * 3600e3 + offsetDias * 86400e3);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
}

/** Valor para <input type="datetime-local"> en hora del negocio */
export function aInputFechaHora(iso: string | null | undefined) {
  if (!iso) return '';
  const p = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
  return p.replace(' ', 'T');
}
/** De <input type="datetime-local"> (hora Colombia, UTC−5) a ISO con zona */
export const deInputFechaHora = (v: string) => (v ? `${v}:00-05:00` : '');

/** Agrupa una lista por clave conservando el orden de aparición */
export function agrupar<T>(lista: T[], clave: (x: T) => string): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const x of lista) {
    const k = clave(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(x);
  }
  return [...m.entries()];
}
