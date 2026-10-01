'use client';

import { useEffect, useRef, useState } from 'react';
import { API_URL } from '@/lib/api';
import { sesion } from './api';

/**
 * Tiempo real: una sola conexión por pestaña al flujo de eventos del backend (/admin/vivo),
 * compartida por todas las pantallas. Si se cae (wifi de la tablet, reinicio del servidor)
 * se reconecta sola y avisa a las pantallas para que recarguen lo que se hayan perdido.
 */
export type EventoVivo =
  | { tipo: 'pedido'; cuenta_id: number; numero: string; lugar: string; cliente: string | null; mesonero: string; estaciones: string[]; items: number; directo: boolean }
  | { tipo: 'comanda'; estado: string; items: { id: number; nombre: string; cantidad: number; cuenta_id: number; lugar: string; cliente: string | null; mesonero_id: number | null; estacion: string }[] }
  | { tipo: 'cobro'; accion: 'solicitado' | 'cancelado' | 'cobrado'; cuenta_id: number; numero: string; lugar: string; cliente: string | null; mesonero: string | null; mesonero_id: number | null }
  | { tipo: 'cuenta'; accion: string; cuenta_id: number; mesonero_id?: number | null }
  /** Sintético: la conexión volvió después de un corte → conviene recargar */
  | { tipo: 'reconectado' };

type Oyente = (e: EventoVivo) => void;
const oyentes = new Set<Oyente>();
const oyentesEstado = new Set<(c: boolean) => void>();
let conectado = false;
let control: AbortController | null = null;
let reintento: ReturnType<typeof setTimeout> | null = null;
let intentos = 0;
let huboCorte = false;

const setConectado = (c: boolean) => {
  if (conectado === c) return;
  conectado = c;
  oyentesEstado.forEach((f) => f(c));
};

async function conectar() {
  if (control || !sesion.token()) return;
  control = new AbortController();
  let latido: ReturnType<typeof setTimeout> | undefined;
  // Si pasan 45 s sin latido del servidor (llega cada 20 s), la conexión está muerta aunque el navegador no lo sepa
  const vigilar = () => {
    clearTimeout(latido);
    latido = setTimeout(() => control?.abort(), 45_000);
  };
  try {
    const res = await fetch(`${API_URL}/admin/vivo`, {
      headers: { Authorization: `Bearer ${sesion.token()}`, Accept: 'text/event-stream' },
      signal: control.signal,
      cache: 'no-store',
    });
    if (res.status === 401) return detener(); // sesión vencida: no insistir
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    setConectado(true);
    intentos = 0;
    if (huboCorte) oyentes.forEach((f) => f({ tipo: 'reconectado' }));
    huboCorte = false;

    const lector = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    vigilar();
    for (;;) {
      const { value, done } = await lector.read();
      if (done) break;
      vigilar();
      buf += dec.decode(value, { stream: true });
      let fin: number;
      while ((fin = buf.indexOf('\n\n')) >= 0) {
        const bloque = buf.slice(0, fin);
        buf = buf.slice(fin + 2);
        const tipo = bloque.match(/^event: (.+)$/m)?.[1];
        const datos = bloque.match(/^data: (.+)$/m)?.[1];
        if (!tipo || !datos || tipo === 'conectado') continue;
        try {
          const evento = JSON.parse(datos) as EventoVivo;
          oyentes.forEach((f) => f(evento));
        } catch { /* trama incompleta: se ignora */ }
      }
    }
  } catch { /* corte de red o abort: se reintenta abajo */ }
  clearTimeout(latido);
  control = null;
  setConectado(false);
  if (oyentes.size || oyentesEstado.size) {
    huboCorte = true;
    intentos++;
    reintento = setTimeout(conectar, Math.min(15_000, 800 * 2 ** Math.min(intentos, 4)));
  }
}

function detener() {
  if (reintento) clearTimeout(reintento);
  reintento = null;
  control?.abort();
  control = null;
  setConectado(false);
}

/** Escucha eventos en vivo mientras el componente esté montado */
export function useVivo(alRecibir: Oyente) {
  const ref = useRef(alRecibir);
  ref.current = alRecibir;
  useEffect(() => {
    const oyente: Oyente = (e) => ref.current(e);
    oyentes.add(oyente);
    conectar();
    return () => {
      oyentes.delete(oyente);
      if (!oyentes.size && !oyentesEstado.size) detener();
    };
  }, []);
}

/** true mientras la conexión en vivo esté activa (para el indicador de la barra superior) */
export function useVivoConectado() {
  const [c, setC] = useState(conectado);
  useEffect(() => {
    oyentesEstado.add(setC);
    setC(conectado);
    conectar();
    return () => {
      oyentesEstado.delete(setC);
      if (!oyentes.size && !oyentesEstado.size) detener();
    };
  }, []);
  return c;
}

// ====================================================================== Sonidos (sin archivos: Web Audio)
let audio: AudioContext | null = null;
const CLAVE_SONIDO = 'mamba_sonido';
export const sonidoActivo = () => typeof window !== 'undefined' && localStorage.getItem(CLAVE_SONIDO) !== 'no';
export const setSonido = (activo: boolean) => localStorage.setItem(CLAVE_SONIDO, activo ? 'si' : 'no');

/** Los navegadores solo dejan sonar después de un toque: se desbloquea en el primero */
if (typeof window !== 'undefined') {
  const desbloquear = () => {
    try {
      audio ??= new AudioContext();
      if (audio.state === 'suspended') audio.resume();
    } catch { /* sin audio */ }
  };
  window.addEventListener('pointerdown', desbloquear, { passive: true });
}

const TONOS: Record<'pedido' | 'listo' | 'cobro', number[]> = {
  pedido: [880, 1175],        // dos notas ascendentes: llegó comanda
  listo: [1047, 1319, 1568],  // tres: plato listo para llevar
  cobro: [659, 523],          // dos descendentes: cuenta en caja
};

export function sonar(tipo: keyof typeof TONOS) {
  if (!audio || audio.state !== 'running' || !sonidoActivo()) return;
  const ahora = audio.currentTime;
  TONOS[tipo].forEach((frecuencia, i) => {
    const osc = audio!.createOscillator();
    const gan = audio!.createGain();
    osc.type = 'sine';
    osc.frequency.value = frecuencia;
    const t = ahora + i * 0.14;
    gan.gain.setValueAtTime(0.0001, t);
    gan.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    gan.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(gan).connect(audio!.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  });
}
