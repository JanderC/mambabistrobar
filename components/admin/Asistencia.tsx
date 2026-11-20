'use client';

import { Clock, LogIn, LogOut } from 'lucide-react';
import { useState } from 'react';
import { Boton, Modal, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { soloHora } from '@/lib/admin/moneda';

/**
 * Control de entrada del personal, siempre a la vista arriba: «Marcar entrada» al empezar el turno y «Salida» al irse.
 * La gerencia ve las horas de cada uno en Administración → Asistencia.
 */
export function MarcarAsistencia() {
  const avisos = useAvisos();
  const estado = useDatos<{ abierta: { id: number; entrada: string } | null }>('/asistencia/mia', 5 * 60_000);
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  if (!estado.datos) return null;
  const abierta = estado.datos.abierta;

  const marcar = async (tipo: 'entrada' | 'salida') => {
    setOcupado(true);
    try {
      await adm(`/asistencia/${tipo}`, { method: 'POST' });
      avisos.ok(tipo === 'entrada' ? `Entrada marcada a las ${soloHora(new Date().toISOString())}. ¡Buen turno!` : `Salida marcada a las ${soloHora(new Date().toISOString())}. ¡Hasta luego!`);
      setConfirmarSalida(false);
      estado.recargar();
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      {abierta ? (
        <button onClick={() => setConfirmarSalida(true)} title="Marcar la salida"
          className="flex h-9 items-center gap-1.5 rounded-xl border border-venom/30 px-2.5 text-xs text-venom hover:bg-venom/10">
          <Clock size={14} /> <span className="hidden sm:inline">En turno desde</span> {soloHora(abierta.entrada)}
        </button>
      ) : (
        <button onClick={() => marcar('entrada')} disabled={ocupado}
          className="flex h-9 animate-pulse items-center gap-1.5 rounded-xl border-2 border-gold bg-gold/15 px-2.5 text-xs font-semibold text-gold-light disabled:opacity-50">
          <LogIn size={14} /> Marcar entrada
        </button>
      )}
      {confirmarSalida && abierta && (
        <Modal titulo="¿Terminas tu turno?" subtitulo={`Entraste a las ${soloHora(abierta.entrada)}`} onCerrar={() => setConfirmarSalida(false)} ancho="max-w-sm"
          pie={<><Boton variante="sutil" onClick={() => setConfirmarSalida(false)}>Sigo trabajando</Boton>
            <Boton variante="oro" cargando={ocupado} onClick={() => marcar('salida')}><LogOut size={16} /> Marcar salida</Boton></>}>
          <p className="text-sm text-smoke">Queda registrada la hora de salida. Si te equivocaste, la gerencia la puede corregir.</p>
        </Modal>
      )}
    </>
  );
}
