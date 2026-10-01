'use client';

import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useSesion } from '@/components/admin/Sesion';
import { Boton, Campo, Cargando, Encabezado, ErrorCaja, InputNum, Insignia, Tabla, Tarjeta, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { type Tasa, convertir, dinero, fechaHora, numero } from '@/lib/admin/moneda';

export default function TasasPage() {
  const { es } = useSesion();
  const puede = es('gerente');
  const actual = useDatos<Tasa>('/tasas/actual');
  const historial = useDatos<(Tasa & { usuario: string | null })[]>('/tasas/historial');
  const avisos = useAvisos();
  const [ocupado, setOcupado] = useState('');
  const [manual, setManual] = useState<{ usd_ves: number | null; usd_cop: number | null }>({ usd_ves: null, usd_cop: null });
  const [cruce, setCruce] = useState<number | null>(null);
  const [calc, setCalc] = useState<number | null>(100);

  const recargar = () => {
    actual.recargar();
    historial.recargar();
  };
  const hacer = async (clave: string, fn: () => Promise<unknown>, ok: string) => {
    setOcupado(clave);
    try {
      await fn();
      avisos.ok(ok);
      recargar();
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado('');
    }
  };

  if (actual.cargando) return <Cargando />;
  const t = actual.datos;

  return (
    <div>
      <Encabezado titulo="Tasas de cambio" descripcion="Con estas tasas se convierten los precios y los pagos entre pesos, dólares y bolívares. Se actualizan solas todos los días a las 8:00 a.m.">
        {puede && (
          <Boton variante="oro" cargando={ocupado === 'bcv'} onClick={() => hacer('bcv', () => adm('/tasas/actualizar', { method: 'POST' }), 'Tasa oficial actualizada')}>
            <RefreshCw size={15} /> Actualizar desde BCV / TRM
          </Boton>
        )}
      </Encabezado>

      {actual.error && <ErrorCaja mensaje={actual.error} onReintentar={recargar} />}

      {t && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <Tarjeta className="p-5">
              <p className="text-[11px] tracking-wider text-smoke uppercase">1 dólar en pesos (TRM)</p>
              <p className="mt-1 font-display text-3xl font-light text-gold-light">$ {numero(t.usd_cop, 2)}</p>
            </Tarjeta>
            <Tarjeta className="p-5">
              <p className="text-[11px] tracking-wider text-smoke uppercase">1 dólar en bolívares (BCV)</p>
              <p className="mt-1 font-display text-3xl font-light text-gold-light">Bs {numero(t.usd_ves, 2)}</p>
            </Tarjeta>
            <Tarjeta className={`p-5 ${t.ves_cop_manual ? 'ring-1 ring-venom/40' : ''}`}>
              <p className="flex items-center gap-2 text-[11px] tracking-wider text-smoke uppercase">
                1 bolívar en pesos {t.ves_cop_manual ? <Insignia color="verde">Fijado a mano</Insignia> : <Insignia>Automático</Insignia>}
              </p>
              <p className="mt-1 font-display text-3xl font-light text-gold-light">$ {numero(t.ves_cop, 4)}</p>
            </Tarjeta>
          </div>
          <p className="mt-2 text-xs text-smoke">Vigente desde {fechaHora(t.created_at)} · fuente: {t.fuente}{t.fuente === 'inicial' && ' (referencial: actualízala antes de vender)'}</p>

          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <Tarjeta className="p-5">
              <h2 className="mb-3 font-display text-base">Calculadora rápida</h2>
              <Campo etiqueta="Monto en dólares"><InputNum valor={calc} onCambio={setCalc} /></Campo>
              <div className="mt-3 space-y-1 text-sm">
                <p className="flex justify-between"><span className="text-smoke">En pesos</span><b>{dinero(convertir(calc ?? 0, 'USD', 'COP', t), 'COP')}</b></p>
                <p className="flex justify-between"><span className="text-smoke">En bolívares</span><b>{dinero(convertir(calc ?? 0, 'USD', 'VES', t), 'VES')}</b></p>
              </div>
            </Tarjeta>

            {puede && (
              <>
                <Tarjeta className="p-5">
                  <h2 className="mb-1 font-display text-base">Registrar tasa a mano</h2>
                  <p className="mb-3 text-xs text-smoke">Úsalo si el servicio oficial no responde o quieres trabajar con otra tasa.</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Campo etiqueta="USD → COP"><InputNum valor={manual.usd_cop} onCambio={(v) => setManual({ ...manual, usd_cop: v })} placeholder={String(t.usd_cop)} /></Campo>
                    <Campo etiqueta="USD → VES"><InputNum valor={manual.usd_ves} onCambio={(v) => setManual({ ...manual, usd_ves: v })} placeholder={String(t.usd_ves)} /></Campo>
                  </div>
                  <Boton className="mt-3 w-full" cargando={ocupado === 'manual'} disabled={!manual.usd_cop || !manual.usd_ves}
                    onClick={() => hacer('manual', () => adm('/tasas/manual', { method: 'POST', body: manual }).then(() => setManual({ usd_ves: null, usd_cop: null })), 'Tasa registrada')}>
                    Guardar tasa
                  </Boton>
                </Tarjeta>

                <Tarjeta className="p-5">
                  <h2 className="mb-1 font-display text-base">Cruce bolívar / peso</h2>
                  <p className="mb-3 text-xs text-smoke">La tasa de la calle en frontera suele ser distinta a la oficial. Si la fijas, los bolívares se convierten con este valor aunque el BCV cambie.</p>
                  <Campo etiqueta="1 Bs = ¿cuántos pesos?"><InputNum valor={cruce} onCambio={setCruce} placeholder={String(t.ves_cop)} /></Campo>
                  <div className="mt-3 flex gap-2">
                    <Boton className="flex-1" cargando={ocupado === 'cruce'} disabled={!cruce}
                      onClick={() => hacer('cruce', () => adm('/tasas/actual/ves-cop', { method: 'PATCH', body: { ves_cop: cruce } }).then(() => setCruce(null)), 'Cruce fijado')}>
                      Fijar
                    </Boton>
                    {t.ves_cop_manual && (
                      <Boton variante="sutil" cargando={ocupado === 'auto'} onClick={() => hacer('auto', () => adm('/tasas/actual/ves-cop', { method: 'PATCH', body: { ves_cop: null } }), 'Cruce en automático')}>
                        Volver a automático
                      </Boton>
                    )}
                  </div>
                </Tarjeta>
              </>
            )}
          </div>
        </>
      )}

      <h2 className="mt-8 mb-3 font-display text-lg">Historial</h2>
      <Tabla
        filas={historial.datos ?? []}
        clave={(h) => h.id}
        columnas={[
          { titulo: 'Fecha', celda: (h) => fechaHora(h.created_at) },
          { titulo: 'USD → COP', celda: (h) => numero(h.usd_cop, 2), alinear: 'der' },
          { titulo: 'USD → VES', celda: (h) => numero(h.usd_ves, 2), alinear: 'der' },
          { titulo: 'VES → COP', celda: (h) => <span>{numero(h.ves_cop, 4)} {h.ves_cop_manual && <Insignia color="verde">manual</Insignia>}</span>, alinear: 'der' },
          { titulo: 'Fuente', celda: (h) => <Insignia color={h.fuente === 'BCV' ? 'azul' : 'oro'}>{h.fuente}</Insignia> },
          { titulo: 'Registró', celda: (h) => <span className="text-smoke">{h.usuario ?? 'Automático'}</span> },
        ]}
      />
    </div>
  );
}
