'use client';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Moldura from '@/components/Moldura';
import AudiosRecebidos from '@/components/AudiosRecebidos';
import { useApp } from '@/lib/contexto';
import {
  buscarContagem, cargaContagem, excluirLinhaContagem, fechamentoContagem, linhasContagem,
  mudarStatusContagem, potreiros as buscarPotreiros, salvarLinhaContagem,
} from '@/lib/dados';
import { dataBR, dec, int, STATUS } from '@/lib/formato';
import type { Contagem, LinhaCarga, LinhaContagem, LinhaFechamento, Potreiro } from '@/lib/tipos';

export default function Pagina() {
  return <Suspense fallback={null}><VerContagem /></Suspense>;
}

function VerContagem() {
  const id = Number(useSearchParams().get('id'));
  const { propriedade, cad, sessao } = useApp();
  const gerente = propriedade.papel !== 'capataz';
  const [c, setC] = useState<Contagem | null>(null);
  const [linhas, setLinhas] = useState<LinhaContagem[]>([]);
  const [pots, setPots] = useState<Potreiro[]>([]);
  const [aba, setAba] = useState<'lancar' | 'conferencia' | 'potreiros'>('lancar');
  const [fech, setFech] = useState<LinhaFechamento[] | null>(null);
  const [carga, setCarga] = useState<LinhaCarga[] | null>(null);
  const [obs, setObs] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [cc, ls] = await Promise.all([buscarContagem(id), linhasContagem(id)]);
    setC(cc); setLinhas(ls); setObs(cc?.observacao ?? '');
  }, [id]);
  useEffect(() => { carregar(); buscarPotreiros(propriedade.id).then(setPots); }, [carregar, propriedade.id]);

  // gerente abre direto na conferência quando a contagem já foi enviada
  useEffect(() => { if (c && gerente && c.status !== 'rascunho') setAba('conferencia'); }, [c?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (aba === 'conferencia') { setFech(null); fechamentoContagem(id).then(setFech); }
    if (aba === 'potreiros') { setCarga(null); cargaContagem(id).then(setCarga); }
  }, [aba, id, linhas]);

  if (!c) return <Moldura><p className="suave">Carregando…</p></Moldura>;

  const editavel = gerente ? true : c.status === 'rascunho';
  const totalCab = linhas.reduce((s, l) => s + l.cabecas, 0);

  async function status(novo: Contagem['status'], texto: string) {
    await mudarStatusContagem(id, novo, sessao, novo === 'fechada' ? obs : undefined);
    setMsg(texto);
    await carregar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <Moldura>
      <Link href="/contagem" className="suave">← Contagens</Link>
      <h1 style={{ marginTop: 8 }}>Contagem de {dataBR(c.data)}</h1>
      <p style={{ marginTop: -6 }}>
        <span style={{ color: STATUS[c.status].cor, fontWeight: 600 }}>{STATUS[c.status].nome}</span>
        <span className="suave"> · {int(totalCab)} cabeças em {new Set(linhas.map(l => l.potreiro_id)).size} potreiros</span>
      </p>
      {msg && <div className="aviso ok" role="status">{msg}</div>}

      {gerente && (
        <div className="chips" style={{ margin: '12px 0' }}>
          <button className={`chip ${aba === 'lancar' ? 'sel' : ''}`} onClick={() => setAba('lancar')}>Contagem</button>
          <button className={`chip ${aba === 'conferencia' ? 'sel' : ''}`} onClick={() => setAba('conferencia')}>Conferência</button>
          <button className={`chip ${aba === 'potreiros' ? 'sel' : ''}`} onClick={() => setAba('potreiros')}>Carga por potreiro</button>
        </div>
      )}

      {aba === 'lancar' && editavel && c.status !== 'fechada' && (
        <>
          <Link href="/gravar" className="botao sec" style={{ textAlign: 'center', marginTop: 0 }}>🎙 Gravar contagem por áudio</Link>
          <AudiosRecebidos alvo={async () => ({ id, linhas: await linhasContagem(id) })} pots={pots} aoAplicar={carregar} />
          <h2>Potreiros</h2>
        </>
      )}
      {aba === 'lancar' && (
        <Preenchimento linhas={linhas} pots={pots} editavel={editavel} contagemId={id} aoMudar={carregar} />
      )}

      {aba === 'conferencia' && <Conferencia linhas={fech} />}
      {aba === 'potreiros' && <Cargas linhas={carga} />}

      {/* ações */}
      {!gerente && c.status === 'rascunho' && (
        <button className="botao" disabled={!linhas.length}
          onClick={() => status('enviada', 'Contagem enviada para o gerente. Obrigado!')}>
          Terminei, enviar para o gerente
        </button>
      )}
      {!gerente && c.status !== 'rascunho' && (
        <p className="aviso">Esta contagem já foi enviada. Se precisar corrigir algo, fale com o gerente.</p>
      )}
      {gerente && c.status !== 'fechada' && (
        <div className="cartao" style={{ marginTop: 20 }}>
          <strong>Fechamento</strong>
          <label htmlFor="obs">Observação do fechamento (opcional)</label>
          <textarea id="obs" value={obs} onChange={e => setObs(e.target.value)}
            placeholder="Ex.: diferença de novilhos conferida no potreiro 42" />
          <button className="botao" onClick={() => status('fechada', 'Contagem fechada.')}>Fechar contagem</button>
          {c.status === 'enviada' && (
            <button className="botao sec" style={{ marginTop: 10 }}
              onClick={() => status('rascunho', 'Devolvida ao capataz para correção.')}>Devolver ao capataz</button>
          )}
        </div>
      )}
      {gerente && c.status === 'fechada' && (
        <button className="botao sec" onClick={() => status('enviada', 'Contagem reaberta.')}>Reabrir contagem</button>
      )}
    </Moldura>
  );

  // -----------------------------------------------------------------------
  function Conferencia({ linhas }: { linhas: LinhaFechamento[] | null }) {
    if (!linhas) return <p className="suave">Calculando…</p>;
    return (
      <>
        <p className="suave" style={{ fontSize: '.9rem' }}>
          Teórico = estoque pelos lançamentos em {dataBR(c!.data)}. Diferença = contado − teórico.
        </p>
        {cad.especies.map(e => {
          const ls = linhas.filter(l => l.especie_id === e.id);
          if (!ls.length) return null;
          const s = (k: 'teorico' | 'contado' | 'diferenca') => ls.reduce((a, l) => a + Number(l[k]), 0);
          return (
            <section key={e.id}>
              <h2>{e.nome}</h2>
              <div className="rolagem">
                <table>
                  <thead><tr><th>Categoria</th><th>Teórico</th><th>Contado</th><th>Diferença</th></tr></thead>
                  <tbody>
                    {ls.map(l => (
                      <tr key={l.categoria_id}>
                        <td>{l.categoria}</td><td>{int(Number(l.teorico))}</td><td>{int(Number(l.contado))}</td>
                        <td className={l.diferenca > 0 ? 'e' : l.diferenca < 0 ? 's' : ''}>
                          {l.diferenca > 0 ? '+' : ''}{l.diferenca ? int(Number(l.diferenca)) : '✓'}
                        </td>
                      </tr>
                    ))}
                    <tr className="total"><td>Total</td><td>{int(s('teorico'))}</td><td>{int(s('contado'))}</td>
                      <td>{s('diferenca') > 0 ? '+' : ''}{int(s('diferenca'))}</td></tr>
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </>
    );
  }

  function Cargas({ linhas }: { linhas: LinhaCarga[] | null }) {
    if (!linhas) return <p className="suave">Calculando…</p>;
    const area = linhas.reduce((a, l) => a + Number(l.area_util_ha ?? 0), 0);
    const kg = linhas.reduce((a, l) => a + Number(l.quilos), 0);
    return (
      <>
      <p className="suave" style={{ fontSize: '.9rem' }}>Total de {int(kg)} kg de peso vivo. 1 UA = 450 kg.</p>
      <div className="rolagem">
        <table>
          <thead><tr><th>Potreiro</th><th>Área ha</th><th>Cab.</th><th>kg/ha</th><th>UA/ha</th></tr></thead>
          <tbody>
            {linhas.map(l => (
              <tr key={String(l.potreiro_id)}>
                <td>{l.potreiro}</td><td>{l.area_util_ha ? dec(Number(l.area_util_ha), 1) : '·'}</td>
                <td>{int(Number(l.cabecas))}</td>
                <td>{l.kg_ha != null ? int(Number(l.kg_ha)) : '·'}</td><td>{l.ua_ha != null ? dec(Number(l.ua_ha)) : '·'}</td>
              </tr>
            ))}
            <tr className="total"><td>Total</td><td>{dec(area, 1)}</td>
              <td>{int(linhas.reduce((a, l) => a + Number(l.cabecas), 0))}</td>
              <td>{area ? int(kg / area) : '·'}</td><td>{area ? dec(kg / 450 / area) : '·'}</td></tr>
          </tbody>
        </table>
      </div>
      </>
    );
  }
}

// ---------------------------------------------------------------------------
// Preenchimento: uma caixa por potreiro, com as categorias e cabeças
// ---------------------------------------------------------------------------
function Preenchimento({ linhas, pots, editavel, contagemId, aoMudar }: {
  linhas: LinhaContagem[]; pots: Potreiro[]; editavel: boolean; contagemId: number; aoMudar: () => Promise<void>;
}) {
  const { cad, sessao } = useApp();
  const [novoPot, setNovoPot] = useState('');
  const [abertos, setAbertos] = useState<(number | null)[]>([]);

  const grupos = useMemo(() => {
    const ids = [...new Set([...linhas.map(l => l.potreiro_id), ...abertos])];
    const nome = (pid: number | null) => pots.find(p => p.id === pid)?.codigo ?? 'Sem potreiro';
    return ids.map(pid => ({ pid, nome: nome(pid), linhas: linhas.filter(l => l.potreiro_id === pid) }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }));
  }, [linhas, pots, abertos]);

  const catNome = (id: number) => cad.categorias.find(c => c.id === id)?.nome ?? '?';
  const n = (s: string) => Number(s.replace(',', '.')) || 0;

  async function atualizar(l: LinhaContagem, campo: 'cabecas' | 'peso_medio_kg', valor: string) {
    const v = campo === 'cabecas' ? Math.round(n(valor)) : (n(valor) || null);
    if (v === l[campo]) return;
    await salvarLinhaContagem({ ...l, [campo]: v }, sessao);
    await aoMudar();
  }

  async function adicionar(pid: number | null, categoriaId: number) {
    const c = cad.categorias.find(x => x.id === categoriaId);
    await salvarLinhaContagem({ contagem_id: contagemId, potreiro_id: pid, categoria_id: categoriaId,
      cabecas: 0, peso_medio_kg: c?.peso_padrao_kg ?? null, observacao: null }, sessao);
    await aoMudar();
  }

  return (
    <>
      {grupos.length === 0 && <p className="suave">Nenhum potreiro contado ainda. Escolha um potreiro abaixo para começar.</p>}
      <div className="lista">
        {grupos.map(g => {
          const pot = pots.find(p => p.id === g.pid);
          return (
            <div key={String(g.pid)} className="cartao">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong>Potreiro {g.nome}</strong>
                <span className="suave" style={{ fontSize: '.85rem' }}>
                  {pot ? `${dec(Number(pot.area_util_ha), 1)} ha · ` : ''}{int(g.linhas.reduce((s, l) => s + l.cabecas, 0))} cab.
                </span>
              </div>
              {g.linhas.length > 0 && (
                <div className="suave" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 24px', gap: 8, fontSize: '.8rem', marginTop: 8 }}>
                  <span>Cabeças</span><span>Peso médio (kg)</span><span />
                </div>
              )}
              {g.linhas.map(l => (
                <div key={l.id} style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--borda)' }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{catNome(l.categoria_id)}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 24px', gap: 8, alignItems: 'center' }}>
                    <input inputMode="numeric" aria-label="Cabeças" defaultValue={l.cabecas || ''} disabled={!editavel} placeholder="Cabeças"
                      onBlur={e => atualizar(l, 'cabecas', e.target.value)} />
                    <input inputMode="decimal" aria-label="Peso médio (kg)" defaultValue={l.peso_medio_kg ?? ''} disabled={!editavel} placeholder="Peso kg"
                      onBlur={e => atualizar(l, 'peso_medio_kg', e.target.value)} />
                    {editavel ? <button className="excluir" aria-label="Remover" title="Remover"
                      onClick={async () => { await excluirLinhaContagem(l.id); await aoMudar(); }}>✕</button> : <span />}
                  </div>
                </div>
              ))}
              {editavel && (
                <select style={{ marginTop: 10 }} value="" aria-label="Adicionar categoria"
                  onChange={e => e.target.value && adicionar(g.pid, Number(e.target.value))}>
                  <option value="">＋ Adicionar categoria neste potreiro…</option>
                  {cad.especies.map(es => (
                    <optgroup key={es.id} label={es.nome}>
                      {cad.categorias.filter(c => c.especie_id === es.id).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </optgroup>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      {editavel && (
        <>
          <label htmlFor="np">Adicionar potreiro</label>
          <select id="np" value={novoPot} onChange={e => {
            const v = e.target.value; setNovoPot('');
            if (v) setAbertos(a => [...a, v === 'sem' ? null : Number(v)]);
          }}>
            <option value="">Escolha um potreiro…</option>
            {pots.filter(p => !grupos.some(g => g.pid === p.id)).map(p => <option key={p.id} value={p.id}>{p.codigo}</option>)}
            <option value="sem">Sem potreiro definido</option>
          </select>
        </>
      )}
    </>
  );
}
