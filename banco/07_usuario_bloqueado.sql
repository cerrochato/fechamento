-- 07: usuário bloqueado (ativo = false) perde o acesso às propriedades na hora,
-- mesmo que continue com login. Rodar uma vez no SQL Editor do Supabase.
create or replace function papel_em(p_propriedade bigint) returns papel_acesso
language sql stable security definer set search_path = public as $$
    select a.papel from acesso_propriedade a
    join usuario u on u.id = a.usuario_id and u.ativo
    where a.usuario_id = auth.uid() and a.propriedade_id = p_propriedade
$$;
