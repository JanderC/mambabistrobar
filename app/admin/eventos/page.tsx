'use client';

import { BellRing, CalendarCheck } from 'lucide-react';
import { Crud } from '@/components/admin/Crud';
import { Insignia } from '@/components/admin/ui';
import { aInputFechaHora, deInputFechaHora, dinero, fechaHora } from '@/lib/admin/moneda';

type Evento = {
  id: number; slug: string; titulo: string; tematica: string | null; descripcion: string | null; flyer_url: string | null; inicia_en: string; termina_en: string | null;
  cover_cop: number | null; nota_cover: string | null; estado: string; destacado: boolean; recordatorio_horas_antes: number;
  artistas: { nombre: string; rol: string; instagram: string | null }[]; suscritos: number; reservas: number;
};

export default function EventosPage() {
  return (
    <Crud<Evento>
      titulo="Eventos"
      descripcion="La cartelera que ven los clientes en la web. Lo que publiques aquí aparece al instante."
      ruta="/eventos"
      textoNuevo="Nuevo evento"
      buscarEn={(e) => `${e.titulo} ${e.tematica ?? ''}`}
      nuevo={{ titulo: '', tematica: '', descripcion: '', flyer_url: '', inicia_en: '', termina_en: '', cover_cop: 0, nota_cover: '', estado: 'publicado', destacado: false, recordatorio_horas_antes: 6, artistas_txt: '' }}
      aForm={(e) => ({
        ...e, inicia_en: aInputFechaHora(e.inicia_en), termina_en: aInputFechaHora(e.termina_en),
        artistas_txt: e.artistas.map((a) => [a.nombre, a.rol, a.instagram].filter(Boolean).join(' | ')).join('\n'),
      })}
      aCuerpo={(f) => ({
        ...f, inicia_en: deInputFechaHora(f.inicia_en), termina_en: f.termina_en ? deInputFechaHora(f.termina_en) : null,
        artistas: String(f.artistas_txt ?? '').split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p[0])
          .map(([nombre, rol, instagram]) => ({ nombre, rol: rol || 'DJ', instagram: instagram?.replace('@', '') || null })),
      })}
      columnas={[
        { titulo: 'Evento', celda: (e) => <div><p className="font-medium">{e.titulo}</p><p className="text-xs text-smoke">{e.tematica}</p></div> },
        { titulo: 'Fecha', celda: (e) => <span className={new Date(e.inicia_en) < new Date() ? 'text-smoke' : ''}>{fechaHora(e.inicia_en)}</span> },
        { titulo: 'Cover', celda: (e) => (e.cover_cop ? dinero(e.cover_cop, 'COP') : 'Libre'), alinear: 'der' },
        { titulo: 'Interés', celda: (e) => (
          <div className="flex gap-2 text-xs text-smoke">
            <span className="flex items-center gap-1" title="Reservas para esa noche"><CalendarCheck size={13} /> {e.reservas}</span>
            <span className="flex items-center gap-1" title="Clientes que pidieron recordatorio"><BellRing size={13} /> {e.suscritos}</span>
          </div>
        ) },
        { titulo: 'Estado', celda: (e) => (
          <div className="flex gap-1">
            <Insignia color={e.estado === 'publicado' ? 'verde' : e.estado === 'cancelado' ? 'rojo' : 'gris'}>{e.estado}</Insignia>
            {e.destacado && <Insignia color="oro">Destacado</Insignia>}
          </div>
        ) },
      ]}
      campos={[
        { nombre: 'titulo', etiqueta: 'Título' },
        { nombre: 'tematica', etiqueta: 'Temática', placeholder: 'Black & Gold Party' },
        { nombre: 'inicia_en', etiqueta: 'Empieza', tipo: 'fecha_hora' },
        { nombre: 'termina_en', etiqueta: 'Termina', tipo: 'fecha_hora' },
        { nombre: 'cover_cop', etiqueta: 'Cover (COP)', tipo: 'numero', ayuda: '0 = entrada libre' },
        { nombre: 'nota_cover', etiqueta: 'Nota del cover', placeholder: 'Cover consumible en barra' },
        { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'area' },
        { nombre: 'artistas_txt', etiqueta: 'Line-up (uno por línea)', tipo: 'area', placeholder: 'DJ Kobra | DJ | djkobra\nFire Crew | Show de fuego', ayuda: 'Formato: Nombre | Rol | usuario de Instagram' },
        { nombre: 'flyer_url', etiqueta: 'URL del flyer', placeholder: 'https://… (vacío = flyer automático)', ancho: true },
        { nombre: 'recordatorio_horas_antes', etiqueta: 'Avisar a los clientes (horas antes)', tipo: 'numero', ayuda: 'A quienes pidieron "Recuérdame" en la web.' },
        { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: [{ valor: 'publicado', etiqueta: 'Publicado' }, { valor: 'borrador', etiqueta: 'Borrador (no se ve)' }, { valor: 'cancelado', etiqueta: 'Cancelado' }] },
        { nombre: 'destacado', etiqueta: 'Destacado (insignia HOT)', tipo: 'si_no' },
      ]}
    />
  );
}
