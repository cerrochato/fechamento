'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import FiltroPeriodo from '@/components/FiltroPeriodo';
import { useApp } from '@/lib/contexto';
import { hoje, mesesAntes, movimentacoes } from '@/lib/dados';
import { dataBR, dec, int, reais } from '@/lib/formato';
import type { Movimentacao } from '@/lib/tipos';

// Grupos do relatório, na ordem em que aparecem
const GRUPOS: { titulo: string; codigos: string[]; valor: boolean; por?: 'contraparte' | 'causa' }[] = [
  { titulo: 'Compras', codigos: ['AQUISICAO'], valor: true, por: 'contraparte' },
  { titulo: 'Vendas', codigos: ['VENDA'], valor: true, por: 'contraparte' },
  { titulo: 'Vendas internas (entrada)', codigos: ['VENDA_INT_ENTRADA'], valor: true },
  { titulo: 'Vendas internas (saída)', codigos: ['VENDA_INT_SAIDA'], valor: true },
  { titulo: 'Nascimentos', codigos: ['NASCIMENTO'], valor: false },
  { titulo: 'Mortes', codigos: ['MORTE'], valor: false, por: 'causa' },
  { titulo: 'Consumo', codigos: ['CONSUMO'], valor: false },
  { titulo: 'Trocas de categoria (entradas)', codigos: ['TCAT_ENTRADA'], valor: false },
  { titulo: 'Trocas de categoria (saídas)', codigos: ['TCAT_SAIDA'], valor: false },
];

interface Soma { cab: number; kg: number; valor: number; kgComValor: number }
const nova = (): Soma => ({ cab: 0, kg: 0, valor: 0, kgComValor: 0 });
function somar(s: Soma, m: Movimentacao) {
  const kg = m.quantidade * Number(m.peso_medio_kg ?? 0);
  s.cab += m.quantidade; s.kg += kg;
  if (m.valor_total) { s.valor += Number(m.valor_total); s.kgComValor += kg; }
}

export default function RelMovimentacoes() {
  const { propriedade, propriedades, cad } = useApp();
  const [de, setDe] = useState(mesesAntes(hoje(), 12));
  const [ate, setAte] = useState(hoje());
  const [todas, setTodas] = useState(false);
  const [lista, setLista] = useState<Movimentacao[] | null>(null);

  useEffect(() => {
    setLista(null);
    const ps = todas ? propriedades : [propriedade];
    Promise.all(ps.map(p => movimentacoes(p.id, de, ate))).then(l => setLista(l.flat()));
  }, [propriedade, propriedades, todas, de, ate]);

  const cat = (id: number) => cad.categorias.find(c => c.id === id);
  const nomeCausa = (id: number | null) => cad.causas.find(c => c.id === id)?.nome ?? 'Sem causa informada';
  const nomeCp = (id: number | null) => cad.contrapartes.find(c => c.id === id)?.nome ?? 'Não informado';

  return (
    <Moldura>
      <Link href="/relatorios" className="suave">← Relatórios</Link>
      <h1 style={{ marginTop: 8 }}>Movimentações</h1>
      <FiltroPeriodo de={de} ate={ate} setDe={setDe} setAte={setAte} todas={todas} setTodas={setTodas} />
      <p className="suave" style={{ fontSize: '.88rem' }}>
        {todas ? 'Todas as propriedades' : propriedade.nome} · {dataBR(de)} a {dataBR(ate)}
      </p>
      {!lista && <p className="suave">Calculando…</p>}
      {lista && lista.length === 0 && <p className="suave">Nenhuma movimentação no período.</p>}
      {lista && GRUPOS.map(g => {
        const ms = lista.filter(m => g.codigos.includes(m.ocorrencia));
        if (!ms.length) return null;
        const porCat = new Map<number, Soma>();
        const porQuem = new Map<string, Soma>();
        const total = nova();
        for (const m of ms) {
          if (!porCat.has(m.categoria_id)) porCat.set(m.categoria_id, nova());
          somar(porCat.get(m.categoria_id)!, m); somar(total, m);
          if (g.por) {
            const k = g.por === 'causa' ? nomeCausa(m.causa_morte_id) : nomeCp(m.contraparte_id);
            if (!porQuem.has(k)) porQuem.set(k, nova());
            somar(porQuem.get(k)!, m);
          }
        }
        const linhas = [...porCat.entries()].sort((a, b) =>
          (cat(a[0])?.especie_id ?? 0) - (cat(b[0])?.especie_id ?? 0) || (cat(a[0])?.ordem ?? 0) - (cat(b[0])?.ordem ?? 0));
        const colunas = (s: Soma) => (
          <>
            <td>{int(s.cab)}</td>
            {g.valor && <>
              <td>{s.kg ? int(s.kg) : '–'}</td>
              <td>{s.kg && s.cab ? dec(s.kg / s.cab, 0) : '–'}</td>
              <td>{s.valor ? reais(s.valor) : '–'}</td>
              <td>{s.valor && s.kgComValor ? reais(s.valor / s.kgComValor) : '–'}</td>
              <td>{s.valor && s.cab ? reais(s.valor / s.cab) : '–'}</td>
            </>}
          </>
        );
        const cabecalho = (primeira: string) => (
          <tr><th>{primeira}</th><th>Cabeças</th>{g.valor && <><th>kg</th><th>kg/cab</th><th>Valor</th><th>R$/kg</th><th>R$/cab</th></>}</tr>
        );
        return (
          <section key={g.titulo}>
            <h2>{g.titulo} <span className="suave" style={{ fontWeight: 400 }}>· {int(total.cab)} cab.{g.valor && total.valor ? ` · ${reais(total.valor)}` : ''}</span></h2>
            <div className="rolagem">
              <table>
                <thead>{cabecalho('Categoria')}</thead>
                <tbody>
                  {linhas.map(([cid, s]) => <tr key={cid}><td>{cat(cid)?.nome}</td>{colunas(s)}</tr>)}
                  {linhas.length > 1 && <tr className="total"><td>Total</td>{colunas(total)}</tr>}
                </tbody>
              </table>
            </div>
            {g.por && porQuem.size > 0 && (
              <div className="rolagem" style={{ marginTop: 8 }}>
                <table>
                  <thead>{cabecalho(g.por === 'causa' ? 'Causa' : g.titulo === 'Compras' ? 'Vendedor' : 'Comprador')}</thead>
                  <tbody>
                    {[...porQuem.entries()].sort((a, b) => b[1].cab - a[1].cab).map(([k, s]) => <tr key={k}><td>{k}</td>{colunas(s)}</tr>)}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </Moldura>
  );
}
