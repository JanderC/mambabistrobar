'use client';

import { useEffect, useState } from 'react';
import { Area, Boton, Campo, Cargando, Encabezado, Input, InputNum, Interruptor, Pestanas, Select, Tarjeta, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { API_URL } from '@/lib/api';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
type Horario = { dia_semana: number; abierto: boolean; hora_apertura: string | null; hora_cierre: string | null; cierre_cocina: string | null; cierre_barra: string | null; nota: string | null };

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<'sistema' | 'local' | 'horarios'>('sistema');
  const ajustes = useDatos<Record<string, any>>('/config/ajustes');
  const [a, setA] = useState<Record<string, any> | null>(null);
  const [local, setLocal] = useState<Record<string, any> | null>(null);
  const [horarios, setHorarios] = useState<Horario[]>([]);
  const [guardando, setGuardando] = useState(false);
  const avisos = useAvisos();

  useEffect(() => { if (ajustes.datos) setA(ajustes.datos); }, [ajustes.datos]);
  useEffect(() => {
    fetch(`${API_URL}/local`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((l) => {
        setLocal(l);
        setHorarios([1, 2, 3, 4, 5, 6, 0].map((d) => l.horarios?.find((h: Horario) => h.dia_semana === d) ?? { dia_semana: d, abierto: false, hora_apertura: null, hora_cierre: null, cierre_cocina: null, cierre_barra: null, nota: null }));
      })
      .catch(() => avisos.error('No se pudieron cargar los datos del local'));
  }, [avisos]);

  const guardar = async (ruta: string, body: unknown) => {
    setGuardando(true);
    try {
      await adm(ruta, { method: 'PUT', body });
      avisos.ok('Configuración guardada');
    } catch (e) {
      avisos.error(e);
    } finally {
      setGuardando(false);
    }
  };

  if (!a || !local) return <Cargando />;
  const setL = (k: string, v: any) => setLocal({ ...local, [k]: v });
  const setH = (i: number, k: keyof Horario, v: any) => setHorarios(horarios.map((h, j) => (j === i ? { ...h, [k]: v } : h)));

  return (
    <div className="max-w-4xl">
      <Encabezado titulo="Configuración" descripcion="Reglas del sistema y datos que se muestran en el sitio web.">
        <Pestanas valor={tab} onCambio={setTab} opciones={[{ valor: 'sistema', etiqueta: 'Sistema' }, { valor: 'local', etiqueta: 'Datos del local' }, { valor: 'horarios', etiqueta: 'Horarios' }]} />
      </Encabezado>

      {tab === 'sistema' && (
        <Tarjeta className="space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Moneda principal" ayuda="En esta moneda se abren las cuentas y se muestran los totales. Los pagos se reciben en cualquiera.">
              <Select value={a.moneda_principal} onChange={(e) => setA({ ...a, moneda_principal: e.target.value })}>
                <option value="COP">Pesos colombianos (COP)</option>
                <option value="USD">Dólares (USD)</option>
                <option value="VES">Bolívares (VES)</option>
              </Select>
            </Campo>
            <Campo etiqueta="Aforo máximo (personas)" ayuda="El contador de la barra superior avisa cuando se acerca al límite.">
              <InputNum valor={a.capacidad_maxima} onCambio={(v) => setA({ ...a, capacidad_maxima: v ?? 0 })} />
            </Campo>
            <Campo etiqueta="Servicio / propina sugerida (%)">
              <InputNum valor={a.servicio_pct} onCambio={(v) => setA({ ...a, servicio_pct: v ?? 0 })} />
            </Campo>
            <Campo etiqueta="Avisar reservas (horas antes)">
              <InputNum valor={a.recordatorio_reserva_horas} onCambio={(v) => setA({ ...a, recordatorio_reserva_horas: v ?? 0 })} />
            </Campo>
          </div>
          <div className="space-y-3">
            <Interruptor activo={a.servicio_auto_mesas} onCambio={(v) => setA({ ...a, servicio_auto_mesas: v })} etiqueta="Agregar el servicio automáticamente al abrir cuentas de mesa" />
            <br />
            <Interruptor activo={a.permitir_venta_sin_stock} onCambio={(v) => setA({ ...a, permitir_venta_sin_stock: v })} etiqueta="Permitir vender aunque el inventario quede en negativo" />
          </div>
          <Campo etiqueta="Texto al pie del ticket"><Input value={a.ticket_pie ?? ''} onChange={(e) => setA({ ...a, ticket_pie: e.target.value })} /></Campo>
          <Boton variante="oro" cargando={guardando} onClick={() => guardar('/config/ajustes', a)}>Guardar sistema</Boton>
        </Tarjeta>
      )}

      {tab === 'local' && (
        <Tarjeta className="space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre"><Input value={local.nombre ?? ''} onChange={(e) => setL('nombre', e.target.value)} /></Campo>
            <Campo etiqueta="Eslogan"><Input value={local.eslogan ?? ''} onChange={(e) => setL('eslogan', e.target.value)} /></Campo>
            <Campo etiqueta="Descripción" className="sm:col-span-2"><Area value={local.descripcion ?? ''} onChange={(e) => setL('descripcion', e.target.value)} /></Campo>
            <Campo etiqueta="Dirección"><Input value={local.direccion ?? ''} onChange={(e) => setL('direccion', e.target.value)} /></Campo>
            <Campo etiqueta="Ciudad"><Input value={local.ciudad ?? ''} onChange={(e) => setL('ciudad', e.target.value)} /></Campo>
            <Campo etiqueta="Departamento / Estado"><Input value={local.departamento ?? ''} onChange={(e) => setL('departamento', e.target.value)} /></Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Latitud"><InputNum min={-90} valor={local.latitud} onCambio={(v) => setL('latitud', v)} /></Campo>
              <Campo etiqueta="Longitud"><InputNum min={-180} valor={local.longitud} onCambio={(v) => setL('longitud', v)} /></Campo>
            </div>
            <Campo etiqueta="WhatsApp (con código de país, sin +)" ayuda="Aquí llegan las reservas. Ej: 573001234567"><Input value={local.whatsapp ?? ''} onChange={(e) => setL('whatsapp', e.target.value.replace(/\D/g, ''))} /></Campo>
            <Campo etiqueta="Teléfono visible"><Input value={local.telefono ?? ''} onChange={(e) => setL('telefono', e.target.value)} /></Campo>
            <Campo etiqueta="Correo de reservas"><Input value={local.email_reservas ?? ''} onChange={(e) => setL('email_reservas', e.target.value)} /></Campo>
            <Campo etiqueta="Edad mínima"><InputNum valor={local.edad_minima} onCambio={(v) => setL('edad_minima', v ?? 18)} /></Campo>
            <Campo etiqueta="Instagram (sin @)"><Input value={local.instagram ?? ''} onChange={(e) => setL('instagram', e.target.value.replace('@', ''))} /></Campo>
            <Campo etiqueta="TikTok (sin @)"><Input value={local.tiktok ?? ''} onChange={(e) => setL('tiktok', e.target.value.replace('@', ''))} /></Campo>
            <Campo etiqueta="Dress code" className="sm:col-span-2"><Area value={local.dress_code ?? ''} onChange={(e) => setL('dress_code', e.target.value)} /></Campo>
          </div>
          <Boton variante="oro" cargando={guardando} onClick={() => guardar('/config/local', local)}>Guardar datos del local</Boton>
        </Tarjeta>
      )}

      {tab === 'horarios' && (
        <Tarjeta className="p-5">
          <div className="space-y-3">
            {horarios.map((h, i) => (
              <div key={h.dia_semana} className="grid items-end gap-3 border-b border-white/5 pb-3 sm:grid-cols-[130px_repeat(4,1fr)_1.5fr]">
                <Interruptor activo={h.abierto} onCambio={(v) => setH(i, 'abierto', v)} etiqueta={<span className="w-20 text-left font-medium">{DIAS[h.dia_semana]}</span>} />
                {(['hora_apertura', 'hora_cierre', 'cierre_cocina', 'cierre_barra'] as const).map((k) => (
                  <Campo key={k} etiqueta={{ hora_apertura: 'Abre', hora_cierre: 'Cierra', cierre_cocina: 'Cocina hasta', cierre_barra: 'Barra hasta' }[k]}>
                    <Input type="time" disabled={!h.abierto} value={h[k] ?? ''} onChange={(e) => setH(i, k, e.target.value || null)} />
                  </Campo>
                ))}
                <Campo etiqueta="Nota"><Input disabled={!h.abierto} value={h.nota ?? ''} onChange={(e) => setH(i, 'nota', e.target.value)} placeholder="Jueves de crossover" /></Campo>
              </div>
            ))}
          </div>
          <p className="my-3 text-xs text-smoke">Si cierras después de medianoche, pon la hora real (ej. 03:00): el sistema entiende que es del día siguiente.</p>
          <Boton variante="oro" cargando={guardando} onClick={() => guardar('/config/horarios', horarios)}>Guardar horarios</Boton>
        </Tarjeta>
      )}
    </div>
  );
}
