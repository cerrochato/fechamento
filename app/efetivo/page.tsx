'use client';
import { useEffect, useState } from 'react';
import Moldura from '@/components/Moldura';
import FiltroPeriodo, { inicioUltimos } from '@/components/FiltroPeriodo';
import Link from 'next/link';
import { useApp } from '@/lib/contexto';
import { efetivoPeriodo, hoje } from '@/lib/dados';
import { dataBR, int } from '@/lib/formato';

const sinal = (v: number) => (v > 0 ? '+' : '') + int(v);
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
  const [de, setDe] = useState(inicioUltimos(12));
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
      <h1 style={{ marginTop: 8 }}>Evolução do rebanho</h1>
      <FiltroPeriodo de={de} ate={ate} setDe={setDe} setAte={setAte} todas={todas} setTodas={setTodas} />

      <p className="suave" style={{ fontSize: '.88rem' }}>
        {todas ? 'Todas as propriedades' : propriedade.nome} · {dataBR(de)} a {dataBR(ate)}
      </p>
      {!linhas && <p className="suave">Calculando…</p>}
      {linhas && (() => {
        // kg = cabeças × peso de referência da categoria (cadastro de categorias)
        const peso = (l: LinhaEfetivo) => {
          const e = cad.especies.find(x => x.nome === l.especie);
          return Number(cad.categorias.find(c => c.nome === l.categoria && c.especie_id === e?.id)?.peso_padrao_kg ?? 0);
        };
        const kgIni = (l: LinhaEfetivo) => Number(l.estoque_inicial) * peso(l);
        const kgFim = (l: LinhaEfetivo) => Number(l.estoque_final) * peso(l);
        const vis = linhas.filter(l => COLS.some(c => Number(l[c.k]) !== 0));
        const tot = (f: (l: LinhaEfetivo) => number) => vis.reduce((s, l) => s + f(l), 0);
        const ci = tot(l => Number(l.estoque_inicial)), cf = tot(l => Number(l.estoque_final));
        const ki = tot(kgIni), kf = tot(kgFim);
        return <>
          {cad.especies.map(e => {
        const ls = vis.filter(l => l.especie === e.nome);
        if (!ls.length) return null;
        const soma = (k: keyof LinhaEfetivo) => ls.reduce((s, l) => s + Number(l[k]), 0);
        const somaF = (f: (l: LinhaEfetivo) => number) => ls.reduce((s, l) => s + f(l), 0);
        return (
          <section key={e.id}>
            <h2>{e.nome} <span className="suave" style={{ fontWeight: 400 }}>· {dataBR(de)} a {dataBR(ate)}</span></h2>
            <div className="rolagem">
              <table>
                <thead><tr><th>Categoria</th>{COLS.map(c => <th key={c.k}>{c.t}</th>)}<th>kg inicial</th><th>kg final</th><th>Variação kg</th></tr></thead>
                <tbody>
                  {ls.map(l => (
                    <tr key={l.categoria}>
                      <td>{l.categoria}</td>
                      {COLS.map(c => {
                        const v = Number(l[c.k]);
                        return <td key={c.k} className={v && c.s === 1 ? 'e' : v && c.s === -1 ? 's' : ''}>{v ? int(v) : '·'}</td>;
                      })}
                      <td>{int(kgIni(l))}</td><td>{int(kgFim(l))}</td><td>{sinal(kgFim(l) - kgIni(l))}</td>
                    </tr>
                  ))}
                  <tr className="total"><td>Total</td>{COLS.map(c => <td key={c.k}>{int(soma(c.k))}</td>)}
                    <td>{int(somaF(kgIni))}</td><td>{int(somaF(kgFim))}</td><td>{sinal(somaF(kgFim) - somaF(kgIni))}</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        );
          })}
          {vis.length > 0 && (
            <section className="cartao">
              <h2 style={{ marginTop: 0 }}>Resumo do período</h2>
              <div className="rolagem">
                <table>
                  <thead><tr><th></th><th>Início</th><th>Final</th><th>Variação</th></tr></thead>
                  <tbody>
                    <tr><td>Cabeças</td><td>{int(ci)}</td><td>{int(cf)}</td><td>{sinal(cf - ci)}</td></tr>
                    <tr className="total"><td>kg totais</td><td>{int(ki)}</td><td>{int(kf)}</td><td>{sinal(kf - ki)}</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="suave" style={{ fontSize: '.82rem', marginBottom: 0 }}>
                Os kg usam o peso de referência de cada categoria (Cadastros › Categorias). Variação de kg mostra o estoque, não a produção, que entra nos indicadores.
              </p>
            </section>
          )}
        </>;
      })()}
    </Moldura>
  );
}
