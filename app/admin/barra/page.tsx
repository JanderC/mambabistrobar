'use client';

import { Armchair, ChevronRight, Clock, Plus, ShoppingBag, UserRound, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { BotonImpresora } from '@/components/admin/ImpresoraComandas';
import { BandejaQR } from '@/components/admin/pos/BandejaQR';
import { PorEnviarCocina } from '@/components/admin/pos/PorEnviarCocina';
import { NombreCliente } from '@/components/admin/pos/NombreCliente';
import { Boton, Cargando, Encabezado, ErrorCaja, Insignia, Pestanas, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { type Moneda, dinero, hace } from '@/lib/admin/moneda';
import { useVivo } from '@/lib/admin/vivo';

type Cuenta = {
  id: number; numero: string; tipo: 'mesa' | 'barra' | 'llevar'; nombre_cliente: string | null; total: number; pagado: number; moneda: Moneda; abierta_en: string;
  mesa_numero: number | null; mesa_nombre: string | null; zona: string | null; items: number; mesonero: string | null;
};

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const lugar = (c: Cuenta) => (c.tipo === 'llevar' ? 'Para llevar' : c.mesa_numero && c.tipo === 'mesa' ? `Mesa ${c.mesa_numero}` : 'Barra');

/**
 * Barra con la discoteca llena: un solo campo para buscar al cliente o abrirle cuenta.
 * Escribes «Carlos» → aparecen sus cuentas; si no tiene, Enter le abre una a su nombre. Sin cuentas duplicadas.
 */
export default function BarraPage() {
  const router = useRouter();
  const [ver, setVer] = useState<'barra' | 'todas'>('barra');
  const { datos, cargando, error, recargar } = useDatos<Cuenta[]>('/cuentas?estado=abierta', 30_000);
  useVivo((e) => {
    if (e.tipo === 'pedido' || e.tipo === 'cobro' || e.tipo === 'cuenta' || e.tipo === 'pedido_qr' || e.tipo === 'reconectado') recargar();
  });
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const avisos = useAvisos();

  const abiertas = useMemo(() => (datos ?? []).filter((c) => ver === 'todas' || c.tipo !== 'mesa'), [datos, ver]);
  const busqueda = sinTildes(nombre);
  const coinciden = useMemo(() => {
    if (!busqueda) return abiertas;
    const palabras = busqueda.split(/[\s·,]+/).filter(Boolean);
    return abiertas.filter((c) => {
      const texto = sinTildes(`${c.nombre_cliente ?? ''} ${c.numero} ${lugar(c)} ${c.mesonero ?? ''}`);
      return palabras.every((p) => texto.includes(p));
    });
  }, [abiertas, busqueda]);

  const abrirNueva = async (conNombre: string | null) => {
    setOcupado(true);
    try {
      const c = await adm<{ id: number }>('/cuentas', { method: 'POST', body: { tipo: 'barra', personas: 1, nombre_cliente: conNombre?.trim() || null } });
      router.push(`/admin/cuenta/${c.id}`);
    } catch (e) {
      avisos.error(e);
      setOcupado(false);
    }
  };

  /** Enter: si hay una sola cuenta que coincide la abre; si no hay ninguna, crea una nueva a ese nombre */
  const alEnter = () => {
    if (!busqueda) return;
    if (coinciden.length === 1) return router.push(`/admin/cuenta/${coinciden[0].id}`);
    if (!coinciden.length) abrirNueva(nombre);
  };

  const porCobrar = abiertas.filter((c) => c.total - c.pagado > 0);
  const deuda = porCobrar.reduce((s, c) => s + (c.moneda === porCobrar[0]?.moneda ? c.total - c.pagado : 0), 0);

  return (
    <div className="mx-auto max-w-6xl">
      <Encabezado titulo="Barra" descripcion="Escribe el nombre o una seña del cliente: si ya tiene cuenta aparece al instante; si no, Enter le abre una a su nombre.">
        <Pestanas valor={ver} onCambio={setVer} opciones={[{ valor: 'barra', etiqueta: 'Cuentas de barra' }, { valor: 'todas', etiqueta: 'Todo el local' }]} />
        <BotonImpresora />
        <Link href="/admin/vender" className="inline-flex h-10 items-center gap-2 rounded-xl bg-gold px-4 text-sm font-semibold text-void hover:brightness-110"><Zap size={15} /> Venta rápida</Link>
        <Link href="/admin/salon" className="inline-flex h-10 items-center gap-2 rounded-xl border border-gold/30 px-4 text-sm text-gold-light hover:bg-gold/10"><Armchair size={15} /> Taburetes</Link>
      </Encabezado>

      {/* Lo que piden los clientes desde el QR de su mesa: aparece arriba de todo hasta que se atiende */}
      <BandejaQR compacta />
      <PorEnviarCocina />

      {/* ------------------------------------------------------------ Buscar o abrir: un solo campo */}
      <section className="sticky top-14 z-20 -mx-3 mb-5 border-b border-gold/10 bg-[#020a07]/95 px-3 pt-1 pb-3 backdrop-blur-xl sm:mx-0 sm:rounded-3xl sm:border sm:p-4">
        <NombreCliente valor={nombre} onCambio={setNombre} onEnter={alEnter} autoFocus placeholder="¿A nombre de quién? Escribe para buscar o abrir cuenta" />
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
          {busqueda ? (
            <Boton variante="oro" tam="lg" className="!h-14 !text-base" cargando={ocupado} onClick={() => abrirNueva(nombre)}>
              <Plus size={20} /> Abrir cuenta nueva a nombre de «{nombre.trim()}»
            </Boton>
          ) : (
            <p className="flex items-center gap-2 px-1 text-sm text-smoke"><UserRound size={15} className="text-gold" /> Ponle siempre nombre o seña: así se encuentra la cuenta en segundos.</p>
          )}
          <Boton tam="lg" className="!h-14" cargando={ocupado && !busqueda} onClick={() => abrirNueva(null)} title="Para quien paga en el momento y no va a seguir pidiendo">
            <Zap size={18} /> Venta al paso
          </Boton>
        </div>
      </section>

      <h2 className="mb-2 flex flex-wrap items-center gap-2 font-display text-lg">
        {busqueda ? `${coinciden.length} ${coinciden.length === 1 ? 'cuenta coincide' : 'cuentas coinciden'}` : 'Cuentas abiertas'}
        {!busqueda && datos && <Insignia color={porCobrar.length ? 'oro' : 'gris'}>{porCobrar.length} por cobrar{porCobrar.length > 0 && ` · ${dinero(deuda, porCobrar[0].moneda)}`}</Insignia>}
        {busqueda && coinciden.length === 1 && <span className="text-xs text-smoke">· Enter para abrirla</span>}
      </h2>

      {cargando ? <Cargando /> : error ? <ErrorCaja mensaje={error} onReintentar={recargar} /> : !coinciden.length ? (
        <div className="rounded-3xl border-2 border-dashed border-gold/20 px-6 py-12 text-center">
          <p className="font-display text-xl">{busqueda ? `Nadie con «${nombre.trim()}» tiene cuenta abierta` : 'Sin cuentas abiertas'}</p>
          <p className="mt-1 text-sm text-smoke">{busqueda ? 'Toca «Abrir cuenta nueva» o pulsa Enter.' : 'Escribe el nombre del primer cliente arriba.'}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {coinciden.map((c) => {
            const saldo = c.total - c.pagado;
            return (
              <button key={c.id} onClick={() => router.push(`/admin/cuenta/${c.id}`)}
                className={`flex items-center gap-3 rounded-3xl border-2 p-4 text-left transition active:scale-[.99] ${saldo > 0 ? 'border-gold/40 bg-gold/5 hover:border-gold' : 'border-venom/30 bg-emerald/20'}`}>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-xl font-medium ${c.nombre_cliente ? 'text-ivory' : 'text-smoke italic'}`}>{c.nombre_cliente ?? 'Sin nombre'}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-xs text-smoke">
                    <span className="text-gold/90">{lugar(c)}</span>
                    <span>{c.numero}</span>
                    <span className="flex items-center gap-1"><Clock size={11} /> {hace(c.abierta_en)}</span>
                    <span className="flex items-center gap-1"><ShoppingBag size={11} /> {c.items}</span>
                    {ver === 'todas' && c.mesonero && <span>{c.mesonero}</span>}
                  </p>
                  <p className={`mt-2 font-display text-3xl font-light ${saldo > 0 ? 'text-gold-light' : 'text-venom'}`}>{saldo > 0 ? dinero(saldo, c.moneda) : 'Al día ✓'}</p>
                  {c.pagado > 0 && saldo > 0 && <p className="text-[11px] text-smoke">Ya abonó {dinero(c.pagado, c.moneda)}</p>}
                </div>
                <ChevronRight size={22} className="shrink-0 text-gold/60" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
