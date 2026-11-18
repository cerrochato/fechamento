'use client';
// Painel de uma espécie, no modelo das abas "DASH BOVINOS" e "DASH OVINOS" da planilha
import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '@/lib/contexto';
import { efetivoPeriodo, mesesDoPeriodo, movimentacoes } from '@/lib/dados';
import { dec, int, reais } from '@/lib/formato';
import type { LinhaEfetivo, Movimentacao } from '@/lib/tipos';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const nomeMes = (m: string) => `${MESES[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;

interface Item { rotulo: string; valor: number; texto: string; dica?: string }

export default function DashEspecie({ especieId, de, ate, todas }: { especieId: number; de: string; ate: string; todas: boolean }) {
  const { propriedade, propriedades, cad } = useApp();
  const [dados, setDados] = useState<{ movs: Movimentacao[]; ef: LinhaEfetivo[] } | null>(null);

  useEffect(() => {
    setDados(null);
    const ps = todas ? propriedades : [propriedade];
    Promise.all(ps.map(async p => ({ movs: await movimentacoes(p.id, de, ate), ef: await efetivoPeriodo(p.id, de, ate) })))
      .then(rs => setDados({ movs: rs.flatMap(r => r.movs), ef: rs.flatMap(r => r.ef) }));
  }, [propriedade, propriedades, todas, de, ate]);

  if (!dados) return <p className="suave">Calculando…</p>;
  const esp = cad.especies.find(e => e.id === especieId)!;
  const cat = (id: number) => cad.categorias.find(c => c.id === id);
  const movs = dados.movs.filter(m => cat(m.categoria_id)?.especie_id === especieId);
  const ef = dados.ef.filter(l => l.especie === esp.nome);
  const de_ = (oc: string) => movs.filter(m => m.ocorrencia === oc);
  const ordem = (id: number) => cat(id)?.ordem ?? 999;

  // agrupa por categoria
  function porCategoria(ms: Movimentacao[], f: (g: Movimentacao[]) => number, fmt: (v: number) => string, dica?: (g: Movimentacao[]) => string): Item[] {
    const g = new Map<number, Movimentacao[]>();
    for (const m of ms) g.set(m.categoria_id, [...(g.get(m.categoria_id) ?? []), m]);
    return [...g.entries()].sort((a, b) => ordem(a[0]) - ordem(b[0]))
      .map(([id, l]) => ({ rotulo: cat(id)?.nome ?? '?', valor: f(l), texto: fmt(f(l)), dica: dica?.(l) }))
      .filter(i => i.valor > 0);
  }
  const cab = (l: Movimentacao[]) => l.reduce((s, m) => s + m.quantidade, 0);
  const kg = (l: Movimentacao[]) => l.reduce((s, m) => s + m.quantidade * Number(m.peso_medio_kg ?? 0), 0);
  const cabComPeso = (l: Movimentacao[]) => l.filter(m => Number(m.peso_medio_kg) > 0).reduce((s, m) => s + m.quantidade, 0);
  const valor = (l: Movimentacao[]) => l.reduce((s, m) => s + Number(m.valor_total ?? 0), 0);
  const kgComValor = (l: Movimentacao[]) => l.filter(m => m.valor_total).reduce((s, m) => s + m.quantidade * Number(m.peso_medio_kg ?? 0), 0);
  const pesoMedio = (l: Movimentacao[]) => (cabComPeso(l) ? kg(l) / cabComPeso(l) : 0);
  const precoKg = (l: Movimentacao[]) => (kgComValor(l) ? valor(l) / kgComValor(l) : 0);
  const porMes = (ms: Movimentacao[]) => mesesDoPeriodo(de, ate).map(({ mes }) => {
    const l = ms.filter(m => m.data.slice(0, 7) === mes.slice(0, 7));
    return { rotulo: nomeMes(mes).slice(0, 3), valor: valor(l), texto: valor(l) ? dec(valor(l) / 1000, 0) : '', dica: `${reais(valor(l))} · ${int(cab(l))} cab.` };
  });
  const causas = (() => {
    const g = new Map<string, number>();
    for (const m of de_('MORTE')) { const k = cad.causas.find(c => c.id === m.causa_morte_id)?.nome ?? 'Sem causa informada'; g.set(k, (g.get(k) ?? 0) + m.quantidade); }
    return [...g.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ rotulo: k, valor: v, texto: int(v) }));
  })();

  const vendas = de_('VENDA'), compras = de_('AQUISICAO');
  const ini = ef.reduce((s, l) => s + Number(l.estoque_inicial), 0), fim = ef.reduce((s, l) => s + Number(l.estoque_final), 0);
  const touros = vendas.filter(m => /^touro/i.test(cat(m.categoria_id)?.nome ?? ''));
  const totTouros = valor(touros);

  const mortes = de_('MORTE'), consumo = de_('CONSUMO'), nasc = de_('NASCIMENTO');
  const ent = de_('VENDA_INT_ENTRADA'), sai = de_('VENDA_INT_SAIDA');
  const saldo = valor(vendas) - valor(compras);

  return (
    <>
      <div className="dash-hero">
        <Hero t={`Rebanho ${esp.nome.toLowerCase()} atual`} v={int(fim)} s={`${int(ini)} no início · ${fim - ini >= 0 ? '+' : ''}${int(fim - ini)} cab.`} />
        <Hero t="Faturamento com vendas" v={compacto(valor(vendas))} s={`${int(cab(vendas))} cab. vendidas`} />
        <Hero t="Desembolso com compras" v={compacto(valor(compras))} s={`${int(cab(compras))} cab. compradas`} />
        <Hero t="Vendas − compras" v={compacto(saldo)} s={saldo >= 0 ? 'saldo positivo no período' : 'saldo negativo no período'} />
        <Hero t="Nascimentos · mortes" v={`${int(cab(nasc))} · ${int(cab(mortes))}`} s={`mortes = ${dec(ini ? cab(mortes) / ini * 100 : 0, 1)}% do rebanho inicial`} />
      </div>

      <Secao t="Vendas">
        <div className="dash-kpis">
          <Kpi t="Cabeças comercializadas" v={int(cab(vendas))} />
          <Kpi t="Preço médio de venda" v={`R$ ${dec(precoKg(vendas))}/kg`} />
          <Kpi t="Peso médio de venda" v={`${int(pesoMedio(vendas))} kg`} />
          <Kpi t="Faturamento total" v={reais(valor(vendas))} />
        </div>
        <div className="dash-graficos">
          <Colunas t="Cabeças vendidas por categoria" itens={porCategoria(vendas, cab, int, l => reais(valor(l)))} />
          <Colunas t="Preço médio por categoria (R$/kg)" itens={porCategoria(vendas, precoKg, v => dec(v), l => reais(valor(l)))} />
          <Colunas t="Peso médio por categoria (kg)" itens={porCategoria(vendas, pesoMedio, v => int(v), l => `${int(cab(l))} cab.`)} />
          <Colunas t="Faturamento mês a mês (R$ mil)" itens={porMes(vendas)} />
          {totTouros > 0 && <Colunas t="Venda de touros: faturamento e % do total" largo
            itens={porCategoria(touros, valor, compacto, l => `${int(cab(l))} cab. · ${reais(valor(l) / (cab(l) || 1))} por cabeça`)}
            linha={porCategoria(touros, valor, compacto).map(i => i.valor / totTouros * 100)} />}
        </div>
      </Secao>

      <Secao t="Compras">
        <div className="dash-kpis">
          <Kpi t="Cabeças compradas" v={int(cab(compras))} />
          <Kpi t="Preço médio de compra" v={`R$ ${dec(precoKg(compras))}/kg`} />
          <Kpi t="Peso médio de compra" v={`${int(pesoMedio(compras))} kg`} />
          <Kpi t="Desembolso total" v={reais(valor(compras))} />
        </div>
        <div className="dash-graficos">
          <Colunas t="Cabeças compradas por categoria" itens={porCategoria(compras, cab, int, l => reais(valor(l)))} />
          <Colunas t="Preço médio por categoria (R$/kg)" itens={porCategoria(compras, precoKg, v => dec(v), l => reais(valor(l)))} />
          <Colunas t="Peso médio por categoria (kg)" itens={porCategoria(compras, pesoMedio, v => int(v), l => `${int(cab(l))} cab.`)} />
          <Colunas t="Desembolso mês a mês (R$ mil)" itens={porMes(compras)} />
        </div>
      </Secao>

      <Secao t="Mortes">
        <div className="dash-kpis">
          <Kpi t="Total de mortes" v={`${int(cab(mortes))} cab.`} />
          <Kpi t="Mortes ÷ rebanho inicial" v={`${dec(ini ? cab(mortes) / ini * 100 : 0, 1)}%`} />
          <Kpi t="Nascimentos" v={`${int(cab(nasc))} cab.`} />
        </div>
        <div className="dash-graficos">
          <Colunas t="Mortes por categoria" itens={porCategoria(mortes, cab, int)} />
          <Colunas t="Mortes por causa" itens={causas} />
        </div>
      </Secao>

      <Secao t="Consumo e vendas internas">
        <div className="dash-kpis">
          <Kpi t="Consumo" v={`${int(cab(consumo))} cab.`} />
          <Kpi t="Vendas internas (entrada)" v={`${int(cab(ent))} cab.`} s={reais(valor(ent))} />
          <Kpi t="Vendas internas (saída)" v={`${int(cab(sai))} cab.`} s={reais(valor(sai))} />
        </div>
        <div className="dash-graficos">
          <Colunas t="Consumo por categoria" itens={porCategoria(consumo, cab, int)} />
          <Colunas t="Vendas internas: entrada" itens={porCategoria(ent, cab, int, l => reais(valor(l)))} />
          <Colunas t="Vendas internas: saída" itens={porCategoria(sai, cab, int, l => reais(valor(l)))} />
        </div>
      </Secao>
      <p className="suave" style={{ fontSize: '.82rem' }}>Pesos e preços médios são ponderados pelas cabeças e kg de cada lançamento. Passe o mouse ou toque numa coluna para ver o detalhe.</p>
    </>
  );
}

// R$ curto para rótulos de coluna: R$ 2,60 mi · R$ 428 mil · R$ 950
function compacto(v: number) {
  const a = Math.abs(v), sinal = v < 0 ? '−' : '';
  if (a >= 1e6) return `${sinal}R$ ${dec(a / 1e6, 2)} mi`;
  if (a >= 1e3) return `${sinal}R$ ${int(a / 1e3)} mil`;
  return `${sinal}R$ ${int(a)}`;
}

function Hero({ t, v, s }: { t: string; v: string; s: string }) {
  return <div className="hero"><small>{t}</small><strong>{v}</strong><small>{s}</small></div>;
}

function Kpi({ t, v, s }: { t: string; v: string; s?: string }) {
  return <div className="kpi"><small className="suave">{t}</small><strong>{v}</strong>{s && <small className="suave">{s}</small>}</div>;
}

function Secao({ t, children }: { t: string; children: ReactNode }) {
  return <section className="dash-secao"><h2>{t}</h2>{children}</section>;
}

// Colunas verticais com o valor em cima de cada uma (como no DASH da planilha).
// "linha" (opcional) desenha uma linha de % por cima das colunas, com o rótulo do %.
function Colunas({ t, itens, linha, largo }: { t: string; itens: Item[]; linha?: number[]; largo?: boolean }) {
  const max = Math.max(0, ...itens.map(i => i.valor));
  const n = itens.length;
  return (
    <div className={`dash-graf${largo ? ' largo' : ''}`}>
      <h3>{t}</h3>
      {!itens.some(i => i.valor > 0) ? <p className="suave" style={{ margin: '24px 0' }}>Nada no período.</p> : (
        <div className="dash-rolagem">
          <div className="vcols" style={{ minWidth: n * 38 }}>
            {linha && (
              <svg className="vlinha" viewBox={`0 0 ${n} 100`} preserveAspectRatio="none" aria-hidden="true">
                <polyline points={linha.map((p, i) => `${i + 0.5},${100 - p}`).join(' ')} />
              </svg>
            )}
            {itens.map((i, k) => (
              <div key={i.rotulo + k} className="vcol" title={`${i.rotulo}: ${i.texto}${i.dica ? ' · ' + i.dica : ''}`}>
                <div className="vtopo">
                  {linha && <span className="vpct" style={{ bottom: `${linha[k]}%` }}>{dec(linha[k], 0)}%</span>}
                  <span className="vval">{i.texto}</span>
                  <div className="vbar" style={{ height: `${max ? i.valor / max * 100 : 0}%` }} />
                </div>
                <small className="vrot">{i.rotulo}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
