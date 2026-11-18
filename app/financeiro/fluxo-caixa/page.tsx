'use client';
// Fluxo de caixa mês a mês, no modelo da aba "DETALHADO FINANCEIRO" da planilha
import { Fragment, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import FiltroPeriodo, { inicioUltimos } from '@/components/FiltroPeriodo';
import { useApp } from '@/lib/contexto';
import { contasFinanceiras, hoje, lancamentosFinanceiros, mesesDoPeriodo, type ContaFin, type LancFin } from '@/lib/dados';
import { nomeConta, ordemCodigo, INVESTIMENTOS } from '@/lib/financeiro';
import { dataBR, int } from '@/lib/formato';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const nomeMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
const v0 = (n: number) => (Math.abs(n) < 0.5 ? '–' : int(n));

export default function FluxoCaixa() {
  const { propriedade, propriedades } = useApp();
  const [de, setDe] = useState(inicioUltimos(12));
  const [ate, setAte] = useState(hoje());
  const [todas, setTodas] = useState(false);
  const [dados, setDados] = useState<{ ls: LancFin[]; contas: ContaFin[] } | null>(null);
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const ps = (todas ? propriedades : [propriedade]).filter(p => p.papel !== 'capataz');

  useEffect(() => {
    setDados(null);
    if (!ps.length) return;
    Promise.all([contasFinanceiras(), Promise.all(ps.map(p => lancamentosFinanceiros(p.id, de, ate)))])
      .then(([contas, rs]) => setDados({ contas, ls: rs.flat() }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propriedade, propriedades, todas, de, ate]);

  const meses = mesesDoPeriodo(de, ate).map(m => m.mes.slice(0, 7));
  return (
    <Moldura largo>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Link href="/financeiro" className="suave">← Financeiro</Link>
        <h1 style={{ marginTop: 8 }}>Fluxo de caixa</h1>
        <div style={{ maxWidth: 728 }}><FiltroPeriodo de={de} ate={ate} setDe={setDe} setAte={setAte} todas={todas} setTodas={setTodas} /></div>
        <p className="suave" style={{ fontSize: '.88rem' }}>{todas ? 'Todas as propriedades' : propriedade.nome} · {dataBR(de)} a {dataBR(ate)} · valores em R$</p>
        {!ps.length ? <p>O financeiro é visível só para gerente e administrador.</p>
          : !dados ? <p className="suave">Calculando…</p>
          : !dados.ls.length ? <p className="suave">Nenhum lançamento financeiro no período. <Link href="/financeiro/importar">Importar do SW Rural</Link></p>
          : <Tabela ls={dados.ls} contas={dados.contas} meses={meses} abertas={abertas}
              alternar={c => setAbertas(a => { const n = new Set(a); if (n.has(c)) n.delete(c); else n.add(c); return n; })} />}
      </div>
    </Moldura>
  );
}

function Tabela({ ls, contas, meses, abertas, alternar }: { ls: LancFin[]; contas: ContaFin[]; meses: string[]; abertas: Set<string>; alternar: (c: string) => void }) {
  // soma por conta (em todos os níveis) e mês
  const por = new Map<string, number[]>();
  for (const l of ls) {
    const i = meses.indexOf(l.data.slice(0, 7));
    if (i < 0) continue;
    const partes = l.conta_codigo.split('.');
    for (let n = 1; n <= Math.min(4, partes.length); n++) {
      const c = partes.slice(0, n).join('.');
      if (!por.has(c)) por.set(c, meses.map(() => 0));
      por.get(c)![i] += l.valor;
    }
  }
  const serie = (c: string) => por.get(c) ?? meses.map(() => 0);
  const rec = serie('1'), despTot = serie('2'), inv = serie(INVESTIMENTOS);
  const despOp = despTot.map((v, i) => v - inv[i]);
  const res = rec.map((v, i) => v - despTot[i]);
  const acum: number[] = []; res.reduce((s, v, i) => (acum[i] = s + v), 0);
  const soma = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const filhos = (c: string) => [...por.keys()].filter(k => k.startsWith(c + '.') && k.split('.').length === c.split('.').length + 1 && soma(por.get(k)!.map(Math.abs)) >= 0.5).sort(ordemCodigo);

  const Linha = ({ rotulo, vs, cls, total = true }: { rotulo: ReactNode; vs: number[]; cls?: string; total?: boolean }) => (
    <tr className={cls}>
      <td>{rotulo}</td>
      {vs.map((v, i) => <td key={i} className={v < -0.5 ? 'neg' : undefined}>{v0(v)}</td>)}
      <td className={soma(vs) < -0.5 ? 'neg' : undefined}><strong>{total ? v0(soma(vs)) : v0(vs[vs.length - 1])}</strong></td>
    </tr>
  );
  const Conta = ({ c }: { c: string }): ReactElement => {
    const n = c.split('.').length, fs = n < 4 ? filhos(c) : [], aberta = abertas.has(c);
    return (
      <Fragment>
        <tr className={`n${n}${fs.length ? ' abre' : ''}`} onClick={fs.length ? () => alternar(c) : undefined}>
          <td title={fs.length ? 'Toque para abrir/fechar' : undefined}>{fs.length ? (aberta ? '▾ ' : '▸ ') : ''}{c} · {nomeConta(contas, c)}</td>
          {serie(c).map((v, i) => <td key={i}>{v0(v)}</td>)}
          <td><strong>{v0(soma(serie(c)))}</strong></td>
        </tr>
        {aberta && fs.map(f => <Conta key={f} c={f} />)}
      </Fragment>
    );
  };

  return (
    <>
      <section className="cartao" style={{ marginTop: 6 }}>
        <h2 style={{ marginTop: 0 }}>Resumo do fluxo de caixa</h2>
        <div className="rolagem">
          <table>
            <thead><tr><th></th>{meses.map(m => <th key={m}>{nomeMes(m)}</th>)}<th>Total</th></tr></thead>
            <tbody>
              <Linha rotulo="Receitas" vs={rec} />
              <Linha rotulo="Despesas operacionais" vs={despOp} />
              <Linha rotulo="Investimentos" vs={inv} />
              <Linha rotulo="Total de despesas" vs={despTot} cls="sub" />
              <Linha rotulo="Resultado do mês" vs={res} cls="sub" />
              <Linha rotulo="Resultado acumulado" vs={acum} total={false} />
              <Linha rotulo="Resultado operacional (sem investimentos)" vs={rec.map((v, i) => v - despOp[i])} />
            </tbody>
          </table>
        </div>
        <Grafico meses={meses} rec={rec} desp={despTot} acum={acum} />
      </section>

      <section style={{ marginTop: 14 }}>
        <h2>Detalhado por conta</h2>
        <p className="suave" style={{ fontSize: '.85rem', marginTop: -4 }}>Toque numa conta para abrir as contas de baixo.</p>
        <div className="rolagem">
          <table>
            <thead><tr><th>Conta</th>{meses.map(m => <th key={m}>{nomeMes(m)}</th>)}<th>Total</th></tr></thead>
            <tbody>
              <Linha rotulo="Receitas" vs={rec} cls="sub" />
              {filhos('1').map(c => <Conta key={c} c={c} />)}
              <Linha rotulo="Despesas" vs={despTot} cls="sub" />
              {filhos('2').map(c => <Conta key={c} c={c} />)}
            </tbody>
          </table>
        </div>
        <p className="suave" style={{ fontSize: '.82rem' }}>No fluxo de caixa o pró-labore aparece cheio e o aporte entra como receita, como na aba DETALHADO FINANCEIRO. No Resumo financeiro o pró-labore aparece já descontado do aporte.</p>
      </section>
    </>
  );
}

// Receitas e despesas lado a lado por mês, com o saldo acumulado em números embaixo
function Grafico({ meses, rec, desp, acum }: { meses: string[]; rec: number[]; desp: number[]; acum: number[] }) {
  const max = Math.max(1, ...rec, ...desp);
  return (
    <div style={{ marginTop: 14 }}>
      <div className="legenda">
        <span><span className="pino" style={{ background: 'var(--entrada)' }} />Receitas</span>
        <span><span className="pino" style={{ background: 'var(--saida)' }} />Despesas</span>
      </div>
      <div className="dash-rolagem">
        <div className="fluxo-cols" style={{ minWidth: meses.length * 56 }}>
          {meses.map((m, i) => (
            <div key={m} className="fluxo-col" title={`${nomeMes(m)}\nReceitas: R$ ${int(rec[i])}\nDespesas: R$ ${int(desp[i])}\nAcumulado: R$ ${int(acum[i])}`}>
              <div className="fluxo-par">
                <div style={{ height: `${rec[i] / max * 100}%`, background: 'var(--entrada)' }} />
                <div style={{ height: `${desp[i] / max * 100}%`, background: 'var(--saida)' }} />
              </div>
              <small>{nomeMes(m)}</small>
              <small className={acum[i] < 0 ? 'neg' : undefined}>{int(acum[i] / 1000)} mil</small>
            </div>
          ))}
        </div>
      </div>
      <p className="suave" style={{ fontSize: '.8rem', marginBottom: 0 }}>Embaixo de cada mês: resultado acumulado até ali, em R$ mil.</p>
    </div>
  );
}
