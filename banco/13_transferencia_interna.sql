-- =====================================================================
-- 13 - Transferência entre propriedades do app (venda interna)
-- Quando se lança uma venda interna (entrada ou saída) e se escolhe a outra
-- propriedade do app, o banco cria sozinho a outra ponta naquela propriedade,
-- marcada "a confirmar". O gerente de lá só confirma e escolhe o potreiro.
-- Alterar ou excluir uma ponta altera ou exclui a outra.
-- Venda interna para alguém de fora do app continua como antes.
-- Rodar uma vez no SQL Editor do Supabase (pode rodar de novo).
-- =====================================================================
begin;

alter table movimentacao_rebanho add column if not exists par_id bigint references movimentacao_rebanho(id) on delete set null;
alter table movimentacao_rebanho add column if not exists confirmar boolean not null default false;
create index if not exists movimentacao_rebanho_confirmar on movimentacao_rebanho (propriedade_id) where confirmar;

-- nomes de todas as propriedades, para escolher a outra ponta (o capataz só enxerga a dele)
create or replace function propriedades_nomes() returns table (id bigint, nome text)
language sql stable security definer set search_path = public as $$
  select id, nome from propriedade where auth.uid() is not null order by nome
$$;

-- cria a outra ponta
create or replace function transferencia_criar_par() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if pg_trigger_depth() > 1 then return null; end if;
  if new.ocorrencia not in ('VENDA_INT_ENTRADA', 'VENDA_INT_SAIDA')
     or new.propriedade_par_id is null or new.par_id is not null
     or new.propriedade_par_id = new.propriedade_id then
    return null;
  end if;
  if not pode_ver(new.propriedade_id) then return null; end if;
  insert into movimentacao_rebanho (propriedade_id, data, categoria_id, ocorrencia, quantidade,
      peso_medio_kg, valor_kg, valor_total, observacao, propriedade_par_id, par_id, confirmar, origem, criado_por)
  values (new.propriedade_par_id, new.data, new.categoria_id,
      case new.ocorrencia when 'VENDA_INT_ENTRADA' then 'VENDA_INT_SAIDA' else 'VENDA_INT_ENTRADA' end,
      new.quantidade, new.peso_medio_kg, new.valor_kg, new.valor_total,
      'Criado automaticamente pela transferência ' ||
        case new.ocorrencia when 'VENDA_INT_ENTRADA' then 'para ' else 'de ' end ||
        (select nome from propriedade where id = new.propriedade_id),
      new.propriedade_id, new.id, true, 'app', new.criado_por)
  returning id into v_id;
  update movimentacao_rebanho set par_id = v_id where id = new.id;
  return null;
end $$;

-- mantém as duas pontas iguais quando uma é alterada
create or replace function transferencia_alterar_par() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 or new.par_id is null then return null; end if;
  if (new.data, new.categoria_id, new.quantidade, new.peso_medio_kg, new.valor_kg, new.valor_total)
     is distinct from (old.data, old.categoria_id, old.quantidade, old.peso_medio_kg, old.valor_kg, old.valor_total) then
    update movimentacao_rebanho
       set data = new.data, categoria_id = new.categoria_id, quantidade = new.quantidade,
           peso_medio_kg = new.peso_medio_kg, valor_kg = new.valor_kg, valor_total = new.valor_total
     where id = new.par_id;
  end if;
  return null;
end $$;

-- excluir uma ponta exclui a outra
create or replace function transferencia_excluir_par() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 or old.par_id is null then return null; end if;
  delete from movimentacao_rebanho where id = old.par_id;
  return null;
end $$;

drop trigger if exists transferencia_criar on movimentacao_rebanho;
create trigger transferencia_criar after insert on movimentacao_rebanho
  for each row execute function transferencia_criar_par();
drop trigger if exists transferencia_alterar on movimentacao_rebanho;
create trigger transferencia_alterar after update on movimentacao_rebanho
  for each row execute function transferencia_alterar_par();
drop trigger if exists transferencia_excluir on movimentacao_rebanho;
create trigger transferencia_excluir after delete on movimentacao_rebanho
  for each row execute function transferencia_excluir_par();

commit;
