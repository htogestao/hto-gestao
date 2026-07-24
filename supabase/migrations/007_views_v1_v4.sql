-- =============================================================
-- 007 · SPRINT 1 · Fonte Única de Custo/Consumo/Área — Views V1–V4
-- =============================================================
-- Implementa docs/SPRINT1_VIEW_CONTRACT.md (decisões D1–D6). Etapa 1.
-- READ-ONLY: cria apenas VIEWS. Não altera tabelas, dados, triggers,
-- RLS nem o gatilho de baixa de estoque.
--
-- security_invoker = on  → as views RESPEITAM a RLS por organizacao_id
-- (multiempresa). Postgres 17 (Supabase). NÃO remover.
--
-- Base confirmada na Etapa 0 (2026-07-24): gatilho de baixa v3 correto
-- (razão balanceado saida−devolucao), custo 103/103 com preço.
-- =============================================================

-- Teardown idempotente (ordem inversa de dependência) ---------
drop view if exists public.v_custo_talhao        cascade;
drop view if exists public.v_operacao_talhao      cascade;
drop view if exists public.v_consumo_item         cascade;
drop view if exists public.v_preco_medio_produto  cascade;


-- ─────────────────────────────────────────────────────────────
-- V1 · v_preco_medio_produto  — apoio (D2)
-- Grão: defensivo. Preço médio ponderado pela quantidade comprada,
-- só lotes com preco_unitario não nulo. Base quando o consumo é sem preço.
-- ─────────────────────────────────────────────────────────────
create or replace view public.v_preco_medio_produto
with (security_invoker = on) as
select
  l.defensivo_id,
  sum(l.quantidade_comprada * l.preco_unitario)
    / nullif(sum(l.quantidade_comprada), 0) as preco_medio
from public.lotes l
where l.preco_unitario is not null
  and l.quantidade_comprada is not null
  and l.quantidade_comprada > 0
group by l.defensivo_id;


-- ─────────────────────────────────────────────────────────────
-- V2 · v_consumo_item  — fato de consumo (D1, D2)
-- Grão: aplicação × defensivo × lote.
-- Fonte primária: movimentacoes (razão). qtd_liquida = Σ saida − Σ devolucao.
-- Fallback legado: aplicações sem saída no razão (era pré-gatilho) →
--   qtd_liquida = usada − sobra de aplicacao_itens, preco_fonte='legado'.
-- Preço (D2): lote.preco_unitario → preço médio → sem_preco (custo=NULL).
-- População (D5): status in ('encerrada','em_andamento').
-- ─────────────────────────────────────────────────────────────
create or replace view public.v_consumo_item
with (security_invoker = on) as
with razao as (
  select
    m.aplicacao_id,
    m.defensivo_id,
    m.lote_id,
    sum(case when m.tipo = 'saida_aplicacao'   then m.quantidade else 0 end)
      - sum(case when m.tipo = 'devolucao_sobra' then m.quantidade else 0 end) as qtd_liquida,
    'razao'::text as origem_qtd
  from public.movimentacoes m
  where m.aplicacao_id is not null
    and m.tipo in ('saida_aplicacao', 'devolucao_sobra')
  group by m.aplicacao_id, m.defensivo_id, m.lote_id
),
legado as (
  select
    ai.aplicacao_id,
    ai.defensivo_id,
    ai.lote_id,
    sum(ai.quantidade_usada - ai.quantidade_sobrou) as qtd_liquida,
    'legado'::text as origem_qtd
  from public.aplicacao_itens ai
  where not exists (
    select 1 from public.movimentacoes m
    where m.aplicacao_id = ai.aplicacao_id and m.tipo = 'saida_aplicacao'
  )
  group by ai.aplicacao_id, ai.defensivo_id, ai.lote_id
),
base as (
  select * from razao
  union all
  select * from legado
)
select
  b.aplicacao_id,
  b.defensivo_id,
  b.lote_id,
  d.unidade,
  b.qtd_liquida,
  coalesce(lo.preco_unitario, pm.preco_medio) as preco_aplicado,
  case
    when b.origem_qtd = 'legado'       then 'legado'
    when lo.preco_unitario is not null then 'lote'
    when pm.preco_medio    is not null then 'medio'
    else 'sem_preco'
  end as preco_fonte,
  case
    when coalesce(lo.preco_unitario, pm.preco_medio) is null then null
    else b.qtd_liquida * coalesce(lo.preco_unitario, pm.preco_medio)
  end as custo
from base b
join public.aplicacoes  a  on a.id = b.aplicacao_id
join public.defensivos  d  on d.id = b.defensivo_id
left join public.lotes  lo on lo.id = b.lote_id
left join public.v_preco_medio_produto pm on pm.defensivo_id = b.defensivo_id
where a.status in ('encerrada', 'em_andamento');


-- ─────────────────────────────────────────────────────────────
-- V3 · v_operacao_talhao  — rateio (D3, D4)
-- Grão: aplicação × talhão.
-- FONTE DE ÁREA = aplicacao_talhoes.area_ha (ÁREA TRATADA / realizada por
--   talhão). Decisão 2026-07-24: NÃO usar talhoes.area_ha (cadastral) —
--   contrato proíbe cadastral como denominador financeiro (SSFT). À prova
--   de futuro p/ aplicação parcial de talhão.
--   fator_rateio = area_ha / Σ area_ha da operação.
-- Fallbacks (origem='legado'):
--   * operação sem junção → talhão primário (aplicacoes.talhao_id),
--     fator_rateio=1 (aí sim usa talhoes.area_ha só como referência).
--   * junção com áreas faltando/zeradas → rateio igual 1/n.
-- ─────────────────────────────────────────────────────────────
create or replace view public.v_operacao_talhao
with (security_invoker = on) as
with junc as (
  select
    at.aplicacao_id,
    at.talhao_id,
    at.area_ha            -- área REALIZADA por talhão (fonte oficial, D4)
  from public.aplicacao_talhoes at
),
op_stats as (
  select
    aplicacao_id,
    count(*)                                  as n_talhoes,
    sum(coalesce(area_ha, 0))                 as area_total,
    bool_or(area_ha is null or area_ha <= 0)  as tem_area_faltando
  from junc
  group by aplicacao_id
),
com_juncao as (
  select
    j.aplicacao_id,
    j.talhao_id,
    j.area_ha,
    case
      when s.tem_area_faltando or s.area_total <= 0
        then 1.0 / s.n_talhoes          -- rateio igual (fallback)
      else j.area_ha / s.area_total     -- rateio proporcional à área realizada
    end as fator_rateio,
    case
      when s.tem_area_faltando or s.area_total <= 0 then 'legado'
      else 'juncao'
    end as origem
  from junc j
  join op_stats s on s.aplicacao_id = j.aplicacao_id
),
sem_juncao as (
  select
    a.id            as aplicacao_id,
    a.talhao_id,
    t.area_ha,                     -- sem junção: cadastral só como referência (fator=1)
    1.0             as fator_rateio,
    'legado'::text  as origem
  from public.aplicacoes a
  join public.talhoes t on t.id = a.talhao_id
  where not exists (
    select 1 from public.aplicacao_talhoes at where at.aplicacao_id = a.id
  )
)
select aplicacao_id, talhao_id, area_ha, fator_rateio, origem from com_juncao
union all
select aplicacao_id, talhao_id, area_ha, fator_rateio, origem from sem_juncao;


-- ─────────────────────────────────────────────────────────────
-- V4 · v_custo_talhao  — fato consumível principal (D3)
-- Grão: aplicação × talhão × defensivo.
-- Composição: v_consumo_item × v_operacao_talhao (por aplicacao_id).
--   qtd_liquida_talhao = qtd_liquida × fator_rateio
--   custo_talhao       = custo       × fator_rateio
-- custo_talhao = NULL se qualquer item sem preço (não zera silenciosamente).
-- É DAQUI que todos os financeiros somam.
-- ─────────────────────────────────────────────────────────────
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
  max(ot.origem) as origem_rateio
from public.v_consumo_item   ci
join public.v_operacao_talhao ot on ot.aplicacao_id = ci.aplicacao_id
join public.aplicacoes        a  on a.id = ci.aplicacao_id
join public.defensivos        d  on d.id = ci.defensivo_id
group by
  ci.aplicacao_id, ot.talhao_id, a.fazenda_id, a.data,
  ci.defensivo_id, d.classe, d.unidade;


-- Permissões de leitura (RLS continua valendo via security_invoker) --
grant select on public.v_preco_medio_produto to authenticated;
grant select on public.v_consumo_item         to authenticated;
grant select on public.v_operacao_talhao      to authenticated;
grant select on public.v_custo_talhao         to authenticated;

-- =============================================================
-- MEDIDAS DE ÁREA (P5) — comentário de referência p/ Etapa 2 (consumidores):
--   -- Área TRATADA (base de custo/ha, denominador único) =
--   --   Σ area_ha sobre DISTINCT (aplicacao_id, talhao_id) de v_operacao_talhao
--   --   (já é a área REALIZADA da junção):
--   select sum(area_ha) from (
--     select distinct aplicacao_id, talhao_id, area_ha
--     from public.v_operacao_talhao  -- filtrado pelo recorte
--   ) x;
--   -- Área APLICADA (acumulada, conta passadas) — indicador separado, nunca denominador.
--   -- Custo/ha (D6) = Σ custo_talhao ÷ área tratada.
-- =============================================================

-- =============================================================
-- ⚠️ DÉBITO DE SEGURANÇA (ver Etapa C): security_invoker + grant a
-- authenticated fazem estas views herdarem o gap de `lotes` — um usuário
-- `field` consegue ler custo via API (lotes_select_field expõe preço).
-- Telas de custo já bloqueadas p/ field (Etapa A/B). Fechar junto com a
-- Etapa C (rotear field para lotes_field_view, sem preço).
-- =============================================================
