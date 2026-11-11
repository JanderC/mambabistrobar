import { adm } from './api';

/**
 * Achica la foto en el navegador antes de subirla: lado largo de `max` px, en WebP (o JPEG si el
 * navegador no sabe hacer WebP). Así una foto del celular de 5 MB queda en ~200–400 KB.
 */
export async function achicarFoto(archivo: File, max = 1600, calidad = 0.82): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp|heic|heif|avif|gif)$/i.test(archivo.type) && !/\.(jpe?g|png|webp|heic|heif|avif)$/i.test(archivo.name)) {
    throw new Error('Ese archivo no es una foto');
  }
  const bitmap = await createImageBitmap(archivo).catch(() => {
    throw new Error('No se pudo leer la foto. Prueba con una JPG o PNG.');
  });
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(bitmap.width * escala);
  lienzo.height = Math.round(bitmap.height * escala);
  lienzo.getContext('2d')!.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height);
  bitmap.close();
  const comoBlob = (tipo: string) => new Promise<Blob | null>((ok) => lienzo.toBlob(ok, tipo, calidad));
  const webp = await comoBlob('image/webp');
  if (webp?.type === 'image/webp') return webp;
  const jpg = await comoBlob('image/jpeg');
  if (!jpg) throw new Error('No se pudo preparar la foto');
  return jpg;
}

/** Sube una foto suelta (productos, flyers…) y devuelve su URL pública */
export async function subirFoto(archivo: File, max?: number) {
  return adm<{ id: number; url: string }>('/imagenes', { method: 'POST', body: await achicarFoto(archivo, max) });
}
