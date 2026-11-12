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
  }, [caja?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!puedeAbrir) return <p className="text-sm text-smoke">La caja está cerrada. Pídele al administrador o a la barra que la abra, o usa <b className="text-ivory">Pasar a caja</b> para que la cobren allá.</p>;
  if (cajas.cargando) return <Cargando />;
  // No hay ninguna caja creada todavía: se crea aquí mismo y se abre
  if (!(cajas.datos ?? []).length)
    return (
      <div className="space-y-4">
        <p className="text-sm text-smoke">Todavía no hay ninguna caja creada en el sistema. Crea la caja de la barra y la abres con tu monto.</p>
        <Boton variante="oro" tam="lg" className="w-full" cargando={ocupado} onClick={async () => {
          setOcupado(true);
          try {
            await adm('/cajas', { method: 'POST', body: { nombre: 'Caja Barra', descripcion: 'Los clientes de barra van cancelando aquí' } });
            cajas.recargar();
          } catch (e) {
            avisos.error(e);
          } finally {
            setOcupado(false);
          }
        }}>Crear la «Caja Barra»</Boton>
      </div>
    );
  // Se abrió desde otra pantalla mientras esta mostraba «cerrada»: se avisa y se actualiza todo
  if (!cerradas.length)
    return (
      <div className="space-y-4 text-center">
        <p className="text-lg text-venom">✓ La caja ya está abierta</p>
        <p className="text-sm text-smoke">{(cajas.datos ?? []).filter((c) => c.sesion).map((c) => `${c.nombre} · ${c.sesion!.usuario}`).join(' · ')}</p>
        <Boton variante="oro" tam="lg" className="w-full" onClick={onAbierta}>Continuar</Boton>
      </div>
    );

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
      {/* Efectivo con que arranca el turno, en cada moneda (lo que no haya, se deja vacío) */}
      <div>
        <p className="mb-2 text-[11px] font-medium tracking-wider text-gold/80 uppercase">¿Con cuánto efectivo arrancas?</p>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Pesos (COP)">
            <InputNum valor={fondo.COP} onCambio={(v) => setFondo({ ...fondo, COP: v })} placeholder="0" autoFocus className="!h-14 !text-2xl" onKeyDown={(e) => e.key === 'Enter' && abrir()} />
          </Campo>
          <Campo etiqueta="Dólares (USD)">
            <InputNum valor={fondo.USD} onCambio={(v) => setFondo({ ...fondo, USD: v })} placeholder="0" className="!h-14 !text-2xl" onKeyDown={(e) => e.key === 'Enter' && abrir()} />
          </Campo>
        </div>
        <Campo etiqueta="Bolívares (VES)" className="mt-3">
          <InputNum valor={fondo.VES} onCambio={(v) => setFondo({ ...fondo, VES: v })} placeholder="0" onKeyDown={(e) => e.key === 'Enter' && abrir()} />
        </Campo>
        <p className="mt-2 text-[11px] text-smoke/80">
          {caja?.arrastre
            ? `El último cierre dejó ${MONEDAS.filter((m) => caja.arrastre![m.toLowerCase() as 'cop' | 'usd' | 'ves']).map((m) => dinero(caja.arrastre![m.toLowerCase() as 'cop' | 'usd' | 'ves'], m)).join(' · ') || 'la caja vacía'}. Cuéntalo y corrige si no cuadra.`
            : 'Cuenta los billetes de cada moneda. Lo que no haya, déjalo vacío.'}
        </p>
      </div>
      <Boton variante="oro" tam="lg" className="!h-14 w-full !text-base" cargando={ocupado} onClick={abrir}><Unlock size={18} /> Abrir {caja?.nombre ?? 'caja'}</Boton>
    </div>
  );
}
