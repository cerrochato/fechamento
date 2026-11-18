'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Moldura from '@/components/Moldura';
import { useApp } from '@/lib/contexto';
import { buscarMovimentacao, hoje, nomesPropriedades, potreiros as buscarPotreiros, salvarMovimentacao } from '@/lib/dados';
import { dec, int, reais } from '@/lib/formato';
import type { NovaMovimentacao, Potreiro } from '@/lib/tipos';

// "Troca de categoria" vira um botão só: gera a saída da categoria antiga e a entrada na nova.
const TROCA = 'TROCA';

export default function Pagina() {
  return <Suspense fallback={null}><Lancar /></Suspense>;
}

function Lancar() {
  const { propriedade, cad, sessao, recarregarCadastros } = useApp();
  const sp = useSearchParams();
  const editarId = Number(sp.get('editar')) || null;
  // vindo da planilha da contagem: categoria, quantidade e data da diferença já preenchidas
  const dif = Number(sp.get('dif')) || 0;
  const voltar = sp.get('voltar');
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
  const [valorTotal, setValorTotal] = useState('');
  // compra e venda: digita o peso total (romaneio) e o valor total; o app calcula peso médio e R$/kg
  const [obs, setObs] = useState('');
  // venda interna: a outra propriedade do app ('' = alguém de fora do app)
  const [outraProp, setOutraProp] = useState('');
  const [outras, setOutras] = useState<{ id: number; nome: string }[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => { buscarPotreiros(propriedade.id).then(setPots); }, [propriedade.id]);
  useEffect(() => { nomesPropriedades().then(l => setOutras(l.filter(p => p.id !== propriedade.id))).catch(() => setOutras([])); }, [propriedade.id]);

  const opcoes = useMemo(() => [
    ...cad.ocorrencias.filter(o => !o.codigo.startsWith('TCAT') || (editarId && o.codigo === oc))
      .filter(o => !dif || o.sinal === Math.sign(dif)),   // diferença da contagem: só as ocorrências que explicam sobra (+) ou falta (−)
    ...(editarId ? [] : [{ codigo: TROCA, nome: 'Troca de categoria', sinal: 0 as const, exige_valor: false, exige_causa: false, ordem: 99 }]),
  ], [cad.ocorrencias, editarId, oc, dif]);

  useEffect(() => {
    if (!dif) return;
    const cat = cad.categorias.find(c => String(c.id) === sp.get('categoria'));
    if (cat) { setEspecie(cat.especie_id); setCategoria(String(cat.id)); }
    setQtd(sp.get('qtd') ?? ''); if (sp.get('data')) setData(sp.get('data')!);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // troca de categoria vinda de uma sobra (+): a categoria da diferença é a que RECEBE os animais
  useEffect(() => {
    if (dif > 0 && oc === TROCA && categoria && !categoriaPara) { setCategoriaPara(categoria); setCategoria(''); }
  }, [oc]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setOutraProp(m.propriedade_par_id ? String(m.propriedade_par_id) : '');
      setContraparte(cad.contrapartes.find(c => c.id === m.contraparte_id)?.nome ?? '');
      setPeso(m.peso_medio_kg ? br(Math.round(Number(m.peso_medio_kg) * m.quantidade * 100) / 100) : ''); setObs(m.observacao ?? '');
      setValorTotal(m.valor_total != null ? Number(m.valor_total).toFixed(2).replace('.', ',') : '');
    });
  }, [editarId]); // eslint-disable-line react-hooks/exhaustive-deps
  const tipo = opcoes.find(o => o.codigo === oc);
  const cats = cad.categorias.filter(c => c.especie_id === especie && c.nome !== 'Outros');
  const catSel = cad.categorias.find(c => String(c.id) === categoria);
  const interna = oc.startsWith('VENDA_INT_');
  const entrada = oc === 'VENDA_INT_ENTRADA';
  const nomeOutra = outras.find(p => String(p.id) === outraProp)?.nome;


  // aceita "185.000,50", "185000,50" e "185000.50"
  const n = (s: string) => {
    const t = s.trim().replace(/[R$\s]/g, '');
    if (t.includes(',')) return Number(t.replace(/\./g, '').replace(',', '.')) || 0;
    // só ponto: "6.150" e "1.200.000" são milhar; "10.25" é decimal
    return Number(/^\d{1,3}(\.\d{3})+$/.test(t) ? t.replace(/\./g, '') : t) || 0;
  };
  const quilos = n(peso);
  const pesoMedio = n(qtd) ? quilos / n(qtd) : 0;
  const total = n(valorTotal);
  const precoKg = quilos ? total / quilos : 0;

  const pronto = data && oc && categoria && n(qtd) > 0
    && (oc !== TROCA || (categoriaPara && categoriaPara !== categoria))
    && (!tipo?.exige_causa || causa);

  function limpar() {
    setQtd(''); setCausa(''); setPotreiro(''); setContraparte(''); setPeso(''); setValorTotal(''); setObs('');
    setCategoria(''); setCategoriaPara(''); setOutraProp('');
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
        propriedade_par_id: interna && outraProp ? Number(outraProp) : null,
      };
      if (tipo?.exige_valor && contraparte.trim() && !(interna && outraProp)) {
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
      if (voltar?.startsWith('/')) { router.push(voltar); return; }
      const nomeCat = catSel?.nome ?? '';
      setMsg({ ok: true, texto: `Salvo: ${tipo?.nome} de ${int(base.quantidade)} ${nomeCat}.` +
        (interna && nomeOutra ? ` A ${entrada ? 'saída' : 'entrada'} em ${nomeOutra} foi criada e espera o gerente de lá confirmar.` : '') });
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
      {dif !== 0 && (
        <div className="aviso" style={{ marginBottom: 8 }}>
          Diferença de <strong>{dif > 0 ? '+' : ''}{dif} {cad.categorias.find(c => String(c.id) === sp.get('categoria'))?.nome}</strong> na contagem.{' '}
          {dif > 0 ? 'Sobraram animais: foi nascimento, compra, troca de categoria (vieram de outra) ou entrada de outra propriedade?'
                   : 'Faltaram animais: foi morte, consumo, venda, troca de categoria (foram para outra) ou saída para outra propriedade?'}
          {voltar && <> <a href={voltar} style={{ textDecoration: 'underline' }}>Voltar sem lançar</a></>}
        </div>
      )}
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

        {interna && outras.length > 0 && (
          <>
            <label htmlFor="outra">{entrada ? 'Os animais vêm de' : 'Os animais vão para'}</label>
            <select id="outra" value={outraProp} disabled={!!editarId} onChange={e => setOutraProp(e.target.value)}>
              <option value="">Alguém de fora do app</option>
              {outras.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
            {outraProp && !editarId && (
              <p className="suave" style={{ fontSize: '.85rem', margin: '4px 0 0' }}>
                O app cria sozinho a {entrada ? 'saída' : 'entrada'} em {nomeOutra}. Lá ela fica a confirmar até o gerente escolher o potreiro. Não precisa lançar de novo na outra propriedade.
              </p>
            )}
          </>
        )}

        {tipo?.exige_valor && (
          <>
            {!(interna && outraProp) && <>
            <label htmlFor="cp">{oc.startsWith('VENDA') && !oc.endsWith('ENTRADA') ? 'Comprador' : 'Vendedor'}</label>
            <input id="cp" list="contrapartes" value={contraparte} onChange={e => setContraparte(e.target.value)} placeholder="Digite ou escolha" />
            <datalist id="contrapartes">{cad.contrapartes.map(c => <option key={c.id} value={c.nome} />)}</datalist>
            </>}
            <div className="linha">
              <div>
                <label htmlFor="peso">Peso total (kg)</label>
                <input id="peso" inputMode="decimal" value={peso} onChange={e => setPeso(e.target.value)} placeholder="0" />
              </div>
              <div>
                <label htmlFor="vt">Valor total (R$)</label>
                <input id="vt" inputMode="decimal" value={valorTotal} onChange={e => setValorTotal(e.target.value)} placeholder="0,00" />
              </div>
            </div>
            {quilos > 0 && (
              <div className="aviso">
                {n(qtd) > 0 && <>Peso médio: <strong>{dec(pesoMedio, 1)} kg</strong> por cabeça</>}
                {total > 0 && <><br />Preço: <strong>{reais(precoKg)} por kg</strong> · {reais(total / (n(qtd) || 1))} por cabeça</>}
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
