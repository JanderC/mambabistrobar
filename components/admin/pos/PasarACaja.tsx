'use client';

import { Wallet } from 'lucide-react';
import { useState } from 'react';
import { adm } from '@/lib/admin/api';
import { MONEDAS, dinero } from '@/lib/admin/moneda';
import { Deslizar } from '../Deslizar';
import { Cargando, Input, Modal, useAvisos, useDatos } from '../ui';
import { type Cuenta, tituloCuenta } from './tipos';

const FORMAS = ['Efectivo pesos', 'Efectivo dólares', 'Efectivo bolívares', 'Transferencia / Nequi', 'Pago Móvil', 'Zelle', 'Punto de venta'];
const EXTRAS = ['Dividir por puesto', 'Con propina', 'Necesita vuelto', 'Pide factura'];

/**
 * El mesonero entrega la cuenta al cajero desde la tablet: marca cómo va a pagar el cliente
 * (para que caja lo tenga listo) y desliza para enviarla. Llega al instante a la cola de cobro.
 */
export function PasarACaja({ cuentaId, onCerrar, onEnviada }: { cuentaId: number; onCerrar: () => void; onEnviada: (c: Cuenta) => void }) {
  const { datos: c, cargando } = useDatos<Cuenta>(`/cuentas/${cuentaId}`);
  const [marcas, setMarcas] = useState<string[]>([]);
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const avisos = useAvisos();

  const alternar = (m: string) => setMarcas((x) => (x.includes(m) ? x.filter((y) => y !== m) : [...x, m]));

  const enviar = async () => {
    setOcupado(true);
    try {
      const texto = [...marcas, nota.trim()].filter(Boolean).join(' · ');
      const cuenta = await adm<Cuenta>(`/cuentas/${cuentaId}/solicitar-cobro`, { method: 'POST', body: { nota: texto || null } });
      avisos.ok('Cuenta enviada a caja');
      onEnviada(cuenta);
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(false);
    }
  };

  const pendientes = c?.items.filter((i) => ['pendiente', 'preparando'].includes(i.estado)).length ?? 0;

  return (
    <Modal titulo={<span className="flex items-center gap-2"><Wallet size={18} className="text-gold" /> Pasar a caja</span>} subtitulo={c ? `${tituloCuenta(c)}${c.nombre_cliente ? ` · ${c.nombre_cliente}` : ''} · ${c.numero}` : undefined} onCerrar={onCerrar} ancho="max-w-xl">
      {cargando || !c ? <Cargando /> : (
        <div className="space-y-5">
          <div className="rounded-2xl border border-gold/20 bg-gold/5 p-4 text-center">
            <p className="text-[11px] tracking-wider text-smoke uppercase">{c.pagado > 0 ? 'Saldo por cobrar' : 'Total de la cuenta'}</p>
            <p className="font-display text-5xl font-light text-gold-light">{dinero(c.saldo, c.moneda)}</p>
            <p className="mt-1 flex justify-center gap-4 text-sm text-smoke">
              {MONEDAS.filter((m) => m !== c.moneda).map((m) => <span key={m}>{dinero(c.equivalentes.saldo[m], m)}</span>)}
            </p>
            <p className="mt-2 text-xs text-smoke">{c.items.filter((i) => i.estado !== 'anulado').length} ítems · {c.personas} personas</p>
          </div>

          {pendientes > 0 && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200">Ojo: {pendientes === 1 ? 'aún hay 1 ítem' : `aún hay ${pendientes} ítems`} sin entregar en esta cuenta.</p>}

          <section>
            <h3 className="mb-2 text-xs tracking-wider text-gold uppercase">¿Cómo va a pagar? <span className="text-smoke normal-case">· opcional, le ahorra tiempo a caja</span></h3>
            <div className="flex flex-wrap gap-2">
              {FORMAS.map((m) => (
                <button key={m} onClick={() => alternar(m)} className={`rounded-full px-4 py-2.5 text-sm transition ${marcas.includes(m) ? 'bg-gold font-semibold text-void' : 'border border-gold/25 text-ivory/85'}`}>{m}</button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {EXTRAS.map((m) => (
                <button key={m} onClick={() => alternar(m)} className={`rounded-full px-4 py-2.5 text-sm transition ${marcas.includes(m) ? 'bg-venom font-semibold text-void' : 'border border-venom/25 text-ivory/85'}`}>{m}</button>
              ))}
            </div>
            <Input className="mt-3" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Algo más para el cajero…" maxLength={120} />
          </section>

          <Deslizar texto="Desliza para enviar a caja" icono={<Wallet size={22} />} ocupado={ocupado} onConfirmar={enviar} />
        </div>
      )}
    </Modal>
  );
}
