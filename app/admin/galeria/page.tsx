'use client';

import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Boton, Cargando, Encabezado, ErrorCaja, Input, Insignia, Tarjeta, Vacio, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { achicarFoto } from '@/lib/admin/imagen';

type Foto = { id: number; url: string; descripcion: string | null; activo: boolean; orden: number };

export default function GaleriaAdminPage() {
  const avisos = useAvisos();
  const fotos = useDatos<Foto[]>('/galeria');
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState<{ hechas: number; total: number } | null>(null);

  const subir = async (archivos: FileList | null) => {
    const lista = Array.from(archivos ?? []);
    if (!lista.length) return;
    setSubiendo({ hechas: 0, total: lista.length });
    let ok = 0;
    for (const [i, a] of lista.entries()) {
      try {
        await adm('/galeria', { method: 'POST', body: await achicarFoto(a) });
        ok++;
      } catch (e) {
        avisos.error(`${a.name}: ${e instanceof Error ? e.message : 'no se pudo subir'}`);
      }
      setSubiendo({ hechas: i + 1, total: lista.length });
    }
    setSubiendo(null);
    if (entrada.current) entrada.current.value = '';
    if (ok) avisos.ok(ok === 1 ? 'Foto subida' : `${ok} fotos subidas`);
    fotos.recargar();
  };

  const cambiar = async (f: Foto, cambios: Partial<Pick<Foto, 'descripcion' | 'activo'>>) => {
    try {
      await adm(`/galeria/${f.id}`, { method: 'PATCH', body: cambios });
      fotos.setDatos((l) => l?.map((x) => (x.id === f.id ? { ...x, ...cambios } : x)) ?? l);
    } catch (e) {
      avisos.error(e);
    }
  };

  const mover = async (i: number, d: -1 | 1) => {
    const l = [...(fotos.datos ?? [])];
    if (!l[i + d]) return;
    [l[i], l[i + d]] = [l[i + d], l[i]];
    fotos.setDatos(l);
    try {
      await adm('/galeria/orden', { method: 'PUT', body: { ids: l.map((x) => x.id) } });
    } catch (e) {
      avisos.error(e);
      fotos.recargar();
    }
  };

  const borrar = async (f: Foto) => {
    if (!confirm('¿Borrar esta foto de la galería? No se puede deshacer.')) return;
    try {
      await adm(`/galeria/${f.id}`, { method: 'DELETE' });
      fotos.setDatos((l) => l?.filter((x) => x.id !== f.id) ?? l);
    } catch (e) {
      avisos.error(e);
    }
  };

  return (
    <div className="max-w-6xl">
      <Encabezado titulo="Galería" descripcion="Las fotos del ambiente que salen en la página Galería de la web, en este orden. Se achican solas al subirlas.">
        <input ref={entrada} type="file" accept="image/*" multiple hidden onChange={(e) => subir(e.target.files)} />
        <Boton variante="oro" cargando={!!subiendo} onClick={() => entrada.current?.click()}>
          <ImagePlus size={16} /> {subiendo ? `Subiendo ${subiendo.hechas + 1} de ${subiendo.total}…` : 'Subir fotos'}
        </Boton>
      </Encabezado>

      {fotos.cargando ? <Cargando /> : fotos.error ? <ErrorCaja mensaje={fotos.error} onReintentar={fotos.recargar} /> : !fotos.datos?.length ? (
        <Vacio titulo="Todavía no hay fotos">Toca <b>Subir fotos</b> y elige una o varias del celular o la computadora. Aparecen en la web en unos minutos.</Vacio>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {fotos.datos.map((f, i) => (
            <Tarjeta key={f.id} className={`overflow-hidden ${f.activo ? '' : 'opacity-60'}`}>
              <div className="relative aspect-square bg-void">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.url} alt={f.descripcion ?? ''} loading="lazy" className="h-full w-full object-cover" />
                <span className="absolute top-2 left-2"><Insignia color={f.activo ? 'verde' : 'rojo'}>{f.activo ? `#${i + 1}` : 'Oculta'}</Insignia></span>
              </div>
              <div className="space-y-2 p-2">
                <Input defaultValue={f.descripcion ?? ''} placeholder="Descripción (opcional)" className="!py-1.5 text-xs"
                  onBlur={(e) => { const v = e.target.value.trim(); if (v !== (f.descripcion ?? '')) void cambiar(f, { descripcion: v || null }); }} />
                <div className="flex items-center justify-between gap-1">
                  <div className="flex gap-1">
                    <Boton tam="sm" variante="sutil" disabled={i === 0} onClick={() => mover(i, -1)} aria-label="Mover antes"><ArrowUp size={14} /></Boton>
                    <Boton tam="sm" variante="sutil" disabled={i === fotos.datos!.length - 1} onClick={() => mover(i, 1)} aria-label="Mover después"><ArrowDown size={14} /></Boton>
                  </div>
                  <div className="flex gap-1">
                    <Boton tam="sm" variante="sutil" onClick={() => cambiar(f, { activo: !f.activo })} aria-label={f.activo ? 'Ocultar' : 'Mostrar'} title={f.activo ? 'Ocultar en la web' : 'Mostrar en la web'}>
                      {f.activo ? <Eye size={14} /> : <EyeOff size={14} />}
                    </Boton>
                    <Boton tam="sm" variante="peligro" onClick={() => borrar(f)} aria-label="Borrar foto"><Trash2 size={14} /></Boton>
                  </div>
                </div>
              </div>
            </Tarjeta>
          ))}
        </div>
      )}
    </div>
  );
}
