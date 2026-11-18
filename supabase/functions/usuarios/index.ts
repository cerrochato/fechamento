// Edge Function "usuarios": o administrador cria o login de uma pessoa nova
// (e-mail + senha provisória) e já define nome, WhatsApp e acesso às propriedades.
// Só funciona para quem é adm. Não precisa de segredo extra.
// Chamada pelo app: supabase.functions.invoke('usuarios', { body: { email, senha, nome, whatsapp, adm, acessos } })
import { createClient } from 'npm:@supabase/supabase-js@2.119.0';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    // 1) quem chamou é administrador?
    const quem = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    });
    const { data: eu } = await quem.auth.getUser();
    if (!eu.user) return json({ erro: 'Entre no app de novo.' }, 401);
    const { data: perfil } = await quem.from('usuario').select('adm, ativo').eq('id', eu.user.id).maybeSingle();
    if (!perfil?.adm || !perfil.ativo) return json({ erro: 'Só o administrador cria usuários.' }, 403);

    const { email, senha, nome, whatsapp, adm, acessos } = await req.json() as {
      email: string; senha: string; nome: string; whatsapp?: string | null; adm?: boolean;
      acessos?: { propriedade_id: number; papel: 'gerente' | 'capataz' }[];
    };
    if (!email || !nome) return json({ erro: 'Informe nome e e-mail.' }, 400);
    if (!senha || senha.length < 8) return json({ erro: 'A senha provisória precisa ter pelo menos 8 caracteres.' }, 400);

    // 2) cria o login (já confirmado) e o cadastro
    const svc = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: novo, error: e1 } = await svc.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (e1 || !novo.user) {
      const msg = e1?.message ?? '';
      return json({ erro: /already|registered|exists/i.test(msg) ? 'Já existe um login com esse e-mail.' : msg }, 400);
    }
    const id = novo.user.id;
    const { error: e2 } = await svc.from('usuario').insert({ id, nome, email, whatsapp: whatsapp || null, adm: !!adm });
    if (e2) { await svc.auth.admin.deleteUser(id); return json({ erro: e2.message }, 400); }
    if (acessos?.length) {
      const { error: e3 } = await svc.from('acesso_propriedade').insert(acessos.map((a) => ({ usuario_id: id, ...a })));
      if (e3) return json({ erro: 'Usuário criado, mas o acesso falhou: ' + e3.message }, 400);
    }
    return json({ id });
  } catch (e) {
    return json({ erro: (e as Error).message }, 500);
  }
});
