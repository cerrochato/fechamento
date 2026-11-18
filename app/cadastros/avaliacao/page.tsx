'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import { useApp } from '@/lib/contexto';
import { hoje, listarAvaliacao, salvarAvaliacao, type ValorAvaliacao } from '@/lib/dados';
import { dataBR, dec } from '@/lib/formato';

const num = (t: string) => {
  const s = t.trim();
  if (!s) return null;
  const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) && n > 0 ? n : NaN;
};

export default function Avaliacao() {
  const { propriedade, cad, sessao } = useApp();
  const [lista, setLista] = useState<ValorAvaliacao[] | null>(null);
  const [desde, setDesde] = useState('');
  const [campos, setCampos] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = async (manter?: string) => {
    const l = await listarAvaliacao(propriedade.id);
    setLista(l);
    const datas = [...new Set(l.map(x => x.vigente_desde))].sort();
    escolher(manter ?? datas[datas.length - 1] ?? hoje(), l);
  };
  useEffect(() => { setMsg(''); carregar(); }, [propriedade.id]);   // eslint-disable-line react-hooks/exhaustive-deps

  const datas = useMemo(() => [...new Set((lista ?? []).map(x => x.vigente_desde))].sort(), [lista]);

  // valor que vale na data, vindo de uma data anterior (aparece em cinza no campo)
  const herdado = (cat: number, data: string, l = lista ?? []) => l.filter(x => x.categoria_id === cat && x.vigente_desde < data)
    .sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde))[0];

  function escolher(data: string, l = lista ?? []) {
    setDesde(data);
    setCampos(Object.fromEntries(l.filter(x => x.vigente_desde === data).map(x => [x.categoria_id, dec(x.valor_kg)])));
  }

  async function salvar() {
    const valores = new Map<number, number | null>();
    for (const c of cad.categorias) {
      const t = campos[c.id] ?? '';
      const v = num(t);
      if (Number.isNaN(v)) { setMsg(`Valor inválido em ${c.nome}: "${t}"`); return; }
      const antes = (lista ?? []).find(x => x.categoria_id === c.id && x.vigente_desde === desde);
      if (v !== (antes ? antes.valor_kg : null)) valores.set(c.id, v);
    }
    if (!valores.size) { setMsg('Nada mudou.'); return; }
    setSalvando(true);
    try {
      await salvarAvaliacao(propriedade.id, desde, valores, sessao);
      setMsg(`✓ ${valores.size} valor(es) salvos, valendo a partir de ${dataBR(desde)}.`);
      await carregar(desde);
    } catch (e) {
      setMsg('Não foi possível salvar: ' + (e instanceof Error ? e.message : String(e)));
    } finally { setSalvando(false); }
  }

  if (propriedade.papel === 'capataz') return <Moldura><p className="suave">A avaliação do rebanho é feita pelo gerente ou pelo administrador.</p></Moldura>;
  return (
    <Moldura>
      <Link href="/cadastros" className="suave">← Cadastros</Link>
      <h1 style={{ marginTop: 8 }}>Avaliação do rebanho</h1>
      <p className="suave" style={{ marginTop: -4 }}>
        R$/kg de cada categoria em {propriedade.nome}, usado na diferença de inventário e no patrimônio. Cada valor vale a partir da data
        escolhida até ser trocado por outro com data posterior. Os relatórios usam o valor que vale na data final do período.
      </p>

      <div className="cartao">
        <label htmlFor="desde">Valores que valem a partir de</label>
        <input id="desde" type="date" value={desde} onChange={e => e.target.value && escolher(e.target.value)} />
        {datas.length > 0 && (
          <div className="chips" style={{ marginTop: 10 }}>
            {datas.map(d => <button key={d} className={`chip ${d === desde ? 'sel' : ''}`} onClick={() => escolher(d)}>{dataBR(d)}</button>)}
            {!datas.includes(hoje()) && <button className={`chip ${desde === hoje() ? 'sel' : ''}`} onClick={() => escolher(hoje())}>＋ Nova a partir de hoje</button>}
          </div>
        )}
        {!datas.includes(desde) && desde && (
          <p className="suave" style={{ fontSize: '.88rem', marginBottom: 0 }}>
            Data nova. Os campos vazios continuam com o valor anterior (em cinza). Preencha só o que mudou.
          </p>
        )}
      </div>

      {!lista && <p className="suave">Carregando…</p>}
      {lista && cad.especies.map(e => {
        const cats = cad.categorias.filter(c => c.especie_id === e.id && c.ativa).sort((a, b) => a.ordem - b.ordem);
        if (!cats.length) return null;
        return (
          <section key={e.id}>
            <h2>{e.nome}</h2>
            <div className="rolagem">
              <table>
                <thead><tr><th>Categoria</th><th>R$/kg</th><th>Antes</th></tr></thead>
                <tbody>
                  {cats.map(c => {
                    const h = herdado(c.id, desde);
                    return (
                      <tr key={c.id}>
                        <td style={{ whiteSpace: 'normal' }}>{c.nome}</td>
                        <td style={{ width: 120 }}>
                          <input inputMode="decimal" aria-label={`R$/kg ${c.nome}`} value={campos[c.id] ?? ''} placeholder={h ? dec(h.valor_kg) : '–'}
                            onChange={ev => setCampos({ ...campos, [c.id]: ev.target.value })} style={{ textAlign: 'right', padding: '6px 8px' }} />
                        </td>
                        <td className="suave" style={{ fontSize: '.85rem' }}>{h ? `${dec(h.valor_kg)} desde ${dataBR(h.vigente_desde)}` : '–'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
      {msg && <p className={msg.startsWith('✓') ? 'aviso' : 'erro'}>{msg}</p>}
      <button className="botao" disabled={salvando || !desde} onClick={salvar}>{salvando ? 'Salvando…' : `Salvar valores a partir de ${desde ? dataBR(desde) : '…'}`}</button>
    </Moldura>
  );
}
