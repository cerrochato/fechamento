'use client';
// Dentro da contagem: mostra os áudios já transcritos, o que o sistema entendeu,
// e deixa conferir/corrigir antes de jogar na contagem.
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/contexto';
import { audiosPendentes, marcarAudio, salvarLinhaContagem, transcreverDeNovo, urlAudio } from '@/lib/dados';
import { interpretarContagem, type Interpretado } from '@/lib/interpretarVoz';
import type { AudioContagem, LinhaContagem, Potreiro } from '@/lib/tipos';

// alvo: devolve a contagem onde lançar (na tela de gravação, cria uma se não houver aberta)
export type Alvo = () => Promise<{ id: number; linhas: LinhaContagem[] }>;

export default function AudiosRecebidos({ alvo, pots, aoAplicar, colar = true, atualizar = 0, vazio }: {
  alvo: Alvo; pots: Potreiro[]; aoAplicar: () => Promise<void>; colar?: boolean; atualizar?: number; vazio?: React.ReactNode;
}) {
  const { propriedade } = useApp();
  const [audios, setAudios] = useState<AudioContagem[]>([]);
  const [texto, setTexto] = useState('');
  const [colando, setColando] = useState(false);

  const carregar = () => audiosPendentes(propriedade.id).then(setAudios);
  useEffect(() => { carregar(); }, [propriedade.id, atualizar]); // eslint-disable-line react-hooks/exhaustive-deps
  // enquanto algum áudio está sendo transcrito, confere de novo a cada 4 segundos
  const esperando = audios.some(a => a.status === 'enviado');
  useEffect(() => {
    if (!esperando) return;
    const t = setInterval(carregar, 4000);
    return () => clearInterval(t);
  }, [esperando]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ marginTop: 16 }}>
      {audios.length === 0 && vazio}
      {audios.map(a => (
        <UmAudio key={a.id} audio={a} alvo={alvo} pots={pots}
          aoTerminar={async () => { await carregar(); await aoAplicar(); }} />
      ))}
      {!colar ? null : colando ? (
        <div className="cartao" style={{ marginTop: 10 }}>
          <strong>Texto da contagem</strong>
          <p className="suave" style={{ fontSize: '.88rem', margin: '4px 0 0' }}>Cole aqui um texto ou a transcrição de um áudio de WhatsApp.</p>
          <textarea value={texto} onChange={e => setTexto(e.target.value)} style={{ marginTop: 8 }}
            placeholder="Potreiro 21: 224 vaquilhonas de cria, 190 ovelhas de cria…" />
          {texto.trim() && <Conferir texto={texto} alvo={alvo} pots={pots}
            aoAplicar={async () => { setTexto(''); setColando(false); await aoAplicar(); }} />}
        </div>
      ) : (
        <button className="botao sec" onClick={() => setColando(true)}>Colar texto da contagem</button>
      )}
    </div>
  );
}

function UmAudio({ audio, alvo, pots, aoTerminar }: {
  audio: AudioContagem; alvo: Alvo; pots: Potreiro[]; aoTerminar: () => Promise<void>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [tentando, setTentando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  useEffect(() => { urlAudio(audio.arquivo).then(setUrl); }, [audio.arquivo]);
  const quando = new Date(audio.gravado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  // enviado há mais de 2 minutos e ainda sem texto: a transcrição não respondeu
  const parado = audio.status === 'enviado' && Date.now() - new Date(audio.criado_em ?? audio.gravado_em).getTime() > 120000;

  async function tentar() {
    setTentando(true); setAviso(null);
    try { await transcreverDeNovo(audio.id); } catch (e) { setAviso((e as Error).message); } finally { setTentando(false); await aoTerminar(); }
  }
  async function descartar() {
    if (!confirm('Descartar este áudio? Ele some da lista (o arquivo continua guardado).')) return;
    await marcarAudio(audio.id, 'aplicado'); await aoTerminar();
  }

  return (
    <div className="cartao" style={{ marginTop: 10, borderColor: 'var(--verde)' }}>
      <strong>🎙 Áudio de {quando}</strong>
      {url && <audio controls preload="metadata" src={url} style={{ width: '100%', marginTop: 8 }} />}
      {audio.status === 'enviado' && !parado && <p className="suave">⏳ O app está ouvindo o áudio, espere alguns segundos…</p>}
      {(audio.status === 'erro' || parado) && (
        <>
          <p className="erro">{audio.erro ?? aviso ?? 'A transcrição não respondeu.'}</p>
          <button className="botao sec" disabled={tentando} onClick={tentar}>{tentando ? 'Tentando…' : 'Tentar de novo'}</button>
        </>
      )}
      {aviso && audio.status !== 'erro' && <p className="erro">{aviso}</p>}
      {audio.status === 'transcrito' && audio.transcricao && (
        <>
          <p style={{ fontStyle: 'italic', margin: '8px 0' }}>“{audio.transcricao}”</p>
          <Conferir texto={audio.transcricao} alvo={alvo} pots={pots}
            aoAplicar={async cid => { await marcarAudio(audio.id, 'aplicado', cid); await aoTerminar(); }} />
        </>
      )}
      <button className="excluir" style={{ marginTop: 8 }} onClick={descartar}>Descartar áudio</button>
    </div>
  );
}

// Tabela do que o sistema entendeu, para conferir e corrigir
function Conferir({ texto, alvo, pots, aoAplicar }: {
  texto: string; alvo: Alvo; pots: Potreiro[]; aoAplicar: (contagemId: number) => Promise<void>;
}) {
  const { cad, sessao } = useApp();
  const [itens, setItens] = useState<(Interpretado & { usar: boolean })[]>([]);
  const [nao, setNao] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const r = interpretarContagem(texto,
      pots.map(p => ({ id: p.id, nome: p.codigo })),
      cad.categorias.filter(c => c.nome !== 'Outros').map(c => ({ id: c.id, nome: c.nome })));
    setItens(r.itens.map(i => ({ ...i, usar: true })));
    setNao(r.naoEntendido);
  }, [texto, pots, cad.categorias]);

  const muda = (k: number, campo: Partial<Interpretado & { usar: boolean }>) =>
    setItens(l => l.map((x, i) => i === k ? { ...x, ...campo } : x));

  async function aplicar() {
    setSalvando(true);
    try {
      const { id: contagemId, linhas } = await alvo();
      for (const i of itens.filter(x => x.usar && x.categoria_id && x.cabecas > 0)) {
        const existe = linhas.find(l => l.potreiro_id === i.potreiro_id && l.categoria_id === i.categoria_id);
        const cat = cad.categorias.find(c => c.id === i.categoria_id);
        await salvarLinhaContagem(existe
          ? { ...existe, cabecas: i.cabecas }
          : { contagem_id: contagemId, potreiro_id: i.potreiro_id, categoria_id: i.categoria_id!, cabecas: i.cabecas,
              peso_medio_kg: cat?.peso_padrao_kg ?? null, observacao: 'por áudio' }, sessao);
      }
      await aoAplicar(contagemId);
    } finally { setSalvando(false); }
  }

  if (!itens.length && !nao.length) return null;
  return (
    <>
      <div className="suave" style={{ fontSize: '.85rem', margin: '10px 0 4px' }}>O sistema entendeu:</div>
      {itens.map((i, k) => (
        <div key={k} style={{ display: 'grid', gridTemplateColumns: '24px 76px 1fr 64px', gap: 6, alignItems: 'center', marginTop: 6 }}>
          <input type="checkbox" checked={i.usar} onChange={e => muda(k, { usar: e.target.checked })}
            style={{ minHeight: 0, width: 20, height: 20 }} aria-label="Usar esta linha" />
          <select value={i.potreiro_id ?? ''} onChange={e => muda(k, { potreiro_id: e.target.value ? Number(e.target.value) : null })}
            aria-label="Potreiro" style={{ padding: 8 }}>
            <option value="">?</option>
            {pots.map(p => <option key={p.id} value={p.id}>{p.codigo}</option>)}
          </select>
          <select value={i.categoria_id ?? ''} onChange={e => muda(k, { categoria_id: Number(e.target.value) })}
            aria-label="Categoria" style={{ padding: 8 }}>
            {cad.categorias.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <input inputMode="numeric" value={i.cabecas} aria-label="Cabeças" style={{ padding: 8 }}
            onChange={e => muda(k, { cabecas: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
        </div>
      ))}
      {nao.length > 0 && (
        <p className="erro" style={{ fontSize: '.88rem' }}>
          Não entendi: {nao.map(t => `“${t}”`).join(', ')}. Ouça o áudio e lance essas à mão.
        </p>
      )}
      {itens.length > 0 && (
        <button className="botao" disabled={salvando} onClick={aplicar}>
          {salvando ? 'Lançando…' : `Lançar ${itens.filter(i => i.usar).length} linha(s) na contagem`}
        </button>
      )}
    </>
  );
}
