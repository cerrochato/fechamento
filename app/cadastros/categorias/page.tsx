'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import { useApp } from '@/lib/contexto';
import { excluirCategoria, listarCategoriasCad, salvarCategoria } from '@/lib/dados';
import type { Categoria } from '@/lib/tipos';

type Cat = Omit<Categoria, 'id'> & { id?: number };

export default function Categorias() {
  const { cad, sessao, recarregarCadastros } = useApp();
  const [lista, setLista] = useState<Categoria[] | null>(null);
  const [editando, setEditando] = useState<Cat | null>(null);
  const [verInativas, setVerInativas] = useState(false);

  const carregar = () => listarCategoriasCad().then(setLista);
  useEffect(() => { carregar(); }, []);
  const fechar = async (salvo: boolean) => { setEditando(null); if (salvo) { await carregar(); await recarregarCadastros(); } };

  if (!sessao.adm) return <Moldura><p className="suave">Só o administrador altera as categorias.</p></Moldura>;
  return (
    <Moldura>
      <Link href="/cadastros" className="suave">← Cadastros</Link>
      <h1 style={{ marginTop: 8 }}>Categorias de animais</h1>
      <p className="suave" style={{ marginTop: -4 }}>Valem para todas as propriedades. Uma categoria com lançamentos não é apagada, só desativada.</p>
      {!lista && <p className="suave">Carregando…</p>}
      {cad.especies.map(e => {
        const cats = (lista ?? []).filter(c => c.especie_id === e.id && (verInativas || c.ativa)).sort((a, b) => a.ordem - b.ordem);
        const proxOrdem = Math.max(0, ...(lista ?? []).filter(c => c.especie_id === e.id && c.ordem < 99).map(c => c.ordem)) + 1;
        return (
          <section key={e.id}>
            <h2>{e.nome}</h2>
            <div className="lista">
              {cats.map(c => editando && editando.id === c.id
                ? <Formulario key={c.id} c={editando} aoFechar={fechar} />
                : (
                  <button key={c.id} className="cartao item" onClick={() => setEditando({ ...c })}
                    style={{ textAlign: 'left', font: 'inherit', color: 'inherit', cursor: 'pointer', opacity: c.ativa ? 1 : .55 }}>
                    <div><strong>{c.nome}</strong>{!c.ativa && ' · desativada'}<br />
                      <small>{c.peso_padrao_kg ? `${Number(c.peso_padrao_kg)} kg de referência` : 'sem peso de referência'}</small></div>
                    <span className="suave">Editar</span>
                  </button>
                ))}
              {editando && !editando.id && editando.especie_id === e.id
                ? <Formulario c={editando} aoFechar={fechar} />
                : <button className="botao sec" style={{ marginTop: 0 }} onClick={() => setEditando({ especie_id: e.id, nome: '', peso_padrao_kg: null, ordem: proxOrdem, ativa: true })}>
                    ＋ Nova categoria de {e.nome.toLowerCase()}
                  </button>}
            </div>
          </section>
        );
      })}
      {(lista ?? []).some(c => !c.ativa) && (
        <button className="botao sec" onClick={() => setVerInativas(v => !v)}>{verInativas ? 'Esconder desativadas' : 'Mostrar desativadas'}</button>
      )}
    </Moldura>
  );
}

function Formulario({ c, aoFechar }: { c: Cat; aoFechar: (salvo: boolean) => Promise<void> }) {
  const [f, setF] = useState(c);
  const [peso, setPeso] = useState(c.peso_padrao_kg ? String(c.peso_padrao_kg).replace('.', ',') : '');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(extra?: Partial<Cat>) {
    if (!f.nome.trim()) return setErro('Informe o nome.');
    setSalvando(true); setErro(null);
    try {
      await salvarCategoria({ ...f, nome: f.nome.trim(), peso_padrao_kg: peso ? Number(peso.replace(',', '.')) : null, ...extra });
      await aoFechar(true);
    } catch (e) {
      setErro((e as Error).message.includes('duplicate') ? 'Já existe uma categoria com esse nome.' : (e as Error).message);
      setSalvando(false);
    }
  }

  return (
    <div className="cartao" style={{ borderColor: 'var(--verde)' }}>
      <strong>{c.id ? c.nome : 'Nova categoria'}</strong>
      <label htmlFor="nome">Nome</label>
      <input id="nome" value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} placeholder="Ex.: Novilha 2A" />
      <div className="filtros" style={{ marginTop: 10 }}>
        <div><label htmlFor="peso">Peso de referência (kg)</label><input id="peso" inputMode="decimal" value={peso} onChange={e => setPeso(e.target.value)} /></div>
        <div><label htmlFor="ordem">Posição na lista</label><input id="ordem" inputMode="numeric" value={f.ordem}
          onChange={e => setF({ ...f, ordem: Number(e.target.value.replace(/\D/g, '')) || 0 })} /></div>
      </div>
      {c.id && <p className="suave" style={{ fontSize: '.85rem' }}>Mudar o nome muda em todos os relatórios, inclusive os antigos.</p>}
      {erro && <p className="erro">{erro}</p>}
      <button className="botao" disabled={salvando} onClick={() => salvar()}>{salvando ? 'Salvando…' : 'Salvar'}</button>
      {c.id && (
        <button className="botao sec" disabled={salvando} style={{ marginTop: 10 }} onClick={() => salvar({ ativa: !c.ativa })}>
          {c.ativa ? 'Desativar categoria' : 'Reativar categoria'}
        </button>
      )}
      {c.id && (
        <button className="excluir" disabled={salvando} style={{ marginTop: 8 }} onClick={async () => {
          if (!window.confirm(`Excluir a categoria ${c.nome}?`)) return;
          setSalvando(true); setErro(null);
          try {
            if (await excluirCategoria(c.id!)) return aoFechar(true);
            setErro('Essa categoria já tem lançamentos, contagens ou estoque, então não pode ser apagada sem perder o histórico. Use "Desativar categoria": ela some das listas para lançar, mas continua nos relatórios antigos.');
          } catch (e) { setErro((e as Error).message); }
          setSalvando(false);
        }}>Excluir categoria</button>
      )}
      <button className="excluir" style={{ color: 'var(--suave)', marginTop: 8 }} onClick={() => aoFechar(false)}>Cancelar</button>
    </div>
  );
}
