'use client';

import { QrCode } from 'lucide-react';
import Link from 'next/link';
import { BandejaQR } from '@/components/admin/pos/BandejaQR';
import { useSesion } from '@/components/admin/Sesion';
import { Encabezado } from '@/components/admin/ui';

export default function PedidosQrPage() {
  const { es } = useSesion();
  return (
    <div className="max-w-7xl">
      <Encabezado titulo="Pedidos QR" descripcion="Lo que los clientes piden escaneando el código de su mesa. Al aceptarlo entra a la cuenta de la mesa y sale a cocina y barra como cualquier comanda.">
        {es('gerente') && (
          <Link href="/admin/mesas?tab=qr" className="inline-flex h-10 items-center gap-2 rounded-xl border border-gold/30 px-4 text-sm text-gold-light hover:bg-gold/10">
            <QrCode size={15} /> Imprimir los QR de las mesas
          </Link>
        )}
      </Encabezado>
      <BandejaQR />
    </div>
  );
}
