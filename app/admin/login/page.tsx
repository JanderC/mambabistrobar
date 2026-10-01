'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SerpentMark } from '@/components/SerpentMark';
import { Boton, Campo, Input } from '@/components/admin/ui';
import { adm, mensajeError, sesion } from '@/lib/admin/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    document.title = 'Panel — Mamba Bistro Bar';
    if (sesion.token()) router.replace('/admin');
  }, [router]);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCargando(true);
    setError('');
    try {
      const { token } = await adm<{ token: string }>('/auth/login', { method: 'POST', body: { email, password } });
      sesion.guardar(token);
      router.replace('/admin');
    } catch (err) {
      setError(mensajeError(err));
      setCargando(false);
    }
  };

  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-[radial-gradient(120%_80%_at_50%_0%,#0b4a35_0%,#03110c_55%,#010604_100%)] p-4">
      <div className="scales pointer-events-none absolute inset-0 opacity-[.06]" />
      <form onSubmit={entrar} className="relative w-full max-w-sm rounded-3xl border border-gold/20 bg-[#04110c]/90 p-7 shadow-2xl backdrop-blur">
        <SerpentMark className="mx-auto w-40" />
        <h1 className="mt-2 text-center font-display text-2xl font-light tracking-[0.35em] text-ivory">MAMBA</h1>
        <p className="mb-6 text-center text-[10px] tracking-[0.4em] text-gold uppercase">Panel administrativo</p>
        <div className="space-y-4">
          <Campo etiqueta="Correo">
            <Input type="email" autoComplete="username" autoFocus required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@mamba.com" />
          </Campo>
          <Campo etiqueta="Contraseña">
            <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Campo>
          {error && <p className="rounded-xl border border-red-400/30 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</p>}
          <Boton type="submit" variante="oro" tam="lg" className="w-full" cargando={cargando}>Entrar</Boton>
        </div>
      </form>
    </div>
  );
}
