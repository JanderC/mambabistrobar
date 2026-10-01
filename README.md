# Mamba Bistro Bar 2.0 — Frontend

Sitio web público (menú con QR, eventos, reservas, galería, contacto) y panel administrativo (`/admin`) de Mamba Bistro Bar.
Next.js 16 (App Router) + Tailwind CSS 4. Consume la API del backend de Mamba.

## Arrancar

```bash
cp .env.example .env.local   # URL del backend y del sitio
npm install
npm run dev                  # http://localhost:3000  ·  panel en /admin
```

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_API_URL` | URL del backend, terminada en `/api` |
| `NEXT_PUBLIC_SITE_URL` | URL pública del sitio (SEO, sitemap, enlaces para compartir) |

## Estructura

- `app/(sitio)/` — páginas públicas
- `app/admin/` — panel: salón, barra, comandas, caja, ventas, productos, inventario, reservas, eventos, recordatorios, reportes, tasas…
- `components/admin/` — navegación, kit de interfaz, CRUD genérico y punto de venta
- `lib/admin/modulos.ts` — registro de módulos y permisos por rol
