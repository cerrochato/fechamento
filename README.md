# Fechamento

App para o fechamento da estância: rebanho, contagem de campo (inclusive por áudio), efetivo por período e cadastros.
Várias propriedades e usuários com papéis (administrador, gerente, capataz).

- `app/`, `components/`, `lib/`: o app (Next.js), publicado na Vercel.
- `supabase/functions/`: funções do Supabase (`transcrever` para os áudios, `usuarios` para criar logins).
- `banco/`: estrutura do banco (sem dados).

Variáveis de ambiente (ver `.env.example`): `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
