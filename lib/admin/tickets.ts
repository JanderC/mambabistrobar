import type { Cuenta } from '@/components/admin/pos/tipos';
import { type DatosTicketVenta, enviarAImpresora, leerConfig, puertoAutorizado, ticketVenta } from './impresora';
import { MONEDAS, dinero } from './moneda';

const presentacion = (p: string | null) => (p && !/^(unidad|botella|porci[oó]n)$/i.test(p) ? ` (${p})` : '');

/** Arma el ticket del cliente con lo que tiene la cuenta: productos agrupados, totales, pagos y vuelto */
export function datosTicketCuenta(c: Cuenta): DatosTicketVenta {
  const grupos = new Map<string, { cantidad: number; nombre: string; subtotal: number }>();
  for (const i of c.items) {
    if (i.estado === 'anulado') continue;
    const clave = `${i.nombre}|${i.presentacion ?? ''}|${i.precio_base + i.extras}`;
    const g = grupos.get(clave) ?? { cantidad: 0, nombre: `${i.nombre}${presentacion(i.presentacion)}`, subtotal: 0 };
    g.cantidad += Number(i.cantidad);
    g.subtotal += Number(i.subtotal);
    grupos.set(clave, g);
  }
  const vuelto = c.pagos.find((p) => p.vuelto_monto);
  return {
    numero: c.numero,
    lugar: c.tipo === 'llevar' ? 'Para llevar' : c.mesa_numero && c.tipo === 'mesa' ? `Mesa ${c.mesa_numero}` : 'Barra',
    cliente: c.nombre_cliente,
    atendio: c.mesonero,
    lineas: [...grupos.values()].map((g) => ({ cantidad: g.cantidad, nombre: g.nombre, monto: dinero(g.subtotal, c.moneda) })),
    subtotal: dinero(c.subtotal, c.moneda),
    servicio: c.servicio > 0 ? dinero(c.servicio, c.moneda) : null,
    descuento: c.descuento > 0 ? dinero(c.descuento, c.moneda) : null,
    total: dinero(c.total, c.moneda),
    equivalentes: MONEDAS.filter((m) => m !== c.moneda).map((m) => dinero(c.equivalentes.total[m], m)).join(' / '),
    pagos: c.pagos.map((p) => ({ metodo: `${p.metodo}${p.moneda !== c.moneda ? ` ${p.moneda}` : ''}`, monto: dinero(p.monto_recibido ?? p.monto, p.moneda) })),
    vuelto: vuelto?.vuelto_monto ? dinero(vuelto.vuelto_monto, vuelto.vuelto_moneda ?? c.moneda) : null,
  };
}

/** Si en esta computadora hay impresora térmica (JALPOS por Bluetooth), imprime ahí; si no, con el navegador */
export async function imprimirTicket(d: DatosTicketVenta): Promise<'impresora' | 'navegador'> {
  if (await puertoAutorizado()) {
    if (await enviarAImpresora(ticketVenta(d))) return 'impresora';
  }
  imprimirEnNavegador(d);
  return 'navegador';
}

/** ¿Imprimir solo al cobrar? (ajuste de la impresora en esta computadora) */
export const ticketAlCobrar = () => leerConfig().ticketAlCobrar;

function imprimirEnNavegador(d: DatosTicketVenta) {
  document.getElementById('ticket-venta')?.remove();
  const marco = document.createElement('iframe');
  marco.id = 'ticket-venta';
  marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(marco);
  const e = (t: string) => t.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  const fila = (a: string, b: string, clase = '') => `<tr class="${clase}"><td>${e(a)}</td><td class="d">${e(b)}</td></tr>`;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Ticket ${e(d.numero)}</title><style>
    @page { size: 80mm auto; margin: 4mm; } body { font: 12px monospace; margin: 0; width: 72mm; }
    h1 { font-size: 16px; text-align: center; margin: 0; } p { margin: 2px 0; text-align: center; }
    table { width: 100%; border-collapse: collapse; margin: 6px 0; } td { padding: 2px 0; vertical-align: top; } .d { text-align: right; white-space: nowrap; }
    .t td { border-top: 1px dashed #000; font-weight: bold; font-size: 14px; } .v td { font-weight: bold; }
  </style></head><body><h1>MAMBA</h1><p>BISTRO BAR 2.0</p><p>${new Date().toLocaleString('es-CO')}</p>
    <p><b>${e(d.titulo ?? 'TICKET')} ${e(d.numero)}</b> · ${e(d.lugar)}${d.cliente ? ` · ${e(d.cliente)}` : ''}</p>
    <table>${d.lineas.map((l) => fila(`${l.cantidad} × ${l.nombre}`, l.monto)).join('')}
    ${d.servicio ? fila('Servicio', d.servicio) : ''}${d.descuento ? fila('Descuento', `-${d.descuento}`) : ''}
    ${fila('TOTAL', d.total, 't')}${d.equivalentes ? fila('', d.equivalentes) : ''}
    ${d.pagos.map((p) => fila(`Pago ${p.metodo}`, p.monto)).join('')}${d.vuelto ? fila('VUELTO', d.vuelto, 'v') : ''}</table>
    <p>¡Gracias por tu visita!</p></body></html>`;
  marco.contentWindow!.document.write(html);
  marco.contentWindow!.document.close();
  setTimeout(() => { marco.contentWindow!.focus(); marco.contentWindow!.print(); }, 250);
}
