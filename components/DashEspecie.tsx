'use client';
// Painel de uma espécie, no modelo das abas "DASH BOVINOS" e "DASH OVINOS" da planilha
import { useEffect, useState } from 'react';
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
    return { rotulo: nomeMes(mes), valor: valor(l), texto: reais(valor(l)), dica: `${int(cab(l))} cab.` };
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

  return (
    <>
      <div className="tiles">
        <Tile t="Rebanho" v={`${int(ini)} → ${int(fim)}`} s={`${fim - ini >= 0 ? '+' : ''}${int(fim - ini)} cabeças no período`} />
        <Tile t="Vendas" v={reais(valor(vendas))} s={`${int(cab(vendas))} cab. · ${dec(precoKg(vendas))} R$/kg · ${int(pesoMedio(vendas))} kg/cab`} />
        <Tile t="Compras" v={reais(valor(compras))} s={`${int(cab(compras))} cab. · ${dec(precoKg(compras))} R$/kg`} />
        <Tile t="Nascimentos · mortes" v={`${int(cab(de_('NASCIMENTO')))} · ${int(cab(de_('MORTE')))}`} s={`consumo ${int(cab(de_('CONSUMO')))} cab.`} />
      </div>

      <div className="grade-dash">
        <Barras t="Vendas por categoria" s="cabeças" itens={porCategoria(vendas, cab, int)} />
        <Barras t="Peso médio de venda" s="kg por cabeça" itens={porCategoria(vendas, pesoMedio, v => int(v))} />
        <Barras t="Preço médio de venda" s="R$ por kg" itens={porCategoria(vendas, precoKg, v => dec(v), l => reais(valor(l)))} />
        <Colunas t="Vendas mês a mês" s="R$" itens={porMes(vendas)} />
        <Barras t="Compras por categoria" s="cabeças" itens={porCategoria(compras, cab, int)} />
        <Barras t="Peso médio de compra" s="kg por cabeça" itens={porCategoria(compras, pesoMedio, v => int(v))} />
        <Barras t="Preço médio de compra" s="R$ por kg" itens={porCategoria(compras, precoKg, v => dec(v), l => reais(valor(l)))} />
        <Colunas t="Compras mês a mês" s="R$" itens={porMes(compras)} />
        <Barras t="Mortes por categoria" s="cabeças" itens={porCategoria(de_('MORTE'), cab, int)} />
        <Barras t="Mortes por causa" s="cabeças" itens={causas} />
        <Barras t="Consumo por categoria" s="cabeças" itens={porCategoria(de_('CONSUMO'), cab, int)} />
        <Barras t="Vendas internas (entrada)" s="cabeças" itens={porCategoria(de_('VENDA_INT_ENTRADA'), cab, int)} />
        <Barras t="Vendas internas (saída)" s="cabeças" itens={porCategoria(de_('VENDA_INT_SAIDA'), cab, int)} />
        {totTouros > 0 && <Barras t="Venda de touros" s="R$ e participação"
          itens={porCategoria(touros, valor, v => `${reais(v)} · ${dec(v / totTouros * 100, 0)}%`, l => `${int(cab(l))} cab. · ${reais(valor(l) / (cab(l) || 1))} por cabeça`)} />}
      </div>
      <p className="suave" style={{ fontSize: '.82rem' }}>Pesos e preços médios são ponderados pelas cabeças e kg de cada lançamento. Passe o mouse ou toque numa barra para ver o detalhe.</p>
    </>
  );
}

function Tile({ t, v, s }: { t: string; v: string; s: string }) {
  return <div className="cartao"><small className="suave">{t}</small><div style={{ fontSize: '1.3rem', fontWeight: 700, margin: '2px 0' }}>{v}</div><small className="suave">{s}</small></div>;
}

function Barras({ t, s, itens }: { t: string; s: string; itens: Item[] }) {
  const max = Math.max(0, ...itens.map(i => i.valor));
  return (
    <section className="cartao">
      <h3 style={{ margin: 0 }}>{t}</h3>
      <small className="suave">{s}</small>
      {!itens.length && <p className="suave" style={{ marginBottom: 0 }}>Nada no período.</p>}
      <div className="barras">
        {itens.map(i => (
          <div key={i.rotulo} className="barra" title={`${i.rotulo}: ${i.texto}${i.dica ? ' · ' + i.dica : ''}`}>
            <span className="rot">{i.rotulo}</span>
            <span className="trilho"><span style={{ width: `${max ? i.valor / max * 100 : 0}%` }} /></span>
            <span className="val">{i.texto}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Colunas({ t, s, itens }: { t: string; s: string; itens: Item[] }) {
  const max = Math.max(1, ...itens.map(i => i.valor));
  return (
    <section className="cartao">
      <h3 style={{ margin: 0 }}>{t}</h3>
      <small className="suave">{s}</small>
      <div className="colunas" style={{ height: 150 }}>
        {itens.map(i => (
          <div key={i.rotulo} className="col" title={`${i.rotulo}: ${i.texto}${i.dica ? ' · ' + i.dica : ''}`}>
            <div className="pilha" style={{ height: `${i.valor / max * 100}%` }}><div style={{ flex: 1, background: 'var(--uso-1)' }} /></div>
            <small>{i.rotulo.slice(0, 3)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
