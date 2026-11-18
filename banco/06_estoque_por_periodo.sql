-- 06: estoque em qualquer data, sem depender de a safra estar aberta/fechada.
-- Parte do último estoque inicial lançado (o mais recente antes da data) e soma
-- todas as movimentações daí até a data. Assim os relatórios funcionam para
-- qualquer período, inclusive depois de junho/2026 sem precisar "abrir safra".
-- Rodar uma vez no SQL Editor do Supabase.

create or replace function estoque_na_data(p_propriedade bigint, p_data date)
returns table (categoria_id bigint, especie_id smallint, categoria text, cabecas bigint, peso_padrao_kg numeric)
language sql stable as $$
    with s as (
        select x.id, x.inicio from (
            select sf.id, sf.inicio from safra sf
            where sf.inicio - 1 <= p_data
              and exists (select 1 from estoque_inicial e
                          where e.safra_id = sf.id and e.propriedade_id = p_propriedade)
            union all
            select null::bigint, date '1900-01-01'      -- propriedade sem estoque inicial: parte do zero
        ) x
        order by x.inicio desc limit 1)
    select c.id, c.especie_id, c.nome,
           coalesce(ei.cabecas, 0)
         + coalesce((select sum(m.quantidade * t.sinal)
                     from movimentacao_rebanho m
                     join tipo_ocorrencia t on t.codigo = m.ocorrencia
                     where m.propriedade_id = p_propriedade
                       and m.categoria_id = c.id
                       and m.data between s.inicio and p_data), 0)::bigint as cabecas,
           c.peso_padrao_kg
    from categoria_animal c
    cross join s
    left join estoque_inicial ei
           on ei.propriedade_id = p_propriedade and ei.safra_id = s.id and ei.categoria_id = c.id
$$;
