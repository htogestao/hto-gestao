-- =============================================================
-- 009 · cultura_id na v_custo_talhao + filtro de cultura na RPC
-- =============================================================
-- Etapa 2b (pré-requisito): os relatórios filtram por cultura, mas as
-- views/RPC (007/008) não tinham essa dimensão. Adiciona cultura_id.
-- READ-ONLY (só views/função). Não altera tabelas/dados/gatilho.
-- =============================================================

-- v_custo_talhao ganha cultura_id (append no fim — CREATE OR REPLACE exige
-- manter as colunas existentes na mesma ordem e só acrescentar no final).
create or replace view public.v_custo_talhao
with (security_invoker = on) as
select
  ci.aplicacao_id,
  ot.talhao_id,
  a.fazenda_id,
  a.data,
  ci.defensivo_id,
  d.classe,
  d.unidade,
  sum(ci.qtd_liquida * ot.fator_rateio) as qtd_liquida_talhao,
  case
    when bool_or(ci.custo is null) then null
    else sum(ci.custo * ot.fator_rateio)
  end as custo_talhao,
  case
    when count(distinct ci.preco_fonte) = 1 then max(ci.preco_fonte)
    else 'misto'
  end as preco_fonte,
  max(ot.origem) as origem_rateio,
  a.cultura_id
from public.v_consumo_item   ci
join public.v_operacao_talhao ot on ot.aplicacao_id = ci.aplicacao_id
join public.aplicacoes        a  on a.id = ci.aplicacao_id
join public.defensivos        d  on d.id = ci.defensivo_id
group by
  ci.aplicacao_id, ot.talhao_id, a.fazenda_id, a.data,
  ci.defensivo_id, d.classe, d.unidade, a.cultura_id;

-- RPC ganha p_cultura_id. Assinatura muda → precisa DROP antes do CREATE.
drop function if exists public.indicadores_custo(text, date, date, uuid, uuid);

create or replace function public.indicadores_custo(
  p_dimensao   text default 'geral',
  p_data_ini   date default null,
  p_data_fim   date default null,
  p_fazenda_id uuid default null,
  p_talhao_id  uuid default null,
  p_cultura_id uuid default null
)
returns table (
  grupo_id          uuid,
  custo_confirmado  numeric,
  custo_total       numeric,
  possui_sem_preco  boolean,
  area_tratada_ha   numeric,
  custo_ha          numeric,
  tem_legado        boolean,
  confiabilidade    text
)
language sql
stable
security invoker
as $$
  with fato as (
    select
      case p_dimensao
        when 'talhao'  then ct.talhao_id
        when 'fazenda' then ct.fazenda_id
        else null
      end as grupo_id,
      ct.aplicacao_id, ct.talhao_id, ct.custo_talhao, ct.preco_fonte, ct.origem_rateio
    from public.v_custo_talhao ct
    where (p_data_ini   is null or ct.data       >= p_data_ini)
      and (p_data_fim   is null or ct.data       <= p_data_fim)
      and (p_fazenda_id is null or ct.fazenda_id  = p_fazenda_id)
      and (p_talhao_id  is null or ct.talhao_id   = p_talhao_id)
      and (p_cultura_id is null or ct.cultura_id  = p_cultura_id)
  ),
  apont as (
    select distinct grupo_id, aplicacao_id, talhao_id from fato
  ),
  area as (
    select
      a.grupo_id,
      sum(ot.area_ha)                                as area_tratada_ha,
      bool_or(ot.area_ha is null or ot.area_ha <= 0) as area_faltando
    from apont a
    join public.v_operacao_talhao ot
      on ot.aplicacao_id = a.aplicacao_id and ot.talhao_id = a.talhao_id
    group by a.grupo_id
  ),
  custo as (
    select
      grupo_id,
      sum(custo_talhao)                                            as custo_confirmado,
      bool_or(custo_talhao is null)                                as possui_sem_preco,
      bool_or(origem_rateio = 'legado' or preco_fonte = 'legado')  as tem_legado
    from fato
    group by grupo_id
  )
  select
    c.grupo_id,
    coalesce(c.custo_confirmado, 0)                                    as custo_confirmado,
    case when c.possui_sem_preco then null else c.custo_confirmado end as custo_total,
    c.possui_sem_preco,
    case when ar.area_faltando then null else ar.area_tratada_ha end   as area_tratada_ha,
    case
      when c.possui_sem_preco                                      then null
      when ar.area_faltando or coalesce(ar.area_tratada_ha,0) <= 0 then null
      else c.custo_confirmado / ar.area_tratada_ha
    end                                                                as custo_ha,
    coalesce(c.tem_legado, false)                                      as tem_legado,
    case
      when c.possui_sem_preco or coalesce(ar.area_faltando, true) then 'BAIXA'
      when c.tem_legado                                          then 'MEDIA'
      else 'ALTA'
    end                                                                as confiabilidade
  from custo c
  left join area ar on ar.grupo_id is not distinct from c.grupo_id;
$$;

grant execute on function public.indicadores_custo(text, date, date, uuid, uuid, uuid) to authenticated;
