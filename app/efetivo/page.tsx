'use client';
import { useEffect, useState } from 'react';
import Moldura from '@/components/Moldura';
import FiltroPeriodo from '@/components/FiltroPeriodo';
import Link from 'next/link';
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
  const { propriedade, propriedades, cad } = useApp();
  const [todas, setTodas] = useState(false);   // soma de todas as propriedades que o usuário vê
  const [de, setDe] = useState(mesesAntes(hoje(), 12));
  const [ate, setAte] = useState(hoje());
  const [linhas, setLinhas] = useState<LinhaEfetivo[] | null>(null);

  useEffect(() => {
    setLinhas(null);
    if (!todas) { efetivoPeriodo(propriedade.id, de, ate).then(setLinhas); return; }
    Promise.all(propriedades.map(p => efetivoPeriodo(p.id, de, ate))).then(listas => {
      const soma = new Map<string, LinhaEfetivo>();
      for (const l of listas.flat()) {
        const k = l.especie + '|' + l.categoria, a = soma.get(k);
        if (!a) { soma.set(k, { ...l }); continue; }
        for (const c of Object.keys(l) as (keyof LinhaEfetivo)[])
          if (c !== 'categoria' && c !== 'especie') (a as unknown as Record<string, number>)[c] = Number(a[c]) + Number(l[c]);
      }
      setLinhas([...soma.values()]);
    });
  }, [propriedade.id, propriedades, todas, de, ate]);

  return (
    <Moldura>
      <Link href="/relatorios" className="suave">← Relatórios</Link>
      <h1 style={{ marginTop: 8 }}>Efetivo do período</h1>
      <FiltroPeriodo de={de} ate={ate} setDe={setDe} setAte={setAte} todas={todas} setTodas={setTodas} />

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
