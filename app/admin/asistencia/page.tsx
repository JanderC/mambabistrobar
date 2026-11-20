'use client';

import { useMemo, useState } from 'react';
import { Cargando, Encabezado, ErrorCaja, Insignia, Tarjeta, Vacio, useDatos } from '@/components/admin/ui';
import { ROLES } from '@/lib/admin/modulos';

type Registro = { id: number; entrada: string; salida: string | null; nombre: string; rol: string; horas: number };

const hoy = () => {
  const d = new Date(Date.now() - 6 * 3600_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const restar = (f: string, dias: number) => { const d = new Date(`${f}T12:00:00`); d.setDate(d.getDate() - dias); return d.toISOString().slice(0, 10); };
const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const hm = (h: number) => `${Math.floor(h)} h ${String(Math.round((h % 1) * 60)).padStart(2, '0')} min`;

/** Asistencia del personal: a qué hora entró y salió cada uno, y cuántas horas trabajó */
export default function AsistenciaPage() {
  const [desde, setDesde] = useState(restar(hoy(), 6));
  const [hasta, setHasta] = useState(hoy());
  const datos = useDatos<Registro[]>(`/asistencia?desde=${desde}&hasta=${hasta}`, 60_000);

  const porPersona = useMemo(() => {
    const m = new Map<string, { nombre: string; rol: string; horas: number; turnos: number; abierto: boolean }>();
    for (const r of datos.datos ?? []) {
      const x = m.get(r.nombre) ?? { nombre: r.nombre, rol: r.rol, horas: 0, turnos: 0, abierto: false };
      x.horas += r.horas; x.turnos++; if (!r.salida) x.abierto = true;
      m.set(r.nombre, x);
    }
    return [...m.values()].sort((a, b) => b.horas - a.horas);
  }, [datos.datos]);

  return (
    <div className="max-w-5xl">
      <Encabezado titulo="Asistencia" descripcion="Cada empleado marca su entrada y su salida arriba en la pantalla. Aquí se ven las horas de cada uno.">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {[['Hoy', 0], ['7 días', 6], ['15 días', 14], ['30 días', 29]].map(([t, n]) => (
            <button key={t} onClick={() => { setDesde(restar(hoy(), Number(n))); setHasta(hoy()); }} className="rounded-full border border-gold/20 px-3 py-1.5 text-smoke hover:text-ivory">{t}</button>
          ))}
          <input type="date" value={desde} onChange={(e) => e.target.value && setDesde(e.target.value)} className="h-9 rounded-xl border border-gold/20 bg-void/60 px-2 text-ivory [color-scheme:dark]" />
          <span className="text-smoke">a</span>
          <input type="date" value={hasta} onChange={(e) => e.target.value && setHasta(e.target.value)} className="h-9 rounded-xl border border-gold/20 bg-void/60 px-2 text-ivory [color-scheme:dark]" />
        </div>
      </Encabezado>

      {datos.cargando ? <Cargando /> : datos.error ? <ErrorCaja mensaje={datos.error} onReintentar={datos.recargar} /> : !datos.datos?.length ? (
        <Vacio titulo="Nadie marcó en esas fechas">Cada empleado marca «Entrada» arriba en la pantalla al empezar su turno.</Vacio>
      ) : (
        <>
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {porPersona.map((p) => (
              <Tarjeta key={p.nombre} className="p-3">
                <p className="flex items-center justify-between gap-2 font-medium">{p.nombre}{p.abierto && <Insignia color="verde">En turno</Insignia>}</p>
                <p className="text-xs text-smoke">{ROLES.find((r) => r.valor === p.rol)?.nombre ?? p.rol} · {p.turnos} {p.turnos === 1 ? 'turno' : 'turnos'}</p>
                <p className="mt-1 font-display text-2xl text-gold-light">{hm(p.horas)}</p>
              </Tarjeta>
            ))}
          </div>
          <Tarjeta className="overflow-x-auto p-3">
            <table className="w-full min-w-[560px] text-sm">
              <thead><tr className="text-left text-[11px] tracking-wider text-smoke uppercase"><th className="p-2">Empleado</th><th className="p-2">Entrada</th><th className="p-2">Salida</th><th className="p-2 text-right">Horas</th></tr></thead>
              <tbody>
                {datos.datos.map((r) => (
                  <tr key={r.id} className="border-t border-white/5">
                    <td className="p-2">{r.nombre}</td>
                    <td className="p-2 text-venom">{fechaHora(r.entrada)}</td>
                    <td className="p-2">{r.salida ? fechaHora(r.salida) : <Insignia color="oro">Sin salida</Insignia>}</td>
                    <td className="p-2 text-right tabular-nums">{hm(r.horas)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Tarjeta>
        </>
      )}
    </div>
  );
}
