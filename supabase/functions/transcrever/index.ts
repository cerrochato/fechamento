// Edge Function "transcrever": pega um áudio da contagem no Storage, manda para o
// Whisper e grava o texto em audio_contagem.transcricao.
//
// Segredo necessário (Supabase > Edge Functions > Secrets), um dos dois:
//   GROQ_API_KEY   -> Whisper da Groq (gratuito com limite diário; usado se existir)
//   OPENAI_API_KEY -> Whisper da OpenAI (pago por minuto)
// Chamada pelo app: supabase.functions.invoke('transcrever', { body: { audio_id } })
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  let audio_id: number | null = null;
  try {
    ({ audio_id } = await req.json());
    const url = Deno.env.get('SUPABASE_URL')!;

    // 1) confere, com o login de quem chamou, se a pessoa pode ver esse áudio (regras de acesso)
    const usuario = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: audio, error } = await usuario.from('audio_contagem')
      .select('id, propriedade_id, arquivo').eq('id', audio_id).single();
    if (error || !audio) return json({ erro: 'Áudio não encontrado ou sem permissão.' }, 403);

    // 2) com a chave de serviço, baixa o arquivo e lê os cadastros para ajudar o reconhecimento
    const adm = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: arquivo, error: e2 } = await adm.storage.from('audios').download(audio.arquivo);
    if (e2 || !arquivo) throw new Error('Não consegui baixar o áudio: ' + e2?.message);

    const [{ data: pots }, { data: cats }] = await Promise.all([
      adm.from('potreiro').select('codigo').eq('propriedade_id', audio.propriedade_id).eq('ativo', true),
      adm.from('categoria_animal').select('nome').eq('ativa', true),
    ]);
    const dica = 'Contagem de gado e ovelhas por potreiro numa estância do RS. ' +
      'Potreiros: ' + (pots ?? []).map((p) => p.codigo).join(', ') + '. ' +
      'Categorias: ' + (cats ?? []).map((c) => c.nome).join(', ') + '. Escreva os números com algarismos.';

    // 3) transcreve
    const nome = audio.arquivo.split('/').pop()!;
    const form = new FormData();
    form.append('file', new File([arquivo], nome, { type: arquivo.type || 'audio/webm' }));
    const groq = Deno.env.get('GROQ_API_KEY');
    const servico = groq
      ? { url: 'https://api.groq.com/openai/v1/audio/transcriptions', chave: groq, modelo: 'whisper-large-v3-turbo', nome: 'Groq' }
      : { url: 'https://api.openai.com/v1/audio/transcriptions', chave: Deno.env.get('OPENAI_API_KEY'), modelo: 'whisper-1', nome: 'OpenAI' };
    if (!servico.chave) throw new Error('Falta configurar a chave de transcrição (GROQ_API_KEY ou OPENAI_API_KEY) no Supabase.');
    form.append('model', servico.modelo);
    form.append('language', 'pt');
    // a Groq aceita no máximo 896 caracteres (contando acentos como bytes); corta com folga
    let curta = dica;
    while (new TextEncoder().encode(curta).length > 850) curta = curta.slice(0, -10);
    form.append('prompt', curta);
    const r = await fetch(servico.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${servico.chave}` },
      body: form,
    });
    const resp = await r.json();
    if (!r.ok) throw new Error(resp?.error?.message ?? `${servico.nome} respondeu ${r.status}`);

    await adm.from('audio_contagem').update({ status: 'transcrito', transcricao: resp.text, erro: null }).eq('id', audio_id);
    return json({ texto: resp.text });
  } catch (e) {
    const msg = (e as Error).message;
    try {
      if (audio_id) {
        await createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
          .from('audio_contagem').update({ status: 'erro', erro: msg }).eq('id', audio_id);
      }
    } catch { /* ignora */ }
    return json({ erro: msg }, 500);
  }
});
