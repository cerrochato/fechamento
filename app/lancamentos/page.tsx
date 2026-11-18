'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import Moldura from '@/components/Moldura';
import { useApp } from '@/lib/contexto';
import { excluirMovimentacao, hoje, mesesAntes, movimentacoes, potreiros } from '@/lib/dados';
import { dataBR, int, reais } from '@/lib/formato';
import type { Movimentacao, Potreiro } from '@/lib/tipos';

export default function Lancamentos() {
  const { propriedade, cad } = useApp();
  const [de, setDe] = useState(mesesAntes(hoje(), 3));
  const [ate, setAte] = useState(hoje());
  const [filtro, setFiltro] = useState('');
  const [lista, setLista] = useState<Movimentacao[] | null>(null);
  const [pots, setPots] = useState<Potreiro[]>([]);
  const [confirmar, setConfirmar] = useState<number | null>(null);

  const carregar = () => { setLista(null); movimentacoes(propriedade.id, de, ate).then(setLista); };
  useEffect(carregar, [propriedade.id, de, ate]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { potreiros(propriedade.id).then(setPots); }, [propriedade.id]);

  const cat = (id: number) => cad.categorias.find(c => c.id === id);
  const oc = (c: string) => cad.ocorrencias.find(o => o.codigo === c);
  const visiveis = (lista ?? []).filter(m => !filtro || m.ocorrencia === filtro);

  async function excluir(id: number) {
    await excluirMovimentacao(id);
    setConfirmar(null);
    carregar();
  }

  return (
    <Moldura>
      <h1>Lançamentos</h1>
      <div className="filtros">
        <div><label htmlFor="de">De</label><input id="de" type="date" value={de} onChange={e => e.target.value && setDe(e.target.value)} /></div>
        <div><label htmlFor="ate">Até</label><input id="ate" type="date" value={ate} onChange={e => e.target.value && setAte(e.target.value)} /></div>
      </div>
      <label htmlFor="f">Tipo</label>
      <select id="f" value={filtro} onChange={e => setFiltro(e.target.value)}>
        <option value="">Todos</option>
        {cad.ocorrencias.map(o => <option key={o.codigo} value={o.codigo}>{o.nome}</option>)}
      </select>

      <p className="suave">{lista ? `${visiveis.length} lançamento(s)` : 'Carregando…'}</p>
      <div className="lista">
        {visiveis.map(m => {
          const o = oc(m.ocorrencia);
          const c = cat(m.categoria_id);
          const detalhes = [
            m.causa_morte_id && cad.causas.find(x => x.id === m.causa_morte_id)?.nome,
            m.potreiro_id && 'Potreiro ' + pots.find(p => p.id === m.potreiro_id)?.codigo,
            m.contraparte_id && cad.contrapartes.find(x => x.id === m.contraparte_id)?.nome,
            m.valor_total && reais(Number(m.valor_total)),
            m.observacao,
          ].filter(Boolean).join(' · ');
          return (
            <div key={m.id} className="cartao item">
              <div>
                <strong>{o?.nome}</strong> · {c?.nome}<br />
                <small>{dataBR(m.data)}{detalhes && ' · ' + detalhes}</small>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className={`q ${o?.sinal === 1 ? 'e' : 's'}`}>{o?.sinal === 1 ? '+' : '−'}{int(m.quantidade)}</div>
                {confirmar === m.id
                  ? <span><button className="excluir" onClick={() => excluir(m.id)}>Confirmar</button> · <button className="excluir" style={{ color: 'var(--suave)' }} onClick={() => setConfirmar(null)}>Não</button></span>
                  : <span>
                      <Link href={`/lancar?editar=${m.id}`} className="excluir" style={{ color: 'var(--verde)' }}>Editar</Link>
                      {' · '}
                      <button className="excluir" onClick={() => setConfirmar(m.id)}>Excluir</button>
                    </span>}
              </div>
            </div>
          );
        })}
      </div>
    </Moldura>
  );
}
