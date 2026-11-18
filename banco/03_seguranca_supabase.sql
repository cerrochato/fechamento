-- =====================================================================
-- Regras de acesso (Row Level Security) para o Supabase
-- adm     : tudo, em todas as propriedades
-- gerente : tudo nas propriedades em que tem acesso
-- capataz : rebanho, contagens e uso de áreas nas propriedades dele; sem financeiro
-- No Supabase, auth.uid() devolve o id do usuário logado.
-- =====================================================================

-- Liga o usuário do login (auth.users) à tabela usuario
alter table usuario
    add constraint usuario_auth_fk foreign key (id) references auth.users(id) on delete cascade;

create or replace function eh_adm() returns boolean
language sql stable security definer set search_path = public as $$
    select coalesce((select adm from usuario where id = auth.uid() and ativo), false)
$$;

create or replace function papel_em(p_propriedade bigint) returns papel_acesso
language sql stable security definer set search_path = public as $$
    select a.papel from acesso_propriedade a
    join usuario u on u.id = a.usuario_id and u.ativo
    where a.usuario_id = auth.uid() and a.propriedade_id = p_propriedade
$$;

create or replace function pode_ver(p_propriedade bigint) returns boolean
language sql stable as $$ select eh_adm() or papel_em(p_propriedade) is not null $$;

create or replace function pode_ver_financeiro(p_propriedade bigint) returns boolean
language sql stable as $$ select eh_adm() or papel_em(p_propriedade) = 'gerente' $$;

-- Tabelas por propriedade, acessíveis a gerente e capataz
do $$
declare t text;
begin
  foreach t in array array['movimentacao_rebanho','contagem_campo']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all using (pode_ver(propriedade_id)) with check (pode_ver(propriedade_id))',
                   t || '_acesso', t);
  end loop;
end $$;

-- Tabelas só de gerente e adm
do $$
declare t text;
begin
  foreach t in array array['lancamento_financeiro','importacao','quadro_funcionarios','movimento_pessoal']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all using (pode_ver_financeiro(propriedade_id)) with check (pode_ver_financeiro(propriedade_id))',
                   t || '_acesso', t);
  end loop;
end $$;

-- Potreiros, estoque inicial e avaliação: todos da propriedade leem; gerente e adm alteram
do $$
declare t text;
begin
  foreach t in array array['potreiro','estoque_inicial','avaliacao_rebanho']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (pode_ver(propriedade_id))', t || '_leitura', t);
    execute format('create policy %I on %I for all using (pode_ver_financeiro(propriedade_id)) with check (pode_ver_financeiro(propriedade_id))',
                   t || '_gerente', t);
  end loop;
end $$;

alter table uso_area_mensal enable row level security;
create policy uso_area_acesso on uso_area_mensal for all
    using (pode_ver((select propriedade_id from potreiro where id = potreiro_id)))
    with check (pode_ver((select propriedade_id from potreiro where id = potreiro_id)));

alter table propriedade enable row level security;
create policy propriedade_leitura on propriedade for select using (pode_ver(id));
create policy propriedade_adm     on propriedade for all    using (eh_adm()) with check (eh_adm());

alter table usuario enable row level security;
create policy usuario_proprio on usuario for select using (id = auth.uid() or eh_adm());
create policy usuario_adm     on usuario for all    using (eh_adm()) with check (eh_adm());

alter table acesso_propriedade enable row level security;
create policy acesso_leitura on acesso_propriedade for select using (usuario_id = auth.uid() or eh_adm());
create policy acesso_adm     on acesso_propriedade for all    using (eh_adm()) with check (eh_adm());

-- Cadastros gerais: todos logados leem, só adm altera
do $$
declare t text;
begin
  foreach t in array array['safra','especie','categoria_animal','tipo_ocorrencia','causa_morte',
                           'contraparte','tipo_uso_area','conta_financeira']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select using (auth.uid() is not null)', t || '_leitura', t);
    execute format('create policy %I on %I for all using (eh_adm()) with check (eh_adm())', t || '_adm', t);
  end loop;
end $$;

-- Capataz pode cadastrar comprador/vendedor novo ao lançar uma venda
create policy contraparte_insercao on contraparte for insert with check (auth.uid() is not null);

-- As funções de relatório (02_views.sql) rodam com as permissões de quem chama,
-- então um capataz que chamar financeiro_periodo recebe zero linhas.
