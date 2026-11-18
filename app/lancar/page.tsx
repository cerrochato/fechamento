'use client';
import { useEffect, useMemo, useState } from 'react';
import Moldura from '@/components/Moldura';
import { useApp } from '@/lib/contexto';
import { hoje, potreiros as buscarPotreiros, salvarMovimentacao } from '@/lib/dados';
import { dec, int, reais } from '@/lib/formato';
import type { NovaMovimentacao, Potreiro } from '@/lib/tipos';

// "Troca de categoria" vira um botão só: gera a saída da categoria antiga e a entrada na nova.
const TROCA = 'TROCA';

export default function Lancar() {
  const { propriedade, cad, sessao, recarregarCadastros } = useApp();
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
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => { buscarPotreiros(propriedade.id).then(setPots); }, [propriedade.id]);

  const opcoes = useMemo(() => [
    ...cad.ocorrencias.filter(o => !o.codigo.startsWith('TCAT')),
    { codigo: TROCA, nome: 'Troca de categoria', sinal: 0 as const, exige_valor: false, exige_causa: false, ordem: 99 },
  ], [cad.ocorrencias]);
  const tipo = opcoes.find(o => o.codigo === oc);
  const cats = cad.categorias.filter(c => c.especie_id === especie && c.nome !== 'Outros');
  const catSel = cad.categorias.find(c => String(c.id) === categoria);

  // peso sugerido da categoria quando ainda não foi digitado
  useEffect(() => {
    if (tipo?.exige_valor && catSel?.peso_padrao_kg && !peso) setPeso(String(catSel.peso_padrao_kg));
  }, [categoria]); // eslint-disable-line react-hooks/exhaustive-deps

  const n = (s: string) => Number(s.replace(',', '.')) || 0;
  const quilos = n(qtd) * n(peso);
  const total = quilos * n(valorKg);

  const pronto = data && oc && categoria && n(qtd) > 0
    && (oc !== TROCA || (categoriaPara && categoriaPara !== categoria))
    && (!tipo?.exige_causa || causa);

  function limpar() {
    setQtd(''); setCausa(''); setPotreiro(''); setContraparte(''); setPeso(''); setValorKg(''); setObs('');
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
        peso_medio_kg: n(peso) || null, valor_kg: n(valorKg) || null,
        valor_total: tipo?.exige_valor && total ? Math.round(total * 100) / 100 : null,
        observacao: obs.trim() || null,
      };
      if (tipo?.exige_valor && contraparte.trim()) {
        const existente = cad.contrapartes.find(c => c.nome.toUpperCase() === contraparte.trim().toUpperCase());
        if (existente) base.contraparte_id = existente.id; else base.contraparte_nova = contraparte.trim();
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
      <h1>Novo lançamento</h1>
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
            <div className="linha">
              <div>
                <label htmlFor="peso">Peso médio (kg)</label>
                <input id="peso" inputMode="decimal" value={peso} onChange={e => setPeso(e.target.value)} placeholder="0" />
              </div>
              <div>
                <label htmlFor="vkg">Preço (R$/kg)</label>
                <input id="vkg" inputMode="decimal" value={valorKg} onChange={e => setValorKg(e.target.value)} placeholder="0,00" />
              </div>
            </div>
            {quilos > 0 && (
              <div className="aviso">
                {int(quilos)} kg no total{total > 0 && <> · <strong>{reais(total)}</strong> ({reais(total / n(qtd))} por cabeça)</>}
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
          {salvando ? 'Salvando…' : 'Salvar lançamento'}
        </button>
      </>}
    </Moldura>
  );
}
