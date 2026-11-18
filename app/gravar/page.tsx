'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Moldura from '@/components/Moldura';
import { useApp } from '@/lib/contexto';
import AudiosRecebidos from '@/components/AudiosRecebidos';
import { criarContagem, hoje, linhasContagem, listarContagens, potreiros } from '@/lib/dados';
import { dataBR } from '@/lib/formato';
import type { Potreiro } from '@/lib/tipos';
import { enviarFila, guardarAudio, listarPendentes, removerPendente, type AudioPendente } from '@/lib/filaAudio';

function tempo(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

export default function Gravar() {
  const { propriedade, sessao } = useApp();
  const [pots, setPots] = useState<Potreiro[]>([]);
  const [enviados, setEnviados] = useState(0);   // muda a cada envio, para recarregar os resultados
  const [lancado, setLancado] = useState<{ id: number; data: string } | null>(null);
  useEffect(() => { potreiros(propriedade.id).then(setPots).catch(() => {}); }, [propriedade.id]);

  // Contagem onde lançar o que foi entendido: a que está aberta, ou uma nova de hoje
  // (a partir da última, com os mesmos potreiros e categorias)
  async function alvo() {
    const lista = await listarContagens(propriedade.id);
    let c = lista.find(x => x.status === 'rascunho');
    if (!c) {
      const ultima = [...lista].sort((a, b) => b.data.localeCompare(a.data))[0];
      const id = await criarContagem(propriedade.id, hoje(), sessao, ultima?.id);
      c = { id, propriedade_id: propriedade.id, data: hoje(), status: 'rascunho', observacao: null };
    }
    setLancado({ id: c.id, data: c.data });
    return { id: c.id, linhas: await linhasContagem(c.id) };
  }
  const [gravando, setGravando] = useState(false);
  const [seg, setSeg] = useState(0);
  const [fila, setFila] = useState<AudioPendente[]>([]);
  const [online, setOnline] = useState(true);
  const [msg, setMsg] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const inicio = useRef(0);
  const relogio = useRef<ReturnType<typeof setInterval> | null>(null);

  const atualizarFila = useCallback(async () => setFila(await listarPendentes()), []);

  const enviar = useCallback(async () => {
    try {
      const n = await enviarFila(setMsg);
      if (n) { setMsg(''); setEnviados(x => x + 1); }
    } catch (e) {
      setMsg(''); setErro('Não consegui enviar agora: ' + (e as Error).message + '. Tento de novo quando o sinal melhorar.');
    }
    atualizarFila();
  }, [atualizarFila]);

  useEffect(() => {
    atualizarFila();
    setOnline(navigator.onLine);
    const on = () => { setOnline(true); enviar(); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    if (navigator.onLine) enviar();
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [atualizarFila, enviar]);

  async function comecar() {
    setErro(null); setMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipo = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) ?? '';
      const r = new MediaRecorder(stream, tipo ? { mimeType: tipo } : undefined);
      pedacos.current = [];
      r.ondataavailable = e => e.data.size && pedacos.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(pedacos.current, { type: r.mimeType });
        await guardarAudio({
          id: crypto.randomUUID(), propriedadeId: propriedade.id, gravadoEm: new Date().toISOString(),
          duracaoSeg: (Date.now() - inicio.current) / 1000, mime: r.mimeType, blob,
        });
        await atualizarFila();
        if (navigator.onLine) enviar(); else setMsg('Áudio guardado no celular. Envio quando tiver sinal.');
      };
      r.start(1000);
      rec.current = r;
      inicio.current = Date.now();
      setSeg(0); setGravando(true);
      relogio.current = setInterval(() => setSeg((Date.now() - inicio.current) / 1000), 250);
    } catch {
      setErro('Não consegui usar o microfone. Confira se o app tem permissão de microfone no celular.');
    }
  }

  function parar() {
    rec.current?.stop();
    if (relogio.current) clearInterval(relogio.current);
    setGravando(false);
  }

  return (
    <Moldura>
      <Link href="/contagem" className="suave">← Contagem</Link>
      <h1 style={{ marginTop: 8 }}>Gravar contagem</h1>
      <p className="suave" style={{ marginTop: -4 }}>
        Fale o potreiro e depois as categorias com as cabeças. Exemplo:<br />
        <em>“Potreiro 21: 224 vaquilhonas de cria, 190 ovelhas de cria. Potreiro 40 B: 15 touros de 2 anos.”</em>
      </p>

      <div style={{ display: 'grid', placeItems: 'center', margin: '28px 0 12px' }}>
        <button onClick={gravando ? parar : comecar} aria-label={gravando ? 'Parar gravação' : 'Começar gravação'}
          style={{
            width: 150, height: 150, borderRadius: '50%', border: 0, cursor: 'pointer',
            background: gravando ? 'var(--saida)' : 'var(--verde)', color: '#fff', fontSize: '1.1rem', fontWeight: 700,
            boxShadow: gravando ? '0 0 0 12px rgba(180,73,47,.18)' : '0 6px 18px rgba(0,0,0,.15)',
          }}>
          {gravando ? <>■<br />Parar</> : <>●<br />Gravar</>}
        </button>
        <div style={{ marginTop: 14, fontSize: '1.4rem', fontVariantNumeric: 'tabular-nums' }}>{gravando ? tempo(seg) : ' '}</div>
      </div>

      <div className="cartao">
        <div className="item">
          <div>
            <strong>{online ? 'Com sinal' : 'Sem sinal'}</strong><br />
            <small>{fila.length === 0 ? 'Nenhum áudio esperando envio.' : `${fila.length} áudio(s) guardado(s) no celular, esperando sinal.`}</small>
          </div>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: online ? 'var(--entrada)' : 'var(--alerta)' }} />
        </div>
        {fila.map(a => (
          <div key={a.id} className="item" style={{ marginTop: 8 }}>
            <small>{new Date(a.gravadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {tempo(a.duracaoSeg)}</small>
            <button className="excluir" onClick={async () => { await removerPendente(a.id); atualizarFila(); }}>Descartar</button>
          </div>
        ))}
        {online && fila.length > 0 && <button className="botao sec" onClick={enviar}>Enviar agora</button>}
      </div>
      {msg && <div className="aviso" role="status">{msg}</div>}
      {erro && <p className="erro">{erro}</p>}

      {online && (
        <>
          <h2>O que o app entendeu</h2>
          {lancado && (
            <Link href={`/contagem/ver?id=${lancado.id}`} className="aviso" style={{ display: 'block' }}>
              ✓ Lançado na contagem de {dataBR(lancado.data)}. Ver a contagem →
            </Link>
          )}
          <AudiosRecebidos alvo={alvo} pots={pots} colar={false} atualizar={enviados}
            aoAplicar={async () => {}}
            vazio={!lancado && <p className="suave">Depois de gravar, o resultado aparece aqui para você conferir e corrigir.</p>} />
        </>
      )}
      {!online && fila.length > 0 && (
        <p className="suave">Quando o sinal voltar, o resultado dos áudios aparece aqui para conferir.</p>
      )}
    </Moldura>
  );
}
