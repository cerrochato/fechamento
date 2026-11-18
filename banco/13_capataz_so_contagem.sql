-- =====================================================================
-- 13 - Capataz só faz contagem
-- O capataz continua lendo o rebanho (a contagem usa), mas não lança
-- nem altera movimentações. Gerente e adm seguem como antes.
-- Rodar uma vez no SQL Editor do Supabase.
-- =====================================================================
begin;

drop policy if exists movimentacao_rebanho_acesso on movimentacao_rebanho;
create policy movimentacao_rebanho_leitura on movimentacao_rebanho for select
    using (pode_ver(propriedade_id));
create policy movimentacao_rebanho_gerente on movimentacao_rebanho for all
    using (pode_ver_financeiro(propriedade_id)) with check (pode_ver_financeiro(propriedade_id));

commit;
