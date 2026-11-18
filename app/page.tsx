'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import { useApp } from '@/lib/contexto';
import { estoqueNaData, hoje, mesesAntes, movimentacoes } from '@/lib/dados';
import { dataBR, int } from '@/lib/formato';
import type { LinhaEstoque, Movimentacao } from '@/lib/tipos';

export default function Inicio() {
  const { propriedade, cad, sessao } = useApp();
  const [data, setData] = useState(hoje());
  const [estoque, setEstoque] = useState<LinhaEstoque[] | null>(null);
  const [ultimos, setUltimos] = useState<Movimentacao[]>([]);

  useEffect(() => {
    setEstoque(null);
    estoqueNaData(propriedade.id, data).then(setEstoque);
    movimentacoes(propriedade.id, mesesAntes(data, 12), data).then(m => setUltimos(m.slice(0, 5)));
  }, [propriedade.id, data]);

  const porEspecie = cad.especies.map(e => {
    const linhas = (estoque ?? []).filter(l => l.especie_id === e.id && l.cabecas !== 0);
    return { ...e, total: linhas.reduce((s, l) => s + l.cabecas, 0), linhas };
  });
  const cat = (id: number) => cad.categorias.find(c => c.id === id)?.nome ?? '?';
  const oc = (c: string) => cad.ocorrencias.find(o => o.codigo === c);

  return (
    <Moldura>
      <h1>Olá, {sessao.nome.split(' ')[0]}</h1>
      <div className="filtros" style={{ marginBottom: 12 }}>
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
        <details key={e.id} className="cartao" style={{ marginTop: 10 }}>
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
              <div><strong>{o?.nome}</strong> · {cat(m.categoria_id)}<br /><small>{dataBR(m.data)}</small></div>
              <div className={`q ${o?.sinal === 1 ? 'e' : 's'}`}>{o?.sinal === 1 ? '+' : '−'}{int(m.quantidade)}</div>
            </div>
          );
        })}
      </div>
      {ultimos.length > 0 && <Link href="/lancamentos" className="botao sec">Ver todos</Link>}
    </Moldura>
  );
}
