'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import FiltroPeriodo, { inicioUltimos } from '@/components/FiltroPeriodo';
import { useApp } from '@/lib/contexto';
import { areaPecuaria, estoquesMensais, hoje, mesesDoPeriodo, pesosDoMes, usoDasAreas, type UsoPotreiro } from '@/lib/dados';
import { dataBR, dec, int } from '@/lib/formato';

const UA = 450;
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const nomeMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
// Cor fixa por uso (a cor segue o uso, não a posição). Usos novos pegam a próxima cor.
const ORDEM_USOS = ['CAMPO NATIVO', 'CAMPO NATIVO MELHORADO', 'PASTAGEM CULTIVADA', 'ARROZ', 'TAIPA'];
const nomeUso = (u: string) => u.charAt(0) + u.slice(1).toLowerCase();

interface Mes { mes: string; porUso: Map<string, number>; areaPec: number; areaUtilPec: number; kg: number; cab: number }
interface Dados { usos: string[]; meses: Mes[]; potreiros: UsoPotreiro[]; areaTotal: number }

async function carregar(prop: number, de: string, ate: string) {
  const [usos, est, areas, pesos] = await Promise.all([usoDasAreas(prop, de, ate), estoquesMensais(prop, de, ate), areaPecuaria(prop, de, ate), pesosDoMes(prop, de, ate)]);
  return { usos, est, areas, pesos };
}

export default function Areas() {
  const { propriedade, propriedades } = useApp();
  const [de, setDe] = useState(inicioUltimos(12));
  const [ate, setAte] = useState(hoje());
  const [todas, setTodas] = useState(false);
  const [dados, setDados] = useState<Dados | null>(null);

  useEffect(() => {
    setDados(null);
    Promise.all((todas ? propriedades : [propriedade]).map(p => carregar(p.id, de, ate))).then(rs => {
      const todosUsos = rs.flatMap(r => r.usos);
      const nomes = [...new Set(todosUsos.map(u => u.uso))]
        .sort((a, b) => (ORDEM_USOS.indexOf(a) + 1 || 99) - (ORDEM_USOS.indexOf(b) + 1 || 99) || a.localeCompare(b));
      const meses: Mes[] = mesesDoPeriodo(de, ate).map((m, i) => {
        const porUso = new Map<string, number>();
        for (const u of todosUsos.filter(x => x.mes === m.mes)) porUso.set(u.uso, (porUso.get(u.uso) ?? 0) + u.total);
        let kg = 0, cab = 0, areaPec = 0, areaUtilPec = 0;
        for (const r of rs) {
          const e = r.est[i];
          cab += e.linhas.reduce((s, l) => s + Number(l.cabecas), 0);
          kg += e.linhas.reduce((s, l) => s + Number(l.cabecas) * (r.pesos.get(m.mes)?.get(l.categoria_id) ?? Number(l.peso_padrao_kg ?? 0)), 0);
          areaPec += r.areas[i].total; areaUtilPec += r.areas[i].util;
        }
        return { mes: m.mes, porUso, areaPec, areaUtilPec, kg, cab };
      });
      const ultimo = meses[meses.length - 1]?.mes;
      const areaTotal = Math.max(0, ...meses.map(m => [...m.porUso.values()].reduce((a, b) => a + b, 0)));
      setDados({ usos: nomes, meses, potreiros: todosUsos.filter(u => u.mes <= (ultimo ?? ate)), areaTotal });
    });
  }, [propriedade, propriedades, todas, de, ate]);

  return (
    <Moldura>
      <style>{CSS}</style>
      <Link href="/relatorios" className="suave">← Relatórios</Link>
      <h1 style={{ marginTop: 8 }}>Áreas</h1>
      <FiltroPeriodo de={de} ate={ate} setDe={setDe} setAte={setAte} todas={todas} setTodas={setTodas} />
      <p className="suave" style={{ fontSize: '.88rem' }}>{todas ? 'Todas as propriedades' : propriedade.nome} · {dataBR(de)} a {dataBR(ate)}</p>
      {!dados && <p className="suave">Calculando…</p>}
      {dados && <Painel d={dados} />}
    </Moldura>
  );
}

function Painel({ d }: { d: Dados }) {
  const cor = (u: string) => `var(--uso-${Math.min(d.usos.indexOf(u), 7) + 1})`;
  const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
  const comUso = d.meses.filter(m => m.porUso.size);
  const mediaUso = new Map(d.usos.map(u => [u, media(comUso.map(m => m.porUso.get(u) ?? 0))]));
  const somaMedia = [...mediaUso.values()].reduce((a, b) => a + b, 0);
  const areaPec = media(d.meses.map(m => m.areaPec));
  const pastagem = mediaUso.get('PASTAGEM CULTIVADA') ?? 0;
  const lot = d.meses.map(m => (m.areaUtilPec ? m.kg / UA / m.areaUtilPec : 0));
  const lotMedia = media(lot), kgHa = media(d.meses.map(m => (m.areaUtilPec ? m.kg / m.areaUtilPec : 0)));
  const maxMes = Math.max(1, ...d.meses.map(m => [...m.porUso.values()].reduce((a, b) => a + b, 0)));
  const maxLot = Math.max(0.01, ...lot);

  // potreiros: uso no último mês e mudanças no período
  const porPot = new Map<number, UsoPotreiro[]>();
  for (const u of d.potreiros) porPot.set(u.potreiro_id, [...(porPot.get(u.potreiro_id) ?? []), u]);
  const pots = [...porPot.values()].map(us => {
    us.sort((a, b) => a.mes.localeCompare(b.mes));
    const mud: string[] = [];
    for (let i = 1; i < us.length; i++) if (us[i].uso !== us[i - 1].uso) mud.push(`${nomeUso(us[i].uso)} em ${nomeMes(us[i].mes)}`);
    return { p: us[us.length - 1], mud };
  }).sort((a, b) => Number(b.mud.length > 0) - Number(a.mud.length > 0) || a.p.codigo.localeCompare(b.p.codigo, 'pt-BR', { numeric: true }));

  if (!d.usos.length) return <p className="suave">Sem uso das áreas informado no período.</p>;
  return (
    <>
      <div className="tiles">
        <Tile t="Área total" v={`${int(d.areaTotal)} ha`} s="soma dos potreiros com uso informado" />
        <Tile t="Área de pecuária" v={`${int(areaPec)} ha`} s={`${dec(areaPec / (d.areaTotal || 1) * 100, 1)}% da área total, média do período`} />
        <Tile t="Pastagem cultivada" v={`${int(pastagem)} ha`} s={`${dec(pastagem / (areaPec || 1) * 100, 1)}% da área de pecuária`} />
        <Tile t="Lotação média" v={`${dec(lotMedia)} UA/ha`} s={`${int(kgHa)} kg PV/ha na área útil de pecuária`} />
      </div>

      <section className="cartao" style={{ marginTop: 14 }}>
        <h2 style={{ marginTop: 0 }}>Uso da área</h2>
        <p className="suave" style={{ fontSize: '.85rem', marginTop: -6 }}>Média do período, em ha de área total</p>
        <div className="barra100" role="img" aria-label="Composição do uso da área">
          {d.usos.map(u => {
            const v = mediaUso.get(u)!;
            return v > 0 && <div key={u} style={{ flex: v, background: cor(u) }} title={`${nomeUso(u)}: ${int(v)} ha (${dec(v / somaMedia * 100, 1)}%)`} />;
          })}
        </div>
        <table style={{ marginTop: 10 }}>
          <thead><tr><th>Uso</th><th>ha</th><th>%</th><th>Pecuária?</th></tr></thead>
          <tbody>
            {d.usos.map(u => {
              const v = mediaUso.get(u)!;
              const pec = d.potreiros.find(x => x.uso === u)?.pecuaria;
              return <tr key={u}><td><span className="pino" style={{ background: cor(u) }} />{nomeUso(u)}</td><td>{int(v)}</td>
                <td>{dec(v / (somaMedia || 1) * 100, 1)}%</td><td className="suave">{pec ? 'sim' : 'não'}</td></tr>;
            })}
          </tbody>
        </table>
      </section>

      <section className="cartao" style={{ marginTop: 14 }}>
        <h2 style={{ marginTop: 0 }}>Uso mês a mês</h2>
        <div className="legenda">{d.usos.map(u => <span key={u}><span className="pino" style={{ background: cor(u) }} />{nomeUso(u)}</span>)}</div>
        <div className="colunas" role="img" aria-label="Uso da área por mês">
          {d.meses.map(m => (
            <div key={m.mes} className="col" title={`${nomeMes(m.mes)}\n` + d.usos.map(u => `${nomeUso(u)}: ${int(m.porUso.get(u) ?? 0)} ha`).join('\n')}>
              <div className="pilha" style={{ height: `${[...m.porUso.values()].reduce((a, b) => a + b, 0) / maxMes * 100}%` }}>
                {[...d.usos].reverse().map(u => (m.porUso.get(u) ?? 0) > 0 &&
                  <div key={u} style={{ flex: m.porUso.get(u), background: cor(u) }} />)}
              </div>
              <small>{nomeMes(m.mes)}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="cartao" style={{ marginTop: 14 }}>
        <h2 style={{ marginTop: 0 }}>Lotação mês a mês (UA/ha)</h2>
        <p className="suave" style={{ fontSize: '.85rem', marginTop: -6 }}>Estoque teórico × peso da contagem do mês ÷ área útil de pecuária</p>
        <div className="colunas" role="img" aria-label="Lotação por mês">
          {d.meses.map((m, i) => (
            <div key={m.mes} className="col" title={`${nomeMes(m.mes)}: ${dec(lot[i])} UA/ha · ${int(m.cab)} cab. · ${int(m.kg)} kg · ${dec(m.areaUtilPec, 1)} ha`}>
              <span className="valor">{dec(lot[i])}</span>
              <div className="pilha" style={{ height: `${lot[i] / maxLot * 100}%` }}><div style={{ flex: 1, background: 'var(--uso-lot)' }} /></div>
              <small>{nomeMes(m.mes)}</small>
            </div>
          ))}
        </div>
        <p className="suave" style={{ fontSize: '.82rem', marginBottom: 0 }}>Mais detalhes, por potreiro, em <Link href="/relatorios/lotacao">Relatórios › Lotação</Link>.</p>
      </section>

      <section style={{ marginTop: 14 }}>
        <h2>Potreiros</h2>
        <div className="rolagem">
          <table>
            <thead><tr><th>Potreiro</th><th>Área total</th><th>Área útil</th><th>Uso no fim do período</th><th>Mudanças no período</th></tr></thead>
            <tbody>
              {pots.map(({ p, mud }) => (
                <tr key={p.potreiro_id}><td>{p.codigo}</td><td>{dec(p.total, 1)}</td><td>{dec(p.util, 1)}</td>
                  <td><span className="pino" style={{ background: cor(p.uso) }} />{nomeUso(p.uso)}</td>
                  <td className="suave" style={{ whiteSpace: 'normal' }}>{mud.join(' · ') || '–'}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Tile({ t, v, s }: { t: string; v: string; s: string }) {
  return <div className="cartao"><small className="suave">{t}</small><div style={{ fontSize: '1.35rem', fontWeight: 700, margin: '2px 0' }}>{v}</div><small className="suave">{s}</small></div>;
}

const CSS = `
:root { --uso-1:#2a78d6; --uso-2:#eb6834; --uso-3:#1baf7a; --uso-4:#eda100; --uso-5:#e87ba4; --uso-6:#008300; --uso-7:#8a63d2; --uso-8:#7a7a74; --uso-lot:#2a78d6; }
@media (prefers-color-scheme: dark) { :root { --uso-1:#3987e5; --uso-2:#d95926; --uso-3:#199e70; --uso-4:#c98500; --uso-5:#d55181; --uso-6:#0ca30c; --uso-7:#9b7be0; --uso-8:#8f8e86; --uso-lot:#3987e5; } }
.tiles { display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin-top:6px; }
.barra100 { display:flex; gap:2px; height:22px; border-radius:4px; overflow:hidden; }
.pino { display:inline-block; width:10px; height:10px; border-radius:3px; margin-right:6px; vertical-align:-1px; }
.legenda { display:flex; flex-wrap:wrap; gap:6px 14px; font-size:.85rem; margin-bottom:8px; }
.colunas { display:flex; align-items:flex-end; gap:6px; height:180px; padding-top:18px; }
.col { flex:1; min-width:0; height:100%; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; gap:4px; position:relative; }
.col small { font-size:.7rem; color:var(--suave); white-space:nowrap; }
.col .valor { font-size:.68rem; color:var(--suave); }
.pilha { width:100%; max-width:34px; display:flex; flex-direction:column; gap:2px; border-radius:4px 4px 0 0; overflow:hidden; }
.col:hover .pilha { outline:2px solid var(--texto); outline-offset:1px; }
`;
