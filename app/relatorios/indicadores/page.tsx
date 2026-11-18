'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import FiltroPeriodo, { inicioUltimos } from '@/components/FiltroPeriodo';
import { useApp } from '@/lib/contexto';
import { efetivoPeriodo, hoje, movimentacoes, potreiros } from '@/lib/dados';
import { dataBR, dec, int } from '@/lib/formato';
import type { Categoria, LinhaEfetivo, Movimentacao } from '@/lib/tipos';

// Matrizes = fêmeas de cria (Vaca de cria, Vaquilhona cria, Ovelha de cria…)
const MATRIZ = /^(vaca|vaquilhona|ovelha|égua|egua)( de)? cria$/i;
const ENTRA_KG = ['AQUISICAO', 'VENDA_INT_ENTRADA'];
const SAI_KG = ['VENDA', 'VENDA_INT_SAIDA', 'CONSUMO'];

interface Base { efetivo: LinhaEfetivo[]; movs: Movimentacao[]; area: number }

const pct = (a: number, b: number) => (b ? dec(a / b * 100, 1) + '%' : '–');

export default function Indicadores() {
  const { propriedade, propriedades, cad } = useApp();
  const [de, setDe] = useState(inicioUltimos(12));
  const [ate, setAte] = useState(hoje());
  const [todas, setTodas] = useState(false);
  const [base, setBase] = useState<Base | null>(null);

  useEffect(() => {
    setBase(null);
    const ps = todas ? propriedades : [propriedade];
    Promise.all(ps.map(async p => {
      const [ef, mv, pots] = await Promise.all([efetivoPeriodo(p.id, de, ate), movimentacoes(p.id, de, ate), potreiros(p.id)]);
      return { ef, mv, area: pots.reduce((s, x) => s + Number(x.area_util_ha ?? 0), 0) };
    })).then(rs => setBase({ efetivo: rs.flatMap(r => r.ef), movs: rs.flatMap(r => r.mv), area: rs.reduce((s, r) => s + r.area, 0) }));
  }, [propriedade, propriedades, todas, de, ate]);

  const dias = (new Date(ate + 'T12:00:00').getTime() - new Date(de + 'T12:00:00').getTime()) / 86400000 + 1;

  return (
    <Moldura>
      <Link href="/relatorios" className="suave">← Relatórios</Link>
      <h1 style={{ marginTop: 8 }}>Indicadores produtivos</h1>
      <FiltroPeriodo de={de} ate={ate} setDe={setDe} setAte={setAte} todas={todas} setTodas={setTodas} />
      <p className="suave" style={{ fontSize: '.88rem' }}>
        {todas ? 'Todas as propriedades' : propriedade.nome} · {dataBR(de)} a {dataBR(ate)} ({int(dias)} dias)
      </p>
      {!base && <p className="suave">Calculando…</p>}
      {base && <Conteudo base={base} cats={cad.categorias} especies={cad.especies} dias={dias} />}
    </Moldura>
  );
}

function Conteudo({ base, cats, especies, dias }: { base: Base; cats: Categoria[]; especies: { id: number; nome: string }[]; dias: number }) {
  const catPorNome = (esp: string, nome: string) => cats.find(c => c.nome === nome && especies.find(e => e.id === c.especie_id)?.nome === esp);
  const peso = (c?: Categoria) => Number(c?.peso_padrao_kg ?? 0);
  // kg de uma movimentação: peso informado, senão o peso de referência da categoria
  const kgMov = (m: Movimentacao) => m.quantidade * (Number(m.peso_medio_kg ?? 0) || peso(cats.find(c => c.id === m.categoria_id)));

  const linhas = especies.map(e => {
    const ef = base.efetivo.filter(l => l.especie === e.nome);
    const s = (k: keyof LinhaEfetivo, f?: (l: LinhaEfetivo) => boolean) => ef.filter(l => !f || f(l)).reduce((a, l) => a + Number(l[k]), 0);
    const ini = s('estoque_inicial'), fim = s('estoque_final'), medio = (ini + fim) / 2;
    const kgIni = ef.reduce((a, l) => a + Number(l.estoque_inicial) * peso(catPorNome(e.nome, l.categoria)), 0);
    const kgFim = ef.reduce((a, l) => a + Number(l.estoque_final) * peso(catPorNome(e.nome, l.categoria)), 0);
    const matrizes = s('estoque_inicial', l => MATRIZ.test(l.categoria));
    const nasc = s('nascimento'), mortes = s('morte');
    // mortes de crias: na(s) categoria(s) onde entram os nascimentos
    const mortesCria = s('morte', l => Number(l.nascimento) > 0);
    const desfrute = s('venda') + s('venda_int_saida') + s('consumo') - s('aquisicao') - s('venda_int_entrada');
    const ms = base.movs.filter(m => cats.find(c => c.id === m.categoria_id)?.especie_id === e.id);
    const kgEnt = ms.filter(m => ENTRA_KG.includes(m.ocorrencia)).reduce((a, m) => a + kgMov(m), 0);
    const kgSai = ms.filter(m => SAI_KG.includes(m.ocorrencia)).reduce((a, m) => a + kgMov(m), 0);
    const kgProd = kgFim - kgIni + kgSai - kgEnt;
    return { e, ini, fim, medio, kgIni, kgFim, matrizes, nasc, mortes, mortesCria, desfrute, kgEnt, kgSai, kgProd, mostrar: ini + fim + nasc + mortes > 0 };
  }).filter(l => l.mostrar);

  const totProd = linhas.reduce((a, l) => a + l.kgProd, 0);
  const ano = 365 / dias;   // para anualizar o kg/ha quando o período não é de 12 meses

  return (
    <>
      <section className="cartao" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        <div><small className="suave">kg produzidos (todas as espécies)</small><br /><strong style={{ fontSize: '1.3rem' }}>{int(totProd)} kg</strong></div>
        <div><small className="suave">kg/ha no período</small><br /><strong style={{ fontSize: '1.3rem' }}>{base.area ? dec(totProd / base.area, 1) : '–'}</strong></div>
        {Math.abs(dias - 365) > 3 && <div><small className="suave">kg/ha/ano</small><br /><strong>{base.area ? dec(totProd / base.area * ano, 1) : '–'}</strong></div>}
        <div><small className="suave">Área útil</small><br /><strong>{dec(base.area, 1)} ha</strong></div>
      </section>

      <div className="rolagem" style={{ marginTop: 12 }}>
        <table>
          <thead><tr><th>Indicador</th>{linhas.map(l => <th key={l.e.id}>{l.e.nome}</th>)}</tr></thead>
          <tbody>
            <Linha t="Rebanho inicial (cab.)" v={linhas.map(l => int(l.ini))} />
            <Linha t="Rebanho final (cab.)" v={linhas.map(l => int(l.fim))} />
            <Linha t="Rebanho médio (cab.)" v={linhas.map(l => int(l.medio))} />
            <Linha t="Matrizes no início" v={linhas.map(l => l.matrizes ? int(l.matrizes) : '–')} />
            <Linha t="Nascimentos" v={linhas.map(l => int(l.nasc))} />
            <Linha t="Natalidade (nasc. ÷ matrizes)" v={linhas.map(l => pct(l.nasc, l.matrizes))} forte />
            <Linha t="Mortes" v={linhas.map(l => int(l.mortes))} />
            <Linha t="Mortalidade (mortes ÷ rebanho médio)" v={linhas.map(l => pct(l.mortes, l.medio))} forte />
            <Linha t="Mortalidade de crias (÷ nascimentos)" v={linhas.map(l => pct(l.mortesCria, l.nasc))} forte />
            <Linha t="Desfrute líquido (cab.)" v={linhas.map(l => int(l.desfrute))} />
            <Linha t="Taxa de desfrute (÷ rebanho médio)" v={linhas.map(l => pct(l.desfrute, l.medio))} forte />
            <Linha t="kg no início" v={linhas.map(l => int(l.kgIni))} />
            <Linha t="kg no final" v={linhas.map(l => int(l.kgFim))} />
            <Linha t="kg saídos (venda, consumo)" v={linhas.map(l => int(l.kgSai))} />
            <Linha t="kg comprados" v={linhas.map(l => int(l.kgEnt))} />
            <Linha t="kg produzidos" v={linhas.map(l => int(l.kgProd))} forte />
            <Linha t="kg produzidos por ha" v={linhas.map(l => base.area ? dec(l.kgProd / base.area, 1) : '–')} forte />
            <Linha t="kg produzidos por cab. média" v={linhas.map(l => l.medio ? dec(l.kgProd / l.medio, 1) : '–')} />
          </tbody>
        </table>
      </div>
      <div className="suave" style={{ fontSize: '.82rem', marginTop: 10, lineHeight: 1.5 }}>
        <p style={{ margin: '4px 0' }}><strong>Como é calculado.</strong> Matrizes são o estoque inicial de Vaca de cria, Vaquilhona cria e Ovelha de cria.
          Mortalidade de crias conta as mortes nas categorias que recebem os nascimentos (terneiros, cordeiros).
          Desfrute líquido = vendas + vendas internas + consumo − compras − vendas internas recebidas.</p>
        <p style={{ margin: '4px 0' }}>kg produzidos = kg final − kg inicial + kg vendidos e consumidos − kg comprados. Estoque usa o peso de referência de cada categoria;
          compras e vendas usam o peso informado no lançamento. Mortes não somam produção. Por ha usa a área útil de todos os potreiros ativos.</p>
      </div>
    </>
  );
}

function Linha({ t, v, forte }: { t: string; v: string[]; forte?: boolean }) {
  return <tr className={forte ? 'total' : undefined}><td>{t}</td>{v.map((x, i) => <td key={i}>{x}</td>)}</tr>;
}
