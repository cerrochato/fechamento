'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Moldura from '@/components/Moldura';
import Imprimir from '@/components/Imprimir';
import { useApp } from '@/lib/contexto';
import { confirmarTransferencia, excluirMovimentacao, hoje, mesesAntes, movimentacoes, nomesPropriedades, potreiros, transferenciasAConfirmar } from '@/lib/dados';
import { dataBR, int, reais } from '@/lib/formato';
import type { Movimentacao, Potreiro } from '@/lib/tipos';

export default function Lancamentos() {
  const { propriedade, propriedades, cad } = useApp();
  const { todas } = useApp();
  const [de, setDe] = useState(mesesAntes(hoje(), 3));
  const [ate, setAte] = useState(hoje());
  const [filtro, setFiltro] = useState('');
  const [lista, setLista] = useState<(Movimentacao & { _prop: string; _propId: number })[] | null>(null);
  const [pots, setPots] = useState<Potreiro[]>([]);
  const [confirmar, setConfirmar] = useState<number | null>(null);
  // transferências que a outra propriedade criou aqui e o gerente precisa confirmar
  const gerente = propriedade.papel !== 'capataz';
  const [pendentes, setPendentes] = useState<Movimentacao[]>([]);
  const [potEscolhido, setPotEscolhido] = useState<Record<number, string>>({});
  const [nomes, setNomes] = useState<{ id: number; nome: string }[]>([]);
  useEffect(() => { nomesPropriedades().then(setNomes).catch(() => setNomes(propriedades)); }, [propriedades]);
  const nomeProp = (id?: number | null) => nomes.find(p => p.id === id)?.nome ?? propriedades.find(p => p.id === id)?.nome ?? 'outra propriedade';

  const carregar = () => {
    setLista(null);
    if (gerente) transferenciasAConfirmar(propriedade.id).then(setPendentes); else setPendentes([]);
    const ps = todas ? propriedades : [propriedade];
    Promise.all(ps.map(p => movimentacoes(p.id, de, ate).then(ms => ms.map(m => ({ ...m, _prop: p.nome, _propId: p.id })))))
      .then(rs => setLista(rs.flat().sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id)));
  };
  useEffect(carregar, [propriedade, propriedades, todas, de, ate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { Promise.all(propriedades.map(p => potreiros(p.id))).then(r => setPots(r.flat())); }, [propriedades]);

  const cat = (id: number) => cad.categorias.find(c => c.id === id);
  const oc = (c: string) => cad.ocorrencias.find(o => o.codigo === c);
  const visiveis = (lista ?? []).filter(m => !filtro || m.ocorrencia === filtro);

  async function confirmarRecebida(m: Movimentacao) {
    const pot = potEscolhido[m.id];
    await confirmarTransferencia(m.id, pot ? Number(pot) : null);
    carregar();
  }

  async function excluir(id: number) {
    await excluirMovimentacao(id);
    setConfirmar(null);
    carregar();
  }

  return (
    <Moldura permiteTodas>
      <div className="titulo-rel"><h1>Lançamentos</h1><Imprimir de={de} ate={ate} /></div>
      <div className="filtros nao-imprime">
        <div><label htmlFor="de">De</label><input id="de" type="date" value={de} onChange={e => e.target.value && setDe(e.target.value)} /></div>
        <div><label htmlFor="ate">Até</label><input id="ate" type="date" value={ate} onChange={e => e.target.value && setAte(e.target.value)} /></div>
      </div>
      <label htmlFor="f" className="nao-imprime">Tipo</label>
      <select id="f" value={filtro} onChange={e => setFiltro(e.target.value)}>
        <option value="">Todos</option>
        {cad.ocorrencias.map(o => <option key={o.codigo} value={o.codigo}>{o.nome}</option>)}
      </select>

      {gerente && pendentes.length > 0 && (
        <div className="cartao nao-imprime" style={{ borderColor: 'var(--verde)', marginBottom: 14 }}>
          <strong>Transferências a confirmar em {propriedade.nome}</strong>
          <p className="suave" style={{ fontSize: '.85rem', margin: '4px 0 8px' }}>
            Criadas sozinhas quando a outra propriedade lançou a venda interna. Confira e escolha o potreiro.
          </p>
          {pendentes.map(m => {
            const entrada = m.ocorrencia === 'VENDA_INT_ENTRADA';
            return (
              <div key={m.id} style={{ borderTop: '1px solid var(--borda)', padding: '10px 0' }}>
                <div><strong>{entrada ? '+' : '−'}{int(m.quantidade)} {cat(m.categoria_id)?.nome}</strong> · {dataBR(m.data)} · {entrada ? 'vindos de' : 'indo para'} {nomeProp(m.propriedade_par_id)}</div>
                <label htmlFor={`pc${m.id}`}>{entrada ? 'Para qual potreiro vão' : 'De qual potreiro saem (opcional)'}</label>
                <select id={`pc${m.id}`} value={potEscolhido[m.id] ?? ''} onChange={e => setPotEscolhido({ ...potEscolhido, [m.id]: e.target.value })}>
                  <option value="">—</option>
                  {pots.filter(p => p.propriedade_id === propriedade.id).map(p => <option key={p.id} value={p.id}>{p.codigo}</option>)}
                </select>
                <button className="botao" style={{ marginTop: 8 }} disabled={entrada && !potEscolhido[m.id]} onClick={() => confirmarRecebida(m)}>Confirmar</button>
              </div>
            );
          })}
        </div>
      )}

      <p className="suave">{lista ? `${visiveis.length} lançamento(s)` : 'Carregando…'}</p>
      <div className="lista">
        {visiveis.map(m => {
          const o = oc(m.ocorrencia);
          const c = cat(m.categoria_id);
          const detalhes = [
            m.causa_morte_id && cad.causas.find(x => x.id === m.causa_morte_id)?.nome,
            m.potreiro_id && 'Potreiro ' + pots.find(p => p.id === m.potreiro_id)?.codigo,
            m.contraparte_id && cad.contrapartes.find(x => x.id === m.contraparte_id)?.nome,
            m.propriedade_par_id && (m.ocorrencia === 'VENDA_INT_ENTRADA' ? 'de ' : 'para ') + nomeProp(m.propriedade_par_id),
            m.confirmar && 'a confirmar',
            m.valor_total && reais(Number(m.valor_total)),
            m.observacao,
          ].filter(Boolean).join(' · ');
          return (
            <div key={m.id} className="cartao item">
              <div>
                <strong>{o?.nome}</strong> · {c?.nome}<br />
                <small>{dataBR(m.data)}{todas ? ` · ${m._prop}` : ''}{detalhes && ' · ' + detalhes}</small>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className={`q ${o?.sinal === 1 ? 'e' : 's'}`}>{o?.sinal === 1 ? '+' : '−'}{int(m.quantidade)}</div>
                <span className="nao-imprime">{m._propId !== propriedade.id ? <small className="suave">troque a propriedade no topo para editar</small>
                : confirmar === m.id
                  ? <span><button className="excluir" onClick={() => excluir(m.id)}>Confirmar</button> · <button className="excluir" style={{ color: 'var(--suave)' }} onClick={() => setConfirmar(null)}>Não</button></span>
                  : <span>
                      <Link href={`/lancar?editar=${m.id}`} className="excluir" style={{ color: 'var(--verde)' }}>Editar</Link>
                      {' · '}
                      <button className="excluir" onClick={() => setConfirmar(m.id)}>Excluir</button>
                    </span>}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Moldura>
  );
}
