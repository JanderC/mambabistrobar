'use client';

import { Armchair, Check, MessageCircle, Star, Users, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Area, Boton, Campo, Cargando, Encabezado, ErrorCaja, Insignia, Modal, Pestanas, Select, Tarjeta, Vacio, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { agrupar, dinero, fechaCorta, jornadaHoy } from '@/lib/admin/moneda';

type Reserva = {
  id: string; codigo: string; estado: string; fecha: string; hora: string; personas: number; motivo: string; nombre_completo: string; telefono: string;
  notas: string | null; nota_interna: string | null; mesa_id: number | null; mesa_numero: number | null; zona_id: number; zona: string; es_vip: boolean;
  consumo_minimo_cop: number; evento: string | null;
};
type Mesa = { id: number; numero: number; nombre: string | null; zona_id: number; zona: string; capacidad: number; activo: boolean };

const ESTADO: Record<string, { color: 'oro' | 'verde' | 'rojo' | 'gris' | 'azul'; nombre: string }> = {
  pendiente: { color: 'oro', nombre: 'Por confirmar' },
  confirmada: { color: 'verde', nombre: 'Confirmada' },
  rechazada: { color: 'rojo', nombre: 'Rechazada' },
  cancelada: { color: 'rojo', nombre: 'Cancelada' },
  asistio: { color: 'azul', nombre: 'Asistió' },
  no_asistio: { color: 'gris', nombre: 'No llegó' },
};
const MOTIVO: Record<string, string> = { cumpleanos: '🎂 Cumpleaños', corporativo: '💼 Corporativo', casual: '🍸 Casual', despedida: '🎉 Despedida', aniversario: '💍 Aniversario', otro: '✨ Otro' };

export default function ReservasPage() {
  const router = useRouter();
  const [vista, setVista] = useState<'proximas' | 'hoy' | 'pasadas'>('proximas');
  const hoy = jornadaHoy();
  const ruta = vista === 'hoy' ? `/reservas?desde=${hoy}&hasta=${hoy}` : vista === 'proximas' ? `/reservas?desde=${hoy}` : `/reservas?hasta=${jornadaHoy(-1)}`;
  const { datos, cargando, error, recargar } = useDatos<Reserva[]>(ruta, 60_000);
  const mesas = useDatos<Mesa[]>('/salon/mesas');
  const [sel, setSel] = useState<Reserva | null>(null);
  const [nota, setNota] = useState('');
  const [mesaId, setMesaId] = useState<number | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const avisos = useAvisos();

  const abrir = (r: Reserva) => {
    setSel(r);
    setNota(r.nota_interna ?? '');
    setMesaId(r.mesa_id);
  };

  const actualizar = async (cambios: Record<string, unknown>, ok: string) => {
    if (!sel) return;
    setOcupado(true);
    try {
      await adm(`/reservas/${sel.id}`, { method: 'PATCH', body: { nota_interna: nota || null, mesa_id: mesaId, ...cambios } });
      avisos.ok(ok);
      setSel(null);
      recargar();
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(false);
    }
  };

  const sentar = async () => {
    if (!sel || !mesaId) return avisos.error('Elige la mesa donde se va a sentar');
    setOcupado(true);
    try {
      const { cuenta_id } = await adm<{ cuenta_id: number }>(`/reservas/${sel.id}/sentar`, { method: 'POST', body: { mesa_id: mesaId } });
      router.push(`/admin/cuenta/${cuenta_id}`);
    } catch (e) {
      avisos.error(e);
      setOcupado(false);
    }
  };

  const lista = vista === 'pasadas' ? [...(datos ?? [])].reverse() : (datos ?? []);
  const porDia = agrupar(lista, (r) => r.fecha);
  const wa = (r: Reserva, texto: string) => `https://wa.me/${r.telefono}?text=${encodeURIComponent(texto)}`;

  return (
    <div className="max-w-6xl">
      <Encabezado titulo="Reservas" descripcion="Las solicitudes llegan desde la web. Confirma por WhatsApp, asigna la mesa y, cuando lleguen, siéntalos con un toque.">
        <Pestanas valor={vista} onCambio={setVista} opciones={[{ valor: 'hoy', etiqueta: 'Esta noche' }, { valor: 'proximas', etiqueta: 'Próximas' }, { valor: 'pasadas', etiqueta: 'Anteriores' }]} />
      </Encabezado>

      {cargando ? <Cargando /> : error ? <ErrorCaja mensaje={error} onReintentar={recargar} /> : !lista.length ? <Vacio titulo="No hay reservas en esta vista" /> : (
        <div className="space-y-6">
          {porDia.map(([fecha, rs]) => (
            <section key={fecha}>
              <h2 className="mb-2 flex items-center gap-3 font-display text-lg">
                {fechaCorta(fecha)} {fecha === hoy && <Insignia color="verde">Hoy</Insignia>}
                <span className="text-sm text-smoke normal-case">{rs.length} reservas · {rs.filter((r) => ['pendiente', 'confirmada'].includes(r.estado)).reduce((s, r) => s + r.personas, 0)} personas esperadas</span>
              </h2>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {rs.map((r) => (
                  <Tarjeta key={r.id} onClick={() => abrir(r)} className={`cursor-pointer p-4 transition hover:border-gold/40 ${r.estado === 'pendiente' ? 'border-gold/40' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.nombre_completo}</p>
                        <p className="text-xs text-smoke">{r.codigo} · {MOTIVO[r.motivo] ?? r.motivo}</p>
                      </div>
                      <Insignia color={ESTADO[r.estado]?.color}>{ESTADO[r.estado]?.nombre ?? r.estado}</Insignia>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="font-display text-xl text-gold-light">{r.hora}</span>
                      <span className="flex items-center gap-1 text-smoke"><Users size={14} /> {r.personas}</span>
                      <span className="flex items-center gap-1 text-smoke">{r.es_vip && <Star size={13} className="fill-gold text-gold" />}{r.zona}</span>
                      {r.mesa_numero && <span className="flex items-center gap-1 text-venom"><Armchair size={14} /> Mesa {r.mesa_numero}</span>}
                    </div>
                    {r.evento && <p className="mt-2 text-xs text-sky-300">🎉 {r.evento}</p>}
                    {r.notas && <p className="mt-2 line-clamp-2 text-xs text-smoke">“{r.notas}”</p>}
                  </Tarjeta>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {sel && (
        <Modal
          titulo={sel.nombre_completo}
          subtitulo={`${sel.codigo} · ${fechaCorta(sel.fecha)} ${sel.hora} · ${sel.personas} personas · ${sel.zona}`}
          onCerrar={() => setSel(null)}
          ancho="max-w-xl"
          pie={
            <>
              {['pendiente', 'confirmada'].includes(sel.estado) && (
                <>
                  <Boton variante="peligro" cargando={ocupado} onClick={() => actualizar({ estado: sel.estado === 'pendiente' ? 'rechazada' : 'no_asistio' }, 'Reserva actualizada')}>
                    <X size={15} /> {sel.estado === 'pendiente' ? 'Rechazar' : 'No llegó'}
                  </Boton>
                  {sel.estado === 'pendiente' && <Boton variante="verde" cargando={ocupado} onClick={() => actualizar({ estado: 'confirmada' }, 'Reserva confirmada')}><Check size={15} /> Confirmar</Boton>}
                  <Boton variante="oro" cargando={ocupado} onClick={sentar}><Armchair size={15} /> Llegaron: abrir cuenta</Boton>
                </>
              )}
              {!['pendiente', 'confirmada'].includes(sel.estado) && <Boton cargando={ocupado} onClick={() => actualizar({}, 'Nota guardada')}>Guardar nota</Boton>}
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <a className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#25d366] px-3 text-sm font-semibold text-white" target="_blank" rel="noopener noreferrer"
                href={wa(sel, `¡Hola ${sel.nombre_completo.split(' ')[0]}! 🐍 Tu reserva ${sel.codigo} en Mamba para el ${fechaCorta(sel.fecha)} a las ${sel.hora} (${sel.personas} personas, ${sel.zona}) está CONFIRMADA. ¡Te esperamos!`)}>
                <MessageCircle size={15} /> Confirmar por WhatsApp
              </a>
              <a className="inline-flex h-9 items-center gap-2 rounded-xl border border-gold/25 px-3 text-sm text-gold-light" target="_blank" rel="noopener noreferrer" href={wa(sel, `Hola ${sel.nombre_completo.split(' ')[0]}, te escribimos de Mamba Bistro Bar sobre tu reserva ${sel.codigo}.`)}>
                Escribirle
              </a>
            </div>
            {sel.consumo_minimo_cop > 0 && <p className="rounded-xl bg-gold/10 px-3 py-2 text-sm text-gold-light">Consumo mínimo de la zona: {dinero(sel.consumo_minimo_cop, 'COP')}</p>}
            {sel.notas && <p className="rounded-xl bg-white/5 px-3 py-2 text-sm"><span className="text-smoke">Nota del cliente:</span> {sel.notas}</p>}
            <Campo etiqueta="Mesa asignada" ayuda="Primero aparecen las mesas de la zona que pidió.">
              <Select value={mesaId ?? ''} onChange={(e) => setMesaId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">— Sin asignar —</option>
                {[...(mesas.datos ?? [])].filter((m) => m.activo).sort((a, b) => Number(b.zona_id === sel.zona_id) - Number(a.zona_id === sel.zona_id) || a.numero - b.numero).map((m) => (
                  <option key={m.id} value={m.id}>Mesa {m.numero}{m.nombre ? ` · ${m.nombre}` : ''} — {m.zona} ({m.capacidad} puestos)</option>
                ))}
              </Select>
            </Campo>
            <Campo etiqueta="Nota interna (solo la ve el equipo)"><Area value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Pidió botella de cortesía, llega tarde…" /></Campo>
            {['pendiente', 'confirmada'].includes(sel.estado) && <Boton tam="sm" variante="sutil" cargando={ocupado} onClick={() => actualizar({}, 'Cambios guardados')}>Guardar mesa y nota</Boton>}
          </div>
        </Modal>
      )}
    </div>
  );
}
