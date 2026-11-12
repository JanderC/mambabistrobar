'use client';

import { Unlock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useSesion } from '@/components/admin/Sesion';
import { Boton, Campo, Cargando, InputNum, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { type Moneda, MONEDAS, dinero } from '@/lib/admin/moneda';

export type CajaEstado = {
  id: number; nombre: string; sesion: { id: number; usuario: string } | null;
  arrastre: { usd: number; cop: number; ves: number } | null;
};

/**
 * Abrir turno de caja en un paso, sin salir de donde se está vendiendo.
 * Propone la caja de barra y el fondo que dejó el último cierre; basta con confirmar lo contado.
 */
export function AbrirCajaRapida({ onAbierta }: { onAbierta: () => void }) {
  const avisos = useAvisos();
  const { es } = useSesion();
  const puedeAbrir = es('gerente', 'cajero', 'barra');
  const cajas = useDatos<CajaEstado[]>('/caja');
  const cerradas = (cajas.datos ?? []).filter((c) => !c.sesion);
  const [cajaId, setCajaId] = useState<number | null>(null);
  const [fondo, setFondo] = useState<Record<Moneda, number | null>>({ COP: null, USD: null, VES: null });
  const [otras, setOtras] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  // La de barra si existe; si no, la primera cerrada. El fondo arranca con lo que dejó el último cierre.
  useEffect(() => {
    if (cajaId || !cerradas.length) return;
    const c = cerradas.find((x) => /barra/i.test(x.nombre)) ?? cerradas[0];
    setCajaId(c.id);
  }, [cerradas, cajaId]);
  const caja = cerradas.find((c) => c.id === cajaId);
  useEffect(() => {
    if (!caja) return;
    setFondo({ COP: caja.arrastre?.cop ?? null, USD: caja.arrastre?.usd || null, VES: caja.arrastre?.ves || null });
    setOtras(!!(caja.arrastre?.usd || caja.arrastre?.ves));
  }, [caja?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!puedeAbrir) return <p className="text-sm text-smoke">La caja está cerrada. Pídele al administrador o a la barra que la abra, o usa <b className="text-ivory">Pasar a caja</b> para que la cobren allá.</p>;
  if (cajas.cargando) return <Cargando />;
  if (!cerradas.length) return <p className="text-sm text-smoke">Todas las cajas ya están abiertas.</p>;

  const abrir = async () => {
    if (!caja) return;
    setOcupado(true);
    try {
      await adm('/caja/abrir', { method: 'POST', body: { caja_id: caja.id, fondo_inicial_cop: fondo.COP ?? 0, fondo_inicial_usd: fondo.USD ?? 0, fondo_inicial_ves: fondo.VES ?? 0 } });
      localStorage.setItem('mamba_caja', String(caja.id));
      avisos.ok(`${caja.nombre} abierta`);
      onAbierta();
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="space-y-4">
      {cerradas.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {cerradas.map((c) => (
            <button key={c.id} onClick={() => setCajaId(c.id)}
              className={`rounded-xl px-4 py-2.5 text-sm transition ${c.id === cajaId ? 'bg-gold font-semibold text-void' : 'border border-gold/25 text-smoke hover:text-ivory'}`}>{c.nombre}</button>
          ))}
        </div>
      )}
      <Campo etiqueta="¿Con cuánto efectivo arrancas? (pesos)" ayuda={caja?.arrastre ? `El último cierre dejó ${dinero(caja.arrastre.cop, 'COP')}. Cuéntalo y corrige si no cuadra.` : 'Cuenta los billetes y monedas que hay en la caja. Si no hay nada, déjalo en 0.'}>
        <InputNum valor={fondo.COP} onCambio={(v) => setFondo({ ...fondo, COP: v })} placeholder="0" autoFocus className="!h-14 !text-2xl" onKeyDown={(e) => e.key === 'Enter' && abrir()} />
      </Campo>
      {otras ? (
        <div className="grid grid-cols-2 gap-3">
          {MONEDAS.filter((m) => m !== 'COP').map((m) => <Campo key={m} etiqueta={`Fondo en ${m}`}><InputNum valor={fondo[m]} onCambio={(v) => setFondo({ ...fondo, [m]: v })} placeholder="0" /></Campo>)}
        </div>
      ) : (
        <button onClick={() => setOtras(true)} className="text-xs text-gold-light underline-offset-2 hover:underline">También hay dólares o bolívares en la caja</button>
      )}
      <Boton variante="oro" tam="lg" className="!h-14 w-full !text-base" cargando={ocupado} onClick={abrir}><Unlock size={18} /> Abrir {caja?.nombre ?? 'caja'}</Boton>
    </div>
  );
}
