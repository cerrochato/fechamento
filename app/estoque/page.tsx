'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import Imprimir from '@/components/Imprimir';
import { useApp } from '@/lib/contexto';
import { estoqueNaData, hoje, mesesAntes, movimentacoes } from '@/lib/dados';
import { dataBR, int } from '@/lib/formato';
import type { LinhaEstoque, Movimentacao } from '@/lib/tipos';

export default function Estoque() {
  const { propriedade, propriedades, cad, sessao } = useApp();
  const { todas } = useApp();
  const [data, setData] = useState(hoje());
  const [estoque, setEstoque] = useState<LinhaEstoque[] | null>(null);
  const [ultimos, setUltimos] = useState<(Movimentacao & { _prop: string })[]>([]);

  useEffect(() => {
    setEstoque(null);
    const ps = todas ? propriedades : [propriedade];
    // com todas as propriedades, soma as cabeças de cada categoria
    Promise.all(ps.map(p => estoqueNaData(p.id, data))).then(rs => {
      const m = new Map<number, LinhaEstoque>();
      for (const l of rs.flat()) {
        const a = m.get(l.categoria_id);
        m.set(l.categoria_id, a ? { ...a, cabecas: Number(a.cabecas) + Number(l.cabecas) } : { ...l, cabecas: Number(l.cabecas) });
      }
      setEstoque([...m.values()]);
    });
    Promise.all(ps.map(p => movimentacoes(p.id, mesesAntes(data, 12), data).then(ms => ms.map(x => ({ ...x, _prop: p.nome })))))
      .then(rs => setUltimos(rs.flat().sort((a, b) => b.data.localeCompare(a.data) || b.id - a.id).slice(0, 5)));
  }, [propriedade, propriedades, todas, data]);

  const porEspecie = cad.especies.map(e => {
    const linhas = (estoque ?? []).filter(l => l.especie_id === e.id && l.cabecas !== 0);
    return { ...e, total: linhas.reduce((s, l) => s + l.cabecas, 0), linhas };
  });
  const cat = (id: number) => cad.categorias.find(c => c.id === id)?.nome ?? '?';
  const oc = (c: string) => cad.ocorrencias.find(o => o.codigo === c);

  return (
    <Moldura permiteTodas>
      <div className="titulo-rel"><h1>Olá, {sessao.nome.split(' ')[0]}</h1><Imprimir /></div>
      <p className="so-impressao" style={{ margin: '0 0 8px' }}>Estoque em {dataBR(data)}</p>
      <div className="filtros nao-imprime" style={{ marginBottom: 12 }}>
        <div>
          <label htmlFor="data">Estoque em</label>
          <input id="data" type="date" value={data} onChange={e => e.target.value && setData(e.target.value)} />
        </div>
        <Link href="/lancar" className="botao" style={{ marginTop: 0, textAlign: 'center' }}>＋ Novo lançamento</Link>
      </div>

      <div className="grade">
        {porEspecie.map(e => (
          <div key={e.id} className="cartao">
            <div className="rotulo">{e.nome}</div>
            <div className="numero">{estoque ? int(e.total) : '…'}</div>
            <div className="rotulo">cabeças</div>
          </div>
        ))}
      </div>

      {porEspecie.filter(e => e.linhas.length).map(e => (
        <details key={e.id} open className="cartao" style={{ marginTop: 10 }}>
          <summary><strong>{e.nome}</strong> <span className="suave">por categoria</span></summary>
          <table style={{ marginTop: 8 }}>
            <tbody>
              {e.linhas.map(l => (
                <tr key={l.categoria_id}><td>{l.categoria}</td><td className={l.cabecas < 0 ? 's' : ''}>{int(l.cabecas)}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}

      <h2>Últimos lançamentos</h2>
      <div className="lista">
        {ultimos.length === 0 && <p className="suave">Nenhum lançamento nos últimos 12 meses.</p>}
        {ultimos.map(m => {
          const o = oc(m.ocorrencia);
          return (
            <div key={m.id} className="cartao item">
              <div><strong>{o?.nome}</strong> · {cat(m.categoria_id)}<br /><small>{dataBR(m.data)}{todas ? ` · ${m._prop}` : ''}</small></div>
              <div className={`q ${o?.sinal === 1 ? 'e' : 's'}`}>{o?.sinal === 1 ? '+' : '−'}{int(m.quantidade)}</div>
            </div>
          );
        })}
      </div>
      {ultimos.length > 0 && <Link href="/lancamentos" className="botao sec">Ver todos</Link>}
    </Moldura>
  );
}
