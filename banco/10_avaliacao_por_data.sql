-- 10: R$/kg de avaliação do rebanho por categoria, com data a partir da qual vale.
-- Substitui o valor fixo por safra (avaliacao_rebanho), que é copiado para cá.
-- Os relatórios usam, em cada data, o último valor com vigente_desde <= data.
-- Pode rodar mais de uma vez.
begin;

create table if not exists avaliacao_valor (
    propriedade_id  bigint not null references propriedade(id) on delete cascade,
    categoria_id    bigint not null references categoria_animal(id),
    vigente_desde   date   not null,
    valor_kg        numeric(10,2) not null,
    alterado_por    uuid references usuario(id),
    alterado_em     timestamptz not null default now(),
    primary key (propriedade_id, categoria_id, vigente_desde)
);

alter table avaliacao_valor enable row level security;
drop policy if exists avaliacao_valor_leitura on avaliacao_valor;
drop policy if exists avaliacao_valor_gerente on avaliacao_valor;
create policy avaliacao_valor_leitura on avaliacao_valor for select using (pode_ver(propriedade_id));
create policy avaliacao_valor_gerente on avaliacao_valor for all
    using (pode_ver_financeiro(propriedade_id)) with check (pode_ver_financeiro(propriedade_id));
grant select, insert, update, delete on avaliacao_valor to authenticated;

-- valores que vieram da planilha (aba R-DIFERENÇA DE INVENTÁRIO), valendo desde o início da safra
insert into avaliacao_valor (propriedade_id, categoria_id, vigente_desde, valor_kg)
select a.propriedade_id, a.categoria_id, s.inicio, a.valor_kg
from avaliacao_rebanho a join safra s on s.id = a.safra_id
where a.valor_kg is not null
on conflict do nothing;

commit;

select count(*) as valores_copiados from avaliacao_valor;
