'use client';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cadastros, DEMO, minhasPropriedades, sessaoAtual, supabase, type Sessao } from './dados';
import type { Cadastros, Propriedade } from './tipos';

interface Ctx {
  sessao: Sessao;
  propriedades: Propriedade[];
  propriedade: Propriedade;
  trocarPropriedade: (id: number) => void;
  cad: Cadastros;
  recarregarCadastros: () => Promise<void>;
}

const Contexto = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const c = useContext(Contexto);
  if (!c) throw new Error('useApp fora do AppProvider');
  return c;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [estado, setEstado] = useState<Omit<Ctx, 'trocarPropriedade' | 'recarregarCadastros'> | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    let salvo: number | null = null;
    try { salvo = Number(localStorage.getItem('propriedade')) || null; } catch { /* sem localStorage */ }
    try {
      const s = await sessaoAtual();
      if (!s) { router.replace('/login'); return; }
      const [props, cad] = await Promise.all([minhasPropriedades(s), cadastros()]);
      if (props.length === 0) { setErro('Seu usuário ainda não tem acesso a nenhuma propriedade. Peça ao administrador.'); return; }
      const prop = props.find(p => p.id === salvo) ?? props[0];
      setEstado({ sessao: s, propriedades: props, propriedade: prop, cad });
      // guarda uma cópia para o app abrir no campo, sem sinal
      try { localStorage.setItem('cache_app', JSON.stringify({ sessao: s, propriedades: props, cad })); } catch { /* ignora */ }
    } catch (e) {
      // sem internet: usa a última cópia guardada
      try {
        const c = JSON.parse(localStorage.getItem('cache_app') ?? 'null');
        if (c) {
          setEstado({ ...c, propriedade: c.propriedades.find((p: Propriedade) => p.id === salvo) ?? c.propriedades[0] });
          return;
        }
      } catch { /* ignora */ }
      setErro(navigator.onLine ? (e as Error).message : 'Sem internet. Abra o app uma vez com sinal para ele funcionar no campo.');
    }
  }, [router]);

  useEffect(() => {
    if (path === '/login') return;
    carregar();
    if (DEMO) return;
    const { data } = supabase().auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT') router.replace('/login'); });
    return () => data.subscription.unsubscribe();
  }, [path, carregar, router]);

  if (path === '/login') return <>{children}</>;
  if (erro) return <div className="centro"><p className="erro">{erro}</p></div>;
  if (!estado) return <div className="centro"><p className="suave">Carregando…</p></div>;

  const trocarPropriedade = (id: number) => {
    const p = estado.propriedades.find(x => x.id === id);
    if (!p) return;
    try { localStorage.setItem('propriedade', String(id)); } catch { /* ignora */ }
    setEstado({ ...estado, propriedade: p });
  };
  const recarregarCadastros = async () => setEstado({ ...estado, cad: await cadastros() });

  return (
    <Contexto.Provider value={{ ...estado, trocarPropriedade, recarregarCadastros }}>
      {children}
    </Contexto.Provider>
  );
}
