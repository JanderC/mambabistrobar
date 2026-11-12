'use client';

import { Download, ExternalLink, FileDown, Printer, RefreshCw } from 'lucide-react';
import QRCode from 'qrcode';
import { useEffect, useMemo, useState } from 'react';
import { Boton, Cargando, ErrorCaja, Insignia, Vacio, useAvisos, useDatos } from '@/components/admin/ui';
import { adm } from '@/lib/admin/api';
import { canvasAJpeg, descargarArchivo, pdfConImagenes } from '@/lib/admin/pdf';

type MesaQr = { id: number; numero: number; nombre: string | null; zona: string; tipo: string; activo: boolean; qr_token: string | null };

const OPCIONES_QR = { errorCorrectionLevel: 'H' as const, margin: 1, color: { dark: '#010604', light: '#ffffff' } };
const titulo = (m: MesaQr) => (m.tipo === 'barra' ? `Barra${m.nombre ? ` · ${m.nombre}` : ''}` : `Mesa ${m.numero}`);
const escapar = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/**
 * Códigos QR para pegar en cada mesa. Cada uno lleva a /pedir/<código secreto de la mesa>:
 * el cliente ve la carta y su pedido llega a la barra marcado con esa mesa.
 */
export function QrMesas() {
  const mesas = useDatos<MesaQr[]>('/salon/mesas');
  const [svgs, setSvgs] = useState<Record<number, string>>({});
  const [ocupado, setOcupado] = useState<number | null>(null);
  const avisos = useAvisos();
  const origen = typeof window === 'undefined' ? '' : window.location.origin;
  const activas = useMemo(() => (mesas.datos ?? []).filter((m) => m.activo && m.qr_token), [mesas.datos]);
  const url = (m: MesaQr) => `${origen}/pedir/${m.qr_token}`;

  useEffect(() => {
    let vivo = true;
    Promise.all(activas.map(async (m) => [m.id, await QRCode.toString(url(m), { ...OPCIONES_QR, type: 'svg' })] as const)).then((pares) => {
      if (vivo) setSvgs(Object.fromEntries(pares));
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activas, origen]);

  /** Tarjeta lista para imprimir en grande: logo, número de mesa, QR e instrucciones */
  const dibujarTarjeta = async (m: MesaQr) => {
    const W = 1200, H = 1650;
    const lienzo = document.createElement('canvas');
    lienzo.width = W;
    lienzo.height = H;
    const g = lienzo.getContext('2d')!;
    g.fillStyle = '#010604';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = '#d4af37';
    g.lineWidth = 6;
    g.strokeRect(40, 40, W - 80, H - 80);
    const logo = new Image();
    logo.src = '/brand/logo-512.png';
    await new Promise((r) => { logo.onload = r; logo.onerror = r; });
    if (logo.complete && logo.naturalWidth) g.drawImage(logo, W / 2 - 110, 90, 220, 220);
    g.textAlign = 'center';
    g.fillStyle = '#d4af37';
    g.font = '600 46px Georgia, serif';
    g.fillText('MAMBA BISTRO BAR', W / 2, 380);
    g.fillStyle = '#f5f0e6';
    // Nombres largos («Barra · Barra principal»): se achica la letra hasta que quepa dentro del borde
    let tam = 120;
    do g.font = `300 ${tam}px Georgia, serif`; while (g.measureText(titulo(m)).width > W - 180 && (tam -= 6) > 40);
    g.fillText(titulo(m), W / 2, 520);
    const qr = new Image();
    qr.src = await QRCode.toDataURL(url(m), { ...OPCIONES_QR, width: 820 });
    await new Promise((r) => { qr.onload = r; });
    g.fillStyle = '#ffffff';
    g.fillRect(W / 2 - 430, 580, 860, 860);
    g.drawImage(qr, W / 2 - 410, 600, 820, 820);
    g.fillStyle = '#f5f0e6';
    g.font = '500 50px system-ui, sans-serif';
    g.fillText('Escanea, mira la carta', W / 2, 1515);
    g.fillStyle = '#d4af37';
    g.fillText('y pide desde tu mesa', W / 2, 1580);
    return lienzo;
  };

  const descargar = async (m: MesaQr) => {
    const lienzo = await dibujarTarjeta(m);
    const a = document.createElement('a');
    a.href = lienzo.toDataURL('image/png');
    a.download = `qr-${titulo(m).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`;
    a.click();
  };

  /** PDF con todas las tarjetas, 4 por hoja carta: se descarga y se imprime desde cualquier lado */
  const [armandoPdf, setArmandoPdf] = useState(false);
  const descargarPdf = async () => {
    setArmandoPdf(true);
    try {
      const imagenes = [];
      for (const m of activas) imagenes.push(await canvasAJpeg(await dibujarTarjeta(m)));
      descargarArchivo(pdfConImagenes(imagenes), `qr-mesas-mamba.pdf`);
      avisos.ok(`PDF listo: ${activas.length} códigos, ${Math.ceil(activas.length / 4)} hojas`);
    } catch (e) {
      avisos.error(e);
    } finally {
      setArmandoPdf(false);
    }
  };

  /** Hoja para imprimir todos (4 por página, listos para recortar y pegar) */
  const imprimirTodas = () => {
    // Se imprime desde un marco oculto en la misma página: así el navegador no lo bloquea como ventana emergente
    document.getElementById('qr-impresion')?.remove();
    const marco = document.createElement('iframe');
    marco.id = 'qr-impresion';
    marco.setAttribute('aria-hidden', 'true');
    marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
    document.body.appendChild(marco);
    const ventana = marco.contentWindow!;
    const tarjetas = activas.map((m) => `
      <div class="t">
        <p class="marca">MAMBA BISTRO BAR</p>
        <p class="mesa">${escapar(titulo(m))}</p>
        <div class="qr">${svgs[m.id] ?? ''}</div>
        <p class="txt">Escanea, mira la carta<br><b>y pide desde tu mesa</b></p>
      </div>`).join('');
    ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>QR de las mesas</title><style>
      @page { size: letter; margin: 10mm; }
      * { box-sizing: border-box; } body { margin: 0; font-family: Georgia, serif; }
      .g { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
      .t { break-inside: avoid; border: 1.5mm solid #d4af37; border-radius: 6mm; padding: 6mm; text-align: center; background: #010604; color: #f5f0e6;
           -webkit-print-color-adjust: exact; print-color-adjust: exact; height: 122mm; display: flex; flex-direction: column; justify-content: center; }
      .marca { margin: 0; color: #d4af37; letter-spacing: 2px; font-size: 11pt; }
      .mesa { margin: 2mm 0 4mm; font-size: 30pt; font-weight: 300; }
      .qr { background: #fff; padding: 3mm; border-radius: 3mm; width: 62mm; margin: 0 auto; } .qr svg { display: block; width: 100%; height: auto; }
      .txt { margin: 4mm 0 0; font: 11pt system-ui, sans-serif; } .txt b { color: #d4af37; font-weight: 600; }
    </style></head><body><div class="g">${tarjetas}</div></body></html>`);
    ventana.document.close();
    setTimeout(() => { ventana.focus(); ventana.print(); }, 300);
  };

  const regenerar = async (m: MesaQr) => {
    if (!confirm(`¿Cambiar el código de ${titulo(m)}? El QR que está pegado ahora dejará de funcionar y tendrás que pegar el nuevo.`)) return;
    setOcupado(m.id);
    try {
      await adm(`/pedidos-qr/mesas/${m.id}/regenerar`, { method: 'POST' });
      avisos.ok(`${titulo(m)}: código nuevo listo. Descárgalo o imprímelo.`);
      mesas.recargar();
    } catch (e) {
      avisos.error(e);
    } finally {
      setOcupado(null);
    }
  };

  if (mesas.cargando) return <Cargando />;
  if (mesas.error) return <ErrorCaja mensaje={mesas.error} onReintentar={mesas.recargar} />;
  if ((mesas.datos ?? []).length && !(mesas.datos ?? []).some((m) => m.qr_token))
    return <ErrorCaja mensaje="El servidor todavía no tiene los códigos QR de las mesas. Espera a que termine de desplegar el backend y recarga." onReintentar={mesas.recargar} />;
  if (!activas.length) return <Vacio titulo="No hay mesas activas">Crea las mesas en la pestaña «Mesas y asientos» y aquí aparecen sus QR.</Vacio>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gold/15 bg-gold/5 p-4">
        <p className="max-w-2xl text-sm text-smoke">
          Cada mesa tiene un código propio y secreto: el pedido llega a la barra marcado con esa mesa y nadie puede pedir a otra cambiando un número.
          Imprímelos, recórtalos y pégalos en cada mesa.
        </p>
        <div className="flex flex-wrap gap-2">
          <Boton variante="oro" tam="lg" cargando={armandoPdf} onClick={descargarPdf}><FileDown size={18} /> Descargar PDF ({activas.length})</Boton>
          <Boton tam="lg" onClick={imprimirTodas} disabled={Object.keys(svgs).length < activas.length}><Printer size={18} /> Imprimir</Boton>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {activas.map((m) => (
          <div key={m.id} className="flex flex-col rounded-2xl border border-gold/15 bg-[#06140f] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-xl">{titulo(m)}</p>
              {m.tipo === 'vip' && <Insignia color="oro">VIP</Insignia>}
            </div>
            <p className="truncate text-xs text-smoke">{m.zona}{m.nombre && m.tipo !== 'barra' ? ` · ${m.nombre}` : ''}</p>
            <div className="mt-2 aspect-square overflow-hidden rounded-xl bg-white p-1.5 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svgs[m.id] ?? '' }} />
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <Boton tam="sm" onClick={() => descargar(m)} title="Descargar la tarjeta en PNG" aria-label="Descargar"><Download size={15} /></Boton>
              <a href={url(m)} target="_blank" rel="noreferrer" title="Abrir como lo ve el cliente" className="inline-flex h-8 items-center justify-center rounded-xl border border-gold/20 text-smoke hover:text-ivory"><ExternalLink size={15} /></a>
              <Boton tam="sm" variante="sutil" cargando={ocupado === m.id} onClick={() => regenerar(m)} title="Cambiar el código (el QR viejo deja de servir)" aria-label="Cambiar código"><RefreshCw size={15} /></Boton>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
