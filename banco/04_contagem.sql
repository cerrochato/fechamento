-- =====================================================================
-- 04 - Contagem de campo com fluxo capataz -> gerente
-- Rodar no SQL Editor do Supabase depois da instalação (pode rodar uma vez só).
--
-- rascunho : capataz está preenchendo (pode editar)
-- enviada  : capataz terminou e mandou para o gerente (capataz não edita mais)
-- fechada  : gerente conferiu e fechou (só gerente/adm reabre)
-- =====================================================================
begin;

create type status_contagem as enum ('rascunho', 'enviada', 'fechada');

create table contagem (
    id              bigint generated always as identity primary key,
    propriedade_id  bigint not null references propriedade(id) on delete cascade,
    data            date   not null,                       -- dia em que a contagem foi feita
    status          status_contagem not null default 'rascunho',
    observacao      text,                                  -- comentário do gerente no fechamento
    criado_por      uuid references usuario(id),
    criado_em       timestamptz not null default now(),
    enviada_em      timestamptz,
    fechada_por     uuid references usuario(id),
    fechada_em      timestamptz
);
create index on contagem (propriedade_id, data);

alter table contagem_campo add column contagem_id bigint references contagem(id) on delete cascade;

-- As contagens importadas da planilha viram contagens já fechadas, uma por mês
insert into contagem (propriedade_id, data, status, fechada_em, observacao)
select distinct propriedade_id, (mes + interval '1 month - 1 day')::date, 'fechada'::status_contagem, now(), 'Importada da planilha (aba cargas)'
from contagem_campo;

update contagem_campo cc set contagem_id = c.id
from contagem c
where c.propriedade_id = cc.propriedade_id
  and c.data = (cc.mes + interval '1 month - 1 day')::date
  and cc.contagem_id is null;

alter table contagem_campo alter column contagem_id set not null;
create index on contagem_campo (contagem_id);

-- O mês da linha acompanha a data da contagem
create or replace function contagem_campo_mes() returns trigger language plpgsql as $$
begin
    select date_trunc('month', c.data)::date, c.propriedade_id
      into new.mes, new.propriedade_id
    from contagem c where c.id = new.contagem_id;
    return new;
end $$;
create trigger contagem_campo_mes before insert or update on contagem_campo
for each row execute function contagem_campo_mes();

-- ---------------------------------------------------------------------
-- Cálculos do fechamento
-- ---------------------------------------------------------------------

-- Teórico (lançamentos) x contado, por categoria, na data da contagem
create or replace function fechamento_contagem(p_contagem bigint)
returns table (categoria_id bigint, especie_id smallint, categoria text,
               teorico bigint, contado bigint, diferenca bigint, quilos numeric)
language sql stable as $$
    with c as (select * from contagem where id = p_contagem),
         t as (select e.* from c, estoque_na_data(c.propriedade_id, c.data) e),
         k as (select categoria_id, sum(cabecas) as cabecas,
                      sum(cabecas * coalesce(peso_medio_kg, 0)) as quilos
               from contagem_campo where contagem_id = p_contagem group by 1)
    select t.categoria_id, t.especie_id, t.categoria, t.cabecas,
           coalesce(k.cabecas, 0)::bigint,
           (coalesce(k.cabecas, 0) - t.cabecas)::bigint,
           coalesce(k.quilos, 0)
    from t left join k on k.categoria_id = t.categoria_id
    where t.cabecas <> 0 or k.cabecas is not null
$$;

-- Carga por potreiro (aba "cargas"): cabeças, quilos, kg PV/ha e UA/ha (1 UA = 450 kg)
create or replace function carga_contagem(p_contagem bigint)
returns table (potreiro_id bigint, potreiro text, area_util_ha numeric,
               cabecas bigint, quilos numeric, kg_ha numeric, ua_ha numeric)
language sql stable as $$
    select p.id, coalesce(p.codigo, 'Sem potreiro'), p.area_util_ha,
           sum(cc.cabecas)::bigint,
           sum(cc.cabecas * coalesce(cc.peso_medio_kg, 0)),
           round(sum(cc.cabecas * coalesce(cc.peso_medio_kg, 0)) / nullif(p.area_util_ha, 0), 1),
           round(sum(cc.cabecas * coalesce(cc.peso_medio_kg, 0)) / 450 / nullif(p.area_util_ha, 0), 2)
    from contagem_campo cc
    left join potreiro p on p.id = cc.potreiro_id
    where cc.contagem_id = p_contagem
    group by p.id, p.codigo, p.area_util_ha
    order by p.codigo
$$;

-- ---------------------------------------------------------------------
-- Regras de acesso
-- ---------------------------------------------------------------------

-- Linhas de contagem: todos da propriedade leem; capataz só mexe enquanto está em rascunho
create or replace function contagem_editavel(p_contagem bigint) returns boolean
language sql stable security definer set search_path = public as $$
    select pode_ver_financeiro(c.propriedade_id)
        or (pode_ver(c.propriedade_id) and c.status = 'rascunho')
    from contagem c where c.id = p_contagem
$$;

alter table contagem enable row level security;
create policy contagem_leitura  on contagem for select using (pode_ver(propriedade_id));
create policy contagem_criar    on contagem for insert with check (pode_ver(propriedade_id) and status = 'rascunho');
create policy contagem_capataz  on contagem for update
    using (pode_ver(propriedade_id) and status = 'rascunho')
    with check (pode_ver(propriedade_id) and status in ('rascunho', 'enviada'));
create policy contagem_excluir  on contagem for delete using (pode_ver(propriedade_id) and status = 'rascunho');
create policy contagem_gerente  on contagem for all
    using (pode_ver_financeiro(propriedade_id)) with check (pode_ver_financeiro(propriedade_id));

drop policy if exists contagem_campo_acesso on contagem_campo;
create policy contagem_campo_leitura on contagem_campo for select using (pode_ver(propriedade_id));
create policy contagem_campo_escrita on contagem_campo for all
    using (contagem_editavel(contagem_id)) with check (contagem_editavel(contagem_id));

commit;
