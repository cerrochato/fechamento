-- =====================================================================
-- 12 - Financeiro visível só para o administrador
-- O gerente continua fechando contagens e editando potreiros, mas não vê
-- mais os lançamentos financeiros nem as importações do SW Rural.
-- Rodar uma vez no SQL Editor do Supabase.
-- =====================================================================
begin;

drop policy if exists lancamento_financeiro_acesso on lancamento_financeiro;
create policy lancamento_financeiro_acesso on lancamento_financeiro for all
    using (eh_adm()) with check (eh_adm());

drop policy if exists importacao_acesso on importacao;
create policy importacao_acesso on importacao for all
    using (eh_adm()) with check (eh_adm());

commit;
