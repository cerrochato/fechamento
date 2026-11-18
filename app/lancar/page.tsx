'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Moldura from '@/components/Moldura';
import { useApp } from '@/lib/contexto';
import { buscarMovimentacao, hoje, potreiros as buscarPotreiros, salvarMovimentacao } from '@/lib/dados';
import { dec, int, reais } from '@/lib/formato';
import type { NovaMovimentacao, Potreiro } from '@/lib/tipos';

// "Troca de categoria" vira um botão só: gera a saída da categoria antiga e a entrada na nova.
const TROCA = 'TROCA';

export default function Pagina() {
  return <Suspense fallback={null}><Lancar /></Suspense>;
}

function Lancar() {
  const { propriedade, cad, sessao, recarregarCadastros } = useApp();
  const editarId = Number(useSearchParams().get('editar')) || null;
  const router = useRouter();
  const [pots, setPots] = useState<Potreiro[]>([]);
  const [data, setData] = useState(hoje());
  const [oc, setOc] = useState<string>('');
  const [especie, setEspecie] = useState<number>(1);
  const [categoria, setCategoria] = useState<string>('');
  const [categoriaPara, setCategoriaPara] = useState<string>('');
  const [qtd, setQtd] = useState('');
  const [causa, setCausa] = useState('');
  const [potreiro, setPotreiro] = useState('');
  const [contraparte, setContraparte] = useState('');
  const [peso, setPeso] = useState('');
  const [valorKg, setValorKg] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [porTotal, setPorTotal] = useState(false);      // digita o valor total da venda e o app calcula o R$/kg
  const [pesoTotal, setPesoTotal] = useState(false);    // digita o peso total (romaneio) em vez do peso médio
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => { buscarPotreiros(propriedade.id).then(setPots); }, [propriedade.id]);

  const opcoes = useMemo(() => [
    ...cad.ocorrencias.filter(o => !o.codigo.startsWith('TCAT') || (editarId && o.codigo === oc)),
    ...(editarId ? [] : [{ codigo: TROCA, nome: 'Troca de categoria', sinal: 0 as const, exige_valor: false, exige_causa: false, ordem: 99 }]),
  ], [cad.ocorrencias, editarId, oc]);

  // editando: carrega o lançamento no formulário
  useEffect(() => {
    if (!editarId) return;
    buscarMovimentacao(editarId).then(m => {
      if (!m) return setMsg({ ok: false, texto: 'Lançamento não encontrado.' });
      const cat = cad.categorias.find(c => c.id === m.categoria_id);
      const br = (v: number | null) => v == null ? '' : String(v).replace('.', ',');
      setData(m.data); setOc(m.ocorrencia); if (cat) setEspecie(cat.especie_id); setCategoria(String(m.categoria_id));
      setQtd(String(m.quantidade)); setCausa(m.causa_morte_id ? String(m.causa_morte_id) : '');
      setPotreiro(m.potreiro_id ? String(m.potreiro_id) : '');
      setContraparte(cad.contrapartes.find(c => c.id === m.contraparte_id)?.nome ?? '');
      setPeso(br(m.peso_medio_kg)); setValorKg(br(m.valor_kg)); setObs(m.observacao ?? '');
      // abre com o valor total gravado, para não mudar centavos por arredondamento
      setPesoTotal(false); setPorTotal(m.valor_total != null);
      setValorTotal(m.valor_total != null ? Number(m.valor_total).toFixed(2).replace('.', ',') : '');
    });
  }, [editarId]); // eslint-disable-line react-hooks/exhaustive-deps
  const tipo = opcoes.find(o => o.codigo === oc);
  const cats = cad.categorias.filter(c => c.especie_id === especie && c.nome !== 'Outros');
  const catSel = cad.categorias.find(c => String(c.id) === categoria);

  // peso sugerido da categoria quando ainda não foi digitado
  useEffect(() => {
    if (tipo?.exige_valor && catSel?.peso_padrao_kg && !peso && !pesoTotal) setPeso(String(catSel.peso_padrao_kg));
  }, [categoria]); // eslint-disable-line react-hooks/exhaustive-deps

  // aceita "185.000,50", "185000,50" e "185000.50"
  const n = (s: string) => {
    const t = s.trim().replace(/[R$\s]/g, '');
    if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.')) || 0;
    // só ponto: "6.150" e "1.200.000" são milhar; "10.25" é decimal
    return Number(/^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t) || 0;
  };
  const quilos = pesoTotal ? n(peso) : n(qtd) * n(peso);
  const pesoMedio = pesoTotal ? (n(qtd) ? n(peso) / n(qtd) : 0) : n(peso);
  const total = porTotal ? n(valorTotal) : quilos * n(valorKg);
  const precoKg = porTotal ? (quilos ? total / quilos : 0) : n(valorKg);

  const pronto = data && oc && categoria && n(qtd) > 0
    && (oc !== TROCA || (categoriaPara && categoriaPara !== categoria))
    && (!tipo?.exige_causa || causa);

  function limpar() {
    setQtd(''); setCausa(''); setPotreiro(''); setContraparte(''); setPeso(''); setValorKg(''); setValorTotal(''); setObs('');
    setCategoria(''); setCategoriaPara('');
  }

  async function salvar() {
    if (!pronto) return;
    setSalvando(true); setMsg(null);
    try {
      const base: NovaMovimentacao = {
        propriedade_id: propriedade.id, data, categoria_id: Number(categoria), ocorrencia: oc,
        quantidade: Math.round(n(qtd)), causa_morte_id: causa ? Number(causa) : null,
        potreiro_id: potreiro ? Number(potreiro) : null, contraparte_id: null,
        peso_medio_kg: pesoMedio ? Math.round(pesoMedio * 100) / 100 : null,
        valor_kg: precoKg ? Math.round(precoKg * 10000) / 10000 : null,
        valor_total: tipo?.exige_valor && total ? Math.round(total * 100) / 100 : null,
        observacao: obs.trim() || null,
      };
      if (tipo?.exige_valor && contraparte.trim()) {
        const existente = cad.contrapartes.find(c => c.nome.toUpperCase() === contraparte.trim().toUpperCase());
        if (existente) base.contraparte_id = existente.id; else base.contraparte_nova = contraparte.trim();
      }
      if (editarId) {
        await salvarMovimentacao(base, sessao, editarId);
        if (base.contraparte_nova) await recarregarCadastros();
        router.push('/lancamentos');
        return;
      }
      if (oc === TROCA) {
        await salvarMovimentacao({ ...base, ocorrencia: 'TCAT_SAIDA' }, sessao);
        await salvarMovimentacao({ ...base, ocorrencia: 'TCAT_ENTRADA', categoria_id: Number(categoriaPara) }, sessao);
      } else {
        await salvarMovimentacao(base, sessao);
      }
      if (base.contraparte_nova) await recarregarCadastros();
      const nomeCat = catSel?.nome ?? '';
      setMsg({ ok: true, texto: `Salvo: ${tipo?.nome} de ${int(base.quantidade)} ${nomeCat}.` });
      limpar();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setMsg({ ok: false, texto: 'Não foi possível salvar: ' + (e as Error).message });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Moldura>
      <h1>{editarId ? 'Editar lançamento' : 'Novo lançamento'}</h1>
      {msg && <div className={`aviso ${msg.ok ? 'ok' : 'erro'}`} role="status">{msg.texto}</div>}

      <label>O que aconteceu?</label>
      <div className="chips">
        {opcoes.map(o => (
          <button key={o.codigo} type="button" className={`chip ${oc === o.codigo ? 'sel' : ''}`} onClick={() => setOc(o.codigo)}>
            {o.sinal !== 0 && <span className="s">{o.sinal === 1 ? '+' : '−'}</span>}{o.nome}
          </button>
        ))}
      </div>

      {oc && <>
        <div className="linha">
          <div>
            <label htmlFor="data">Data</label>
            <input id="data" type="date" value={data} max={hoje()} onChange={e => setData(e.target.value)} />
          </div>
          <div>
            <label htmlFor="qtd">Quantidade (cabeças)</label>
            <input id="qtd" inputMode="numeric" value={qtd} onChange={e => setQtd(e.target.value.replace(/\D/g, ''))} placeholder="0" />
          </div>
        </div>

        <label>Espécie</label>
        <div className="chips">
          {cad.especies.map(e => (
            <button key={e.id} type="button" className={`chip ${especie === e.id ? 'sel' : ''}`}
              onClick={() => { setEspecie(e.id); setCategoria(''); setCategoriaPara(''); }}>{e.nome}</button>
          ))}
        </div>

        <div className={oc === TROCA ? 'linha' : ''}>
          <div>
            <label htmlFor="cat">{oc === TROCA ? 'Sai da categoria' : 'Categoria'}</label>
            <select id="cat" value={categoria} onChange={e => setCategoria(e.target.value)}>
              <option value="">Escolha…</option>
              {cats.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          {oc === TROCA && (
            <div>
              <label htmlFor="cat2">Entra na categoria</label>
              <select id="cat2" value={categoriaPara} onChange={e => setCategoriaPara(e.target.value)}>
                <option value="">Escolha…</option>
                {cats.filter(c => String(c.id) !== categoria).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          )}
        </div>

        {tipo?.exige_causa && (
          <>
            <label htmlFor="causa">Causa da morte</label>
            <select id="causa" value={causa} onChange={e => setCausa(e.target.value)}>
              <option value="">Escolha…</option>
              {cad.causas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </>
        )}

        {tipo?.exige_valor && (
          <>
            <label htmlFor="cp">{oc.startsWith('VENDA') && !oc.endsWith('ENTRADA') ? 'Comprador' : 'Vendedor'}</label>
            <input id="cp" list="contrapartes" value={contraparte} onChange={e => setContraparte(e.target.value)} placeholder="Digite ou escolha" />
            <datalist id="contrapartes">{cad.contrapartes.map(c => <option key={c.id} value={c.nome} />)}</datalist>
            <div className="chips" style={{ marginTop: 12 }}>
              <button type="button" className={`chip ${!pesoTotal ? 'sel' : ''}`} onClick={() => { setPesoTotal(false); setPeso(''); }}>Peso médio</button>
              <button type="button" className={`chip ${pesoTotal ? 'sel' : ''}`} onClick={() => { setPesoTotal(true); setPeso(''); }}>Peso total</button>
              <span style={{ width: 8 }} />
              <button type="button" className={`chip ${!porTotal ? 'sel' : ''}`} onClick={() => setPorTotal(false)}>R$ por kg</button>
              <button type="button" className={`chip ${porTotal ? 'sel' : ''}`} onClick={() => setPorTotal(true)}>Valor total</button>
            </div>
            <div className="linha">
              <div>
                <label htmlFor="peso">{pesoTotal ? 'Peso total (kg)' : 'Peso médio (kg)'}</label>
                <input id="peso" inputMode="decimal" value={peso} onChange={e => setPeso(e.target.value)} placeholder="0" />
              </div>
              <div>
                {porTotal ? <>
                  <label htmlFor="vt">Valor total (R$)</label>
                  <input id="vt" inputMode="decimal" value={valorTotal} onChange={e => setValorTotal(e.target.value)} placeholder="0,00" />
                </> : <>
                  <label htmlFor="vkg">Preço (R$/kg)</label>
                  <input id="vkg" inputMode="decimal" value={valorKg} onChange={e => setValorKg(e.target.value)} placeholder="0,00" />
                </>}
              </div>
            </div>
            {quilos > 0 && (
              <div className="aviso">
                {int(quilos)} kg no total{pesoTotal && n(qtd) > 0 && <> · {dec(pesoMedio, 1)} kg por cabeça</>}
                {total > 0 && <> · <strong>{reais(total)}</strong> ({reais(total / (n(qtd) || 1))} por cabeça)</>}
                {porTotal && precoKg > 0 && <><br />Preço: <strong>{reais(precoKg)} por kg</strong></>}
              </div>
            )}
          </>
        )}

        <label htmlFor="pot">Potreiro {tipo?.exige_causa ? '' : '(opcional)'}</label>
        <select id="pot" value={potreiro} onChange={e => setPotreiro(e.target.value)}>
          <option value="">—</option>
          {pots.map(p => <option key={p.id} value={p.id}>{p.codigo} · {dec(p.area_util_ha, 1)} ha</option>)}
        </select>

        <label htmlFor="obs">Observação (opcional)</label>
        <textarea id="obs" value={obs} onChange={e => setObs(e.target.value)} />

        <button className="botao" disabled={!pronto || salvando} onClick={salvar}>
          {salvando ? 'Salvando…' : editarId ? 'Salvar alteração' : 'Salvar lançamento'}
        </button>
        {editarId && <button className="botao sec" style={{ marginTop: 10 }} onClick={() => router.push('/lancamentos')}>Cancelar</button>}
      </>}
    </Moldura>
  );
}
