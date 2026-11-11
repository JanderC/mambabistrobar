'use client';

import { ArrowLeft, Check, CheckCheck, Clock, Link2, LogOut, MessageCircle, Plus, RefreshCw, Search, Send, Smartphone, Users, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSesion } from '@/components/admin/Sesion';
import { Boton, Cargando, Encabezado, Input, Insignia, Modal, Tarjeta, Vacio, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { useVivo } from '@/lib/admin/vivo';

type Estado = { estado: 'DESCONECTADO' | 'CONECTANDO' | 'ESPERANDO_QR' | 'CONECTADO' | 'REEMPLAZADA'; qr: string | null; numero: string | null; nombre: string | null; ultimoError: string | null };
type Chat = { jid: string; nombre: string | null; es_grupo: boolean; ultimo_texto: string | null; ultimo_de_mi: boolean; ultimo_en: string | null; no_leidos: number };
type Mensaje = { id: number; wa_id: string | null; de_mi: boolean; tipo: string; texto: string | null; remitente: string | null; usuario: string | null; estado: string; creado_en: string };

const telefono = (jid: string) => (jid.endsWith('@g.us') ? 'Grupo' : `+${jid.split('@')[0]}`);
const nombreChat = (c: Chat) => c.nombre || telefono(c.jid);
const hora = (f: string) => {
  const d = new Date(f);
  const hoy = new Date().toDateString() === d.toDateString();
  return hoy ? d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
};

function Palomitas({ estado }: { estado: string }) {
  if (estado === 'pendiente') return <Clock size={12} className="text-smoke" />;
  if (estado === 'fallido') return <X size={12} className="text-red-300" />;
  if (estado === 'enviado') return <Check size={13} className="text-smoke" />;
  return <CheckCheck size={13} className={estado === 'leido' ? 'text-sky-300' : 'text-smoke'} />;
}

export default function WhatsappPage() {
  const { es } = useSesion();
  const puedeVincular = es('gerente');
  const estado = useDatos<Estado>('/whatsapp/estado');
  const conectado = estado.datos?.estado === 'CONECTADO';
  const [verConexion, setVerConexion] = useState(false);

  useVivo((e) => {
    if (e.tipo === 'whatsapp' && e.accion === 'conexion') estado.recargar();
  });

  if (estado.cargando) return <Cargando />;
  const e = estado.datos;

  return (
    <div className="max-w-6xl">
      <Encabezado titulo="WhatsApp" descripcion="El WhatsApp del local vinculado al sistema: lee y responde los chats desde aquí, y las reservas y recordatorios salen solos por este número.">
        {e && (
          <button onClick={() => setVerConexion(true)} className="flex items-center gap-2">
            {conectado ? <Insignia color="verde"><Smartphone size={12} /> +{e.numero}{e.nombre ? ` · ${e.nombre}` : ''}</Insignia>
              : e.estado === 'CONECTANDO' ? <Insignia color="oro">Conectando…</Insignia>
              : <Insignia color="rojo">Sin vincular</Insignia>}
          </button>
        )}
      </Encabezado>

      {!conectado || verConexion ? (
        <Conexion estado={e} puedeVincular={puedeVincular} onCambio={estado.recargar} onVolver={conectado ? () => setVerConexion(false) : undefined} />
      ) : (
        <Bandeja />
      )}
    </div>
  );
}

// ====================================================================== Vincular
function Conexion({ estado, puedeVincular, onCambio, onVolver }: { estado: Estado | null; puedeVincular: boolean; onCambio: () => void; onVolver?: () => void }) {
  const avisos = useAvisos();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [numero, setNumero] = useState('');
  const [codigo, setCodigo] = useState<string | null>(null);
  const e = estado?.estado ?? 'DESCONECTADO';

  // mientras se espera el QR o la vinculación, se consulta seguido (el QR cambia cada ~20 s)
  useEffect(() => {
    if (e !== 'CONECTANDO' && e !== 'ESPERANDO_QR') return;
    const id = setInterval(onCambio, 3000);
    return () => clearInterval(id);
  }, [e, onCambio]);

  const accion = async (ruta: string, texto?: string) => {
    if (texto && !confirm(texto)) return;
    setOcupado(ruta);
    try {
      await adm(`/whatsapp/${ruta}`, { method: 'POST' });
      onCambio();
    } catch (err) {
      avisos.error(err);
    } finally {
      setOcupado(null);
    }
  };

  const pedirCodigo = async () => {
    setOcupado('codigo');
    try {
      const r = await adm<{ codigo: string }>('/whatsapp/codigo', { method: 'POST', body: { numero } });
      setCodigo(r.codigo);
      onCambio();
    } catch (err) {
      avisos.error(err);
    } finally {
      setOcupado(null);
    }
  };

  if (e === 'CONECTADO' && estado) {
    return (
      <Tarjeta className="max-w-xl p-6">
        <p className="flex items-center gap-2 text-lg"><Smartphone className="text-venom" /> Vinculado con <b>+{estado.numero}</b></p>
        {estado.nombre && <p className="mt-1 text-sm text-smoke">{estado.nombre}</p>}
        <p className="mt-3 text-sm text-smoke">El teléfono sigue funcionando normal: lo que respondas aquí sale por ese número y lo ves también en el teléfono.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {onVolver && <Boton variante="oro" onClick={onVolver}><MessageCircle size={15} /> Ir a los chats</Boton>}
          {puedeVincular && <Boton variante="peligro" cargando={ocupado === 'desconectar'} onClick={() => accion('desconectar', '¿Desvincular el WhatsApp del sistema? Habrá que volver a escanear el QR.')}><LogOut size={15} /> Desvincular</Boton>}
        </div>
      </Tarjeta>
    );
  }

  if (!puedeVincular) {
    return <Vacio titulo="El WhatsApp no está vinculado">Pídele al administrador o al gerente que lo vincule desde esta pantalla.</Vacio>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Tarjeta className="p-6">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg"><Link2 size={18} className="text-gold" /> Vincular con QR</h2>
        <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-smoke">
          <li>En el teléfono del local abre WhatsApp.</li>
          <li>Toca <b className="text-ivory">⋮ → Dispositivos vinculados → Vincular un dispositivo</b>.</li>
          <li>Escanea el código de aquí.</li>
        </ol>
        {e === 'ESPERANDO_QR' && estado?.qr ? (
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={estado.qr} alt="Código QR para vincular WhatsApp" className="h-64 w-64 rounded-xl bg-white p-2" />
            <p className="text-xs text-smoke">El código se renueva solo cada pocos segundos.</p>
          </div>
        ) : e === 'CONECTANDO' ? (
          <Cargando texto="Preparando el código…" />
        ) : (
          <Boton variante="oro" cargando={ocupado === 'conectar'} onClick={() => accion('conectar')}><Link2 size={15} /> Mostrar el QR</Boton>
        )}
        {e === 'REEMPLAZADA' && <p className="mt-3 text-sm text-red-200">La sesión se abrió en otro lugar. Toca “Mostrar el QR” para retomarla aquí.</p>}
        {estado?.ultimoError && e !== 'ESPERANDO_QR' && <p className="mt-3 text-xs text-smoke">Último error: {estado.ultimoError}</p>}
      </Tarjeta>

      <Tarjeta className="p-6">
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg"><Smartphone size={18} className="text-gold" /> O con el número (sin escanear)</h2>
        <p className="mb-3 text-sm text-smoke">En WhatsApp: <b className="text-ivory">Dispositivos vinculados → Vincular un dispositivo → Vincular con el número de teléfono</b>, y escribe el código que aparece aquí.</p>
        <div className="flex gap-2">
          <Input value={numero} onChange={(x) => setNumero(x.target.value)} placeholder="573001234567 (con código de país)" inputMode="numeric" />
          <Boton variante="borde" cargando={ocupado === 'codigo'} disabled={numero.replace(/\D/g, '').length < 10} onClick={pedirCodigo}>Pedir código</Boton>
        </div>
        {codigo && (
          <p className="mt-4 text-center font-mono text-3xl tracking-[0.3em] text-gold-light">{codigo.slice(0, 4)}-{codigo.slice(4)}</p>
        )}
        <div className="mt-6 border-t border-gold/10 pt-4">
          <Boton variante="sutil" tam="sm" cargando={ocupado === 'reiniciar'} onClick={() => accion('reiniciar', '¿Empezar de cero? Se borra la sesión guardada y se genera un QR nuevo.')}>
            <RefreshCw size={13} /> Se quedó trabado: empezar de cero
          </Boton>
        </div>
      </Tarjeta>
    </div>
  );
}

// ====================================================================== Chats
function Bandeja() {
  const [buscar, setBuscar] = useState('');
  const chats = useDatos<Chat[]>(`/whatsapp/chats${buscar.trim() ? `?q=${encodeURIComponent(buscar.trim())}` : ''}`);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState(false);

  useVivo((e) => {
    if (e.tipo === 'reconectado' || (e.tipo === 'whatsapp' && e.accion === 'mensaje')) chats.recargar();
  });

  const chat = chats.datos?.find((c) => c.jid === abierto) ?? null;

  return (
    <div className="grid h-[calc(100dvh-13rem)] min-h-[480px] gap-3 md:grid-cols-[320px_1fr]">
      <Tarjeta className={`flex min-h-0 flex-col overflow-hidden ${abierto ? 'hidden md:flex' : 'flex'}`}>
        <div className="flex gap-2 border-b border-gold/10 p-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-smoke" />
            <Input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar chat" className="pl-9" />
          </div>
          <Boton variante="borde" onClick={() => setNuevo(true)} aria-label="Escribir a un número" title="Escribir a un número"><Plus size={16} /></Boton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {chats.cargando ? <Cargando /> : !chats.datos?.length ? (
            <p className="p-6 text-center text-sm text-smoke">Todavía no hay chats. Los mensajes que lleguen al WhatsApp aparecen aquí.</p>
          ) : chats.datos.map((c) => (
            <button key={c.jid} onClick={() => setAbierto(c.jid)}
              className={`flex w-full items-center gap-3 border-b border-white/5 px-3 py-2.5 text-left transition hover:bg-white/5 ${abierto === c.jid ? 'bg-gold/10' : ''}`}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald/60 text-sm font-semibold text-ivory">
                {c.es_grupo ? <Users size={16} /> : nombreChat(c).replace(/^\+/, '').slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="truncate font-medium">{nombreChat(c)}</span>
                  {c.ultimo_en && <span className={`shrink-0 text-[11px] ${c.no_leidos ? 'text-venom' : 'text-smoke'}`}>{hora(c.ultimo_en)}</span>}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs text-smoke">{c.ultimo_de_mi ? 'Tú: ' : ''}{c.ultimo_texto}</span>
                  {c.no_leidos > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-venom px-1.5 text-[10px] font-bold text-void">{c.no_leidos}</span>}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Tarjeta>

      <Tarjeta className={`min-h-0 flex-col overflow-hidden ${abierto ? 'flex' : 'hidden md:flex'}`}>
        {chat ? <Conversacion key={chat.jid} chat={chat} onVolver={() => setAbierto(null)} onLeido={chats.recargar} />
          : <div className="grid flex-1 place-items-center p-6 text-center text-sm text-smoke"><span><MessageCircle className="mx-auto mb-2 text-gold" />Elige un chat para leerlo y responder.</span></div>}
      </Tarjeta>

      {nuevo && <NuevoChat onCerrar={() => setNuevo(false)} onEnviado={(jid) => { setNuevo(false); chats.recargar(); setAbierto(jid); }} />}
    </div>
  );
}

function Conversacion({ chat, onVolver, onLeido }: { chat: Chat; onVolver: () => void; onLeido: () => void }) {
  const avisos = useAvisos();
  const ruta = `/whatsapp/chats/${encodeURIComponent(chat.jid)}`;
  const mensajes = useDatos<Mensaje[]>(`${ruta}/mensajes`);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const fondo = useRef<HTMLDivElement>(null);

  useVivo((e) => {
    if (e.tipo === 'reconectado' || (e.tipo === 'whatsapp' && e.accion !== 'conexion' && e.jid === chat.jid)) mensajes.recargar();
  });

  // al abrirlo y con cada mensaje nuevo: se marca leído y se baja al final
  const cantidad = mensajes.datos?.length ?? 0;
  useEffect(() => {
    if (chat.no_leidos > 0) adm(`${ruta}/leido`, { method: 'POST' }).then(onLeido).catch(() => {});
    fondo.current?.scrollIntoView({ block: 'end' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cantidad]);

  const enviar = async () => {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    try {
      await adm(`${ruta}/enviar`, { method: 'POST', body: { texto: t } });
      setTexto('');
      mensajes.recargar();
    } catch (e) {
      avisos.error(e);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 border-b border-gold/10 px-4 py-3">
        <button onClick={onVolver} className="text-smoke md:hidden" aria-label="Volver a los chats"><ArrowLeft size={18} /></button>
        <div className="min-w-0">
          <p className="truncate font-medium">{nombreChat(chat)}</p>
          <p className="text-xs text-smoke">{telefono(chat.jid)}</p>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto bg-void/40 px-3 py-4 md:px-6">
        {mensajes.cargando ? <Cargando /> : mensajes.datos?.map((m) => (
          <div key={m.id} className={`flex ${m.de_mi ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.de_mi ? 'rounded-br-md bg-emerald/80' : 'rounded-bl-md bg-white/8 bg-[#0f2a20]'}`}>
              {m.remitente && <p className="mb-0.5 text-xs font-semibold text-gold-light">{m.remitente}</p>}
              <p className="break-words whitespace-pre-wrap">{m.texto}</p>
              <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-smoke">
                {m.de_mi && m.usuario && <span>{m.usuario} ·</span>}
                {hora(m.creado_en)}
                {m.de_mi && <Palomitas estado={m.estado} />}
              </p>
            </div>
          </div>
        ))}
        <div ref={fondo} />
      </div>
      <form className="flex items-end gap-2 border-t border-gold/10 p-3" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void enviar(); } }}
          rows={1}
          placeholder="Escribe un mensaje"
          className="max-h-32 min-h-10 flex-1 resize-none rounded-xl border border-gold/15 bg-void/60 px-3 py-2 text-sm text-ivory outline-none placeholder:text-smoke/60 focus:border-gold/50"
        />
        <Boton type="submit" variante="verde" cargando={enviando} disabled={!texto.trim()} aria-label="Enviar"><Send size={16} /></Boton>
      </form>
    </>
  );
}

function NuevoChat({ onCerrar, onEnviado }: { onCerrar: () => void; onEnviado: (jid: string) => void }) {
  const avisos = useAvisos();
  const [telefonoNuevo, setTelefono] = useState('');
  const [texto, setTexto] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const enviar = async () => {
    setOcupado(true);
    try {
      const r = await adm<{ jid: string }>('/whatsapp/enviar', { method: 'POST', body: { telefono: telefonoNuevo, texto } });
      avisos.ok('Mensaje enviado');
      onEnviado(r.jid);
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <Modal titulo="Escribir a un número" onCerrar={onCerrar}
      pie={<><Boton variante="sutil" onClick={onCerrar}>Cancelar</Boton><Boton variante="verde" cargando={ocupado} disabled={telefonoNuevo.replace(/\D/g, '').length < 10 || !texto.trim()} onClick={enviar}><Send size={15} /> Enviar</Boton></>}>
      <div className="space-y-3">
        <Input value={telefonoNuevo} onChange={(e) => setTelefono(e.target.value)} placeholder="Número con código de país (573001234567)" inputMode="numeric" autoFocus />
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} placeholder="Mensaje"
          className="w-full rounded-xl border border-gold/15 bg-void/60 px-3 py-2 text-sm text-ivory outline-none placeholder:text-smoke/60 focus:border-gold/50" />
      </div>
    </Modal>
  );
}
