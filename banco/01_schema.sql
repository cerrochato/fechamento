-- =====================================================================
-- Fechamento - modelo do banco de dados (PostgreSQL / Supabase)
-- Gerado a partir da planilha "Cerro Chato 2025/26"
-- Ordem de execução: 01_schema.sql -> 02_views.sql -> 03_seguranca_supabase.sql
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 1. Propriedades, usuários e acesso
-- ---------------------------------------------------------------------

create table propriedade (
    id              bigint generated always as identity primary key,
    nome            text not null unique,              -- "Estância Cerro Chato"
    apelido         text,                              -- "CERRO CHATO"
    municipio       text,
    uf              char(2),
    valor_hectare   numeric(14,2),                     -- usado em "resultado sobre valor da terra"
    ativa           boolean not null default true,
    criado_em       timestamptz not null default now()
);

-- No Supabase, id = auth.users.id (o login fica a cargo do Supabase Auth).
create table usuario (
    id              uuid primary key default gen_random_uuid(),
    nome            text not null,
    email           text unique,
    whatsapp        text unique,                       -- formato E.164: +5555999999999
    adm             boolean not null default false,    -- adm vê e edita todas as propriedades
    ativo           boolean not null default true,
    criado_em       timestamptz not null default now()
);

create type papel_acesso as enum ('gerente', 'capataz');

-- Quem acessa qual propriedade, e com qual papel.
-- gerente: tudo da propriedade (rebanho, áreas, financeiro, relatórios)
-- capataz: lança rebanho, contagens e uso de áreas; sem financeiro
create table acesso_propriedade (
    usuario_id      uuid   not null references usuario(id) on delete cascade,
    propriedade_id  bigint not null references propriedade(id) on delete cascade,
    papel           papel_acesso not null,
    primary key (usuario_id, propriedade_id)
);

-- ---------------------------------------------------------------------
-- 2. Safra e cadastros gerais
-- ---------------------------------------------------------------------

create table safra (
    id              bigint generated always as identity primary key,
    nome            text not null unique,              -- "2025/2026"
    inicio          date not null,                     -- 2025-07-01
    fim             date not null,                     -- 2026-06-30
    check (fim > inicio)
);

create table especie (
    id              smallint primary key,
    nome            text not null unique               -- Bovinos, Ovinos, Equinos
);

create table categoria_animal (
    id              bigint generated always as identity primary key,
    especie_id      smallint not null references especie(id),
    nome            text not null,                     -- "Vaca de cria"
    peso_padrao_kg  numeric(8,2),                      -- peso médio de referência da planilha
    ordem           smallint not null default 0,
    ativa           boolean not null default true,
    unique (especie_id, nome)
);

-- Ocorrências da planilha. "sinal" diz se soma (+1) ou tira (-1) do estoque.
create table tipo_ocorrencia (
    codigo          text primary key,                  -- AQUISICAO, VENDA, MORTE...
    nome            text not null,                     -- texto como aparece na planilha
    sinal           smallint not null check (sinal in (-1, 1)),
    exige_valor     boolean not null default false,    -- compra/venda pedem peso e R$/kg
    exige_causa     boolean not null default false,    -- morte pede causa
    ordem           smallint not null default 0
);

create table causa_morte (
    id              bigint generated always as identity primary key,
    nome            text not null unique
);

-- Compradores, vendedores, frigoríficos (origem/destino das movimentações)
create table contraparte (
    id              bigint generated always as identity primary key,
    nome            text not null unique,
    documento       text,                              -- CPF/CNPJ, opcional
    telefone        text
);

-- ---------------------------------------------------------------------
-- 3. Áreas e potreiros
-- ---------------------------------------------------------------------

create type dominio_area as enum ('propria', 'arrendada');

create table potreiro (
    id              bigint generated always as identity primary key,
    propriedade_id  bigint not null references propriedade(id) on delete cascade,
    codigo          text not null,                     -- "21", "40 a", "umbu"
    dominio         dominio_area not null default 'propria',
    area_total_ha   numeric(10,2) not null,
    area_util_ha    numeric(10,2) not null,
    ativo           boolean not null default true,
    unique (propriedade_id, codigo, area_total_ha)     -- a planilha tem códigos repetidos com áreas diferentes
);

create table tipo_uso_area (
    id              smallint generated always as identity primary key,
    nome            text not null unique,              -- CAMPO NATIVO, PASTAGEM CULTIVADA, ARROZ, TAIPA...
    pecuaria        boolean not null default true      -- conta como área pastoril?
);

-- Uso de cada potreiro em cada mês (aba "Controle areas")
create table uso_area_mensal (
    potreiro_id     bigint not null references potreiro(id) on delete cascade,
    mes             date   not null check (extract(day from mes) = 1),
    tipo_uso_id     smallint not null references tipo_uso_area(id),
    primary key (potreiro_id, mes)
);

-- ---------------------------------------------------------------------
-- 4. Rebanho
-- ---------------------------------------------------------------------

-- Estoque de abertura da safra por categoria, com o valor usado no inventário
create table estoque_inicial (
    propriedade_id  bigint not null references propriedade(id) on delete cascade,
    safra_id        bigint not null references safra(id),
    categoria_id    bigint not null references categoria_animal(id),
    cabecas         integer not null default 0,
    peso_medio_kg   numeric(8,2),
    primary key (propriedade_id, safra_id, categoria_id)
);

-- Valor de R$/kg e peso médio usados para avaliar o rebanho no fim da safra
create table avaliacao_rebanho (
    propriedade_id  bigint not null references propriedade(id) on delete cascade,
    safra_id        bigint not null references safra(id),
    categoria_id    bigint not null references categoria_animal(id),
    valor_kg        numeric(10,2),
    peso_medio_kg   numeric(8,2),
    primary key (propriedade_id, safra_id, categoria_id)
);

create type origem_registro as enum ('planilha', 'app', 'whatsapp', 'importacao');

-- Cada linha da aba "R - LANÇAMENTOS"
create table movimentacao_rebanho (
    id              bigint generated always as identity primary key,
    propriedade_id  bigint not null references propriedade(id) on delete cascade,
    data            date   not null,
    data_aproximada boolean not null default false,    -- true quando a planilha só tinha mês/ano
    categoria_id    bigint not null references categoria_animal(id),
    ocorrencia      text   not null references tipo_ocorrencia(codigo),
    quantidade      integer not null check (quantidade > 0),
    causa_morte_id  bigint references causa_morte(id),
    potreiro_id     bigint references potreiro(id),
    contraparte_id  bigint references contraparte(id), -- comprador ou vendedor
    peso_medio_kg   numeric(8,2),
    valor_kg        numeric(10,4),
    valor_total     numeric(14,2),
    observacao      text,
    -- transferência entre propriedades: a outra ponta
    propriedade_par_id bigint references propriedade(id),
    origem          origem_registro not null default 'app',
    criado_por      uuid references usuario(id),
    criado_em       timestamptz not null default now()
);
create index on movimentacao_rebanho (propriedade_id, data);
create index on movimentacao_rebanho (categoria_id);

-- Contagem de campo por potreiro e mês (aba "cargas")
create table contagem_campo (
    id              bigint generated always as identity primary key,
    propriedade_id  bigint not null references propriedade(id) on delete cascade,
    mes             date   not null check (extract(day from mes) = 1),
    potreiro_id     bigint references potreiro(id),
    categoria_id    bigint not null references categoria_animal(id),
    cabecas         integer not null,
    peso_medio_kg   numeric(8,2),
    observacao      text,
    criado_por      uuid references usuario(id),
    criado_em       timestamptz not null default now()
);
create index on contagem_campo (propriedade_id, mes);

-- ---------------------------------------------------------------------
-- 5. Financeiro (vem do SW-Rural)
-- ---------------------------------------------------------------------

-- Plano de contas do SW-Rural: "2.1.4.8 - Pessoal Estancias"
create table conta_financeira (
    codigo          text primary key,                  -- "2.1.4.8"
    nome            text not null,
    codigo_pai      text references conta_financeira(codigo),
    nivel           smallint not null,                 -- quantidade de partes do código
    tipo            text not null check (tipo in ('receita', 'despesa', 'outro')),
    -- classificações usadas no resumo financeiro e nos indicadores
    grupo_resumo    text,                              -- "Pessoal", "Pastagens", "Insumos VET"...
    custo           text check (custo in ('fixo', 'variavel'))
);

create table importacao (
    id              bigint generated always as identity primary key,
    propriedade_id  bigint not null references propriedade(id) on delete cascade,
    tipo            text not null,                     -- 'sw_rural_contas_grupo', 'planilha_safra'
    arquivo         text,
    linhas          integer,
    importado_por   uuid references usuario(id),
    importado_em    timestamptz not null default now()
);

-- Lançamento por conta. O relatório "Contas a Pagar/Receber por Grupo" vem
-- somado por mês (data = dia 1, mensal = true). Se no futuro vier o relatório
-- detalhado do SW-Rural, cada título entra com a data real e mensal = false.
create table lancamento_financeiro (
    id              bigint generated always as identity primary key,
    propriedade_id  bigint not null references propriedade(id) on delete cascade,
    data            date   not null,
    mensal          boolean not null default false,
    conta_codigo    text   not null references conta_financeira(codigo),
    valor           numeric(14,2) not null,
    descricao       text,
    documento       text,
    importacao_id   bigint references importacao(id) on delete cascade
);
create index on lancamento_financeiro (propriedade_id, data);

-- ---------------------------------------------------------------------
-- 6. Pessoas (indicadores de RH)
-- ---------------------------------------------------------------------

create table quadro_funcionarios (
    propriedade_id  bigint not null references propriedade(id) on delete cascade,
    safra_id        bigint not null references safra(id),
    funcao          text   not null,                   -- Capataz, Peão, Tratorista...
    quantidade      integer not null default 0,
    primary key (propriedade_id, safra_id, funcao)
);

create table movimento_pessoal (
    propriedade_id  bigint not null references propriedade(id) on delete cascade,
    safra_id        bigint not null references safra(id),
    contratacoes    integer not null default 0,
    demissoes       integer not null default 0,
    primary key (propriedade_id, safra_id)
);

-- ---------------------------------------------------------------------
-- 7. Dados fixos
-- ---------------------------------------------------------------------

insert into especie (id, nome) values (1, 'Bovinos'), (2, 'Ovinos'), (3, 'Equinos');

insert into tipo_ocorrencia (codigo, nome, sinal, exige_valor, exige_causa, ordem) values
    ('AQUISICAO',        'Aquisição',                    1, true,  false, 1),
    ('VENDA_INT_ENTRADA','Venda interna (entrada)',      1, true,  false, 2),
    ('VENDA_INT_SAIDA',  'Venda interna (saída)',       -1, true,  false, 3),
    ('NASCIMENTO',       'Nascimentos',                  1, false, false, 4),
    ('VENDA',            'Venda',                       -1, true,  false, 5),
    ('MORTE',            'Morte',                       -1, false, true,  6),
    ('CONSUMO',          'Consumo',                     -1, false, false, 7),
    ('TCAT_ENTRADA',     'Troca de categoria (entrada)', 1, false, false, 8),
    ('TCAT_SAIDA',       'Troca de categoria (saída)',  -1, false, false, 9);
