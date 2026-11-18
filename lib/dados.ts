'use client';
// Camada de dados: todas as telas falam só com estas funções.
// Em produção usa o Supabase; com NEXT_PUBLIC_DEMO=1 usa dados de exemplo locais.
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  AudioContagem, StatusAudio, Cadastros, Categoria, Contagem, LinhaCarga, LinhaContagem, LinhaFechamento, StatusContagem, LinhaEfetivo, LinhaEstoque, Movimentacao, NovaMovimentacao,
  Papel, Potreiro, Propriedade, PotreiroCad, PropriedadeCad, UsuarioCad, NovoUsuario, Acesso,
} from './tipos';

export const DEMO = process.env.NEXT_PUBLIC_DEMO === '1';

let _sb: SupabaseClient | null = null;
export function supabase(): SupabaseClient {
  if (!_sb) {
    _sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
  }
  return _sb;
}

function ok<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------

export async function entrar(email: string, senha: string) {
  if (DEMO) return;
  const r = await supabase().auth.signInWithPassword({ email, password: senha });
  if (r.error) throw new Error(r.error.message === 'Invalid login credentials'
    ? 'E-mail ou senha incorretos.' : r.error.message);
}

export async function sair() {
  if (!DEMO) await supabase().auth.signOut();
}

export interface Sessao { usuarioId: string; nome: string; adm: boolean }

export async function sessaoAtual(): Promise<Sessao | null> {
  if (DEMO) return { usuarioId: 'demo', nome: 'Marcelo Linhares', adm: true };
  const { data } = await supabase().auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return null;
  const u = ok(await supabase().from('usuario').select('nome, adm').eq('id', uid).maybeSingle());
  if (!u) return { usuarioId: uid, nome: data.session!.user.email ?? '', adm: false };
  return { usuarioId: uid, nome: (u as { nome: string }).nome, adm: (u as { adm: boolean }).adm };
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export async function minhasPropriedades(s: Sessao): Promise<Propriedade[]> {
  if (DEMO) {
    let papel: Papel = 'adm';
    try { papel = (localStorage.getItem('demo_papel') as Papel) || 'adm'; } catch { /* ignora */ }
    return (await seed()).propriedade.map((p: { id: number; nome: string }) => ({ ...p, papel }));
  }
  const props = ok(await supabase().from('propriedade').select('id, nome').eq('ativa', true).order('nome')) as { id: number; nome: string }[];
  if (s.adm) return props.map(p => ({ ...p, papel: 'adm' as Papel }));
  const acessos = ok(await supabase().from('acesso_propriedade').select('propriedade_id, papel').eq('usuario_id', s.usuarioId)) as { propriedade_id: number; papel: Papel }[];
  return props.map(p => ({ ...p, papel: acessos.find(a => a.propriedade_id === p.id)?.papel ?? 'capataz' }));
}

export async function cadastros(): Promise<Cadastros> {
  if (DEMO) {
    const d = await seed();
    return { especies: d.especie, categorias: d.categoria_animal.filter((c: Categoria) => c.ativa),
      ocorrencias: d.tipo_ocorrencia, causas: d.causa_morte, contrapartes: d.contraparte };
  }
  const sb = supabase();
  const [especies, categorias, ocorrencias, causas, contrapartes] = await Promise.all([
    sb.from('especie').select('*').order('id'),
    sb.from('categoria_animal').select('*').eq('ativa', true).order('especie_id').order('ordem'),
    sb.from('tipo_ocorrencia').select('*').order('ordem'),
    sb.from('causa_morte').select('*').order('nome'),
    sb.from('contraparte').select('id, nome').order('nome'),
  ]);
  return { especies: ok(especies), categorias: ok(categorias), ocorrencias: ok(ocorrencias),
    causas: ok(causas), contrapartes: ok(contrapartes) };
}

export async function potreiros(propriedadeId: number): Promise<Potreiro[]> {
  if (DEMO) return (await seed()).potreiro.filter((p: Potreiro) => p.propriedade_id === propriedadeId && p.ativo);
  return ok(await supabase().from('potreiro').select('id, propriedade_id, codigo, area_util_ha, ativo')
    .eq('propriedade_id', propriedadeId).eq('ativo', true).order('codigo'));
}

export async function movimentacoes(propriedadeId: number, de: string, ate: string): Promise<Movimentacao[]> {
  if (DEMO) {
    return (await seed()).movimentacao_rebanho
      .filter((m: Movimentacao) => m.propriedade_id === propriedadeId && m.data >= de && m.data <= ate)
      .sort((a: Movimentacao, b: Movimentacao) => b.data.localeCompare(a.data) || b.id - a.id);
  }
  return ok(await supabase().from('movimentacao_rebanho').select('*')
    .eq('propriedade_id', propriedadeId).gte('data', de).lte('data', ate)
    .order('data', { ascending: false }).order('id', { ascending: false }));
}

export async function estoqueNaData(propriedadeId: number, data: string): Promise<LinhaEstoque[]> {
  if (DEMO) return demoEstoque(await seed(), propriedadeId, data);
  return ok(await supabase().rpc('estoque_na_data', { p_propriedade: propriedadeId, p_data: data }));
}

export async function efetivoPeriodo(propriedadeId: number, de: string, ate: string): Promise<LinhaEfetivo[]> {
  if (DEMO) return demoEfetivo(await seed(), propriedadeId, de, ate);
  return ok(await supabase().rpc('efetivo_periodo', { p_propriedade: propriedadeId, p_de: de, p_ate: ate }));
}

// ---------------------------------------------------------------------------
// Gravação
// ---------------------------------------------------------------------------

export async function salvarMovimentacao(m: NovaMovimentacao, s: Sessao): Promise<void> {
  const { contraparte_nova, ...linha } = m;
  if (DEMO) {
    const d = await seed();
    if (contraparte_nova) {
      const id = Math.max(0, ...d.contraparte.map((c: { id: number }) => c.id)) + 1;
      d.contraparte.push({ id, nome: contraparte_nova.toUpperCase() });
      linha.contraparte_id = id;
    }
    d.movimentacao_rebanho.push({ ...linha, id: Date.now(), origem: 'app' });
    guardarDemo();
    return;
  }
  const sb = supabase();
  if (contraparte_nova) {
    const c = ok(await sb.from('contraparte').insert({ nome: contraparte_nova.trim().toUpperCase() }).select('id').single()) as { id: number };
    linha.contraparte_id = c.id;
  }
  ok(await sb.from('movimentacao_rebanho').insert({ ...linha, origem: 'app', criado_por: s.usuarioId }));
}

export async function excluirMovimentacao(id: number): Promise<void> {
  if (DEMO) {
    const d = await seed();
    d.movimentacao_rebanho = d.movimentacao_rebanho.filter((m: Movimentacao) => m.id !== id);
    guardarDemo();
    return;
  }
  ok(await supabase().from('movimentacao_rebanho').delete().eq('id', id));
}

// ---------------------------------------------------------------------------
// Contagem de campo (capataz preenche, gerente confere e fecha)
// ---------------------------------------------------------------------------

export async function listarContagens(propriedadeId: number): Promise<Contagem[]> {
  if (DEMO) return (await seed()).contagem.filter((c: Contagem) => c.propriedade_id === propriedadeId)
    .sort((a: Contagem, b: Contagem) => b.data.localeCompare(a.data));
  return ok(await supabase().from('contagem').select('id, propriedade_id, data, status, observacao')
    .eq('propriedade_id', propriedadeId).order('data', { ascending: false }));
}

export async function buscarContagem(id: number): Promise<Contagem> {
  if (DEMO) return (await seed()).contagem.find((c: Contagem) => c.id === id);
  return ok(await supabase().from('contagem').select('id, propriedade_id, data, status, observacao').eq('id', id).single());
}

// Cria uma contagem nova. Se copiarDe vier, já traz as linhas da contagem anterior
// (mesmos potreiros e categorias) para o capataz só corrigir o que mudou.
export async function criarContagem(propriedadeId: number, data: string, s: Sessao, copiarDe?: number): Promise<number> {
  const anteriores = copiarDe ? await linhasContagem(copiarDe) : [];
  if (DEMO) {
    const d = await seed();
    const id = Math.max(0, ...d.contagem.map((c: Contagem) => c.id)) + 1;
    d.contagem.push({ id, propriedade_id: propriedadeId, data, status: 'rascunho', observacao: null });
    let lid = Math.max(0, ...d.contagem_campo.map((l: LinhaContagem) => l.id));
    for (const l of anteriores) d.contagem_campo.push({ ...l, id: ++lid, contagem_id: id });
    guardarDemo();
    return id;
  }
  const sb = supabase();
  const c = ok(await sb.from('contagem').insert({ propriedade_id: propriedadeId, data, criado_por: s.usuarioId }).select('id').single()) as { id: number };
  if (anteriores.length) {
    ok(await sb.from('contagem_campo').insert(anteriores.map(l => ({
      contagem_id: c.id, potreiro_id: l.potreiro_id, categoria_id: l.categoria_id,
      cabecas: l.cabecas, peso_medio_kg: l.peso_medio_kg, criado_por: s.usuarioId,
    }))));
  }
  return c.id;
}

export async function linhasContagem(contagemId: number): Promise<LinhaContagem[]> {
  if (DEMO) return (await seed()).contagem_campo.filter((l: LinhaContagem) => l.contagem_id === contagemId);
  return ok(await supabase().from('contagem_campo')
    .select('id, contagem_id, potreiro_id, categoria_id, cabecas, peso_medio_kg, observacao')
    .eq('contagem_id', contagemId).order('id'));
}

export async function salvarLinhaContagem(l: Omit<LinhaContagem, 'id'> & { id?: number }, s: Sessao): Promise<void> {
  if (DEMO) {
    const d = await seed();
    if (l.id) Object.assign(d.contagem_campo.find((x: LinhaContagem) => x.id === l.id), l);
    else d.contagem_campo.push({ ...l, id: Date.now() });
    guardarDemo();
    return;
  }
  const { id, ...dados } = l;
  if (id) ok(await supabase().from('contagem_campo').update(dados).eq('id', id));
  else ok(await supabase().from('contagem_campo').insert({ ...dados, criado_por: s.usuarioId }));
}

export async function excluirLinhaContagem(id: number): Promise<void> {
  if (DEMO) {
    const d = await seed();
    d.contagem_campo = d.contagem_campo.filter((l: LinhaContagem) => l.id !== id);
    guardarDemo();
    return;
  }
  ok(await supabase().from('contagem_campo').delete().eq('id', id));
}

export async function mudarStatusContagem(id: number, status: StatusContagem, s: Sessao, observacao?: string): Promise<void> {
  const extra: Record<string, unknown> = {};
  if (status === 'enviada') extra.enviada_em = new Date().toISOString();
  if (status === 'fechada') { extra.fechada_em = new Date().toISOString(); extra.fechada_por = s.usuarioId; }
  if (observacao !== undefined) extra.observacao = observacao || null;
  if (DEMO) {
    const c = (await seed()).contagem.find((x: Contagem) => x.id === id);
    c.status = status; if (observacao !== undefined) c.observacao = observacao || null;
    guardarDemo();
    return;
  }
  ok(await supabase().from('contagem').update({ status, ...extra }).eq('id', id));
}

export async function fechamentoContagem(id: number): Promise<LinhaFechamento[]> {
  if (DEMO) {
    const d = await seed();
    const c = d.contagem.find((x: Contagem) => x.id === id);
    const t = demoEstoque(d, c.propriedade_id, c.data);
    const ls = d.contagem_campo.filter((l: LinhaContagem) => l.contagem_id === id);
    return t.map(e => {
      const minhas = ls.filter((l: LinhaContagem) => l.categoria_id === e.categoria_id);
      const contado = minhas.reduce((s: number, l: LinhaContagem) => s + l.cabecas, 0);
      const quilos = minhas.reduce((s: number, l: LinhaContagem) => s + l.cabecas * Number(l.peso_medio_kg ?? 0), 0);
      return { categoria_id: e.categoria_id, especie_id: e.especie_id, categoria: e.categoria,
        teorico: e.cabecas, contado, diferenca: contado - e.cabecas, quilos, _tem: minhas.length > 0 };
    }).filter((x: LinhaFechamento & { _tem: boolean }) => x.teorico !== 0 || x._tem);
  }
  return ok(await supabase().rpc('fechamento_contagem', { p_contagem: id }));
}

export async function cargaContagem(id: number): Promise<LinhaCarga[]> {
  if (DEMO) {
    const d = await seed();
    const ls = d.contagem_campo.filter((l: LinhaContagem) => l.contagem_id === id);
    const grupos = new Map<number | null, LinhaContagem[]>();
    for (const l of ls) grupos.set(l.potreiro_id, [...(grupos.get(l.potreiro_id) ?? []), l]);
    return [...grupos.entries()].map(([pid, g]) => {
      const p = d.potreiro.find((x: Potreiro) => x.id === pid);
      const quilos = g.reduce((s, l) => s + l.cabecas * Number(l.peso_medio_kg ?? 0), 0);
      const area = p ? Number(p.area_util_ha) : null;
      return { potreiro_id: pid, potreiro: p?.codigo ?? 'Sem potreiro', area_util_ha: area,
        cabecas: g.reduce((s, l) => s + l.cabecas, 0), quilos,
        kg_ha: area ? Math.round(quilos / area * 10) / 10 : null,
        ua_ha: area ? Math.round(quilos / 450 / area * 100) / 100 : null };
    }).sort((a, b) => a.potreiro.localeCompare(b.potreiro, 'pt-BR', { numeric: true }));
  }
  return ok(await supabase().rpc('carga_contagem', { p_contagem: id }));
}

// ---------------------------------------------------------------------------
// Áudios da contagem (gravados no campo, transcritos no servidor)
// ---------------------------------------------------------------------------

// Áudios ainda não aplicados numa contagem
export async function audiosPendentes(propriedadeId: number): Promise<AudioContagem[]> {
  if (DEMO) return (await seed()).audio_contagem?.filter((a: AudioContagem) => a.propriedade_id === propriedadeId && a.status !== 'aplicado') ?? [];
  return ok(await supabase().from('audio_contagem').select('*')
    .eq('propriedade_id', propriedadeId).neq('status', 'aplicado').order('gravado_em'));
}

export async function urlAudio(arquivo: string): Promise<string | null> {
  if (DEMO) return null;
  const r = await supabase().storage.from('audios').createSignedUrl(arquivo, 3600);
  return r.data?.signedUrl ?? null;
}

export async function transcreverDeNovo(id: number): Promise<void> {
  if (DEMO) return;
  const r = await supabase().functions.invoke('transcrever', { body: { audio_id: id } });
  if (r.error) throw new Error(r.error.message);
}

export async function marcarAudio(id: number, status: StatusAudio, contagemId?: number): Promise<void> {
  if (DEMO) {
    const a = (await seed()).audio_contagem.find((x: AudioContagem) => x.id === id);
    a.status = status; if (contagemId) a.contagem_id = contagemId;
    guardarDemo();
    return;
  }
  ok(await supabase().from('audio_contagem').update({ status, ...(contagemId ? { contagem_id: contagemId } : {}) }).eq('id', id));
}

const FALA_EXEMPLO = 'Potreiro 21, 224 vaquilhonas de cria, 190 ovelhas de cria e 195 cordeiros. ' +
  'Potreiro 40 B, 15 touros de 2 anos. Potreiro umbu, 12 vacas velhas, 3 cavalos e 2 éguas.';

export async function demoAdicionarAudio(propriedadeId: number, gravadoEm: string, duracao: number) {
  const d = await seed();
  d.audio_contagem = d.audio_contagem ?? [];
  d.audio_contagem.push({ id: Date.now(), propriedade_id: propriedadeId, contagem_id: null, arquivo: 'demo.webm',
    gravado_em: gravadoEm, duracao_seg: duracao, status: 'transcrito', transcricao: FALA_EXEMPLO, erro: null });
  guardarDemo();
}

// ---------------------------------------------------------------------------
// Cadastros: propriedades, potreiros, categorias e usuários
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function proximoId(lista: any[]): number { return Math.max(0, ...lista.map(x => x.id)) + 1; }

export async function listarPotreirosCad(propriedadeId: number): Promise<PotreiroCad[]> {
  if (DEMO) return (await seed()).potreiro.filter((p: PotreiroCad) => p.propriedade_id === propriedadeId)
    .map((p: Record<string, unknown>) => ({ dominio: 'propria', area_total_ha: p.area_util_ha, ...p }));
  return ok(await supabase().from('potreiro').select('id, propriedade_id, codigo, dominio, area_total_ha, area_util_ha, ativo')
    .eq('propriedade_id', propriedadeId).order('codigo'));
}

export async function salvarPotreiro(p: PotreiroCad): Promise<void> {
  if (DEMO) {
    const d = await seed();
    if (p.id) Object.assign(d.potreiro.find((x: PotreiroCad) => x.id === p.id), p);
    else d.potreiro.push({ ...p, id: proximoId(d.potreiro) });
    guardarDemo(); return;
  }
  const { id, ...campos } = p;
  ok(id ? await supabase().from('potreiro').update(campos).eq('id', id) : await supabase().from('potreiro').insert(campos));
}

export async function listarCategoriasCad(): Promise<Categoria[]> {
  if (DEMO) return (await seed()).categoria_animal;
  return ok(await supabase().from('categoria_animal').select('*').order('especie_id').order('ordem'));
}

export async function salvarCategoria(c: Omit<Categoria, 'id'> & { id?: number }): Promise<void> {
  if (DEMO) {
    const d = await seed();
    if (c.id) Object.assign(d.categoria_animal.find((x: Categoria) => x.id === c.id), c);
    else d.categoria_animal.push({ ...c, id: proximoId(d.categoria_animal) });
    guardarDemo(); return;
  }
  const { id, ...campos } = c;
  ok(id ? await supabase().from('categoria_animal').update(campos).eq('id', id) : await supabase().from('categoria_animal').insert(campos));
}

export async function listarPropriedadesCad(): Promise<PropriedadeCad[]> {
  if (DEMO) return (await seed()).propriedade.map((p: Record<string, unknown>) =>
    ({ apelido: null, municipio: null, uf: null, valor_hectare: null, ativa: true, ...p }));
  return ok(await supabase().from('propriedade').select('id, nome, apelido, municipio, uf, valor_hectare, ativa').order('nome'));
}

export async function salvarPropriedade(p: PropriedadeCad): Promise<void> {
  if (DEMO) {
    const d = await seed();
    if (p.id) Object.assign(d.propriedade.find((x: PropriedadeCad) => x.id === p.id), p);
    else d.propriedade.push({ ...p, id: proximoId(d.propriedade) });
    guardarDemo(); return;
  }
  const { id, ...campos } = p;
  ok(id ? await supabase().from('propriedade').update(campos).eq('id', id) : await supabase().from('propriedade').insert(campos));
}

export async function listarUsuarios(): Promise<UsuarioCad[]> {
  if (DEMO) {
    const d = await seed();
    d.usuario = d.usuario ?? [
      { id: 'demo', nome: 'Marcelo Linhares', email: 'adm@exemplo.com', whatsapp: null, adm: true, ativo: true, acessos: [] },
      { id: 'demo-g', nome: 'Gerente (exemplo)', email: 'gerente@exemplo.com', whatsapp: '+5555999990001', adm: false, ativo: true,
        acessos: [{ propriedade_id: 1, papel: 'gerente' }] },
      { id: 'demo-c', nome: 'Capataz (exemplo)', email: 'capataz@exemplo.com', whatsapp: '+5555999990002', adm: false, ativo: true,
        acessos: [{ propriedade_id: 1, papel: 'capataz' }] },
    ];
    return d.usuario;
  }
  const sb = supabase();
  const [us, acs] = await Promise.all([
    sb.from('usuario').select('id, nome, email, whatsapp, adm, ativo').order('nome'),
    sb.from('acesso_propriedade').select('usuario_id, propriedade_id, papel'),
  ]);
  const acessos = ok(acs) as (Acesso & { usuario_id: string })[];
  return (ok(us) as Omit<UsuarioCad, 'acessos'>[]).map(u => ({
    ...u, acessos: acessos.filter(a => a.usuario_id === u.id).map(({ propriedade_id, papel }) => ({ propriedade_id, papel })),
  }));
}

// Salva nome, WhatsApp, adm, ativo e os acessos (substitui os acessos pelos informados)
export async function salvarUsuario(u: UsuarioCad): Promise<void> {
  if (DEMO) {
    const d = await seed();
    Object.assign(d.usuario.find((x: UsuarioCad) => x.id === u.id), u);
    guardarDemo(); return;
  }
  const sb = supabase();
  ok(await sb.from('usuario').update({ nome: u.nome, whatsapp: u.whatsapp || null, adm: u.adm, ativo: u.ativo }).eq('id', u.id));
  ok(await sb.from('acesso_propriedade').delete().eq('usuario_id', u.id));
  if (u.acessos.length) ok(await sb.from('acesso_propriedade').insert(u.acessos.map(a => ({ usuario_id: u.id, ...a }))));
}

// Cria login + cadastro (pela função "usuarios" no Supabase, que só aceita adm)
export async function criarUsuario(n: NovoUsuario): Promise<void> {
  if (DEMO) {
    const d = await seed(); await listarUsuarios();
    d.usuario.push({ id: 'demo-' + Date.now(), nome: n.nome, email: n.email, whatsapp: n.whatsapp, adm: n.adm, ativo: true, acessos: n.acessos });
    guardarDemo(); return;
  }
  const r = await supabase().functions.invoke('usuarios', { body: n });
  const erro = (r.data as { erro?: string } | null)?.erro;
  if (r.error || erro) {
    let msg = erro ?? r.error?.message ?? 'erro';
    try { msg = (await (r.error as unknown as { context: Response }).context.json()).erro ?? msg; } catch { /* ignora */ }
    throw new Error(msg);
  }
}

// ---------------------------------------------------------------------------
// Modo demonstração (mesmo cálculo das funções do banco, feito no navegador)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _seed: any = null;
async function seed() {
  if (!_seed) {
    try { const g = sessionStorage.getItem('demo_estado'); if (g) _seed = JSON.parse(g); } catch { /* ignora */ }
    if (!_seed) _seed = await (await fetch('/demo-seed.json')).json();
  }
  return _seed;
}
function guardarDemo() {
  try { sessionStorage.setItem('demo_estado', JSON.stringify(_seed)); } catch { /* ignora */ }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function demoEstoque(d: any, prop: number, data: string): LinhaEstoque[] {
  // último estoque inicial antes da data (mesma regra da função do banco)
  const safra = d.safra
    .filter((s: { id: number; inicio: string }) => diaAnterior(s.inicio) <= data &&
      d.estoque_inicial.some((e: { safra_id: number; propriedade_id: number }) => e.safra_id === s.id && e.propriedade_id === prop))
    .sort((a: { inicio: string }, b: { inicio: string }) => b.inicio.localeCompare(a.inicio))[0];
  const sinal: Record<string, number> = Object.fromEntries(d.tipo_ocorrencia.map((t: { codigo: string; sinal: number }) => [t.codigo, t.sinal]));
  return d.categoria_animal.map((c: Categoria) => {
    const ini = safra ? (d.estoque_inicial.find((e: { safra_id: number; categoria_id: number; propriedade_id: number }) =>
      e.safra_id === safra.id && e.categoria_id === c.id && e.propriedade_id === prop)?.cabecas ?? 0) : 0;
    const mov = safra ? d.movimentacao_rebanho
      .filter((m: Movimentacao) => m.propriedade_id === prop && m.categoria_id === c.id && m.data >= safra.inicio && m.data <= data)
      .reduce((s: number, m: Movimentacao) => s + m.quantidade * sinal[m.ocorrencia], 0) : 0;
    return { categoria_id: c.id, especie_id: c.especie_id, categoria: c.nome, cabecas: ini + mov, peso_padrao_kg: c.peso_padrao_kg };
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function demoEfetivo(d: any, prop: number, de: string, ate: string): LinhaEfetivo[] {
  const ini = demoEstoque(d, prop, diaAnterior(de));
  const fim = demoEstoque(d, prop, ate);
  const campos: Record<string, keyof LinhaEfetivo> = {
    AQUISICAO: 'aquisicao', VENDA_INT_ENTRADA: 'venda_int_entrada', VENDA_INT_SAIDA: 'venda_int_saida',
    NASCIMENTO: 'nascimento', VENDA: 'venda', MORTE: 'morte', CONSUMO: 'consumo',
    TCAT_ENTRADA: 'tcat_entrada', TCAT_SAIDA: 'tcat_saida',
  };
  return d.categoria_animal.map((c: Categoria, i: number) => {
    const l: LinhaEfetivo = {
      especie: d.especie.find((e: { id: number }) => e.id === c.especie_id).nome, categoria: c.nome,
      estoque_inicial: ini[i].cabecas, aquisicao: 0, venda_int_entrada: 0, venda_int_saida: 0, nascimento: 0,
      venda: 0, morte: 0, consumo: 0, tcat_entrada: 0, tcat_saida: 0,
      estoque_final: fim[i].cabecas, quilos_final: fim[i].cabecas * (c.peso_padrao_kg ?? 0),
    };
    for (const m of d.movimentacao_rebanho as Movimentacao[]) {
      if (m.propriedade_id === prop && m.categoria_id === c.id && m.data >= de && m.data <= ate) {
        (l[campos[m.ocorrencia]] as number) += m.quantidade;
      }
    }
    return l;
  });
}

export function diaAnterior(iso: string): string {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function hoje(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Mesma data n meses antes (para os atalhos de período)
export function mesesAntes(iso: string, n: number): string {
  const d = new Date(iso + 'T12:00:00');
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

// Início da safra (1º de julho) que contém a data — uso interno
export function inicioSafra(iso: string): string {
  const [a, m] = iso.split('-').map(Number);
  return `${m >= 7 ? a : a - 1}-07-01`;
}
