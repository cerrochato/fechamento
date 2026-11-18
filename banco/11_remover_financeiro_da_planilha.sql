-- Remove os lançamentos financeiros que vieram da planilha "Cerro Chato 2025 26.xlsm".
-- A partir daqui o financeiro do app usa só o que for importado do SW Rural.
-- Os dados do rebanho (movimentações, contagens, avaliação) não são tocados.

-- 1) Conferir antes: deve mostrar 1 importação com 599 linhas
select i.id, i.tipo, i.arquivo, count(l.id) as lancamentos, sum(l.valor) as soma
from importacao i left join lancamento_financeiro l on l.importacao_id = i.id
where i.arquivo like '%.xlsm%' and i.tipo like 'sw_rural%'
group by i.id, i.tipo, i.arquivo;

-- 2) Apagar (os lançamentos saem junto, por cascata)
delete from importacao
where arquivo like '%.xlsm%' and tipo like 'sw_rural%';

-- 3) Conferir depois: deve dar 0
select count(*) from lancamento_financeiro where importacao_id is not null
  and importacao_id not in (select id from importacao);
