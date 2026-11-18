-- =====================================================================
-- Cálculos (substituem as fórmulas das abas de resumo)
-- Todos os relatórios aceitam um período qualquer: data inicial e final.
-- O período pode atravessar safras (ex.: 15/03/2026 a 10/09/2026).
-- =====================================================================

-- Safra que contém uma data
create or replace function safra_da_data(p_data date) returns bigint
language sql stable as $$
    select id from safra where p_data between inicio and fim
$$;

-- ---------------------------------------------------------------------
-- Rebanho
-- ---------------------------------------------------------------------

-- Estoque por categoria no FIM do dia p_data.
-- = estoque inicial da safra + movimentações desde o início da safra até a data.
-- No último dia de uma safra (30/06), se a safra seguinte já tem estoque inicial
-- lançado, usa esse estoque (que pode ter vindo da contagem de campo).
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

-- Movimentações somadas por categoria e ocorrência dentro do período
create or replace function movimento_periodo(p_propriedade bigint, p_de date, p_ate date)
returns table (categoria_id bigint, ocorrencia text, cabecas bigint, quilos numeric, valor_total numeric)
language sql stable as $$
    select m.categoria_id, m.ocorrencia,
           sum(m.quantidade)::bigint,
           sum(m.quantidade * coalesce(m.peso_medio_kg, 0)),
           sum(m.valor_total)
    from movimentacao_rebanho m
    where m.propriedade_id = p_propriedade and m.data between p_de and p_ate
    group by 1, 2
$$;

-- Relatório de efetivo do período (aba "R -MOVIMENTAÇÕES GERAL", para qualquer intervalo)
-- Uma linha por categoria: estoque inicial, cada ocorrência, estoque final.
create or replace function efetivo_periodo(p_propriedade bigint, p_de date, p_ate date)
returns table (
    especie text, categoria text, estoque_inicial bigint,
    aquisicao bigint, venda_int_entrada bigint, venda_int_saida bigint, nascimento bigint,
    venda bigint, morte bigint, consumo bigint, tcat_entrada bigint, tcat_saida bigint,
    estoque_final bigint, quilos_final numeric
) language sql stable as $$
    with ini as (select * from estoque_na_data(p_propriedade, p_de - 1)),
         fim as (select * from estoque_na_data(p_propriedade, p_ate)),
         mov as (select * from movimento_periodo(p_propriedade, p_de, p_ate))
    select e.nome, c.nome,
           coalesce(ini.cabecas, 0)::bigint,
           coalesce(sum(mov.cabecas) filter (where mov.ocorrencia = 'AQUISICAO'), 0)::bigint,
           coalesce(sum(mov.cabecas) filter (where mov.ocorrencia = 'VENDA_INT_ENTRADA'), 0)::bigint,
           coalesce(sum(mov.cabecas) filter (where mov.ocorrencia = 'VENDA_INT_SAIDA'), 0)::bigint,
           coalesce(sum(mov.cabecas) filter (where mov.ocorrencia = 'NASCIMENTO'), 0)::bigint,
           coalesce(sum(mov.cabecas) filter (where mov.ocorrencia = 'VENDA'), 0)::bigint,
           coalesce(sum(mov.cabecas) filter (where mov.ocorrencia = 'MORTE'), 0)::bigint,
           coalesce(sum(mov.cabecas) filter (where mov.ocorrencia = 'CONSUMO'), 0)::bigint,
           coalesce(sum(mov.cabecas) filter (where mov.ocorrencia = 'TCAT_ENTRADA'), 0)::bigint,
           coalesce(sum(mov.cabecas) filter (where mov.ocorrencia = 'TCAT_SAIDA'), 0)::bigint,
           coalesce(fim.cabecas, 0)::bigint,
           coalesce(fim.cabecas, 0) * coalesce(c.peso_padrao_kg, 0)
    from categoria_animal c
    join especie e on e.id = c.especie_id
    left join ini on ini.categoria_id = c.id
    left join fim on fim.categoria_id = c.id
    left join mov on mov.categoria_id = c.id
    group by e.id, e.nome, c.id, c.nome, c.ordem, ini.cabecas, fim.cabecas, c.peso_padrao_kg
    order by e.id, c.ordem
$$;

-- Conferência do mês: estoque teórico no fim do mês x contagem de campo do mês
create or replace function conferencia_contagem(p_propriedade bigint, p_mes date)
returns table (categoria text, teorico bigint, contagem bigint, diferenca bigint)
language sql stable as $$
    with t as (select * from estoque_na_data(p_propriedade,
                    (date_trunc('month', p_mes) + interval '1 month - 1 day')::date)),
         cc as (select categoria_id, sum(cabecas) as cabecas from contagem_campo
                where propriedade_id = p_propriedade and mes = date_trunc('month', p_mes)::date
                group by 1)
    select t.categoria, t.cabecas, coalesce(cc.cabecas, 0)::bigint,
           (coalesce(cc.cabecas, 0) - t.cabecas)::bigint
    from t left join cc on cc.categoria_id = t.categoria_id
    where t.cabecas <> 0 or cc.cabecas is not null
$$;

-- ---------------------------------------------------------------------
-- Financeiro
-- ---------------------------------------------------------------------

-- Total por conta no período, somando as contas filhas em cada nível do plano.
-- Lançamentos mensais (relatório agrupado) entram se o mês estiver dentro do período.
create or replace function financeiro_periodo(p_propriedade bigint, p_de date, p_ate date)
returns table (codigo text, nome text, nivel smallint, tipo text, valor numeric)
language sql stable as $$
    select c.codigo, c.nome, c.nivel, c.tipo, sum(l.valor)
    from lancamento_financeiro l
    join conta_financeira c
      on l.conta_codigo = c.codigo or l.conta_codigo like c.codigo || '.%'
    where l.propriedade_id = p_propriedade
      and l.data between date_trunc('month', p_de)::date and p_ate
      and (l.mensal or l.data >= p_de)
    group by c.codigo, c.nome, c.nivel, c.tipo
    order by string_to_array(c.codigo, '.')::int[]
$$;

-- Fluxo de caixa mês a mês dentro do período (aba "DETALHADO FINANCEIRO")
create or replace function fluxo_caixa(p_propriedade bigint, p_de date, p_ate date)
returns table (mes date, receitas numeric, despesas numeric, resultado numeric, acumulado numeric)
language sql stable as $$
    with m as (
        select date_trunc('month', l.data)::date as mes,
               sum(l.valor) filter (where l.conta_codigo like '1.%') as receitas,
               sum(l.valor) filter (where l.conta_codigo like '2.%') as despesas
        from lancamento_financeiro l
        where l.propriedade_id = p_propriedade
          and l.data between date_trunc('month', p_de)::date and p_ate
          and (l.mensal or l.data >= p_de)
        group by 1
    )
    select mes, coalesce(receitas, 0), coalesce(despesas, 0),
           coalesce(receitas, 0) - coalesce(despesas, 0),
           sum(coalesce(receitas, 0) - coalesce(despesas, 0)) over (order by mes)
    from m order by mes
$$;

-- ---------------------------------------------------------------------
-- Fechamento de safra
-- ---------------------------------------------------------------------

-- Grava o estoque final de uma safra como estoque inicial da seguinte.
-- Uso: select fechar_safra(1, 1, 2);   -- propriedade 1, de 2025/2026 para 2026/2027
create or replace function fechar_safra(p_propriedade bigint, p_safra_atual bigint, p_safra_seguinte bigint)
returns integer language plpgsql as $$
declare n integer; v_fim date;
begin
    select fim into v_fim from safra where id = p_safra_atual;
    insert into estoque_inicial (propriedade_id, safra_id, categoria_id, cabecas, peso_medio_kg)
    select p_propriedade, p_safra_seguinte, e.categoria_id, e.cabecas,
           coalesce(a.peso_medio_kg, e.peso_padrao_kg)
    from estoque_na_data(p_propriedade, v_fim) e
    left join avaliacao_rebanho a on a.propriedade_id = p_propriedade
                                  and a.safra_id = p_safra_atual and a.categoria_id = e.categoria_id
    on conflict (propriedade_id, safra_id, categoria_id)
    do update set cabecas = excluded.cabecas, peso_medio_kg = excluded.peso_medio_kg;
    get diagnostics n = row_count;
    return n;
end $$;
