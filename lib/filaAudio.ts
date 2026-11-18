'use client';
// Fila de áudios gravados no celular (IndexedDB). Funciona sem internet:
// o áudio fica guardado no aparelho até conseguir enviar.
import { DEMO, supabase } from './dados';

export interface AudioPendente {
  id: string;
  propriedadeId: number;
  gravadoEm: string;      // ISO
  duracaoSeg: number;
  mime: string;
  blob: Blob;
}

const BANCO = 'fechamento', LOJA = 'audios';

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(LOJA, { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}

async function op<T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await abrir();
  return new Promise((ok, erro) => {
    const req = f(db.transaction(LOJA, modo).objectStore(LOJA));
    req.onsuccess = () => ok(req.result as T);
    req.onerror = () => erro(req.error);
  });
}

export const guardarAudio = (a: AudioPendente) => op<void>('readwrite', s => s.put(a));
export const listarPendentes = () => op<AudioPendente[]>('readonly', s => s.getAll());
export const removerPendente = (id: string) => op<void>('readwrite', s => s.delete(id));

let enviando = false;

// Envia tudo o que estiver na fila. Devolve quantos foram enviados.
export async function enviarFila(aoProgredir?: (msg: string) => void): Promise<number> {
  if (enviando || (typeof navigator !== 'undefined' && !navigator.onLine)) return 0;
  enviando = true;
  let n = 0;
  try {
    const fila = await listarPendentes();
    for (const a of fila) {
      aoProgredir?.(`Enviando áudio ${n + 1} de ${fila.length}…`);
      if (DEMO) { await demoReceber(a); await removerPendente(a.id); n++; continue; }
      const sb = supabase();
      const ext = a.mime.includes('mp4') ? 'm4a' : a.mime.includes('ogg') ? 'ogg' : 'webm';
      const caminho = `${a.propriedadeId}/${a.id}.${ext}`;
      const up = await sb.storage.from('audios').upload(caminho, a.blob, { contentType: a.mime.split(';')[0], upsert: true });
      if (up.error) throw new Error(up.error.message);
      const ins = await sb.from('audio_contagem').insert({
        propriedade_id: a.propriedadeId, arquivo: caminho, gravado_em: a.gravadoEm, duracao_seg: Math.round(a.duracaoSeg),
      }).select('id').single();
      if (ins.error) throw new Error(ins.error.message);
      await removerPendente(a.id);   // já está seguro no servidor
      n++;
      aoProgredir?.(`Transcrevendo áudio ${n}…`);
      // se a transcrição falhar (ou ainda não estiver ligada), marca o áudio com erro para não ficar esperando
      const { transcreverDeNovo } = await import('./dados');
      await transcreverDeNovo(ins.data.id).catch(() => { /* o erro já ficou gravado no áudio */ });
    }
    aoProgredir?.('');
  } finally {
    enviando = false;
  }
  return n;
}

// Modo demonstração: finge que o servidor transcreveu
async function demoReceber(a: AudioPendente) {
  const { demoAdicionarAudio } = await import('./dados');
  await demoAdicionarAudio(a.propriedadeId, a.gravadoEm, Math.round(a.duracaoSeg));
}
