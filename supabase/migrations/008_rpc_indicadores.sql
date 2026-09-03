-- =============================================================
-- 008 · SPRINT 1 · RPC de Indicadores (a "calculadora oficial")
-- =============================================================
-- Etapa 2a. Implementa a "Camada de indicadores" de
-- docs/SPRINT1_VIEW_CONTRACT.md. É a ÚNICA fonte oficial de custo
-- total / custo por hectare (SSFT). Frontend NUNCA recalcula isto.
--
-- Consome as views V4/V3 (007). security invoker → respeita a RLS
-- por empresa (herda o security_invoker das views). READ-ONLY.
--
-- Parâmetros (todos opcionais):
--   p_dimensao   'talhao' | 'fazenda' | 'geral'  (como agrupar)
--   p_data_ini / p_data_fim   recorte de período
--   p_fazenda_id / p_talhao_id   filtro
--
-- Regras (congeladas no contrato):
--   custo_confirmado = soma só dos itens COM preço.
--   custo_total      = custo_confirmado; NULL se houver item sem preço
--                      (não zera silencioso — corrige P9).
--   area_tratada_ha  = Σ área realizada por apontamento (op×talhão),
--                      dedup do fan-out de produto; NULL se faltar área.
--   custo_ha         = custo_total ÷ area_tratada — só com AMBOS completos
--                      (portão duplo); senão NULL. Área CADASTRAL nunca entra.
--   confiabilidade   BAIXA (sem preço/sem área) · MEDIA (dados legado) · ALTA.
-- =============================================================

create or replace function public.indicadores_custo(
  p_dimensao   text default 'geral',
  p_data_ini   date default null,
  p_data_fim   date default null,
  p_fazenda_id uuid default null,
  p_talhao_id  uuid default null
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
    -- fato base filtrado (grão: aplicação × talhão × defensivo)
    select
      case p_dimensao
        when 'talhao'  then ct.talhao_id
        when 'fazenda' then ct.fazenda_id
        else null
      end                as grupo_id,
      ct.aplicacao_id,
      ct.talhao_id,
      ct.custo_talhao,
      ct.preco_fonte,
      ct.origem_rateio
    from public.v_custo_talhao ct
    where (p_data_ini   is null or ct.data       >= p_data_ini)
      and (p_data_fim   is null or ct.data       <= p_data_fim)
      and (p_fazenda_id is null or ct.fazenda_id  = p_fazenda_id)
      and (p_talhao_id  is null or ct.talhao_id   = p_talhao_id)
  ),
  apont as (
    -- um apontamento = (grupo, aplicação, talhão) — dedup do fan-out de produto
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
      when c.possui_sem_preco                                   then null
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

grant execute on function public.indicadores_custo(text, date, date, uuid, uuid) to authenticated;

-- =============================================================
-- ⚠️ DÉBITO DE SEGURANÇA (Etapa C): como as views, esta RPC roda como
-- invoker e é acessível a authenticated → um `field` poderia ler custo
-- via API. Telas de custo já bloqueadas p/ field (Etapa A/B). Fechar
-- junto com a Etapa C.
-- =============================================================
