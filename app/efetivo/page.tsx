'use client';
import { useEffect, useState } from 'react';
import Moldura from '@/components/Moldura';
import { useApp } from '@/lib/contexto';
import { efetivoPeriodo, hoje, mesesAntes } from '@/lib/dados';
import { dataBR, int } from '@/lib/formato';
import type { LinhaEfetivo } from '@/lib/tipos';

const COLS: { k: keyof LinhaEfetivo; t: string; s: 0 | 1 | -1 }[] = [
  { k: 'estoque_inicial', t: 'Inicial', s: 0 },
  { k: 'aquisicao', t: 'Compra', s: 1 },
  { k: 'venda_int_entrada', t: 'V. int. ent.', s: 1 },
  { k: 'nascimento', t: 'Nasc.', s: 1 },
  { k: 'tcat_entrada', t: 'T. cat. ent.', s: 1 },
  { k: 'venda', t: 'Venda', s: -1 },
  { k: 'venda_int_saida', t: 'V. int. saída', s: -1 },
  { k: 'morte', t: 'Morte', s: -1 },
  { k: 'consumo', t: 'Consumo', s: -1 },
  { k: 'tcat_saida', t: 'T. cat. saída', s: -1 },
  { k: 'estoque_final', t: 'Final', s: 0 },
];

export default function Efetivo() {
  const { propriedade, cad } = useApp();
  const [de, setDe] = useState(mesesAntes(hoje(), 12));
  const [ate, setAte] = useState(hoje());
  const [linhas, setLinhas] = useState<LinhaEfetivo[] | null>(null);

  useEffect(() => { setLinhas(null); efetivoPeriodo(propriedade.id, de, ate).then(setLinhas); }, [propriedade.id, de, ate]);

  const atalho = (d: string, a: string) => { setDe(d); setAte(a); };
  const ano = Number(hoje().slice(0, 4));
  // primeiro e último dia do mês, n meses atrás
  const mesConta = (n: number) => {
    const [a, m] = hoje().split('-').map(Number);
    const ini = new Date(Date.UTC(a, m - 1 - n, 1)), fim = new Date(Date.UTC(a, m - n, 0));
    return { de: ini.toISOString().slice(0, 10), ate: fim.toISOString().slice(0, 10) };
  };

  return (
    <Moldura>
      <h1>Efetivo do período</h1>
      <div className="filtros">
        <div><label htmlFor="de">De</label><input id="de" type="date" value={de} onChange={e => e.target.value && setDe(e.target.value)} /></div>
        <div><label htmlFor="ate">Até</label><input id="ate" type="date" value={ate} onChange={e => e.target.value && setAte(e.target.value)} /></div>
      </div>
      <div className="chips" style={{ marginTop: 10 }}>
        <button className="chip" onClick={() => atalho(mesConta(1).de, mesConta(1).ate)}>Mês passado</button>
        <button className="chip" onClick={() => atalho(mesesAntes(hoje(), 3), hoje())}>Últimos 3 meses</button>
        <button className="chip" onClick={() => atalho(mesesAntes(hoje(), 12), hoje())}>Últimos 12 meses</button>
        <button className="chip" onClick={() => atalho(`${ano}-01-01`, hoje())}>Este ano</button>
        <button className="chip" onClick={() => atalho(`${ano - 1}-01-01`, `${ano - 1}-12-31`)}>Ano {ano - 1}</button>
      </div>

      {!linhas && <p className="suave">Calculando…</p>}
      {linhas && cad.especies.map(e => {
        const ls = linhas.filter(l => l.especie === e.nome && COLS.some(c => Number(l[c.k]) !== 0));
        if (!ls.length) return null;
        const soma = (k: keyof LinhaEfetivo) => ls.reduce((s, l) => s + Number(l[k]), 0);
        return (
          <section key={e.id}>
            <h2>{e.nome} <span className="suave" style={{ fontWeight: 400 }}>· {dataBR(de)} a {dataBR(ate)}</span></h2>
            <div className="rolagem">
              <table>
                <thead><tr><th>Categoria</th>{COLS.map(c => <th key={c.k}>{c.t}</th>)}</tr></thead>
                <tbody>
                  {ls.map(l => (
                    <tr key={l.categoria}>
                      <td>{l.categoria}</td>
                      {COLS.map(c => {
                        const v = Number(l[c.k]);
                        return <td key={c.k} className={v && c.s === 1 ? 'e' : v && c.s === -1 ? 's' : ''}>{v ? int(v) : '·'}</td>;
                      })}
                    </tr>
                  ))}
                  <tr className="total"><td>Total</td>{COLS.map(c => <td key={c.k}>{int(soma(c.k))}</td>)}</tr>
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </Moldura>
  );
}
