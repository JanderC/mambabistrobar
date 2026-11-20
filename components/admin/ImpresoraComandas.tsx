'use client';

import { Printer } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { adm } from '@/lib/admin/api';
import {
  type ConfigImpresora, EVENTO_CONFIG, type Estacion, type ItemTicket, conectarImpresora, enviarAImpresora, guardarConfig, leerConfig,
  lugarTicket, olvidarImpresora, puertoAutorizado, soportaImpresora, ticketComanda, ticketPrueba,
} from '@/lib/admin/impresora';
import { agrupar } from '@/lib/admin/moneda';
import { useVivo } from '@/lib/admin/vivo';
import { Boton, Campo, Interruptor, Modal, Select, useAvisos } from './ui';

function useConfigImpresora() {
  const [cfg, setCfg] = useState<ConfigImpresora | null>(null);
  useEffect(() => {
    const leer = () => setCfg(leerConfig());
    leer();
    window.addEventListener(EVENTO_CONFIG, leer);
    return () => window.removeEventListener(EVENTO_CONFIG, leer);
  }, []);
  return cfg;
}

/**
 * Vive en el Shell: si ESTA pantalla tiene la impresora activada, cada pedido nuevo de las estaciones
 * elegidas sale por papel al instante (y cada 20 s revisa por si se perdió alguno en un corte de red).
 */
export function ImpresionAutomatica() {
  const cfg = useConfigImpresora();
  const avisos = useAvisos();
  const ocupado = useRef(false);
  const otraVez = useRef(false);

  const procesar = useCallback(async () => {
    const c = leerConfig();
    if (!c.auto || !c.estaciones.length || !soportaImpresora()) return;
    if (ocupado.current) {
      otraVez.current = true;
      return;
    }
    ocupado.current = true;
    try {
      // Sin impresora autorizada no se reclama nada: si no, quedarían marcados como impresos sin salir
      if (!(await puertoAutorizado())) return;
      const items = await adm<ItemTicket[]>('/comandas/imprimir', { method: 'POST', body: { estaciones: c.estaciones } });
      const grupos = agrupar(items, (i) => `${i.cuenta_id}-${i.ronda}-${i.estacion}`);
      for (const [k, [, grupo]] of grupos.entries()) {
        if (!(await enviarAImpresora(ticketComanda(grupo)))) {
          const pendientes = grupos.slice(k).flatMap(([, g]) => g.map((i) => i.id));
          await adm('/comandas/imprimir/liberar', { method: 'POST', body: { ids: pendientes } }).catch(() => {});
          avisos.error(new Error('🖨️ No se pudo imprimir la comanda. Revisa que la impresora esté encendida; se reintentará sola.'));
          return;
        }
      }
    } catch (e) {
      console.error('[impresion]', e);
    } finally {
      ocupado.current = false;
      if (otraVez.current) {
        otraVez.current = false;
        void procesar();
      }
    }
  }, [avisos]);

  useVivo((e) => {
    if (e.tipo === 'pedido' && !e.directo) void procesar();
    if (e.tipo === 'reconectado') void procesar();
  });

  useEffect(() => {
    if (!cfg?.auto) return;
    void procesar();
    const id = setInterval(procesar, 20_000);
    return () => clearInterval(id);
  }, [cfg?.auto, cfg?.estaciones.join(), procesar]);

  return null;
}

/** Reimprime una comanda que ya está en pantalla (no la marca de nuevo) */
export async function reimprimirComanda(items: ItemTicket[]) {
  if (!soportaImpresora()) throw new Error('Este navegador no puede imprimir directo. Usa Chrome o Edge en el computador.');
  if (!(await puertoAutorizado())) throw new Error('Primero conecta la impresora (botón 🖨️ arriba).');
  if (!(await enviarAImpresora(ticketComanda(items, { reimpresion: true })))) throw new Error('No se pudo imprimir. Revisa que la impresora esté encendida.');
  return `🖨️ Reimpresa la comanda de ${lugarTicket(items[0]).toLowerCase()}`;
}

/**
 * Configuración de la impresora de ESTE computador: vincular el puerto, probar y elegir qué imprime.
 * Se usa en Configuración → Impresora y en el botón 🖨️ de Barra, Comandas y Vender.
 */
export function PanelImpresora() {
  const cfg = useConfigImpresora();
  const avisos = useAvisos();
  const [conectada, setConectada] = useState(false);
  const [probando, setProbando] = useState(false);

  useEffect(() => {
    puertoAutorizado().then((p) => setConectada(!!p)).catch(() => {});
  }, []);

  if (!cfg) return null;
  const cambiar = (c: Partial<ConfigImpresora>) => guardarConfig({ ...cfg, ...c });
  const alternarEstacion = (e: Estacion, si: boolean) => cambiar({ estaciones: si ? [...new Set([...cfg.estaciones, e])] : cfg.estaciones.filter((x) => x !== e) });

  const conectar = async () => {
    if (await conectarImpresora()) {
      setConectada(true);
      avisos.ok('🔌 Impresora vinculada a este computador');
    }
  };
  const probar = async () => {
    setProbando(true);
    const ok = await enviarAImpresora(ticketPrueba());
    setProbando(false);
    if (ok) avisos.ok('🖨️ Ticket de prueba enviado');
    else avisos.error(new Error('No imprimió. Revisa que esté encendida y emparejada, prueba el otro puerto COM u otra velocidad.'));
  };
  const olvidar = async () => {
    await olvidarImpresora();
    setConectada(false);
    avisos.ok('Impresora desvinculada de este computador');
  };

  if (!soportaImpresora()) {
    return (
      <p className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
        Este navegador no puede imprimir directo. Abre el sistema en <b>Chrome o Edge</b> en el computador que tiene la impresora (en teléfonos y tablets no funciona).
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${conectada ? 'bg-venom/15 text-venom' : 'bg-white/5 text-smoke'}`}>
          <span className={`h-2 w-2 rounded-full ${conectada ? 'bg-venom' : 'bg-smoke'}`} /> {conectada ? 'Impresora vinculada' : 'Sin impresora'}
        </span>
        <Boton variante={conectada ? 'borde' : 'oro'} onClick={conectar}>{conectada ? 'Cambiar impresora' : '🔌 Vincular impresora'}</Boton>
        {conectada && <Boton onClick={probar} cargando={probando}>Imprimir prueba</Boton>}
        {conectada && <Boton variante="sutil" onClick={olvidar}>Desvincular</Boton>}
      </div>
      <ol className="list-decimal space-y-1 rounded-2xl border border-gold/15 bg-gold/5 py-3 pr-3 pl-8 text-xs leading-relaxed text-smoke">
        <li>Enciende la <b className="text-ivory">JALPOS</b> y en Windows ve a <b className="text-ivory">Configuración → Bluetooth y dispositivos → Agregar dispositivo → Bluetooth</b>. Si pide PIN: <b className="text-ivory">0000</b> o <b className="text-ivory">1234</b>. Por USB basta con conectar el cable.</li>
        <li>Al emparejarla, Windows le crea un <b className="text-ivory">puerto COM</b> (ej. «Serie estándar sobre vínculo Bluetooth (COM5)»). Si aparecen dos, suele ser el de número más bajo.</li>
        <li>Toca <b className="text-ivory">Vincular impresora</b> y elige ese puerto COM. Queda recordado en este computador.</li>
        <li>Imprime la prueba. Si no sale nada, vincula el otro puerto COM; si salen símbolos raros, cambia la velocidad.</li>
      </ol>
      <Boton tam="sm" variante="borde" onClick={() => { cambiar({ columnas: 42, baudios: 9600 }); avisos.ok('Configurada como JALPOS / JAL-880L: 80 mm a 9600'); }}>
        ⚙️ Usar configuración JALPOS (80 mm · 9600)
      </Boton>

      <div className="rounded-2xl border border-gold/15 p-4">
        <Interruptor activo={cfg.ticketAlCobrar} onCambio={(v) => cambiar({ ticketAlCobrar: v })} etiqueta={<b>Imprimir el ticket del cliente al cobrar</b>} />
        <p className="mt-1 pl-11 text-xs text-smoke">Con sus productos, total, cómo pagó y el vuelto. Si está apagado, se imprime con el botón «Ticket» después de cobrar.</p>
      </div>

      <div className="rounded-2xl border border-gold/15 p-4">
        <Interruptor activo={cfg.auto} onCambio={(v) => cambiar({ auto: v })} etiqueta={<b>Imprimir las comandas nuevas en este computador</b>} />
        <p className="mt-1 pl-11 text-xs text-smoke">Cada pedido sale una sola vez, aunque haya otra pantalla con impresora. Si la impresora falla, se reintenta sola.</p>
        <div className="mt-3 flex flex-wrap gap-5 pl-11">
          <Interruptor activo={cfg.estaciones.includes('cocina')} onCambio={(v) => alternarEstacion('cocina', v)} etiqueta="Pedidos de cocina" />
          <Interruptor activo={cfg.estaciones.includes('barra')} onCambio={(v) => alternarEstacion('barra', v)} etiqueta="Pedidos de barra" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Papel">
          <Select value={cfg.columnas} onChange={(e) => cambiar({ columnas: Number(e.target.value) })}>
            <option value={42}>80 mm</option>
            <option value={32}>58 mm</option>
          </Select>
        </Campo>
        <Campo etiqueta="Velocidad" ayuda="Si imprime símbolos raros, prueba otra">
          <Select value={cfg.baudios} onChange={(e) => cambiar({ baudios: Number(e.target.value) })}>
            {[9600, 19200, 38400, 115200].map((b) => <option key={b} value={b}>{b}</option>)}
          </Select>
        </Campo>
      </div>
      <p className="text-[11px] text-smoke">Esto se guarda en este computador: cada computador con impresora se vincula una sola vez.</p>
    </div>
  );
}

/** Botón 🖨️ que abre la configuración de la impresora */
export function BotonImpresora() {
  const cfg = useConfigImpresora();
  const [abierto, setAbierto] = useState(false);
  const [conectada, setConectada] = useState(false);

  useEffect(() => {
    puertoAutorizado().then((p) => setConectada(!!p)).catch(() => {});
  }, [abierto]);

  if (!cfg) return null;
  const activa = cfg.auto && conectada;

  return (
    <>
      <Boton onClick={() => setAbierto(true)} title={activa ? `Imprimiendo comandas de ${cfg.estaciones.join(' y ')}` : 'Impresora de comandas'} aria-label="Impresora">
        <Printer size={16} className={activa ? 'text-venom' : ''} />
        {activa && <span className="h-2 w-2 animate-pulse rounded-full bg-venom" />}
      </Boton>
      {abierto && (
        <Modal titulo="Impresora térmica" subtitulo="JALPOS / JAL-880L u otra ESC/POS, por Bluetooth o USB, conectada a este computador" onCerrar={() => setAbierto(false)}
          pie={<Boton variante="oro" onClick={() => setAbierto(false)}>Listo</Boton>}>
          <PanelImpresora />
        </Modal>
      )}
    </>
  );
}
