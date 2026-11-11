'use client';

import { Check, ChefHat, Clock, Martini, QrCode, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Boton, Campo, Input, Insignia, Modal, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { type Moneda, dinero, hace, soloHora } from '@/lib/admin/moneda';
import { useVivo } from '@/lib/admin/vivo';

type Linea = { nombre: string; presentacion: string | null; cantidad: number; detalle: string[]; notas: string | null; estacion: string; subtotal: number };
type CuentaMesa = { id: number; numero: string; nombre_cliente: string | null; mesonero: string | null };
export type PedidoQR = {
  id: number; mesa_id: number; cuenta_id: number | null; nombre_cliente: string | null; nota: string | null; resumen: Linea[]; moneda: Moneda; total: number;
  estado: 'pendiente' | 'aceptado' | 'rechazado'; motivo: string | null; creado_en: string; atendido_en: string | null; atendido_por: string | null;
  mesa_numero: number; mesa_nombre: string | null; mesa_tipo: string; zona: string | null; cuentas_abiertas: CuentaMesa[];
};

const MOTIVOS = ['Se agotó, ¿quieres otra cosa?', 'Ya te lo tomó tu mesero', 'Pedido repetido', 'La cocina ya cerró'];

/**
 * Bandeja de pedidos del QR. «Aceptar» los pasa a la cuenta de la mesa (o abre una) y salen a comandas;
 * «Rechazar» le avisa al cliente en su celular con el motivo. Se usa en la barra y en su propia pantalla.
 */
export function BandejaQR({ compacta = false }: { compacta?: boolean }) {
  const { datos, recargar } = useDatos<PedidoQR[]>('/pedidos-qr', 30_000);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [elegir, setElegir] = useState<PedidoQR | null>(null);
  const [rechazar, setRechazar] = useState<PedidoQR | null>(null);
  const [motivo, setMotivo] = useState('');
  const avisos = useAvisos();

  useVivo((e) => {
    if (e.tipo === 'pedido_qr' || e.tipo === 'reconectado') recargar();
  });

  const pendientes = (datos ?? []).filter((p) => p.estado === 'pendiente');
  const atendidos = (datos ?? []).filter((p) => p.estado !== 'pendiente');

  const aceptar = async (p: PedidoQR, cuentaId: number | null = null) => {
    if (cuentaId == null && p.cuentas_abiertas.length > 1) return setElegir(p);
    setOcupado(p.id);
    try {
      await adm(`/pedidos-qr/${p.id}/aceptar`, { method: 'POST', body: { cuenta_id: cuentaId } });
      avisos.ok(`Mesa ${p.mesa_numero}: pedido aceptado y enviado a preparación`);
      setElegir(null);
      recargar();
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(null);
    }
  };

  const confirmarRechazo = async () => {
    if (!rechazar) return;
    setOcupado(rechazar.id);
    try {
      await adm(`/pedidos-qr/${rechazar.id}/rechazar`, { method: 'POST', body: { motivo } });
      avisos.ok('Pedido rechazado: el cliente ya lo ve en su celular');
      setRechazar(null);
      setMotivo('');
      recargar();
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(null);
    }
  };

  if (compacta && !pendientes.length) return null;

  return (
    <section className={compacta ? 'mb-6 rounded-3xl border-2 border-sky-400/50 bg-sky-400/5 p-4' : ''}>
      {compacta && (
        <h2 className="mb-3 flex items-center gap-2 font-display text-lg text-sky-200">
          <QrCode size={20} className="animate-pulse" /> Pedidos desde el QR <Insignia color="azul">{pendientes.length}</Insignia>
          <Link href="/admin/pedidos-qr" className="ml-auto text-xs text-smoke hover:text-ivory">Ver todos →</Link>
        </h2>
      )}

      {!compacta && !pendientes.length && (
        <div className="rounded-3xl border-2 border-dashed border-gold/20 px-6 py-14 text-center">
          <QrCode size={44} className="mx-auto text-gold/60" />
          <p className="mt-3 font-display text-xl">Sin pedidos por confirmar</p>
          <p className="mt-1 text-sm text-smoke">Cuando un cliente pida desde el QR de su mesa aparece aquí al instante, con sonido.</p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {pendientes.map((p) => {
          const unidades = p.resumen.reduce((s, l) => s + l.cantidad, 0);
          const minutos = (Date.now() - new Date(p.creado_en).getTime()) / 60_000;
          return (
            <article key={p.id} className={`flex flex-col rounded-3xl border-2 bg-[#06140f] ${minutos > 5 ? 'border-red-400/60' : 'border-sky-400/60'}`}>
              <header className="flex items-center gap-3 border-b border-white/5 p-4">
                <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-sky-400/20 font-display text-3xl text-sky-100">{p.mesa_tipo === 'barra' ? 'B' : p.mesa_numero}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-medium">{p.mesa_tipo === 'barra' ? 'Barra' : `Mesa ${p.mesa_numero}`}{p.nombre_cliente && <span className="text-smoke"> · {p.nombre_cliente}</span>}</p>
                  <p className="flex flex-wrap items-center gap-x-3 text-xs text-smoke">
                    {p.zona && <span>{p.zona}</span>}
                    <span className={`flex items-center gap-1 ${minutos > 5 ? 'text-red-300' : ''}`}><Clock size={11} /> hace {hace(p.creado_en)}</span>
                    <span>{p.cuentas_abiertas.length ? `Cuenta ${p.cuentas_abiertas.map((c) => c.numero).join(', ')}` : 'Mesa sin cuenta: se abre al aceptar'}</span>
                  </p>
                </div>
              </header>
              <ul className="flex-1 space-y-1.5 p-4">
                {p.resumen.map((l, k) => (
                  <li key={k} className="flex gap-2 text-sm">
                    <span className="font-display text-lg leading-tight text-gold-light">{l.cantidad}×</span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 leading-tight font-medium">
                        {l.estacion === 'cocina' ? <ChefHat size={13} className="shrink-0 text-gold" /> : <Martini size={13} className="shrink-0 text-venom" />}
                        {l.nombre}{l.presentacion && l.presentacion !== 'Única' && <span className="font-normal text-smoke">· {l.presentacion}</span>}
                      </p>
                      {l.detalle.map((d) => <p key={d} className={`text-xs ${d.startsWith('SIN') ? 'text-red-300' : d.startsWith('+') ? 'text-venom' : 'text-smoke'}`}>{d}</p>)}
                      {l.notas && <p className="text-xs text-smoke">📝 {l.notas}</p>}
                    </div>
                    <span className="text-smoke tabular-nums">{dinero(l.subtotal, p.moneda)}</span>
                  </li>
                ))}
                {p.nota && <li className="rounded-xl bg-gold/10 px-3 py-2 text-sm text-gold-light">📝 {p.nota}</li>}
              </ul>
              <footer className="border-t border-white/5 p-3">
                <p className="mb-2 flex justify-between text-sm text-smoke"><span>{unidades} {unidades === 1 ? 'producto' : 'productos'}</span><span className="font-display text-xl text-ivory">{dinero(p.total, p.moneda)}</span></p>
                <div className="grid grid-cols-[auto_1fr] gap-2">
                  <Boton tam="lg" variante="peligro" disabled={ocupado === p.id} onClick={() => setRechazar(p)} aria-label="Rechazar"><X size={20} /></Boton>
                  <Boton tam="lg" variante="verde" cargando={ocupado === p.id} onClick={() => aceptar(p)}><Check size={20} /> Aceptar y enviar</Boton>
                </div>
              </footer>
            </article>
          );
        })}
      </div>

      {!compacta && atendidos.length > 0 && (
        <div className="mt-8">
          <h3 className="mb-2 text-xs tracking-wider text-smoke uppercase">Atendidos en los últimos 45 minutos</h3>
          <ul className="divide-y divide-white/5 rounded-2xl border border-gold/10">
            {atendidos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <Insignia color={p.estado === 'aceptado' ? 'verde' : 'rojo'}>{p.estado === 'aceptado' ? 'Aceptado' : 'Rechazado'}</Insignia>
                <span className="font-medium">{p.mesa_tipo === 'barra' ? 'Barra' : `Mesa ${p.mesa_numero}`}{p.nombre_cliente && ` · ${p.nombre_cliente}`}</span>
                <span className="min-w-0 flex-1 truncate text-smoke">{p.resumen.map((l) => `${l.cantidad} ${l.nombre}`).join(', ')}{p.motivo && ` — ${p.motivo}`}</span>
                <span className="text-xs text-smoke">{p.atendido_por} · {p.atendido_en && soloHora(p.atendido_en)}</span>
                {p.cuenta_id && <Link href={`/admin/cuenta/${p.cuenta_id}`} className="text-xs text-gold hover:underline">Ver cuenta</Link>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {elegir && (
        <Modal titulo={`Mesa ${elegir.mesa_numero}: ¿a qué cuenta va?`} subtitulo="La mesa tiene varias cuentas abiertas" onCerrar={() => setElegir(null)} ancho="max-w-md">
          <div className="space-y-2">
            {elegir.cuentas_abiertas.map((c) => (
              <button key={c.id} disabled={ocupado === elegir.id} onClick={() => aceptar(elegir, c.id)} className="flex w-full items-center justify-between rounded-2xl border border-gold/20 p-4 text-left hover:border-gold disabled:opacity-50">
                <span><span className="block font-medium">{c.nombre_cliente ?? c.numero}</span><span className="text-xs text-smoke">{c.numero}{c.mesonero && ` · ${c.mesonero}`}</span></span>
                <Check size={18} className="text-gold" />
              </button>
            ))}
          </div>
        </Modal>
      )}

      {rechazar && (
        <Modal titulo={`Rechazar pedido de la mesa ${rechazar.mesa_numero}`} subtitulo="El cliente verá este mensaje en su celular" onCerrar={() => { setRechazar(null); setMotivo(''); }} ancho="max-w-md"
          pie={<><Boton variante="sutil" onClick={() => setRechazar(null)}>Volver</Boton><Boton variante="peligro" cargando={ocupado === rechazar.id} disabled={motivo.trim().length < 3} onClick={confirmarRechazo}>Rechazar</Boton></>}>
          <Campo etiqueta="Mensaje para el cliente">
            <Input autoFocus value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Se agotó, ¿quieres otra cosa?" maxLength={160} />
          </Campo>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MOTIVOS.map((m) => <button key={m} onClick={() => setMotivo(m)} className="rounded-full border border-gold/20 px-3 py-1.5 text-xs text-smoke hover:text-ivory">{m}</button>)}
          </div>
        </Modal>
      )}
    </section>
  );
}
