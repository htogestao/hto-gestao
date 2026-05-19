-- =============================================
-- Funções utilitárias
-- =============================================

-- Estoque total por defensivo
create or replace function public.estoque_atual(p_defensivo_id uuid default null)
returns table (
  defensivo_id     uuid,
  nome_comercial   text,
  principio_ativo  text,
  classe           text,
  unidade          text,
  empresa          text,
  local_armazenamento text,
  estoque_minimo   numeric,
  quantidade_total numeric,
  em_alerta        boolean,
  tem_vencido      boolean
) language sql stable security definer as $$
  select
    d.id,
    d.nome_comercial,
    d.principio_ativo,
    d.classe,
    d.unidade,
    d.empresa,
    d.local_armazenamento,
    d.estoque_minimo,
    coalesce(sum(l.quantidade_atual), 0)                            as quantidade_total,
    coalesce(sum(l.quantidade_atual), 0) <= d.estoque_minimo       as em_alerta,
    bool_or(l.data_vencimento is not null and l.data_vencimento < current_date) as tem_vencido
  from public.defensivos d
  left join public.lotes l on l.defensivo_id = d.id and l.quantidade_atual > 0
  where (p_defensivo_id is null or d.id = p_defensivo_id)
  group by d.id, d.nome_comercial, d.principio_ativo, d.classe,
           d.unidade, d.empresa, d.local_armazenamento, d.estoque_minimo;
$$;

-- Lotes ordenados por vencimento (FEFO)
create or replace function public.lotes_por_vencimento(
  p_defensivo_id uuid,
  p_dias_alerta  int default 90
)
returns table (
  lote_id           uuid,
  numero_nf         text,
  fornecedor        text,
  quantidade_atual  numeric,
  data_vencimento   date,
  dias_para_vencer  int,
  status_vencimento text
) language sql stable security definer as $$
  select
    id,
    numero_nf,
    fornecedor,
    quantidade_atual,
    data_vencimento,
    (data_vencimento - current_date)::int    as dias_para_vencer,
    case
      when data_vencimento is null           then 'sem_vencimento'
      when data_vencimento < current_date    then 'vencido'
      when data_vencimento <= current_date + p_dias_alerta then 'proximo'
      else 'ok'
    end                                      as status_vencimento
  from public.lotes
  where defensivo_id = p_defensivo_id
    and quantidade_atual > 0
  order by data_vencimento asc nulls last;
$$;

-- Encerra aplicação atomicamente
create or replace function public.encerrar_aplicacao(
  p_aplicacao_id         uuid,
  p_praga_alvo           text,
  p_condicoes_climaticas text,
  p_observacoes          text,
  p_itens                jsonb
  -- [{item_id, quantidade_sobrou, calda_total_l, dose_por_hectare}]
)
returns void language plpgsql security definer as $$
declare
  v_item         jsonb;
  v_lote_id      uuid;
  v_defensivo_id uuid;
  v_sobrou       numeric;
begin
  if not exists (
    select 1 from public.aplicacoes
    where id = p_aplicacao_id
      and status = 'em_andamento'
      and (responsavel_id = auth.uid() or current_user_role() = 'admin')
  ) then
    raise exception 'Aplicação não encontrada ou sem permissão';
  end if;

  for v_item in select * from jsonb_array_elements(p_itens)
  loop
    v_sobrou := coalesce((v_item->>'quantidade_sobrou')::numeric, 0);

    update public.aplicacao_itens
    set
      quantidade_sobrou = v_sobrou,
      calda_total_l     = (v_item->>'calda_total_l')::numeric,
      dose_por_hectare  = (v_item->>'dose_por_hectare')::numeric
    where id = (v_item->>'item_id')::uuid
    returning lote_id, defensivo_id into v_lote_id, v_defensivo_id;

    if v_sobrou > 0 then
      update public.lotes
      set quantidade_atual = quantidade_atual + v_sobrou
      where id = v_lote_id;

      insert into public.movimentacoes
        (defensivo_id, lote_id, tipo, quantidade, aplicacao_id, usuario_id, observacoes)
      values
        (v_defensivo_id, v_lote_id, 'devolucao_sobra', v_sobrou,
         p_aplicacao_id, auth.uid(), 'Devolução de sobra ao encerrar aplicação');
    end if;
  end loop;

  update public.aplicacoes
  set
    status               = 'encerrada',
    praga_alvo           = p_praga_alvo,
    condicoes_climaticas = p_condicoes_climaticas,
    observacoes          = p_observacoes
  where id = p_aplicacao_id;
end;
$$;

-- Dashboard: alertas ativos
create or replace function public.alertas_ativos()
returns table (
  tipo        text,
  defensivo_id uuid,
  lote_id      uuid,
  nome_comercial text,
  detalhe     text,
  severidade  text  -- 'critico' | 'alto' | 'medio'
) language sql stable security definer as $$
  -- Lotes vencidos com estoque
  select
    'lote_vencido'       as tipo,
    d.id                 as defensivo_id,
    l.id                 as lote_id,
    d.nome_comercial,
    'NF ' || coalesce(l.numero_nf,'s/nf') || ' — venceu em ' || to_char(l.data_vencimento,'DD/MM/YYYY') as detalhe,
    'critico'            as severidade
  from public.lotes l
  join public.defensivos d on d.id = l.defensivo_id
  where l.quantidade_atual > 0 and l.data_vencimento < current_date

  union all

  -- Lotes vencendo em 30 dias
  select
    'vencimento_proximo' as tipo,
    d.id, l.id,
    d.nome_comercial,
    'Vence em ' || (l.data_vencimento - current_date)::int || ' dias (NF ' || coalesce(l.numero_nf,'s/nf') || ')' as detalhe,
    case when (l.data_vencimento - current_date) <= 30 then 'alto' else 'medio' end as severidade
  from public.lotes l
  join public.defensivos d on d.id = l.defensivo_id
  where l.quantidade_atual > 0
    and l.data_vencimento between current_date and current_date + 90

  union all

  -- Estoque abaixo do mínimo
  select
    'estoque_baixo'      as tipo,
    d.id, null::uuid,
    d.nome_comercial,
    'Estoque: ' || round(sum(l.quantidade_atual),1)::text || ' ' || d.unidade
    || ' / Mínimo: ' || d.estoque_minimo::text || ' ' || d.unidade as detalhe,
    'alto'               as severidade
  from public.defensivos d
  left join public.lotes l on l.defensivo_id = d.id and l.quantidade_atual > 0
  where d.estoque_minimo > 0
  group by d.id, d.nome_comercial, d.unidade, d.estoque_minimo
  having coalesce(sum(l.quantidade_atual),0) <= d.estoque_minimo

  order by severidade, nome_comercial;
$$;
