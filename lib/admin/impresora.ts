'use client';

/**
 * Impresora térmica de comandas (ESC/POS) por Web Serial, igual que en Maracumango.
 *
 *  - Funciona en Chrome o Edge de computador (Windows). La impresora se empareja primero por Bluetooth
 *    en Windows (eso crea un puerto COM) o se conecta por USB; aquí se elige ese puerto una sola vez.
 *  - Cada pantalla decide si imprime (se guarda en este navegador): normalmente el computador de la barra
 *    imprime lo de cocina para pasárselo, o el de la cocina imprime lo suyo.
 *  - El servidor reparte los pedidos: el que «reclama» un pedido lo marca impreso, así nunca sale doble.
 */

export type Estacion = 'cocina' | 'barra';
export type ConfigImpresora = { auto: boolean; estaciones: Estacion[]; baudios: number; columnas: number };

export type ItemTicket = {
  id: number; cuenta_id: number; cuenta: string; tipo: string; nombre_cliente: string | null; puesto: number | null;
  mesa_numero: number | null; mesa_tipo: string | null; zona: string | null; mesonero: string | null;
  nombre: string; presentacion: string | null; cantidad: number; asiento: number | null; notas: string | null;
  estacion: string; ronda: number; creado_en: string; modificadores: { tipo: 'sin' | 'adicional' | 'seleccion'; nombre: string; cantidad: number }[];
};

const CLAVE = 'mamba_impresora';
const POR_DEFECTO: ConfigImpresora = { auto: false, estaciones: ['cocina'], baudios: 9600, columnas: 42 };
export const EVENTO_CONFIG = 'mamba-impresora';

export function leerConfig(): ConfigImpresora {
  try {
    return { ...POR_DEFECTO, ...JSON.parse(localStorage.getItem(CLAVE) ?? '{}') };
  } catch {
    return POR_DEFECTO;
  }
}
export function guardarConfig(c: ConfigImpresora) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(c));
  } catch {}
  window.dispatchEvent(new Event(EVENTO_CONFIG));
}

// ---------------------------------------------------------------------- Puerto serie
/* eslint-disable @typescript-eslint/no-explicit-any */
const serial = (): any => (typeof navigator !== 'undefined' ? (navigator as any).serial : undefined);
export const soportaImpresora = () => !!serial();

let puerto: any = null;
let abiertoA = 0;

/** Abre el selector del navegador (necesita un toque del usuario). El permiso queda recordado. */
export async function conectarImpresora(): Promise<boolean> {
  if (!serial()) return false;
  try {
    const nuevo = await serial().requestPort();
    if (puerto && puerto !== nuevo) await puerto.close?.().catch(() => {});
    puerto = nuevo;
    return true;
  } catch {
    return false; // cerró el selector sin elegir
  }
}

/** Puerto ya autorizado antes, sin preguntar (para imprimir solo) */
export async function puertoAutorizado(): Promise<any> {
  if (!serial()) return null;
  if (puerto) return puerto;
  const lista = await serial().getPorts();
  puerto = lista[0] ?? null;
  return puerto;
}

async function escribir(bytes: Uint8Array, baudios: number) {
  const p = await puertoAutorizado();
  if (!p) throw new Error('Primero conecta la impresora');
  // Si cambiaron la velocidad en la configuración, se reabre el puerto con la nueva
  if (p.writable && abiertoA !== baudios) await p.close().catch(() => {});
  if (!p.writable) {
    await p.open({ baudRate: baudios });
    abiertoA = baudios;
  }
  const w = p.writable.getWriter();
  try {
    await w.write(bytes);
  } finally {
    w.releaseLock();
  }
}

/** Envía el ticket; si la conexión Bluetooth se cayó, cierra, reabre y reintenta una vez */
export async function enviarAImpresora(bytes: Uint8Array): Promise<boolean> {
  const { baudios } = leerConfig();
  try {
    await escribir(bytes, baudios);
    return true;
  } catch {
    try {
      await puerto?.close?.();
    } catch {}
    try {
      await escribir(bytes, baudios);
      return true;
    } catch (e) {
      console.error('[impresora]', e);
      return false;
    }
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------- Ticket ESC/POS
const ESC = 0x1b, GS = 0x1d;

/** Las térmicas baratas no traen UTF-8: se imprimen sin tildes para que no salgan símbolos raros */
const plano = (s: string) => s.replace(/·/g, '-').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e\n]/g, '');

function partir(texto: string, ancho: number, sangria = ''): string[] {
  const out: string[] = [];
  let linea = '';
  for (const palabra of plano(texto).split(/\s+/).filter(Boolean)) {
    const candidata = linea ? `${linea} ${palabra}` : palabra;
    if (candidata.length > ancho && linea) {
      out.push(linea);
      linea = sangria + palabra;
    } else linea = candidata;
  }
  if (linea) out.push(linea);
  return out;
}

export const lugarTicket = (p: Pick<ItemTicket, 'mesa_tipo' | 'tipo' | 'mesa_numero' | 'puesto'>) =>
  p.mesa_tipo === 'barra' || (p.tipo === 'barra' && !p.mesa_numero) ? `BARRA${p.puesto ? ` ${p.puesto}` : ''}` : p.tipo === 'llevar' ? 'PARA LLEVAR' : `MESA ${p.mesa_numero}`;

class Ticket {
  private b: number[] = [];
  constructor(private columnas: number) {
    this.raw(ESC, 0x40);
  }
  raw(...x: number[]) { this.b.push(...x); return this; }
  txt(s: string) { for (const ch of plano(s)) this.b.push(ch.charCodeAt(0)); return this; }
  ln(s = '') { return this.txt(`${s}\n`); }
  centro() { return this.raw(ESC, 0x61, 1); }
  izq() { return this.raw(ESC, 0x61, 0); }
  /** 0 normal · 0x08 negrita · 0x10 doble alto · 0x30 doble alto y ancho */
  modo(m: number) { return this.raw(ESC, 0x21, m); }
  raya(c = '-') { return this.modo(0).ln(c.repeat(this.columnas)); }
  bytes() { this.ln('\n\n\n').raw(GS, 0x56, 0x42, 0x00); return new Uint8Array(this.b); }
}

/** Una comanda = lo que salió junto (misma cuenta, ronda y estación) */
export function ticketComanda(items: ItemTicket[], { reimpresion = false } = {}): Uint8Array {
  const { columnas } = leerConfig();
  const p = items[0];
  const t = new Ticket(columnas);
  const hora = new Date(p.creado_en).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

  t.centro().modo(0x08).ln(`*** ${p.estacion.toUpperCase()} ***${reimpresion ? ' (REIMPRESION)' : ''}`);
  t.modo(0x30).ln(lugarTicket(p));
  if (p.nombre_cliente) t.modo(0x10).ln(p.nombre_cliente.slice(0, columnas));
  t.modo(0).ln(`${hora} - ${p.cuenta} - ronda ${p.ronda}`);
  t.ln(`Mesero: ${p.mesonero ?? "-"}${p.zona ? ` - ${p.zona}` : ""}`);
  t.raya('=').izq();

  for (const i of items) {
    const nombre = `${i.cantidad} x ${i.nombre}${i.presentacion ? ` (${i.presentacion})` : ''}`;
    t.modo(0x18); // doble alto + negrita: se lee desde lejos sin perder ancho
    partir(nombre, columnas, '    ').forEach((l) => t.ln(l));
    t.modo(0x08);
    if (i.asiento) t.ln(`    Puesto ${i.asiento}`);
    for (const m of i.modificadores) {
      const linea = m.tipo === 'sin' ? `    SIN ${m.nombre.toUpperCase()}` : m.tipo === 'adicional' ? `    + ${m.cantidad > 1 ? `${m.cantidad} x ` : ''}${m.nombre}` : `    ${m.cantidad} x ${m.nombre}`;
      partir(linea, columnas, '      ').forEach((l) => t.ln(l));
    }
    if (i.notas) partir(`    >> ${i.notas}`, columnas, '       ').forEach((l) => t.ln(l));
    t.modo(0).ln();
  }
  t.raya('=');
  t.centro().ln(`${items.reduce((s, i) => s + i.cantidad, 0)} producto(s)`);
  return t.bytes();
}

export function ticketPrueba(): Uint8Array {
  const { columnas } = leerConfig();
  const t = new Ticket(columnas);
  t.centro().modo(0x30).ln('MAMBA').modo(0).ln('Bistro Bar').raya();
  t.modo(0x18).ln('Impresora lista').modo(0).ln(new Date().toLocaleString('es-CO'));
  t.raya().ln('Aqui saldran las comandas.');
  return t.bytes();
}
