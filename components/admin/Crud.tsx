'use client';

import { Plus, Search, X } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { adm } from '@/lib/admin/api';
import { Area, Boton, Campo, Cargando, type Columna, Encabezado, ErrorCaja, Input, InputNum, Interruptor, Modal, Select, Tabla, useAvisos, useDatos } from './ui';

export type CampoCrud = {
  nombre: string;
  etiqueta: string;
  tipo?: 'texto' | 'numero' | 'select' | 'multi' | 'si_no' | 'area' | 'fecha' | 'fecha_hora' | 'color' | 'password' | 'lista';
  opciones?: { valor: string | number; etiqueta: string }[];
  ayuda?: string;
  placeholder?: string;
  /** Ocupa las dos columnas del formulario */
  ancho?: boolean;
  /** Mostrar solo si se cumple (ej. campos que dependen de otro) */
  si?: (form: Record<string, any>) => boolean;
};

type Props<T> = {
  titulo: string;
  descripcion?: string;
  /** Ruta base del API: GET lista, POST crea, PUT /:id edita */
  ruta: string;
  rutaLista?: string;
  columnas: Columna<T>[];
  campos: CampoCrud[];
  /** Valores de un registro nuevo */
  nuevo: Record<string, any>;
  /** Fila → formulario / formulario → cuerpo de la petición (para adaptar tipos) */
  aForm?: (fila: T) => Record<string, any>;
  aCuerpo?: (form: Record<string, any>) => Record<string, any>;
  puedeEditar?: boolean;
  textoNuevo?: string;
  /** Texto por el que filtra el buscador */
  buscarEn?: (fila: T) => string;
  acciones?: ReactNode;
  sinEncabezado?: boolean;
  vacio?: string;
};

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Listado + formulario en modal para módulos de mantenimiento */
export function Crud<T extends { id: number | string }>({
  titulo, descripcion, ruta, rutaLista, columnas, campos, nuevo, aForm, aCuerpo, puedeEditar = true, textoNuevo = 'Nuevo', buscarEn, acciones, sinEncabezado, vacio,
}: Props<T>) {
  const { datos, cargando, error, recargar } = useDatos<T[]>(rutaLista ?? ruta);
  const [form, setForm] = useState<Record<string, any> | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [q, setQ] = useState('');
  const avisos = useAvisos();

  const filas = useMemo(() => {
    if (!datos) return [];
    const n = sinTildes(q.trim());
    return n && buscarEn ? datos.filter((f) => sinTildes(buscarEn(f)).includes(n)) : datos;
  }, [datos, q, buscarEn]);

  const guardar = async () => {
    if (!form) return;
    setGuardando(true);
    try {
      const cuerpo = aCuerpo ? aCuerpo(form) : form;
      await adm(form.id ? `${ruta}/${form.id}` : ruta, { method: form.id ? 'PUT' : 'POST', body: cuerpo });
      avisos.ok('Guardado');
      setForm(null);
      recargar();
    } catch (e) {
      avisos.error(e);
    } finally {
      setGuardando(false);
    }
  };

  const set = (k: string, v: any) => setForm((f) => ({ ...f!, [k]: v }));

  const barra = (
    <>
      {buscarEn && (
        <label className="relative">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-smoke" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="w-48 pl-9" />
        </label>
      )}
      {acciones}
      {puedeEditar && <Boton variante="oro" onClick={() => setForm({ ...nuevo })}><Plus size={16} /> {textoNuevo}</Boton>}
    </>
  );

  return (
    <div>
      {sinEncabezado ? <div className="mb-4 flex flex-wrap items-center justify-end gap-2">{barra}</div> : <Encabezado titulo={titulo} descripcion={descripcion}>{barra}</Encabezado>}

      {cargando ? <Cargando /> : error ? <ErrorCaja mensaje={error} onReintentar={recargar} /> : (
        <Tabla columnas={columnas} filas={filas} clave={(f) => f.id} vacio={vacio} onFila={puedeEditar ? (f) => setForm(aForm ? aForm(f) : { ...f }) : undefined} />
      )}

      {form && (
        <Modal
          titulo={form.id ? `Editar ${titulo.toLowerCase()}` : textoNuevo}
          onCerrar={() => setForm(null)}
          ancho="max-w-2xl"
          pie={<><Boton variante="sutil" onClick={() => setForm(null)}>Cancelar</Boton><Boton variante="oro" cargando={guardando} onClick={guardar}>Guardar</Boton></>}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {campos.filter((c) => !c.si || c.si(form)).map((c) => (
              <CampoForm key={c.nombre} campo={c} valor={form[c.nombre]} onCambio={(v) => set(c.nombre, v)} />
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}

export function CampoForm({ campo: c, valor, onCambio }: { campo: CampoCrud; valor: any; onCambio: (v: any) => void }) {
  const cls = c.ancho || c.tipo === 'area' || c.tipo === 'multi' || c.tipo === 'lista' ? 'sm:col-span-2' : '';
  if (c.tipo === 'si_no')
    return (
      <div className={`flex flex-col justify-end ${cls}`}>
        <Interruptor activo={!!valor} onCambio={onCambio} etiqueta={c.etiqueta} />
        {c.ayuda && <span className="mt-1 text-[11px] text-smoke/80">{c.ayuda}</span>}
      </div>
    );
  return (
    <Campo etiqueta={c.etiqueta} ayuda={c.ayuda} className={cls}>
      {c.tipo === 'numero' ? (
        <InputNum valor={valor} onCambio={onCambio} placeholder={c.placeholder} />
      ) : c.tipo === 'select' ? (
        <Select value={valor ?? ''} onChange={(e) => onCambio(e.target.value === '' ? null : typeof c.opciones?.[0]?.valor === 'number' ? Number(e.target.value) : e.target.value)}>
          <option value="">— Selecciona —</option>
          {c.opciones?.map((o) => <option key={o.valor} value={o.valor}>{o.etiqueta}</option>)}
        </Select>
      ) : c.tipo === 'multi' ? (
        <div className="flex flex-wrap gap-1.5">
          {c.opciones?.map((o) => {
            const activo = (valor ?? []).includes(o.valor);
            return (
              <button key={o.valor} type="button" onClick={() => onCambio(activo ? valor.filter((x: any) => x !== o.valor) : [...(valor ?? []), o.valor])}
                className={`rounded-full px-3 py-1.5 text-xs transition ${activo ? 'bg-gold text-void font-semibold' : 'border border-gold/20 text-smoke hover:text-ivory'}`}>
                {o.etiqueta}
              </button>
            );
          })}
        </div>
      ) : c.tipo === 'area' ? (
        <Area value={valor ?? ''} onChange={(e) => onCambio(e.target.value)} placeholder={c.placeholder} />
      ) : c.tipo === 'lista' ? (
        <ListaTexto valor={valor ?? []} onCambio={onCambio} placeholder={c.placeholder} />
      ) : (
        <Input
          type={c.tipo === 'fecha' ? 'date' : c.tipo === 'fecha_hora' ? 'datetime-local' : c.tipo === 'color' ? 'color' : c.tipo === 'password' ? 'password' : 'text'}
          value={valor ?? ''}
          onChange={(e) => onCambio(e.target.value)}
          placeholder={c.placeholder}
          autoComplete={c.tipo === 'password' ? 'new-password' : 'off'}
          className={c.tipo === 'color' ? 'p-1' : ''}
        />
      )}
    </Campo>
  );
}

/** Lista de textos cortos (ingredientes, etiquetas, beneficios) */
function ListaTexto({ valor, onCambio, placeholder }: { valor: string[]; onCambio: (v: string[]) => void; placeholder?: string }) {
  const [t, setT] = useState('');
  const agregar = () => {
    const v = t.trim();
    if (v && !valor.includes(v)) onCambio([...valor, v]);
    setT('');
  };
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {valor.map((x) => (
          <span key={x} className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-2.5 py-1 text-xs text-gold-light">
            {x}
            <button type="button" onClick={() => onCambio(valor.filter((y) => y !== x))} aria-label={`Quitar ${x}`}><X size={12} /></button>
          </span>
        ))}
      </div>
      <Input value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), agregar())} onBlur={agregar} placeholder={placeholder ?? 'Escribe y presiona Enter'} />
    </div>
  );
}
