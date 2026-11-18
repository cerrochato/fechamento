'use client';
import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import FiltroPeriodo, { inicioUltimos } from '@/components/FiltroPeriodo';
import { useApp } from '@/lib/contexto';
import { areaPecuaria, efetivoPeriodo, estoquesMensais, hoje, movimentacoes, pesosDoMes } from '@/lib/dados';
import { dataBR, dec, int } from '@/lib/formato';
import type { Categoria, LinhaEfetivo, LinhaEstoque, Movimentacao } from '@/lib/tipos';

// Mesmas fórmulas da aba "Indicadores nova" da planilha
const JOVEM = /\b[12]A\b|15 m|6-12/i;        // Vaquilhona/Touro/Novilho 1A e 2A, Vaquilhona cria 15 m, Terneiros 6-12 M
const CRIA = /\(M\/F\)/i;                    // Terneiro (M/F), Cordeiro (M/F)
const OUTROS = /^outros$/i;
const ESTACOES: Record<string, string> = { '07': 'inverno', '09': 'primavera', '12': 'verão', '03': 'outono' };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

interface Base {
  efetivo: LinhaEfetivo[]; movs: Movimentacao[];
  meses: { mes: string; fim: string; linhas: LinhaEstoque[]; area: number; areaUtil: number; kgCarga: number }[];
}

async function carregar(prop: number, de: string, ate: string) {
  const [efetivo, movs, est, area, pesos] = await Promise.all([
    efetivoPeriodo(prop, de, ate), movimentacoes(prop, de, ate), estoquesMensais(prop, de, ate), areaPecuaria(prop, de, ate), pesosDoMes(prop, de, ate)]);
  return { efetivo, movs, meses: est.map((m, i) => ({ ...m, area: area[i].total, areaUtil: area[i].util,
    // kg para a carga: cabeças teóricas × peso da contagem do mês (ou peso de referência)
    kgCarga: m.linhas.reduce((s, l) => s + Number(l.cabecas) * (pesos.get(m.mes)?.get(l.categoria_id) ?? Number(l.peso_padrao_kg ?? 0)), 0) })) };
}

export default function Indicadores() {
  const { propriedade, propriedades, cad } = useApp();
  const [de, setDe] = useState(inicioUltimos(12));
  const [ate, setAte] = useState(hoje());
  const [todas, setTodas] = useState(false);
  const [base, setBase] = useState<Base | null>(null);

  useEffect(() => {
    setBase(null);
    Promise.all((todas ? propriedades : [propriedade]).map(p => carregar(p.id, de, ate))).then(rs => setBase({
      efetivo: rs.flatMap(r => r.efetivo), movs: rs.flatMap(r => r.movs),
      // soma as propriedades mês a mês
      meses: rs[0].meses.map((m, i) => ({ ...m, linhas: rs.flatMap(r => r.meses[i].linhas),
        area: rs.reduce((s, r) => s + r.meses[i].area, 0), areaUtil: rs.reduce((s, r) => s + r.meses[i].areaUtil, 0),
        kgCarga: rs.reduce((s, r) => s + r.meses[i].kgCarga, 0) })),
    }));
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
      {base && base.meses.length > 0 && <Conteudo base={base} cats={cad.categorias} especies={cad.especies} dias={dias} />}
    </Moldura>
  );
}

function Conteudo({ base, cats, especies, dias }: { base: Base; cats: Categoria[]; especies: { id: number; nome: string }[]; dias: number }) {
  const bov = especies.find(e => /^bovino/i.test(e.nome)), ov = especies.find(e => /^ovino/i.test(e.nome));
  const catDe = (id: number) => cats.find(c => c.id === id);
  const catNome = (esp: string, nome: string) => cats.find(c => c.nome === nome && especies.find(e => e.id === c.especie_id)?.nome === esp);
  const peso = (c?: Categoria | null) => Number(c?.peso_padrao_kg ?? 0);
  const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

  // rebanho médio = média dos estoques no fim de cada mês
  const rebMedio = (f: (l: LinhaEstoque) => boolean) => media(base.meses.map(m => m.linhas.filter(f).reduce((s, l) => s + Number(l.cabecas), 0)));
  const ef = (esp?: { nome: string }) => base.efetivo.filter(l => l.especie === esp?.nome);
  const soma = (ls: LinhaEfetivo[], k: keyof LinhaEfetivo, f?: (l: LinhaEfetivo) => boolean) => ls.filter(l => !f || f(l)).reduce((a, l) => a + Number(l[k]), 0);
  const movsDe = (espId: number | undefined, ocs: string[]) => base.movs.filter(m => ocs.includes(m.ocorrencia) && catDe(m.categoria_id)?.especie_id === espId);
  const kgInf = (ms: Movimentacao[]) => ms.reduce((s, m) => s + m.quantidade * Number(m.peso_medio_kg ?? 0), 0);   // só o peso informado, como a planilha
  const valor = (ms: Movimentacao[]) => ms.reduce((s, m) => s + Number(m.valor_total ?? 0), 0);

  const areaMedia = media(base.meses.map(m => m.area));
  const eb = ef(bov), eo = ef(ov);
  const rmBov = rebMedio(l => l.especie_id === bov?.id), rmOv = rebMedio(l => l.especie_id === ov?.id);
  const rmJov = rebMedio(l => l.especie_id === bov?.id && JOVEM.test(l.categoria));
  const rmAdu = rebMedio(l => l.especie_id === bov?.id && !JOVEM.test(l.categoria) && !CRIA.test(l.categoria) && !OUTROS.test(l.categoria));
  const nascBov = soma(eb, 'nascimento'), mortCria = soma(eb, 'morte', l => CRIA.test(l.categoria));
  const mortJov = soma(eb, 'morte', l => JOVEM.test(l.categoria)), mortAdu = soma(eb, 'morte', l => !JOVEM.test(l.categoria) && !CRIA.test(l.categoria));
  const iniBov = soma(eb, 'estoque_inicial');
  const kgIni = eb.reduce((s, l) => s + Number(l.estoque_inicial) * peso(catNome(l.especie, l.categoria)), 0);
  const kgFim = eb.reduce((s, l) => s + Number(l.estoque_final) * peso(catNome(l.especie, l.categoria)), 0);
  const vendasBov = movsDe(bov?.id, ['VENDA']);
  const kgSaiu = kgInf(movsDe(bov?.id, ['VENDA', 'VENDA_INT_SAIDA'])), kgEntrou = kgInf(movsDe(bov?.id, ['AQUISICAO', 'VENDA_INT_ENTRADA']));
  const pac = kgFim - kgIni + kgSaiu - kgEntrou;
  const precoKg = kgInf(vendasBov) ? valor(vendasBov) / kgInf(vendasBov) : 0;
  const eqOv = precoKg ? valor(movsDe(ov?.id, ['VENDA'])) / precoKg : 0;
  const pct = (a: number, b: number) => (b ? dec(a / b * 100, 1) + '%' : '–');

  const cargas = base.meses.filter(m => ESTACOES[m.mes.slice(5, 7)]).map(m => {
    const kg = m.kgCarga;
    return { t: `Carga ${ESTACOES[m.mes.slice(5, 7)]} (${MESES[Number(m.mes.slice(5, 7)) - 1]}/${m.mes.slice(2, 4)})`, kgha: m.areaUtil ? kg / m.areaUtil : 0, kg, area: m.areaUtil, fim: m.fim };
  });

  const n1 = (x: number) => dec(x, 1), mb = soma(eb, 'morte'), mo = soma(eo, 'morte');
  const vc = soma(eb, 'venda') + soma(eb, 'consumo');
  // [indicador, resultado, referência, fórmula com os números do período]
  const L: [string, string, string, string][] = [
    ['Área utilizada para pecuária (média, ha)', dec(areaMedia, 1), '', `Média mensal da área total dos potreiros em uso de pecuária (Cadastros › Potreiros e uso das áreas) = ${n1(areaMedia)} ha`],
    ['Rebanho médio bovino', dec(rmBov, 1), '', `Média dos estoques de bovinos no fim de cada mês (${base.meses.length} meses) = ${n1(rmBov)}`],
    ['Rebanho médio ovino', dec(rmOv, 1), '', `Média dos estoques de ovinos no fim de cada mês (${base.meses.length} meses) = ${n1(rmOv)}`],
    ['Taxa de mortalidade de terneiros', pct(mortCria, nascBov), '2,5%', `Mortes de terneiros (M/F) ÷ nascimentos de bovinos = ${int(mortCria)} ÷ ${int(nascBov)}`],
    ['Taxa de mortalidade de bovinos jovens', pct(mortJov, rmJov), '1%', `Mortes de jovens ÷ rebanho médio de jovens = ${int(mortJov)} ÷ ${n1(rmJov)}. Jovens: categorias 1A e 2A, Vaquilhona cria 15 m, Terneiros 6-12 M`],
    ['Taxa de mortalidade de bovinos adultos', pct(mortAdu, rmAdu), '0,8%', `Mortes de adultos ÷ rebanho médio de adultos = ${int(mortAdu)} ÷ ${n1(rmAdu)}. Adultos: vacas, vaquilhonas de cria e 3A, touros de cria, 3A e refugo, novilho 3A`],
    ['Taxa de mortalidade geral de bovinos', pct(mb, rmBov), '2%', `Mortes de bovinos ÷ rebanho médio bovino = ${int(mb)} ÷ ${n1(rmBov)}`],
    ['Taxa de mortalidade geral de ovinos', pct(mo, rmOv), '5%', `Mortes de ovinos ÷ rebanho médio ovino = ${int(mo)} ÷ ${n1(rmOv)}`],
    ['Taxa de desfrute de bovinos', pct(vc, iniBov), '> 30%', `(Vendas + consumo) ÷ estoque inicial de bovinos = (${int(soma(eb, 'venda'))} + ${int(soma(eb, 'consumo'))}) ÷ ${int(iniBov)}`],
    ['Eficiência de estoque de bovinos', pct(pac, kgIni), '> 35%', `kg produzidos bovinos ÷ kg do estoque inicial = ${int(pac)} ÷ ${int(kgIni)}`],
    ['kg produzidos bovinos', int(pac), '', `(kg final − kg inicial) + kg vendidos e de vendas internas − kg comprados e de vendas internas recebidas = (${int(kgFim)} − ${int(kgIni)}) + ${int(kgSaiu)} − ${int(kgEntrou)}. Estoque pelo peso de referência; vendas e compras pelo peso informado`],
    ['Produtividade bovinos (kg PV/ha)', areaMedia ? dec(pac / areaMedia, 1) : '–', '> 150', `kg produzidos bovinos ÷ área de pecuária = ${int(pac)} ÷ ${n1(areaMedia)}`],
    ['Eq. ovinos (kg equivalente bovino)', int(eqOv), '', `R$ das vendas de ovinos ÷ R$/kg médio das vendas de bovinos = ${dec(valor(movsDe(ov?.id, ['VENDA'])))} ÷ ${precoKg ? dec(precoKg) : '–'}`],
    ['kg produzidos geral (ov + bov)', int(pac + eqOv), '', `kg produzidos bovinos + eq. ovinos = ${int(pac)} + ${int(eqOv)}`],
    ['Produtividade geral (kg PV/ha)', areaMedia ? dec((pac + eqOv) / areaMedia, 1) : '–', '> 150', `kg produzidos geral ÷ área de pecuária = ${int(pac + eqOv)} ÷ ${n1(areaMedia)}`],
    ['GMD global rebanho bovino (kg/dia)', rmBov ? dec(pac / rmBov / dias, 3) : '–', '0,291', `kg produzidos bovinos ÷ rebanho médio bovino ÷ dias = ${int(pac)} ÷ ${n1(rmBov)} ÷ ${int(dias)}`],
    ...cargas.map(c => [`${c.t}, kg PV/ha · UA/ha`, `${dec(c.kgha, 1)} · ${dec(c.kgha / 450)}`, '',
      `kg do estoque teórico em ${dataBR(c.fim)} (cabeças × peso médio da contagem do mês) ÷ área útil de pecuária = ${int(c.kg)} ÷ ${n1(c.area)}. UA/ha = kg/ha ÷ 450`] as [string, string, string, string]),
  ];
  const [aberto, setAberto] = useState<string | null>(null);

  return (
    <>
      <div className="rolagem">
        <table>
          <thead><tr><th>Indicador</th><th>Resultado</th><th>Referência</th></tr></thead>
          <tbody>{L.map(([t, v, r, f]) => (
            <Fragment key={t}>
              <tr title={f} onClick={() => setAberto(aberto === t ? null : t)} style={{ cursor: 'pointer' }}>
                <td style={{ whiteSpace: 'normal', minWidth: 150 }}>{t} <span className="suave" aria-hidden style={{ fontSize: '.8rem' }}>ⓘ</span></td><td><strong>{v}</strong></td><td className="suave">{r}</td>
              </tr>
              {aberto === t && <tr><td colSpan={3} className="suave" style={{ fontSize: '.85rem', whiteSpace: 'normal', textAlign: 'left' }}>{f}</td></tr>}
            </Fragment>
          ))}</tbody>
        </table>
      </div>
      <div className="suave" style={{ fontSize: '.82rem', marginTop: 10, lineHeight: 1.5 }}>
        <p style={{ margin: '4px 0' }}>Passe o mouse ou toque em um indicador para ver a fórmula com os números do período.</p>
        <p style={{ margin: '4px 0' }}><strong>Como é calculado (igual à planilha).</strong> Rebanho médio = média dos estoques no fim de cada mês.
          Área = média mensal da área total dos potreiros em uso de pecuária (Controle de áreas); a carga usa a área útil de pecuária do mês.
          Desfrute = (vendas + consumo) ÷ estoque inicial.</p>
        <p style={{ margin: '4px 0' }}>kg produzidos = (kg final − kg inicial, pelo peso de referência) + kg vendidos e de vendas internas − kg comprados e de vendas internas recebidas (peso informado nos lançamentos).
          Eq. ovinos = R$ das vendas de ovinos ÷ R$/kg médio das vendas de bovinos ({precoKg ? dec(precoKg) : '–'}). GMD = kg produzidos ÷ rebanho médio ÷ dias do período.
          Carga = estoque teórico no fim do mês × peso médio da contagem do mês (ou peso de referência) ÷ área útil de pecuária.</p>
      </div>
    </>
  );
}
