-- 08: a contagem do mês fica aberta e o capataz vai atualizando os potreiros dia a dia.
-- Cada linha guarda o dia em que aquele potreiro/categoria foi contado de fato.
-- Linhas copiadas da contagem anterior mantêm o dia original (mostram que não foram recontadas).
-- Rodar uma vez no SQL Editor do Supabase.
alter table contagem_campo add column if not exists contado_em date;

update contagem_campo cc set contado_em = c.data
from contagem c where c.id = cc.contagem_id and cc.contado_em is null;

-- ao incluir sem dia, ou ao mudar as cabeças, marca o dia de hoje (horário de Brasília)
create or replace function contagem_campo_contado_em() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.contado_em is null then
    new.contado_em := (now() at time zone 'America/Sao_Paulo')::date;
  elsif tg_op = 'UPDATE' and (new.cabecas is distinct from old.cabecas or new.potreiro_id is distinct from old.potreiro_id)
        and new.contado_em is not distinct from old.contado_em then
    new.contado_em := (now() at time zone 'America/Sao_Paulo')::date;
  end if;
  return new;
end $$;

drop trigger if exists contagem_campo_contado_em on contagem_campo;
create trigger contagem_campo_contado_em before insert or update on contagem_campo
for each row execute function contagem_campo_contado_em();
