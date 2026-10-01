'use client';

import { Check, MessageCircle, Plus, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { CampoForm, type CampoCrud } from '@/components/admin/Crud';
import { useSesion } from '@/components/admin/Sesion';
import { Boton, Cargando, Encabezado, Insignia, Modal, Pestanas, Tarjeta, Vacio, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { aInputFechaHora, agrupar, deInputFechaHora, fechaHora } from '@/lib/admin/moneda';

type Tarea = { id: number; titulo: string; detalle: string | null; vence_en: string; evento_id: number | null; evento: string | null; prioridad: 'baja' | 'normal' | 'alta'; completado: boolean; vencido: boolean };
type Suscripcion = { id: number; nombre: string; telefono: string; estado: 'pendiente' | 'enviado' | 'fallido'; evento: string; inicia_en: string; toca_enviar: boolean; mensaje: string; recordatorio_horas_antes: number };
type Evento = { id: number; titulo: string; inicia_en: string };

export default function RecordatoriosPage() {
  const { es } = useSesion();
  const comercial = es('gerente', 'rrpp', 'cajero');
  const [tab, setTab] = useState<'tareas' | 'clientes'>('tareas');
  const [verHechas, setVerHechas] = useState(false);
  const tareas = useDatos<Tarea[]>(`/recordatorios${verHechas ? '?todos=1' : ''}`);
  const subs = useDatos<Suscripcion[]>(comercial ? '/recordatorios/suscripciones' : null);
  const eventos = useDatos<Evento[]>(comercial ? '/eventos' : null);
  const [form, setForm] = useState<Record<string, any> | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const avisos = useAvisos();

  const campos: CampoCrud[] = [
    { nombre: 'titulo', etiqueta: 'Qué hay que hacer', ancho: true, placeholder: 'Confirmar DJ, publicar flyer, pedir hielo…' },
    { nombre: 'vence_en', etiqueta: 'Para cuándo', tipo: 'fecha_hora' },
    { nombre: 'prioridad', etiqueta: 'Prioridad', tipo: 'select', opciones: [{ valor: 'alta', etiqueta: 'Alta' }, { valor: 'normal', etiqueta: 'Normal' }, { valor: 'baja', etiqueta: 'Baja' }] },
    { nombre: 'evento_id', etiqueta: 'Evento relacionado', tipo: 'select', ancho: true, opciones: (eventos.datos ?? []).filter((e) => new Date(e.inicia_en) > new Date()).map((e) => ({ valor: e.id, etiqueta: `${e.titulo} · ${fechaHora(e.inicia_en)}` })) },
    { nombre: 'detalle', etiqueta: 'Detalle', tipo: 'area' },
  ];

  const guardar = async () => {
    if (!form) return;
    setOcupado(true);
    try {
      const body = { ...form, vence_en: deInputFechaHora(form.vence_en) };
      await adm(form.id ? `/recordatorios/${form.id}` : '/recordatorios', { method: form.id ? 'PUT' : 'POST', body });
      avisos.ok('Recordatorio guardado');
      setForm(null);
      tareas.recargar();
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(false);
    }
  };

  const completar = async (t: Tarea) => {
    try {
      await adm(`/recordatorios/${t.id}/completar`, { method: 'PATCH', body: { completado: !t.completado } });
      tareas.recargar();
    } catch (e) {
      avisos.error(e);
    }
  };

  const marcar = async (s: Suscripcion, estado: 'enviado' | 'pendiente') => {
    try {
      await adm(`/recordatorios/suscripciones/${s.id}`, { method: 'PATCH', body: { estado } });
      subs.recargar();
    } catch (e) {
      avisos.error(e);
    }
  };

  const enviarAuto = async () => {
    setOcupado(true);
    try {
      const r = await adm<{ automatico: boolean; pendientes: number; enviados: number; fallidos: number }>('/recordatorios/suscripciones/enviar', { method: 'POST' });
      if (!r.automatico) avisos.info('El envío automático necesita WhatsApp Cloud API configurado. Por ahora envíalos con el botón de cada cliente.');
      else avisos.ok(`${r.enviados} enviados, ${r.fallidos} fallidos`);
      subs.recargar();
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(false);
    }
  };

  const porEnviar = subs.datos?.filter((s) => s.estado === 'pendiente' && s.toca_enviar).length ?? 0;
  const porEvento = agrupar(subs.datos ?? [], (s) => s.evento);

  return (
    <div className="max-w-5xl">
      <Encabezado titulo="Recordatorios" descripcion="Que no se escape nada: tareas del equipo con fecha y avisos a los clientes que pidieron que les recuerden un evento.">
        {comercial && (
          <Pestanas valor={tab} onCambio={setTab} opciones={[
            { valor: 'tareas', etiqueta: 'Tareas del equipo', cuenta: tareas.datos?.filter((t) => !t.completado).length },
            { valor: 'clientes', etiqueta: 'Avisos a clientes', cuenta: porEnviar },
          ]} />
        )}
      </Encabezado>

      {tab === 'tareas' && (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-smoke">
              <input type="checkbox" checked={verHechas} onChange={(e) => setVerHechas(e.target.checked)} className="accent-[#d4af37]" /> Ver completadas
            </label>
            <Boton variante="oro" onClick={() => setForm({ titulo: '', detalle: '', vence_en: aInputFechaHora(new Date(Date.now() + 86400e3).toISOString()), prioridad: 'normal', evento_id: null, completado: false })}>
              <Plus size={16} /> Nuevo recordatorio
            </Boton>
          </div>
          {tareas.cargando ? <Cargando /> : !tareas.datos?.length ? <Vacio titulo="Sin pendientes">Crea recordatorios para los preparativos de cada evento.</Vacio> : (
            <div className="space-y-2">
              {tareas.datos.map((t) => (
                <Tarjeta key={t.id} className={`flex items-start gap-3 p-4 ${t.completado ? 'opacity-50' : t.vencido ? 'border-red-400/40' : ''}`}>
                  <button onClick={() => completar(t)} aria-label={t.completado ? 'Marcar pendiente' : 'Marcar hecho'}
                    className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${t.completado ? 'border-venom bg-venom text-void' : 'border-gold/40 hover:bg-gold/20'}`}>
                    {t.completado && <Check size={14} />}
                  </button>
                  <button className="min-w-0 flex-1 text-left" onClick={() => setForm({ ...t, vence_en: aInputFechaHora(t.vence_en) })}>
                    <p className={`font-medium ${t.completado ? 'line-through' : ''}`}>{t.titulo}</p>
                    {t.detalle && <p className="text-sm text-smoke">{t.detalle}</p>}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                      <Insignia color={t.vencido ? 'rojo' : 'gris'}>{t.vencido ? 'Vencido · ' : ''}{fechaHora(t.vence_en)}</Insignia>
                      {t.prioridad === 'alta' && <Insignia color="oro">Prioridad alta</Insignia>}
                      {t.evento && <Insignia color="azul">{t.evento}</Insignia>}
                    </div>
                  </button>
                  <button onClick={async () => { await adm(`/recordatorios/${t.id}`, { method: 'DELETE' }).catch(avisos.error); tareas.recargar(); }} className="text-smoke hover:text-red-300" aria-label="Eliminar"><Trash2 size={16} /></button>
                </Tarjeta>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'clientes' && comercial && (
        <>
          <Tarjeta className="mb-4 flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-smoke">
            <p className="max-w-2xl">
              En la página de cada evento el cliente puede tocar <b className="text-ivory">“Recuérdamelo”</b> y dejar su WhatsApp. Cuando falten las horas configuradas
              en el evento, aparecen aquí como <b className="text-ivory">listos para enviar</b>: un toque abre WhatsApp con el mensaje ya escrito.
            </p>
            <Boton cargando={ocupado} onClick={enviarAuto}><Send size={15} /> Enviar automáticos</Boton>
          </Tarjeta>
          {subs.cargando ? <Cargando /> : !subs.datos?.length ? <Vacio titulo="Nadie ha pedido recordatorio todavía">Comparte los eventos: mientras más gente los vea, más se anotan.</Vacio> : (
            <div className="space-y-5">
              {porEvento.map(([evento, lista]) => (
                <section key={evento}>
                  <h2 className="mb-2 flex flex-wrap items-center gap-2 font-display text-lg">
                    {evento} <span className="text-sm text-smoke">· {fechaHora(lista[0].inicia_en)}</span>
                    <Insignia color="azul">{lista.length} anotados</Insignia>
                    {!lista[0].toca_enviar && <Insignia>Se avisan {lista[0].recordatorio_horas_antes} h antes</Insignia>}
                  </h2>
                  <div className="grid gap-2 md:grid-cols-2">
                    {lista.map((s) => (
                      <Tarjeta key={s.id} className="flex items-center gap-3 p-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{s.nombre}</p>
                          <p className="text-xs text-smoke">+{s.telefono}</p>
                        </div>
                        {s.estado === 'enviado' ? (
                          <button onClick={() => marcar(s, 'pendiente')} title="Marcar como no enviado"><Insignia color="verde"><Check size={12} /> Enviado</Insignia></button>
                        ) : (
                          <a
                            href={`https://wa.me/${s.telefono}?text=${encodeURIComponent(s.mensaje)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => marcar(s, 'enviado')}
                            className={`inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold ${s.toca_enviar ? 'bg-[#25d366] text-white' : 'border border-gold/20 text-smoke'}`}
                          >
                            <MessageCircle size={14} /> {s.toca_enviar ? 'Enviar ahora' : 'Enviar antes'}
                          </a>
                        )}
                      </Tarjeta>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {form && (
        <Modal titulo={form.id ? 'Editar recordatorio' : 'Nuevo recordatorio'} onCerrar={() => setForm(null)} ancho="max-w-xl"
          pie={<><Boton variante="sutil" onClick={() => setForm(null)}>Cancelar</Boton><Boton variante="oro" cargando={ocupado} onClick={guardar}>Guardar</Boton></>}>
          <div className="grid gap-4 sm:grid-cols-2">
            {campos.map((c) => <CampoForm key={c.nombre} campo={c} valor={form[c.nombre]} onCambio={(v) => setForm({ ...form, [c.nombre]: v })} />)}
          </div>
        </Modal>
      )}
    </div>
  );
}
