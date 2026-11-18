'use client';
// Grade para o gerente: categorias nas linhas, potreiros nas colunas, já com a contagem do capataz.
// Cada célula é editável; ao lado da categoria aparecem o total contado, o saldo teórico e a diferença.
import { useMemo, useState } from 'react';
import { useApp } from '@/lib/contexto';
import { excluirLinhaContagem, salvarLinhaContagem } from '@/lib/dados';
import { int } from '@/lib/formato';
import type { LinhaContagem, LinhaFechamento, Potreiro } from '@/lib/tipos';

export default function Planilha({ contagemId, linhas, pots, fech, editavel, aoMudar }: {
  contagemId: number; linhas: LinhaContagem[]; pots: Potreiro[]; fech: LinhaFechamento[] | null;
  editavel: boolean; aoMudar: () => Promise<void>;
}) {
  const { cad, sessao } = useApp();
  const [especie, setEspecie] = useState(cad.especies[0]?.id ?? 1);
  const [todasCats, setTodasCats] = useState(false);
  const [soComAnimais, setSoComAnimais] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);

  // cabeças por potreiro × categoria
  const grade = useMemo(() => {
    const g = new Map<string, LinhaContagem[]>();
    for (const l of linhas) { const k = `${l.potreiro_id ?? 0}|${l.categoria_id}`; g.set(k, [...(g.get(k) ?? []), l]); }
    return g;
  }, [linhas]);
  const valor = (pid: number | null, cid: number) => (grade.get(`${pid ?? 0}|${cid}`) ?? []).reduce((s, l) => s + l.cabecas, 0);

  const teorico = new Map((fech ?? []).map(f => [f.categoria_id, Number(f.teorico)]));
  const cats = cad.categorias.filter(c => c.especie_id === especie)
    .filter(c => todasCats || linhas.some(l => l.categoria_id === c.id) || (teorico.get(c.id) ?? 0) !== 0)
    .sort((a, b) => a.ordem - b.ordem);
  const semPotreiro = linhas.some(l => l.potreiro_id == null);
  const linhasPot: { id: number | null; nome: string }[] = [
    ...[...pots].sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric: true })).map(p => ({ id: p.id as number | null, nome: p.codigo })),
    ...(semPotreiro ? [{ id: null, nome: 'Sem potreiro' }] : []),
  ].filter(p => !soComAnimais || cats.some(c => valor(p.id, c.id) > 0));
  // potreiro sem animais desta espécie: escolha um para abrir uma coluna nova
  const [extra, setExtra] = useState<number[]>([]);
  const colunas = [...linhasPot, ...pots.filter(p => extra.includes(p.id) && !linhasPot.some(x => x.id === p.id)).map(p => ({ id: p.id as number | null, nome: p.codigo }))];

  async function gravar(pid: number | null, cid: number, texto: string) {
    const novo = Number(texto.replace(/\D/g, '')) || 0;
    const atuais = grade.get(`${pid ?? 0}|${cid}`) ?? [];
    if (novo === atuais.reduce((s, l) => s + l.cabecas, 0)) return;
    setSalvando(`${pid}|${cid}`);
    try {
      const [primeira, ...resto] = atuais;
      for (const l of resto) await excluirLinhaContagem(l.id);
      if (!novo) { if (primeira) await excluirLinhaContagem(primeira.id); }
      else if (primeira) await salvarLinhaContagem({ ...primeira, cabecas: novo }, sessao);
      else {
        const cat = cad.categorias.find(c => c.id === cid);
        await salvarLinhaContagem({ contagem_id: contagemId, potreiro_id: pid, categoria_id: cid, cabecas: novo,
          peso_medio_kg: cat?.peso_padrao_kg ?? null, observacao: null }, sessao);
      }
      await aoMudar();
    } finally { setSalvando(null); }
  }

  const totalContado = (cid: number) => linhas.filter(l => l.categoria_id === cid).reduce((s, l) => s + l.cabecas, 0);

  return (
    <>
      <div className="chips" style={{ marginBottom: 8 }}>
        {cad.especies.map(e => (
          <button key={e.id} className={`chip ${especie === e.id ? 'sel' : ''}`} onClick={() => setEspecie(e.id)}>{e.nome}</button>
        ))}
      </div>
      <div className="chips" style={{ marginBottom: 10, fontSize: '.85rem' }}>
        <button className={`chip ${soComAnimais ? 'sel' : ''}`} onClick={() => setSoComAnimais(v => !v)}>Só potreiros com animais</button>
        <button className={`chip ${todasCats ? 'sel' : ''}`} onClick={() => setTodasCats(v => !v)}>Todas as categorias</button>
      </div>
      {editavel && soComAnimais && (
        <select value="" onChange={e => e.target.value && setExtra(x => [...x, Number(e.target.value)])} style={{ marginBottom: 10 }}
          aria-label="Adicionar potreiro">
          <option value="">＋ Adicionar coluna de potreiro…</option>
          {pots.filter(p => !colunas.some(x => x.id === p.id)).map(p => <option key={p.id} value={p.id}>{p.codigo}</option>)}
        </select>
      )}
      {cats.length === 0 ? <p className="suave">Nenhuma categoria com animais nesta espécie.</p> : (
        <div className="rolagem" style={{ maxHeight: '75vh', overflow: 'auto' }}>
          <table className="planilha">
            <thead>
              <tr>
                <th style={{ position: 'sticky', top: 0, zIndex: 3 }}>Categoria</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--verde-claro)' }}>Contado</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--verde-claro)', whiteSpace: 'normal' }}>Saldo teórico</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--verde-claro)' }}>Diferença</th>
                {colunas.map(p => <th key={p.id ?? 'sem'} style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--cartao)', whiteSpace: 'normal', minWidth: 64 }}>{p.nome}</th>)}
              </tr>
            </thead>
            <tbody>
              {cats.map(c => {
                const cont = totalContado(c.id), teo = teorico.get(c.id) ?? 0, d = cont - teo;
                return (
                  <tr key={c.id}>
                    <td>{c.nome}</td>
                    <td style={{ fontWeight: 700, background: 'var(--verde-claro)' }}>{int(cont)}</td>
                    <td style={{ background: 'var(--verde-claro)' }}>{fech ? int(teo) : '…'}</td>
                    <td className={d > 0 ? 'e' : d < 0 ? 's' : ''} style={{ fontWeight: 700, background: 'var(--verde-claro)' }}>{!fech ? '…' : d === 0 ? '✓' : (d > 0 ? '+' : '') + int(d)}</td>
                    {colunas.map(p => {
                      const v = valor(p.id, c.id), k = `${p.id}|${c.id}`;
                      return (
                        <td key={p.id ?? 'sem'} style={{ padding: 2 }}>
                          {editavel ? (
                            <input key={`${k}-${v}`} defaultValue={v || ''} inputMode="numeric" aria-label={`${c.nome} no potreiro ${p.nome}`}
                              onBlur={e => gravar(p.id, c.id, e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                              style={{ width: 58, minHeight: 0, padding: '6px 6px', textAlign: 'right', opacity: salvando === k ? .5 : 1,
                                background: v ? undefined : 'transparent' }} />
                          ) : (v ? int(v) : '')}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {(() => {
                const soma = (f: (cid: number) => number) => cats.reduce((s, c) => s + f(c.id), 0);
                const cont = soma(totalContado), teo = soma(cid => teorico.get(cid) ?? 0);
                return (
                  <tr className="total">
                    <td>Total</td>
                    <td>{int(cont)}</td><td>{fech ? int(teo) : '…'}</td>
                    <td className={cont - teo > 0 ? 'e' : cont - teo < 0 ? 's' : ''}>{fech ? (cont - teo === 0 ? '✓' : (cont - teo > 0 ? '+' : '') + int(cont - teo)) : '…'}</td>
                    {colunas.map(p => <td key={p.id ?? 'sem'}>{int(cats.reduce((s, c) => s + valor(p.id, c.id), 0))}</td>)}
                  </tr>
                );
              })()}
            </tfoot>
          </table>
        </div>
      )}
      {editavel && <p className="suave" style={{ fontSize: '.85rem' }}>Digite o número e saia da célula (ou Enter) para gravar. Célula vazia ou 0 apaga.</p>}
    </>
  );
}
