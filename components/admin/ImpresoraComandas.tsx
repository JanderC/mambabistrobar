'use client';

import { Printer } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { adm } from '@/lib/admin/api';
import {
  type ConfigImpresora, EVENTO_CONFIG, type Estacion, type ItemTicket, conectarImpresora, enviarAImpresora, guardarConfig, leerConfig,
  lugarTicket, puertoAutorizado, soportaImpresora, ticketComanda, ticketPrueba,
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

/** Botón 🖨️ con su configuración: conectar, probar y elegir qué imprime esta pantalla */
export function BotonImpresora() {
  const cfg = useConfigImpresora();
  const avisos = useAvisos();
  const [abierto, setAbierto] = useState(false);
  const [conectada, setConectada] = useState(false);
  const [probando, setProbando] = useState(false);

  useEffect(() => {
    puertoAutorizado().then((p) => setConectada(!!p)).catch(() => {});
  }, [abierto]);

  if (!cfg) return null;
  const activa = cfg.auto && conectada;
  const cambiar = (c: Partial<ConfigImpresora>) => guardarConfig({ ...cfg, ...c });
  const alternarEstacion = (e: Estacion, si: boolean) => cambiar({ estaciones: si ? [...new Set([...cfg.estaciones, e])] : cfg.estaciones.filter((x) => x !== e) });

  const conectar = async () => {
    if (await conectarImpresora()) {
      setConectada(true);
      avisos.ok('🔌 Impresora conectada');
    }
  };
  const probar = async () => {
    setProbando(true);
    const ok = await enviarAImpresora(ticketPrueba());
    setProbando(false);
    if (ok) avisos.ok('🖨️ Ticket de prueba enviado');
    else avisos.error(new Error('No imprimió. Revisa que esté encendida, emparejada y prueba otra velocidad.'));
  };

  return (
    <>
      <Boton onClick={() => setAbierto(true)} title={activa ? `Imprimiendo comandas de ${cfg.estaciones.join(' y ')}` : 'Impresora de comandas'} aria-label="Impresora">
        <Printer size={16} className={activa ? 'text-venom' : ''} />
        {activa && <span className="h-2 w-2 animate-pulse rounded-full bg-venom" />}
      </Boton>

      {abierto && (
        <Modal titulo="Impresora de comandas" subtitulo="Impresora térmica Bluetooth o USB conectada a este computador" onCerrar={() => setAbierto(false)}
          pie={<Boton variante="oro" onClick={() => setAbierto(false)}>Listo</Boton>}>
          {!soportaImpresora() ? (
            <p className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-sm text-red-200">
              Este navegador no puede imprimir directo. Abre el sistema en <b>Chrome o Edge</b> en el computador que tiene la impresora.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm ${conectada ? 'bg-venom/15 text-venom' : 'bg-white/5 text-smoke'}`}>
                  <span className={`h-2 w-2 rounded-full ${conectada ? 'bg-venom' : 'bg-smoke'}`} /> {conectada ? 'Impresora conectada' : 'Sin impresora'}
                </span>
                <Boton onClick={conectar}>{conectada ? 'Cambiar impresora' : '🔌 Conectar impresora'}</Boton>
                {conectada && <Boton onClick={probar} cargando={probando}>Imprimir prueba</Boton>}
              </div>
              {!conectada && (
                <p className="text-xs leading-relaxed text-smoke">
                  Empareja primero la impresora por Bluetooth en Windows (o conéctala por USB). Luego toca «Conectar impresora» y elige su puerto
                  (suele llamarse «Bluetooth… COM» o «USB Serial»). Solo hay que hacerlo una vez en este computador.
                </p>
              )}

              <div className="rounded-2xl border border-gold/15 p-4">
                <Interruptor activo={cfg.auto} onCambio={(v) => cambiar({ auto: v })} etiqueta={<b>Imprimir solo los pedidos nuevos en esta pantalla</b>} />
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
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
