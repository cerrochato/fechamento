'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import { useApp } from '@/lib/contexto';
import { criarUsuario, listarPropriedadesCad, listarUsuarios, salvarUsuario } from '@/lib/dados';
import type { Acesso, PropriedadeCad, UsuarioCad } from '@/lib/tipos';

const PAPEIS = [
  { v: null, nome: 'Sem acesso' },
  { v: 'capataz', nome: 'Capataz' },
  { v: 'gerente', nome: 'Gerente' },
] as const;

const resumo = (u: UsuarioCad, props: PropriedadeCad[]) => u.adm ? 'Administrador · todas as propriedades'
  : u.acessos.length === 0 ? 'Sem acesso a nenhuma propriedade'
  : u.acessos.map(a => `${a.papel === 'gerente' ? 'Gerente' : 'Capataz'} em ${props.find(p => p.id === a.propriedade_id)?.nome ?? '?'}`).join(' · ');

export default function Usuarios() {
  const { sessao } = useApp();
  const [lista, setLista] = useState<UsuarioCad[] | null>(null);
  const [props, setProps] = useState<PropriedadeCad[]>([]);
  const [editando, setEditando] = useState<string | null>(null);   // id, ou 'novo'
  const [aviso, setAviso] = useState('');

  const carregar = () => listarUsuarios().then(setLista);
  useEffect(() => { carregar(); listarPropriedadesCad().then(l => setProps(l.filter(p => p.ativa))); }, []);
  const fechar = async (msg?: string) => { setEditando(null); if (msg) { setAviso(msg); await carregar(); } };

  if (!sessao.adm) return <Moldura><p className="suave">Só o administrador cadastra usuários.</p></Moldura>;
  return (
    <Moldura>
      <Link href="/cadastros" className="suave">← Cadastros</Link>
      <h1 style={{ marginTop: 8 }}>Usuários e acessos</h1>
      <p className="suave" style={{ marginTop: -4, fontSize: '.9rem' }}>
        <strong>Capataz:</strong> lança movimentações e contagens. <strong>Gerente:</strong> também fecha contagens e edita potreiros.
        <strong> Administrador:</strong> tudo, em todas as propriedades, inclusive o financeiro.
      </p>
      {aviso && <div className="aviso" role="status">{aviso}</div>}
      {editando !== 'novo' && <button className="botao" onClick={() => { setAviso(''); setEditando('novo'); }}>＋ Novo usuário</button>}
      {editando === 'novo' && <Formulario props={props} aoFechar={fechar} />}
      <div className="lista" style={{ marginTop: 14 }}>
        {!lista && <p className="suave">Carregando…</p>}
        {(lista ?? []).map(u => editando === u.id
          ? <Formulario key={u.id} u={u} props={props} eu={u.id === sessao.usuarioId} aoFechar={fechar} />
          : (
            <button key={u.id} className="cartao item" onClick={() => { setAviso(''); setEditando(u.id); }}
              style={{ textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', opacity: u.ativo ? 1 : .55 }}>
              <div><strong>{u.nome}</strong>{!u.ativo && ' · bloqueado'}<br /><small>{u.email}</small><br /><small>{resumo(u, props)}</small></div>
              <span className="suave">Editar</span>
            </button>
          ))}
      </div>
    </Moldura>
  );
}

function Formulario({ u, props, eu, aoFechar }: {
  u?: UsuarioCad; props: PropriedadeCad[]; eu?: boolean; aoFechar: (msg?: string) => Promise<void>;
}) {
  const [nome, setNome] = useState(u?.nome ?? '');
  const [email, setEmail] = useState(u?.email ?? '');
  const [whats, setWhats] = useState(u?.whatsapp ?? '');
  const [senha, setSenha] = useState('');
  const [adm, setAdm] = useState(u?.adm ?? false);
  const [acessos, setAcessos] = useState<Acesso[]>(u?.acessos ?? []);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const papelEm = (pid: number) => acessos.find(a => a.propriedade_id === pid)?.papel ?? null;
  const mudarPapel = (pid: number, papel: Acesso['papel'] | null) =>
    setAcessos(l => [...l.filter(a => a.propriedade_id !== pid), ...(papel ? [{ propriedade_id: pid, papel }] : [])]);
  const whatsLimpo = () => { const d = whats.replace(/\D/g, ''); return d ? '+' + (d.startsWith('55') ? d : '55' + d) : null; };

  async function salvar(extra?: Partial<UsuarioCad>) {
    if (!nome.trim()) return setErro('Informe o nome.');
    if (!u && !/^\S+@\S+\.\S+$/.test(email.trim())) return setErro('Informe um e-mail válido.');
    if (!u && senha.length < 8) return setErro('A senha provisória precisa ter pelo menos 8 caracteres.');
    if (!adm && acessos.length === 0 && !extra) return setErro('Escolha pelo menos uma propriedade, ou marque como administrador.');
    setSalvando(true); setErro(null);
    try {
      if (u) {
        await salvarUsuario({ ...u, nome: nome.trim(), whatsapp: whatsLimpo(), adm, acessos, ...extra });
        await aoFechar(extra?.ativo === false ? `${nome} foi bloqueado e não entra mais no app.` : 'Alterações salvas.');
      } else {
        await criarUsuario({ nome: nome.trim(), email: email.trim().toLowerCase(), senha, whatsapp: whatsLimpo(), adm, acessos });
        await aoFechar(`${nome} foi criado. Passe para a pessoa o e-mail e a senha provisória; ela pode trocar a senha depois.`);
      }
    } catch (e) { setErro((e as Error).message); setSalvando(false); }
  }

  return (
    <div className="cartao" style={{ borderColor: 'var(--verde)' }}>
      <strong>{u ? u.nome : 'Novo usuário'}</strong>
      <label htmlFor="nome">Nome</label>
      <input id="nome" value={nome} onChange={e => setNome(e.target.value)} />
      <label htmlFor="email">E-mail (usado para entrar)</label>
      <input id="email" type="email" value={email} disabled={!!u} onChange={e => setEmail(e.target.value)} autoComplete="off" />
      {!u && <>
        <label htmlFor="senha">Senha provisória</label>
        <input id="senha" type="text" value={senha} onChange={e => setSenha(e.target.value)} autoComplete="new-password" placeholder="Mínimo 8 caracteres" />
      </>}
      <label htmlFor="wa">WhatsApp</label>
      <input id="wa" inputMode="tel" value={whats} onChange={e => setWhats(e.target.value)} placeholder="(55) 99999-9999" />

      <label style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'inherit', fontSize: '1rem' }}>
        <input type="checkbox" checked={adm} disabled={eu} onChange={e => setAdm(e.target.checked)} style={{ width: 20, height: 20, minHeight: 0 }} />
        Administrador (acesso total)
      </label>

      {!adm && <>
        <div className="suave" style={{ fontSize: '.88rem', margin: '14px 0 6px' }}>Acesso por propriedade</div>
        {props.map(p => (
          <div key={p.id} style={{ marginBottom: 10 }}>
            <div style={{ marginBottom: 4 }}>{p.nome}</div>
            <div className="chips">
              {PAPEIS.map(x => (
                <button key={String(x.v)} type="button" className={`chip ${papelEm(p.id!) === x.v ? 'sel' : ''}`}
                  onClick={() => mudarPapel(p.id!, x.v)}>{x.nome}</button>
              ))}
            </div>
          </div>
        ))}
      </>}

      {erro && <p className="erro">{erro}</p>}
      <button className="botao" disabled={salvando} onClick={() => salvar()}>{salvando ? 'Salvando…' : u ? 'Salvar' : 'Criar usuário'}</button>
      {u && !eu && (
        <button className="botao sec" disabled={salvando} style={{ marginTop: 10 }} onClick={() => salvar({ ativo: !u.ativo })}>
          {u.ativo ? 'Bloquear acesso' : 'Desbloquear acesso'}
        </button>
      )}
      <button className="excluir" style={{ color: 'var(--suave)', marginTop: 8 }} onClick={() => aoFechar()}>Cancelar</button>
    </div>
  );
}
