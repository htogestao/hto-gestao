-- =============================================================
-- 014 · Fix crítico: RPCs SECURITY DEFINER vazavam dado entre empresas
-- =============================================================
-- Achado: estoque_atual(), alertas_ativos(), lotes_por_vencimento(),
-- encerrar_aplicacao() e aplicar_inventario() são SECURITY DEFINER
-- (rodam com privilégio elevado, ignorando RLS) e foram escritas
-- ANTES do multiempresa (migration 003, mai/2026) — nunca ganharam
-- filtro de organização quando o org_guard chegou (Fase 0). A RLS
-- das tabelas está correta; o vazamento acontece só dentro dessas
-- funções, que a contornam por definição.
--
-- Confirmado em produção (2026-09-08): usuário da AGRO MÁXIMO via
-- 241 defensivos (230 da Agrícola MV + 11 dela) no Dashboard/Estoque/
-- Relatórios/Exportar/Inventário. encerrar_aplicacao() e
-- aplicar_inventario() tinham o mesmo problema do lado de ESCRITA
-- (qualquer admin/viewer de qualquer empresa podia alterar aplicação
-- ou aplicar ajuste de estoque de OUTRA empresa, sabendo o UUID).
--
-- Fix: acrescenta organizacao_id = current_org() em cada função.
-- Aditivo (CREATE OR REPLACE), sem mudar assinatura nem RLS.
-- =============================================================

-- 1) estoque_atual — leitura, usada em Dashboard/Estoque/Relatórios/Exportar/Inventário
create or replace function public.estoque_atual(p_defensivo_id uuid default null)
returns table(
  defensivo_id uuid, nome_comercial text, principio_ativo text, classe text,
  unidade text, empresa text, local_armazenamento text, estoque_minimo numeric,
  quantidade_total numeric, em_alerta boolean, tem_vencido boolean
)
language sql stable security definer
as $function$
  select d.id, d.nome_comercial, d.principio_ativo, d.classe, d.unidade,
    d.empresa, d.local_armazenamento, d.estoque_minimo,
    coalesce(sum(l.quantidade_atual), 0),
    coalesce(sum(l.quantidade_atual), 0) <= d.estoque_minimo,
    bool_or(l.data_vencimento is not null and l.data_vencimento < current_date)
  from public.defensivos d
  left join public.lotes l on l.defensivo_id = d.id and l.quantidade_atual > 0
  where (p_defensivo_id is null or d.id = p_defensivo_id)
    and d.organizacao_id = current_org()
  group by d.id, d.nome_comercial, d.principio_ativo, d.classe,
           d.unidade, d.empresa, d.local_armazenamento, d.estoque_minimo;
$function$;

-- 2) alertas_ativos — leitura, usada em Dashboard (Central de Alertas)
create or replace function public.alertas_ativos()
returns table(tipo text, defensivo_id uuid, lote_id uuid, nome_comercial text, detalhe text, severidade text)
language sql stable security definer
as $function$
  select * from (
    select 'lote_vencido'::text as tipo, d.id as defensivo_id, l.id as lote_id, d.nome_comercial,
      'NF ' || coalesce(l.numero_nf,'s/nf') || ' — venceu em ' || to_char(l.data_vencimento,'DD/MM/YYYY') as detalhe,
      'critico'::text as severidade
    from public.lotes l join public.defensivos d on d.id = l.defensivo_id
    where l.quantidade_atual > 0 and l.data_vencimento < current_date
      and d.organizacao_id = current_org()

    union all

    select 'vencimento_proximo'::text, d.id, l.id, d.nome_comercial,
      'Vence em ' || (l.data_vencimento - current_date)::int || ' dias (NF ' || coalesce(l.numero_nf,'s/nf') || ')',
      case when (l.data_vencimento - current_date) <= 30 then 'alto' else 'medio' end
    from public.lotes l join public.defensivos d on d.id = l.defensivo_id
    where l.quantidade_atual > 0 and l.data_vencimento between current_date and current_date + 90
      and d.organizacao_id = current_org()

    union all

    select 'estoque_baixo'::text, d.id, null::uuid, d.nome_comercial,
      'Estoque: ' || round(sum(l.quantidade_atual),1)::text || ' ' || d.unidade || ' / Mínimo: ' || d.estoque_minimo::text || ' ' || d.unidade,
      'alto'::text
    from public.defensivos d
    left join public.lotes l on l.defensivo_id = d.id and l.quantidade_atual > 0
    where d.estoque_minimo > 0
      and d.organizacao_id = current_org()
    group by d.id, d.nome_comercial, d.unidade, d.estoque_minimo
    having coalesce(sum(l.quantidade_atual),0) <= d.estoque_minimo
  ) sub
  order by severidade, nome_comercial;
$function$;

-- 3) lotes_por_vencimento — não usada em tela hoje, mas exposta via API
create or replace function public.lotes_por_vencimento(p_defensivo_id uuid, p_dias_alerta integer default 90)
returns table(lote_id uuid, numero_nf text, fornecedor text, quantidade_atual numeric, data_vencimento date, dias_para_vencer integer, status_vencimento text)
language sql stable security definer
as $function$
  select id, numero_nf, fornecedor, quantidade_atual, data_vencimento,
    (data_vencimento - current_date)::int,
    case
      when data_vencimento is null        then 'sem_vencimento'
      when data_vencimento < current_date then 'vencido'
      when data_vencimento <= current_date + p_dias_alerta then 'proximo'
      else 'ok'
    end
  from public.lotes
  where defensivo_id = p_defensivo_id and quantidade_atual > 0
    and organizacao_id = current_org()
  order by data_vencimento asc nulls last;
$function$;

-- 4) encerrar_aplicacao — ESCRITA. Antes só checava responsável/papel, sem organização.
create or replace function public.encerrar_aplicacao(
  p_aplicacao_id uuid, p_praga_alvo text, p_condicoes_climaticas text,
  p_observacoes text, p_itens jsonb
)
returns void
language plpgsql security definer
as $function$
declare
  v_item jsonb;
  v_lote_id uuid;
  v_defensivo_id uuid;
  v_sobrou numeric;
begin
  if not exists (
    select 1 from public.aplicacoes
    where id = p_aplicacao_id
      and status = 'em_andamento'
      and organizacao_id = current_org()
      and (responsavel_id = auth.uid() or current_user_role() = 'admin')
  ) then
    raise exception 'Aplicação não encontrada ou sem permissão';
  end if;

  for v_item in select * from jsonb_array_elements(p_itens) loop
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
  set status = 'encerrada',
      praga_alvo = p_praga_alvo,
      condicoes_climaticas = p_condicoes_climaticas,
      observacoes = p_observacoes
  where id = p_aplicacao_id;
end;
$function$;

-- 5) aplicar_inventario — ESCRITA. Antes só checava papel, sem checar dono do inventário.
create or replace function public.aplicar_inventario(p_inventario_id uuid)
returns void
language plpgsql security definer
as $function$
DECLARE
  v_role      text;
  v_item      record;
  v_lote      record;
  v_diff      numeric;
  v_remover   numeric;
  v_tirar     numeric;
  v_lote_novo uuid;
BEGIN
  v_role := public.current_user_role();
  IF v_role NOT IN ('admin','viewer') THEN
    RAISE EXCEPTION 'Sem permissão para aplicar inventário';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.inventario_fisico
    WHERE id = p_inventario_id AND organizacao_id = current_org()
  ) THEN
    RAISE EXCEPTION 'Inventário não encontrado ou sem permissão';
  END IF;

  IF EXISTS (SELECT 1 FROM public.inventario_fisico WHERE id = p_inventario_id AND aplicado) THEN
    RAISE EXCEPTION 'Este inventário já foi aplicado ao estoque';
  END IF;

  FOR v_item IN
    SELECT defensivo_id, diferenca
    FROM public.inventario_itens
    WHERE inventario_id = p_inventario_id AND diferenca <> 0
  LOOP
    v_diff := v_item.diferenca;

    IF v_diff > 0 THEN
      SELECT id INTO v_lote_novo
      FROM public.lotes
      WHERE defensivo_id = v_item.defensivo_id AND organizacao_id = current_org()
      ORDER BY created_at DESC
      LIMIT 1;

      IF v_lote_novo IS NULL THEN
        INSERT INTO public.lotes (defensivo_id, quantidade_comprada, quantidade_atual, observacoes, organizacao_id)
        VALUES (v_item.defensivo_id, v_diff, v_diff, 'Ajuste de inventário físico', current_org());
      ELSE
        UPDATE public.lotes SET quantidade_atual = quantidade_atual + v_diff
        WHERE id = v_lote_novo;
      END IF;
    ELSE
      v_remover := -v_diff;
      FOR v_lote IN
        SELECT id, quantidade_atual
        FROM public.lotes
        WHERE defensivo_id = v_item.defensivo_id AND quantidade_atual > 0
          AND organizacao_id = current_org()
        ORDER BY created_at DESC
      LOOP
        EXIT WHEN v_remover <= 0;
        v_tirar := LEAST(v_lote.quantidade_atual, v_remover);
        UPDATE public.lotes SET quantidade_atual = quantidade_atual - v_tirar
        WHERE id = v_lote.id;
        v_remover := v_remover - v_tirar;
      END LOOP;
    END IF;

    INSERT INTO public.movimentacoes (defensivo_id, tipo, quantidade, usuario_id, observacoes)
    VALUES (
      v_item.defensivo_id, 'ajuste', v_diff, auth.uid(),
      'Ajuste por inventário físico ' || p_inventario_id::text
    );
  END LOOP;

  UPDATE public.inventario_fisico
  SET aplicado = true, aplicado_em = now()
  WHERE id = p_inventario_id;
END;
$function$;

-- 6) Defesa em profundidade — fallback FEFO das triggers de baixa/devolução.
-- Autolimitado hoje (defensivo_id já é de uma única empresa), mas reforça
-- caso alguma inconsistência de dado apareça no futuro.
create or replace function public.fn_decrement_lote_aplicacao()
returns trigger
language plpgsql security definer
as $function$
DECLARE
  v_net  numeric;
  v_rest numeric;
  v_lote record;
  v_take numeric;
BEGIN
  v_net := GREATEST(0, NEW.quantidade_usada - COALESCE(NEW.quantidade_sobrou, 0));

  IF NEW.lote_id IS NOT NULL THEN
    UPDATE public.lotes
    SET quantidade_atual = GREATEST(0, quantidade_atual - v_net)
    WHERE id = NEW.lote_id;
  ELSE
    v_rest := v_net;
    FOR v_lote IN
      SELECT id, quantidade_atual FROM public.lotes
      WHERE defensivo_id = NEW.defensivo_id AND quantidade_atual > 0
        AND organizacao_id = current_org()
      ORDER BY data_vencimento ASC NULLS LAST, created_at ASC
    LOOP
      EXIT WHEN v_rest <= 0;
      v_take := LEAST(v_lote.quantidade_atual, v_rest);
      UPDATE public.lotes SET quantidade_atual = quantidade_atual - v_take WHERE id = v_lote.id;
      v_rest := v_rest - v_take;
    END LOOP;
  END IF;

  INSERT INTO public.movimentacoes
    (defensivo_id, lote_id, tipo, quantidade, aplicacao_id, usuario_id, observacoes)
  VALUES
    (NEW.defensivo_id, NEW.lote_id, 'saida_aplicacao', NEW.quantidade_usada,
     NEW.aplicacao_id, auth.uid(), 'Saída por aplicação');

  IF COALESCE(NEW.quantidade_sobrou, 0) > 0 THEN
    INSERT INTO public.movimentacoes
      (defensivo_id, lote_id, tipo, quantidade, aplicacao_id, usuario_id, observacoes)
    VALUES
      (NEW.defensivo_id, NEW.lote_id, 'devolucao_sobra', NEW.quantidade_sobrou,
       NEW.aplicacao_id, auth.uid(), 'Sobra devolvida ao estoque');
  END IF;
  RETURN NEW;
END;
$function$;

create or replace function public.fn_restore_lote_aplicacao()
returns trigger
language plpgsql security definer
as $function$
DECLARE
  v_net  numeric;
  v_lote uuid;
BEGIN
  v_net := GREATEST(0, OLD.quantidade_usada - COALESCE(OLD.quantidade_sobrou, 0));
  v_lote := OLD.lote_id;
  IF v_lote IS NULL THEN
    SELECT id INTO v_lote FROM public.lotes
    WHERE defensivo_id = OLD.defensivo_id AND organizacao_id = current_org()
    ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF v_lote IS NOT NULL THEN
    UPDATE public.lotes SET quantidade_atual = quantidade_atual + v_net WHERE id = v_lote;
    INSERT INTO public.movimentacoes
      (defensivo_id, lote_id, tipo, quantidade, aplicacao_id, usuario_id, observacoes)
    VALUES
      (OLD.defensivo_id, v_lote, 'devolucao_sobra', v_net,
       OLD.aplicacao_id, auth.uid(), 'Devolução por exclusão de aplicação');
  END IF;
  RETURN OLD;
END;
$function$;
