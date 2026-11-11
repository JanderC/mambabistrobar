// Arma la lista de fotos de la galería a partir de public/uploads/galeria (corre antes de dev y build).
// Para agregar fotos basta copiarlas a esa carpeta: salen en /galeria ordenadas por nombre.
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(import.meta.dirname, '..', 'public', 'uploads', 'galeria');
const fotos = readdirSync(DIR)
  .filter((f) => /\.(jpe?g|png|webp|avif)$/i.test(f))
  .sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
  .map((f) => ({ archivo: f, url: `/uploads/galeria/${encodeURIComponent(f)}` }));

writeFileSync(join(import.meta.dirname, '..', 'lib', 'galeria-local.json'), JSON.stringify(fotos, null, 1) + '\n');
console.log(`[galeria] ${fotos.length} foto(s) en public/uploads/galeria`);
