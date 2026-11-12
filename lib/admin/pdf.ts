/**
 * PDF mínimo hecho a mano: páginas tamaño carta con imágenes JPEG en cuadrícula.
 * Alcanza para hojas de tarjetas (QR de las mesas) sin cargar una librería entera:
 * el PDF acepta el JPEG tal cual (DCTDecode), así que solo hay que armar la estructura.
 */
export type ImagenJpeg = { bytes: Uint8Array; ancho: number; alto: number };

const MM = 72 / 25.4;
const CARTA = { ancho: 612, alto: 792 };

/** Convierte un canvas a JPEG listo para el PDF */
export async function canvasAJpeg(lienzo: HTMLCanvasElement, calidad = 0.92): Promise<ImagenJpeg> {
  const blob = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/jpeg', calidad));
  if (!blob) throw new Error('No se pudo preparar la imagen');
  return { bytes: new Uint8Array(await blob.arrayBuffer()), ancho: lienzo.width, alto: lienzo.height };
}

/**
 * Arma el PDF con `columnas × filas` imágenes por hoja, todas del mismo tamaño (ancho en mm),
 * centradas y con `separacion` mm entre ellas.
 */
export function pdfConImagenes(imagenes: ImagenJpeg[], { columnas = 2, filas = 2, anchoMm = 90, separacionMm = 8 } = {}): Blob {
  const porHoja = columnas * filas;
  const partes: (string | Uint8Array)[] = [];
  const desplaz: number[] = [];
  let largo = 0;
  const escribir = (p: string | Uint8Array) => {
    partes.push(p);
    largo += typeof p === 'string' ? p.length : p.length; // solo ASCII en los textos
  };
  const objeto = (n: number, cuerpo: () => void) => {
    desplaz[n] = largo;
    escribir(`${n} 0 obj\n`);
    cuerpo();
    escribir('\nendobj\n');
  };

  const hojas = Math.max(1, Math.ceil(imagenes.length / porHoja));
  // 1 catálogo · 2 páginas · por hoja: página + contenido · luego una por imagen
  const numPagina = (h: number) => 3 + h * 2;
  const numContenido = (h: number) => 4 + h * 2;
  const numImagen = (i: number) => 3 + hojas * 2 + i;
  const total = 2 + hojas * 2 + imagenes.length;

  escribir('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'.replace(/[^\x00-\x7F]/g, '?'));
  objeto(1, () => escribir('<< /Type /Catalog /Pages 2 0 R >>'));
  objeto(2, () => escribir(`<< /Type /Pages /Count ${hojas} /Kids [${Array.from({ length: hojas }, (_, h) => `${numPagina(h)} 0 R`).join(' ')}] >>`));

  const w = anchoMm * MM;
  const sep = separacionMm * MM;
  for (let h = 0; h < hojas; h++) {
    const deEsta = imagenes.slice(h * porHoja, (h + 1) * porHoja);
    const hImg = deEsta.length ? (w * deEsta[0].alto) / deEsta[0].ancho : w;
    const x0 = (CARTA.ancho - (columnas * w + (columnas - 1) * sep)) / 2;
    const yTop = CARTA.alto - (CARTA.alto - (filas * hImg + (filas - 1) * sep)) / 2;
    const dibujo = deEsta.map((img, k) => {
      const col = k % columnas, fila = Math.floor(k / columnas);
      const alto = (w * img.alto) / img.ancho;
      const x = x0 + col * (w + sep);
      const y = yTop - (fila + 1) * hImg - fila * sep + (hImg - alto);
      return `q ${w.toFixed(2)} 0 0 ${alto.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im${k} Do Q`;
    }).join('\n');
    const recursos = deEsta.map((_, k) => `/Im${k} ${numImagen(h * porHoja + k)} 0 R`).join(' ');
    objeto(numPagina(h), () => escribir(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${CARTA.ancho} ${CARTA.alto}] /Resources << /XObject << ${recursos} >> >> /Contents ${numContenido(h)} 0 R >>`));
    objeto(numContenido(h), () => escribir(`<< /Length ${dibujo.length} >>\nstream\n${dibujo}\nendstream`));
  }
  imagenes.forEach((img, i) => objeto(numImagen(i), () => {
    escribir(`<< /Type /XObject /Subtype /Image /Width ${img.ancho} /Height ${img.alto} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`);
    escribir(img.bytes);
    escribir('\nendstream');
  }));

  const inicioXref = largo;
  escribir(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let n = 1; n <= total; n++) escribir(`${String(desplaz[n]).padStart(10, '0')} 00000 n \n`);
  escribir(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${inicioXref}\n%%EOF`);

  return new Blob(partes.map((p) => (typeof p === 'string' ? new TextEncoder().encode(p) : p)) as BlobPart[], { type: 'application/pdf' });
}

/** Descarga un Blob con ese nombre */
export function descargarArchivo(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
