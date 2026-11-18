'use client';
// Resumo financeiro do período, no modelo da aba "RESUMO FINANCEIRO" da planilha
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import Imprimir from '@/components/Imprimir';
import FiltroPeriodo, { inicioUltimos } from '@/components/FiltroPeriodo';
import { useApp } from '@/lib/contexto';
import { contasFinanceiras, efetivoPeriodo, hoje, lancamentosFinanceiros, valorKgRebanho, type ContaFin } from '@/lib/dados';
import { nomeConta, ordemCodigo, resumir, comeca, PRO_LABORE, type Resumo } from '@/lib/financeiro';
import { dataBR, dec, reais } from '@/lib/formato';

const pct = (v: number, t: number) => (t ? `${dec(v / t * 100, 1)}%` : '–');

export default function ResumoFinanceiro() {
  const { propriedade, propriedades, cad } = useApp();
  const [de, setDe] = useState(inicioUltimos(12));
  const [ate, setAte] = useState(hoje());
  const { todas } = useApp();
  const [dados, setDados] = useState<{ r: Resumo; contas: ContaFin[]; difInv: number; n: number } | null>(null);
  const ps = (todas ? propriedades : [propriedade]).filter(p => p.papel === 'adm');

  useEffect(() => {
    setDados(null);
    if (!ps.length) return;
    Promise.all([contasFinanceiras(), ...ps.map(async p => {
      const [ls, ef, precos] = await Promise.all([lancamentosFinanceiros(p.id, de, ate), efetivoPeriodo(p.id, de, ate), valorKgRebanho(p.id, ate)]);
      // diferença de inventário: (kg final − kg inicial) × R$/kg, com o peso de referência da categoria
      let difInv = 0;
      for (const l of ef) {
        const e = cad.especies.find(x => x.nome === l.especie);
        const c = cad.categorias.find(x => x.nome === l.categoria && x.especie_id === e?.id);
        if (!c) continue;
        difInv += (Number(l.estoque_final) - Number(l.estoque_inicial)) * Number(c.peso_padrao_kg ?? 0) * (precos.get(c.id) ?? 0);
      }
      return { ls, difInv };
    })]).then(([contas, ...rs]) => {
      const lista = rs as { ls: Awaited<ReturnType<typeof lancamentosFinanceiros>>; difInv: number }[];
      const ls = lista.flatMap(r => r.ls);
      setDados({ r: resumir(ls), contas: contas as ContaFin[], difInv: lista.reduce((s, r) => s + r.difInv, 0), n: ls.length });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propriedade, propriedades, todas, de, ate]);

  return (
    <Moldura permiteTodas>
      <Link href="/financeiro" className="suave nao-imprime">← Financeiro</Link>
      <div className="titulo-rel"><h1 style={{ marginTop: 8 }}>Resumo financeiro</h1><Imprimir de={de} ate={ate} /></div>
      <FiltroPeriodo de={de} ate={ate} setDe={setDe} setAte={setAte} />
      <p className="suave" style={{ fontSize: '.88rem' }}>{todas ? 'Todas as propriedades' : propriedade.nome} · {dataBR(de)} a {dataBR(ate)}</p>
      {!ps.length ? <p>O financeiro é visível só para o administrador.</p>
        : !dados ? <p className="suave">Calculando…</p>
        : !dados.n ? <p className="suave">Nenhum lançamento financeiro no período. <Link href="/financeiro/importar">Importar do SW Rural</Link></p>
        : <Corpo {...dados} />}
    </Moldura>
  );
}

function Corpo({ r, contas, difInv }: { r: Resumo; contas: ContaFin[]; difInv: number }) {
  const nome = (c: string) => c === PRO_LABORE ? 'Pró-labore (menos aporte)' : nomeConta(contas, c);
  const linhas = (m: Map<string, number>, filtro: (c: string) => boolean) =>
    [...m.entries()].filter(([c, v]) => filtro(c) && Math.abs(v) >= 0.05).sort((a, b) => ordemCodigo(a[0], b[0]));
  const recPec = linhas(r.receitas, c => comeca(c, '1.1')), recOut = linhas(r.receitas, c => !comeca(c, '1.1'));
  const desp = linhas(r.despesas, () => true);
  const top = [...desp].sort((a, b) => b[1] - a[1]).slice(0, 10);
  let acum = 0;

  return (
    <>
      <div className="dash-hero" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
        <Hero t="Receitas totais" v={reais(r.recTotal)} s={`pecuária ${reais(r.recPecuaria)}`} />
        <Hero t="Desembolso total" v={reais(r.desembolsoTotal)} s="desembolso + arrendamento + investimentos + pró-labore" />
        <Hero t="Resultado 4" v={reais(r.resultado4)} s="receitas pecuárias − desembolso total" />
        <Hero t="Resultado 4 com dif. inventário" v={reais(r.resultado4 + difInv)} s={`diferença de inventário ${reais(difInv)}`} />
      </div>

      <section className="cartao" style={{ marginTop: 14 }}>
        <h2 style={{ marginTop: 0 }}>Resultados</h2>
        <table className="cascata">
          <tbody>
            <tr><td>Receitas pecuárias</td><td>{reais(r.recPecuaria)}</td></tr>
            <tr><td>− Desembolso (despesas pecuárias)</td><td>{reais(r.desembolso)}</td></tr>
            <tr className="res"><td>Resultado 1</td><td>{reais(r.resultado1)}</td></tr>
            <tr><td>− Arrendamento</td><td>{reais(r.arrendamento)}</td></tr>
            <tr className="res"><td>Resultado 2</td><td>{reais(r.resultado2)}</td></tr>
            <tr><td>− Investimentos</td><td>{reais(r.investimentos)}</td></tr>
            <tr className="res"><td>Resultado 3</td><td>{reais(r.resultado3)}</td></tr>
            <tr><td>− Pró-labore (menos aporte)</td><td>{reais(r.proLabore)}</td></tr>
            <tr className="res"><td>Resultado 4</td><td>{reais(r.resultado4)}</td></tr>
            <tr><td>+ Diferença de inventário</td><td>{reais(difInv)}</td></tr>
            <tr className="res"><td>Resultado 4 com diferença de inventário</td><td>{reais(r.resultado4 + difInv)}</td></tr>
          </tbody>
        </table>
        <p className="suave" style={{ fontSize: '.82rem', marginBottom: 0 }}>
          Desembolso = total de despesas − investimentos − pró-labore − despesas do arroz − pagamento de empréstimos − arrendamento.
          Pró-labore = 2.5 Pró-labore − 1.6 Aporte ({reais(r.proLaboreBruto)} − {reais(r.aporte)}).
          Diferença de inventário = (kg final − kg inicial) × R$/kg de avaliação de cada categoria, como na Evolução do rebanho.
        </p>
      </section>

      <section style={{ marginTop: 14 }}>
        <h2>Receitas</h2>
        <div className="rolagem">
          <table>
            <thead><tr><th>Rubrica</th><th>R$</th><th>%</th></tr></thead>
            <tbody>
              <tr className="sub"><td>Receitas pecuárias</td><td>{reais(r.recPecuaria)}</td><td>{pct(r.recPecuaria, r.recTotal)}</td></tr>
              {recPec.map(([c, v]) => <tr key={c}><td>{c} · {nome(c)}</td><td>{reais(v)}</td><td>{pct(v, r.recTotal)}</td></tr>)}
              <tr className="sub"><td>Outras receitas</td><td>{reais(r.recOutras)}</td><td>{pct(r.recOutras, r.recTotal)}</td></tr>
              {recOut.map(([c, v]) => <tr key={c}><td>{c} · {nome(c)}</td><td>{reais(v)}</td><td>{pct(v, r.recTotal)}</td></tr>)}
              <tr className="sub"><td>Total de receitas</td><td>{reais(r.recTotal)}</td><td>100%</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 14 }}>
        <h2>Despesas</h2>
        <div className="rolagem">
          <table>
            <thead><tr><th>Rubrica</th><th>R$</th><th>%</th></tr></thead>
            <tbody>
              {desp.map(([c, v]) => <tr key={c}><td>{c} · {nome(c)}</td><td>{reais(v)}</td><td>{pct(v, r.despTotal)}</td></tr>)}
              <tr className="sub"><td>Total de despesas</td><td>{reais(r.despTotal)}</td><td>100%</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="cartao" style={{ marginTop: 14 }}>
        <h2 style={{ marginTop: 0 }}>Top 10 rubricas de despesa</h2>
        <div className="barras">
          {top.map(([c, v]) => {
            acum += v;
            return (
              <div key={c} className="barra" title={`${c} · ${nome(c)}: ${reais(v)} · ${pct(v, r.despTotal)} do total · ${pct(acum, r.despTotal)} acumulado`}>
                <span className="rot">{nome(c)}</span>
                <span className="trilho"><span style={{ width: `${v / top[0][1] * 100}%`, background: 'var(--dash-barra)' }} /></span>
                <span className="val">{reais(v)} · {pct(v, r.despTotal)}</span>
              </div>
            );
          })}
        </div>
        <p className="suave" style={{ fontSize: '.82rem', marginBottom: 0 }}>As 10 rubricas somam {pct(top.reduce((s, [, v]) => s + v, 0), r.despTotal)} das despesas.</p>
      </section>
    </>
  );
}

function Hero({ t, v, s }: { t: string; v: string; s: string }) {
  return <div className="hero"><small>{t}</small><strong style={{ fontSize: '1.3rem' }}>{v}</strong><small>{s}</small></div>;
}
