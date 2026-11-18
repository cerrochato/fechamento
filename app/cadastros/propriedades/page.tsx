'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import { useApp } from '@/lib/contexto';
import { listarPropriedadesCad, salvarPropriedade } from '@/lib/dados';
import type { PropriedadeCad } from '@/lib/tipos';

export default function Propriedades() {
  const { sessao } = useApp();
  const [lista, setLista] = useState<PropriedadeCad[] | null>(null);
  const [editando, setEditando] = useState<PropriedadeCad | null>(null);
  const carregar = () => listarPropriedadesCad().then(setLista);
  useEffect(() => { carregar(); }, []);
  // propriedade nova ou renomeada: recarrega o app para aparecer no seletor do topo
  const fechar = async (salvo: boolean) => { setEditando(null); if (salvo) window.location.reload(); };

  if (!sessao.adm) return <Moldura><p className="suave">Só o administrador cadastra propriedades.</p></Moldura>;
  return (
    <Moldura>
      <Link href="/cadastros" className="suave">← Cadastros</Link>
      <h1 style={{ marginTop: 8 }}>Propriedades</h1>
      {!editando && <button className="botao" onClick={() => setEditando({ nome: '', apelido: null, municipio: null, uf: 'RS', valor_hectare: null, ativa: true })}>＋ Nova propriedade</button>}
      {editando && !editando.id && <Formulario p={editando} aoFechar={fechar} />}
      <div className="lista" style={{ marginTop: 14 }}>
        {!lista && <p className="suave">Carregando…</p>}
        {(lista ?? []).map(p => editando && editando.id === p.id ? <Formulario key={p.id} p={editando} aoFechar={fechar} /> : (
          <button key={p.id} className="cartao item" onClick={() => setEditando({ ...p })}
            style={{ textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', opacity: p.ativa ? 1 : .55 }}>
            <div><strong>{p.nome}</strong>{!p.ativa && ' · desativada'}<br />
              <small>{[p.municipio, p.uf].filter(Boolean).join(' / ') || 'Município não informado'}</small></div>
            <span className="suave">Editar</span>
          </button>
        ))}
      </div>
      <p className="suave" style={{ fontSize: '.88rem' }}>
        Depois de criar uma propriedade, cadastre os potreiros dela (escolha a propriedade no topo) e dê acesso aos usuários.
      </p>
    </Moldura>
  );
}

function Formulario({ p, aoFechar }: { p: PropriedadeCad; aoFechar: (salvo: boolean) => Promise<void> }) {
  const [f, setF] = useState(p);
  const [valor, setValor] = useState(p.valor_hectare ? String(p.valor_hectare).replace('.', ',') : '');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const txt = (k: keyof PropriedadeCad) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value || null });

  async function salvar(extra?: Partial<PropriedadeCad>) {
    if (!f.nome?.trim()) return setErro('Informe o nome.');
    setSalvando(true); setErro(null);
    try {
      await salvarPropriedade({ ...f, nome: f.nome.trim(), uf: f.uf ? f.uf.toUpperCase().slice(0, 2) : null,
        valor_hectare: valor ? Number(valor.replace(/\./g, '').replace(',', '.')) : null, ...extra });
      await aoFechar(true);
    } catch (e) {
      setErro((e as Error).message.includes('duplicate') ? 'Já existe uma propriedade com esse nome.' : (e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <div className="cartao" style={{ borderColor: 'var(--verde)' }}>
      <strong>{p.id ? p.nome : 'Nova propriedade'}</strong>
      <label htmlFor="nome">Nome</label>
      <input id="nome" value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Estância Santa Maria" />
      <label htmlFor="ap">Apelido (como aparece nos relatórios)</label>
      <input id="ap" value={f.apelido ?? ''} onChange={txt('apelido')} placeholder="Ex.: SANTA MARIA" />
      <div className="filtros" style={{ gridTemplateColumns: '1fr 70px', marginTop: 10 }}>
        <div><label htmlFor="mun">Município</label><input id="mun" value={f.municipio ?? ''} onChange={txt('municipio')} /></div>
        <div><label htmlFor="uf">UF</label><input id="uf" maxLength={2} value={f.uf ?? ''} onChange={txt('uf')} /></div>
      </div>
      <label htmlFor="vh">Valor da terra (R$ por hectare)</label>
      <input id="vh" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="Usado no resultado sobre o valor da terra" />
      {erro && <p className="erro">{erro}</p>}
      <button className="botao" disabled={salvando} onClick={() => salvar()}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      {p.id && <button className="botao sec" disabled={salvando} style={{ marginTop: 10 }} onClick={() => salvar({ ativa: !p.ativa })}>
        {p.ativa ? 'Desativar propriedade' : 'Reativar propriedade'}</button>}
      <button className="excluir" style={{ color: 'var(--suave)', marginTop: 8 }} onClick={() => aoFechar(false)}>Cancelar</button>
    </div>
  );
}
