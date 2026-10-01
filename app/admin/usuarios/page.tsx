'use client';

import { Crud } from '@/components/admin/Crud';
import { Insignia } from '@/components/admin/ui';
import { ROLES } from '@/lib/admin/modulos';
import { fechaHora } from '@/lib/admin/moneda';

type Usuario = { id: number; nombre: string; email: string; rol: string; activo: boolean; ultimo_acceso: string | null };

export default function UsuariosPage() {
  return (
    <Crud<Usuario>
      titulo="Usuarios"
      descripcion="Cada persona entra con su correo. El rol define qué módulos ve y qué puede hacer."
      ruta="/usuarios"
      textoNuevo="Nuevo usuario"
      buscarEn={(u) => `${u.nombre} ${u.email} ${u.rol}`}
      nuevo={{ nombre: '', email: '', rol: 'mesonero', activo: true, password: '' }}
      aForm={(u) => ({ ...u, password: '' })}
      columnas={[
        { titulo: 'Nombre', celda: (u) => <span className="font-medium">{u.nombre}</span> },
        { titulo: 'Correo', celda: (u) => <span className="text-smoke">{u.email}</span> },
        { titulo: 'Rol', celda: (u) => <Insignia color={u.rol === 'admin' ? 'oro' : 'azul'}>{ROLES.find((r) => r.valor === u.rol)?.nombre ?? u.rol}</Insignia> },
        { titulo: 'Último acceso', celda: (u) => <span className="text-smoke">{u.ultimo_acceso ? fechaHora(u.ultimo_acceso) : 'Nunca'}</span> },
        { titulo: 'Estado', celda: (u) => (u.activo ? <Insignia color="verde">Activo</Insignia> : <Insignia color="rojo">Desactivado</Insignia>) },
      ]}
      campos={[
        { nombre: 'nombre', etiqueta: 'Nombre' },
        { nombre: 'email', etiqueta: 'Correo' },
        { nombre: 'rol', etiqueta: 'Rol', tipo: 'select', opciones: ROLES.map((r) => ({ valor: r.valor, etiqueta: `${r.nombre} — ${r.descripcion}` })), ancho: true },
        { nombre: 'password', etiqueta: 'Contraseña', tipo: 'password', ayuda: 'Mínimo 8 caracteres. Al editar, déjala vacía para no cambiarla.' },
        { nombre: 'activo', etiqueta: 'Puede iniciar sesión', tipo: 'si_no' },
      ]}
    />
  );
}
