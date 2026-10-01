'use client';

import { DoorOpen, HandCoins, Search, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { adm } from '@/lib/admin/api';
import { type Moneda, dinero } from '@/lib/admin/moneda';
import { Boton, Campo, Input, Modal, useAvisos } from '../ui';
import type { Cuenta } from './tipos';

type ClienteMin = { id: number; nombre: string; telefono: string | null; vip: boolean };
type Props = {
  cuenta: { id: number; numero: string; saldo: number; moneda: Moneda; nombre_cliente: string | null };
  motivoInicial?: 'fiado' | 'se_fue';
  onCerrar: () => void;
  onFiada: (c: Cuenta) => void;
};

/**
 * Cierra la cuenta dejando el saldo como deuda de un cliente:
 *  - "Fiado": el cliente pidió que se lo anoten.
 *  - "Se fue sin pagar": consumió y se fue; queda registrado a su nombre para cobrarle después.
 */
export function Fiar({ cuenta, motivoInicial = 'fiado', onCerrar, onFiada }: Props) {
  const [motivo, setMotivo] = useState<'fiado' | 'se_fue'>(motivoInicial);
  const [q, setQ] = useState('');
  const [resultados, setResultados] = useState<ClienteMin[]>([]);
  const [cliente, setCliente] = useState<ClienteMin | null>(null);
  const [nuevo, setNuevo] = useState<{ nombre: string; telefono: string } | null>(null);
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const avisos = useAvisos();

  // Búsqueda de clientes mientras se escribe
  useEffect(() => {
    if (cliente || nuevo) return;
    const id = setTimeout(() => {
      adm<ClienteMin[]>(`/clientes?q=${encodeURIComponent(q.trim())}`).then((r) => setResultados(r.slice(0, 8))).catch(() => setResultados([]));
    }, 250);
    return () => clearTimeout(id);
  }, [q, cliente, nuevo]);

  const confirmar = async () => {
    if (!cliente && !(nuevo && nuevo.nombre.trim().length >= 2)) return avisos.error('Indica a nombre de quién queda la deuda');
    setOcupado(true);
    try {
      const c = await adm<Cuenta>(`/cuentas/${cuenta.id}/fiar`, {
        method: 'POST',
        body: { motivo, nota: nota.trim() || null, cliente_id: cliente?.id ?? null, cliente_nuevo: cliente ? null : { nombre: nuevo!.nombre.trim(), telefono: nuevo!.telefono.trim() || null } },
      });
      avisos.ok(`Deuda de ${dinero(cuenta.saldo, cuenta.moneda)} cargada a ${cliente?.nombre ?? nuevo!.nombre}`);
      onFiada(c);
    } catch (e) {
      avisos.error(e);
      setOcupado(false);
    }
  };

  return (
    <Modal
      titulo="Dejar la cuenta a crédito"
      subtitulo={`${cuenta.numero} · quedan por pagar ${dinero(cuenta.saldo, cuenta.moneda)}`}
      onCerrar={onCerrar}
      ancho="max-w-xl"
      pie={<><Boton variante="sutil" onClick={onCerrar}>Cancelar</Boton><Boton variante="oro" tam="lg" cargando={ocupado} onClick={confirmar}>Cargar {dinero(cuenta.saldo, cuenta.moneda)} al cliente</Boton></>}
    >
      <div className="space-y-5">
        <section>
          <h3 className="mb-2 text-xs tracking-wider text-gold uppercase">¿Qué pasó?</h3>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMotivo('fiado')} className={`rounded-2xl border p-4 text-left transition ${motivo === 'fiado' ? 'border-gold bg-gold/15' : 'border-gold/15'}`}>
              <HandCoins size={22} className="text-gold" />
              <p className="mt-2 font-medium">Fía</p>
              <p className="text-xs text-smoke">Pidió que se lo anoten y paga después.</p>
            </button>
            <button onClick={() => setMotivo('se_fue')} className={`rounded-2xl border p-4 text-left transition ${motivo === 'se_fue' ? 'border-red-400 bg-red-500/15' : 'border-gold/15'}`}>
              <DoorOpen size={22} className="text-red-300" />
              <p className="mt-2 font-medium">Consumió y se fue</p>
              <p className="text-xs text-smoke">Se fue sin pagar. Queda a su nombre para cobrarle.</p>
            </button>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-xs tracking-wider text-gold uppercase">¿A nombre de quién queda la deuda?</h3>
          {cliente ? (
            <div className="flex items-center justify-between rounded-2xl border border-venom/40 bg-emerald/30 p-3">
              <div><p className="font-medium">{cliente.nombre}</p><p className="text-xs text-smoke">{cliente.telefono ?? 'Sin teléfono'}</p></div>
              <Boton tam="sm" variante="sutil" onClick={() => setCliente(null)}>Cambiar</Boton>
            </div>
          ) : nuevo ? (
            <div className="space-y-3 rounded-2xl border border-gold/20 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo etiqueta="Nombre"><Input autoFocus value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} placeholder={motivo === 'se_fue' ? 'Nombre o seña: “camisa roja, mesa 4”' : 'Nombre y apellido'} /></Campo>
                <Campo etiqueta="WhatsApp (para cobrarle)"><Input type="tel" inputMode="tel" value={nuevo.telefono} onChange={(e) => setNuevo({ ...nuevo, telefono: e.target.value })} placeholder="573001234567" /></Campo>
              </div>
              <Boton tam="sm" variante="sutil" onClick={() => setNuevo(null)}>Buscar un cliente existente</Boton>
            </div>
          ) : (
            <>
              <label className="relative block">
                <Search size={16} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-smoke" />
                <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por nombre, teléfono o documento…" className="pl-10" />
              </label>
              <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                {resultados.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => setCliente(c)} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-white/5">
                      <span className="font-medium">{c.nombre}</span><span className="text-xs text-smoke">{c.telefono ?? ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <Boton className="mt-2 w-full" onClick={() => setNuevo({ nombre: q.trim() || cuenta.nombre_cliente || '', telefono: '' })}><UserPlus size={16} /> Cliente nuevo{q.trim() ? `: “${q.trim()}”` : ''}</Boton>
            </>
          )}
        </section>

        <Campo etiqueta="Nota (opcional)"><Input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Paga el viernes, lo autorizó el gerente…" maxLength={200} /></Campo>
      </div>
    </Modal>
  );
}
