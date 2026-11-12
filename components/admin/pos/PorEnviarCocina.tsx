'use client';

import { ChefHat, Clock, Printer, Send } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Boton, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { hace } from '@/lib/admin/moneda';
import { useVivo } from '@/lib/admin/vivo';

type Item = {
  id: number; cuenta_id: number; nombre: string; presentacion: string | null; cantidad: number; notas: string | null; ronda: number; creado_en: string;
  cuenta: string; tipo: string; nombre_cliente: string | null; mesa_numero: number | null; mesa_nombre: string | null; mesonero: string | null;
  modificadores: { tipo: string; nombre: string; cantidad: number }[];
};
type Pedido = { clave: string; cuenta_id: number; lugar: string; cliente: string | null; mesonero: string | null; desde: string; items: Item[] };

const lugarDe = (i: Item) => (i.tipo === 'llevar' ? 'Para llevar' : i.mesa_numero && i.tipo === 'mesa' ? (i.mesa_nombre ?? `Mesa ${i.mesa_numero}`) : 'Barra');

/**
 * Lo de cocina que mandaron los mesoneros espera aquí, en la barra. Un toque en «Enviar a cocina» y
 * aparece en la pantalla de cocina y la impresora saca la comanda.
 */
export function PorEnviarCocina() {
  const avisos = useAvisos();
  const datos = useDatos<Item[]>('/comandas/por-enviar', 20_000);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [, tic] = useState(0);
  useVivo((e) => {
    if (e.tipo === 'pedido' || e.tipo === 'cuenta' || e.tipo === 'reconectado') datos.recargar();
  });
  useEffect(() => {
    const id = setInterval(() => tic((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Un pedido = una ronda de una cuenta (lo que el mesonero mandó junto)
  const pedidos = useMemo<Pedido[]>(() => {
    const m = new Map<string, Pedido>();
    for (const i of datos.datos ?? []) {
      const clave = `${i.cuenta_id}-${i.ronda}`;
      if (!m.has(clave)) m.set(clave, { clave, cuenta_id: i.cuenta_id, lugar: lugarDe(i), cliente: i.nombre_cliente, mesonero: i.mesonero, desde: i.creado_en, items: [] });
      m.get(clave)!.items.push(i);
    }
    return [...m.values()];
  }, [datos.datos]);

  if (!pedidos.length) return null;

  const enviar = async (ids: number[], clave: string, texto: string) => {
    setEnviando(clave);
    try {
      await adm('/comandas/enviar-cocina', { method: 'POST', body: { ids } });
      avisos.ok(`🍳 ${texto} enviado a cocina`);
      datos.setDatos((l) => l?.filter((i) => !ids.includes(i.id)) ?? l);
    } catch (e) {
      avisos.error(e);
    } finally {
      setEnviando(null);
    }
  };

  return (
    <section className="mb-4 rounded-3xl border-2 border-orange-400/60 bg-orange-500/10 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg text-orange-200">
          <ChefHat size={20} /> Para cocina · esperando que lo envíes
          <span className="grid h-7 min-w-7 place-items-center rounded-full bg-orange-400 px-2 text-sm font-bold text-void">{pedidos.length}</span>
        </h2>
        {pedidos.length > 1 && (
          <Boton variante="oro" className="ml-auto" cargando={enviando === 'todo'} onClick={() => enviar(pedidos.flatMap((p) => p.items.map((i) => i.id)), 'todo', `Todo (${pedidos.length} pedidos)`)}>
            <Send size={15} /> Enviar todo a cocina
          </Boton>
        )}
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {pedidos.map((p) => (
          <div key={p.clave} className="flex flex-col rounded-2xl border border-orange-300/30 bg-[#0c0f0a] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-display text-xl leading-tight">{p.lugar}{p.cliente && <span className="text-smoke"> · {p.cliente}</span>}</p>
                <p className="flex items-center gap-2 text-[11px] text-smoke">{p.mesonero && <span>{p.mesonero}</span>}<span className="flex items-center gap-1"><Clock size={10} /> {hace(p.desde)}</span></p>
              </div>
              <Link href={`/admin/cuenta/${p.cuenta_id}`} className="shrink-0 text-xs text-smoke hover:text-gold-light">Ver cuenta</Link>
            </div>
            <ul className="my-2 flex-1 space-y-1">
              {p.items.map((i) => (
                <li key={i.id} className="text-sm">
                  <b className="text-orange-200">{Number(i.cantidad)}×</b> {i.nombre}{i.presentacion && !/^(unidad|porci[oó]n)$/i.test(i.presentacion) && <span className="text-smoke"> · {i.presentacion}</span>}
                  {i.modificadores.length > 0 && (
                    <span className="block pl-5 text-xs text-gold-light">
                      {i.modificadores.map((m) => (m.tipo === 'sin' ? `SIN ${m.nombre}` : m.tipo === 'adicional' ? `+ ${m.cantidad > 1 ? `${m.cantidad}× ` : ''}${m.nombre}` : `${m.cantidad}× ${m.nombre}`)).join(' · ')}
                    </span>
                  )}
                  {i.notas && <span className="block pl-5 text-xs text-sky-200">“{i.notas}”</span>}
                </li>
              ))}
            </ul>
            <Boton variante="oro" tam="lg" className="w-full" cargando={enviando === p.clave} onClick={() => enviar(p.items.map((i) => i.id), p.clave, p.lugar)}>
              <Printer size={17} /> Enviar a cocina
            </Boton>
          </div>
        ))}
      </div>
    </section>
  );
}
