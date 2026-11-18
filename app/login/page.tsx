'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { entrar } from '@/lib/dados';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setEnviando(true);
    try { await entrar(email.trim(), senha); router.replace('/'); }
    catch (x) { setErro((x as Error).message); }
    finally { setEnviando(false); }
  }

  return (
    <div className="centro">
      <form onSubmit={enviar} className="cartao" style={{ width: '100%', maxWidth: 380, textAlign: 'left' }}>
        <h1>Fechamento</h1>
        <p className="suave" style={{ marginTop: 0 }}>Entre com seu e-mail e senha.</p>
        <label htmlFor="email">E-mail</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        <label htmlFor="senha">Senha</label>
        <input id="senha" type="password" autoComplete="current-password" required value={senha} onChange={e => setSenha(e.target.value)} />
        {erro && <p className="erro">{erro}</p>}
        <button className="botao" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
