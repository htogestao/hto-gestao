-- =============================================================
-- 017 · Fecha I1, I2 e I3 da auditoria de 2026-09-08
-- =============================================================
-- I1) current_user_role() ignorava `ativo`: usuário desativado seguia com
--     acesso total pela API (só o middleware web barrava a tela). Agora
--     devolve NULL para inativo → toda policy falha na próxima chamada.
--     definir_usuario_ativo(): RPC de admin que muda o status E apaga as
--     sessões/refresh tokens do usuário em auth (o access token ainda vale
--     até expirar, ~1h, mas sem papel ele não passa em nenhuma policy).
--
-- I2) aplicacao_itens, aplicacao_talhoes e inventario_itens não têm
--     organizacao_id e as policies eram só por papel: admin/viewer de
--     qualquer empresa lia itens de todas; inventario_itens era USING(true)
--     (até anônimo lia e gravava). Agora: org_guard RESTRITIVO por junção
--     com a tabela-pai (aplicacoes / inventario_fisico). O gatilho de baixa
--     passa a validar que lote e defensivo pertencem à empresa da aplicação
--     (antes só o fallback FEFO checava empresa).
--
-- I3) DELETE de aplicação falhava em silêncio (movimentacoes.aplicacao_id é
--     FK sem ON DELETE) e deixava cabeçalho órfão com estoque já devolvido.
--     Agora: exclusão LÓGICA. status 'cancelada' via cancelar_aplicacao()
--     (estorna o líquido de cada item ao lote e grava no razão); DELETE
--     direto some (policy aplicacoes_delete removida); mudar status para
--     cancelada ou editar aplicação cancelada por fora da RPC é barrado por
--     trigger. As duas órfãs existentes são tratadas em script de dado
--     separado (supabase/cancela_aplicacoes_orfas_2026-09.sql).
--
-- Aditivo, idempotente. Não altera dados.
-- =============================================================

-- ───────────────────────── I1 ─────────────────────────
create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and ativo
$$;

create or replace function public.definir_usuario_ativo(p_id uuid, p_ativo boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if public.current_user_role() is distinct from 'admin' then
    raise exception 'Apenas administradores ativam ou desativam usuários.' using errcode = '42501';
  end if;
  if p_id = auth.uid() then
    raise exception 'Não é permitido alterar o próprio status.' using errcode = '42501';
  end if;
  select organizacao_id into v_org from public.profiles where id = p_id;
  if v_org is null or v_org <> public.current_org() then
    raise exception 'Usuário não encontrado nesta empresa.' using errcode = '42501';
  end if;

  update public.profiles set ativo = p_ativo where id = p_id;

  if not p_ativo then
    -- Derruba as sessões abertas: o app precisa logar de novo, e não consegue.
    delete from auth.refresh_tokens where user_id = p_id::text;
    delete from auth.sessions where user_id = p_id;
  end if;
end;
$$;
revoke execute on function public.definir_usuario_ativo(uuid, boolean) from public, anon;
grant execute on function public.definir_usuario_ativo(uuid, boolean) to authenticated;

-- ───────────────────────── I2 ─────────────────────────
drop policy if exists org_guard on public.aplicacao_itens;
create policy org_guard on public.aplicacao_itens as restrictive for all to public
  using (exists (select 1 from public.aplicacoes a
                 where a.id = aplicacao_itens.aplicacao_id and a.organizacao_id = public.current_org()))
  with check (exists (select 1 from public.aplicacoes a
                 where a.id = aplicacao_itens.aplicacao_id and a.organizacao_id = public.current_org()));

drop policy if exists org_guard on public.aplicacao_talhoes;
create policy org_guard on public.aplicacao_talhoes as restrictive for all to public
  using (exists (select 1 from public.aplicacoes a
                 where a.id = aplicacao_talhoes.aplicacao_id and a.organizacao_id = public.current_org()))
  with check (exists (select 1 from public.aplicacoes a
                 where a.id = aplicacao_talhoes.aplicacao_id and a.organizacao_id = public.current_org()));

-- inventario_itens: some o USING(true); passa a exigir papel + empresa do inventário-pai.
drop policy if exists inventario_itens_all on public.inventario_itens;
drop policy if exists inventario_itens_rw on public.inventario_itens;
create policy inventario_itens_rw on public.inventario_itens as permissive for all to public
  using (public.current_user_role() = any (array['admin','viewer']))
  with check (public.current_user_role() = any (array['admin','viewer']));
drop policy if exists org_guard on public.inventario_itens;
create policy org_guard on public.inventario_itens as restrictive for all to public
  using (exists (select 1 from public.inventario_fisico f
                 where f.id = inventario_itens.inventario_id and f.organizacao_id = public.current_org()))
  with check (exists (select 1 from public.inventario_fisico f
                 where f.id = inventario_itens.inventario_id and f.organizacao_id = public.current_org()));

-- Gatilho de baixa: empresa vem da APLICAÇÃO (funciona também em scripts,
-- onde current_org() é NULL); lote e defensivo precisam ser da mesma empresa;
-- aplicação cancelada não aceita item.
create or replace function public.fn_decrement_lote_aplicacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_net  numeric;
  v_rest numeric;
  v_lote record;
  v_take numeric;
  v_org  uuid;
  v_status text;
  v_lote_org uuid;
  v_def_org uuid;
begin
  select organizacao_id, status into v_org, v_status from public.aplicacoes where id = new.aplicacao_id;
  if v_org is null then
    raise exception 'Aplicação % não encontrada ou sem empresa.', new.aplicacao_id;
  end if;
  if v_status = 'cancelada' then
    raise exception 'Aplicação cancelada não aceita itens.';
  end if;
  select organizacao_id into v_def_org from public.defensivos where id = new.defensivo_id;
  if v_def_org is distinct from v_org then
    raise exception 'Defensivo % não pertence à empresa da aplicação.', new.defensivo_id using errcode = '42501';
  end if;

  v_net := greatest(0, new.quantidade_usada - coalesce(new.quantidade_sobrou, 0));

  if new.lote_id is not null then
    select organizacao_id into v_lote_org from public.lotes where id = new.lote_id;
    if v_lote_org is distinct from v_org then
      raise exception 'Lote % não pertence à empresa da aplicação.', new.lote_id using errcode = '42501';
    end if;
    update public.lotes
    set quantidade_atual = greatest(0, quantidade_atual - v_net)
    where id = new.lote_id;
  else
    v_rest := v_net;
    for v_lote in
      select id, quantidade_atual from public.lotes
      where defensivo_id = new.defensivo_id and quantidade_atual > 0
        and organizacao_id = v_org
      order by data_vencimento asc nulls last, created_at asc
    loop
      exit when v_rest <= 0;
      v_take := least(v_lote.quantidade_atual, v_rest);
      update public.lotes set quantidade_atual = quantidade_atual - v_take where id = v_lote.id;
      v_rest := v_rest - v_take;
    end loop;
  end if;

  insert into public.movimentacoes
    (defensivo_id, lote_id, tipo, quantidade, aplicacao_id, usuario_id, observacoes, organizacao_id)
  values
    (new.defensivo_id, new.lote_id, 'saida_aplicacao', new.quantidade_usada,
     new.aplicacao_id, auth.uid(), 'Saída por aplicação', v_org);

  if coalesce(new.quantidade_sobrou, 0) > 0 then
    insert into public.movimentacoes
      (defensivo_id, lote_id, tipo, quantidade, aplicacao_id, usuario_id, observacoes, organizacao_id)
    values
      (new.defensivo_id, new.lote_id, 'devolucao_sobra', new.quantidade_sobrou,
       new.aplicacao_id, auth.uid(), 'Sobra devolvida ao estoque', v_org);
  end if;
  return new;
end;
$function$;

create or replace function public.fn_restore_lote_aplicacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_net  numeric;
  v_lote uuid;
  v_org  uuid;
  v_status text;
begin
  select organizacao_id, status into v_org, v_status from public.aplicacoes where id = old.aplicacao_id;
  -- Aplicação cancelada já teve o estoque estornado pela RPC: não devolver de novo.
  if v_status = 'cancelada' then
    return old;
  end if;
  v_net := greatest(0, old.quantidade_usada - coalesce(old.quantidade_sobrou, 0));
  v_lote := old.lote_id;
  if v_lote is null then
    select id into v_lote from public.lotes
    where defensivo_id = old.defensivo_id and organizacao_id = v_org
    order by created_at desc limit 1;
  end if;
  if v_lote is not null then
    update public.lotes set quantidade_atual = quantidade_atual + v_net where id = v_lote;
    insert into public.movimentacoes
      (defensivo_id, lote_id, tipo, quantidade, aplicacao_id, usuario_id, observacoes, organizacao_id)
    values
      (old.defensivo_id, v_lote, 'devolucao_sobra', v_net,
       old.aplicacao_id, auth.uid(), 'Devolução por exclusão de item', v_org);
  end if;
  return old;
end;
$function$;

-- ───────────────────────── I3 ─────────────────────────
alter table public.aplicacoes drop constraint if exists aplicacoes_status_check;
alter table public.aplicacoes add constraint aplicacoes_status_check
  check (status = any (array['em_andamento'::text, 'encerrada'::text, 'cancelada'::text]));

alter table public.aplicacoes add column if not exists cancelada_em timestamptz;
alter table public.aplicacoes add column if not exists cancelada_por uuid references public.profiles(id);
alter table public.aplicacoes add column if not exists motivo_cancelamento text;

create or replace function public.cancelar_aplicacao(p_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a    record;
  v_item record;
  v_net  numeric;
  v_lote uuid;
  v_role text := public.current_user_role();
begin
  select * into v_a from public.aplicacoes
  where id = p_id and organizacao_id = public.current_org();
  if not found then
    raise exception 'Aplicação não encontrada ou sem permissão.' using errcode = '42501';
  end if;
  if v_a.status = 'cancelada' then
    raise exception 'Aplicação já está cancelada.';
  end if;
  if not (v_role in ('admin', 'viewer') or (v_role = 'field' and v_a.responsavel_id = auth.uid())) then
    raise exception 'Sem permissão para cancelar esta aplicação.' using errcode = '42501';
  end if;

  -- Estorna ao estoque o líquido (retirada − sobra) de cada item e registra no razão.
  for v_item in select * from public.aplicacao_itens where aplicacao_id = p_id loop
    v_net := greatest(0, v_item.quantidade_usada - coalesce(v_item.quantidade_sobrou, 0));
    if v_net <= 0 then continue; end if;
    v_lote := v_item.lote_id;
    if v_lote is null then
      select id into v_lote from public.lotes
      where defensivo_id = v_item.defensivo_id and organizacao_id = v_a.organizacao_id
      order by created_at desc limit 1;
    end if;
    if v_lote is not null then
      update public.lotes set quantidade_atual = quantidade_atual + v_net where id = v_lote;
      insert into public.movimentacoes
        (defensivo_id, lote_id, tipo, quantidade, aplicacao_id, usuario_id, observacoes, organizacao_id)
      values
        (v_item.defensivo_id, v_lote, 'devolucao_sobra', v_net, p_id, auth.uid(),
         'Estorno por cancelamento da aplicação', v_a.organizacao_id);
    end if;
  end loop;

  update public.aplicacoes
  set status = 'cancelada', cancelada_em = now(), cancelada_por = auth.uid(),
      motivo_cancelamento = nullif(p_motivo, '')
  where id = p_id;
end;
$$;
revoke execute on function public.cancelar_aplicacao(uuid, text) from public, anon;
grant execute on function public.cancelar_aplicacao(uuid, text) to authenticated;

-- Fim do DELETE físico de aplicação pela API (sem policy permissiva = negado).
drop policy if exists aplicacoes_delete on public.aplicacoes;

-- SECURITY INVOKER de propósito (mesmo motivo da 016): current_user precisa
-- ser o papel real do chamador. RPCs (definer) e scripts passam.
create or replace function public.fn_aplicacoes_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if old.status = 'cancelada' then
      raise exception 'Aplicação cancelada não pode ser alterada.' using errcode = '42501';
    end if;
    if new.status = 'cancelada' then
      raise exception 'Para cancelar use a função cancelar_aplicacao (estorna o estoque).' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_aplicacoes_guard on public.aplicacoes;
create trigger trg_aplicacoes_guard
  before update on public.aplicacoes
  for each row execute function public.fn_aplicacoes_guard();

-- =============================================================
-- Rollback (se necessário):
--   drop trigger trg_aplicacoes_guard on aplicacoes; drop function fn_aplicacoes_guard();
--   drop function cancelar_aplicacao(uuid,text); drop function definir_usuario_ativo(uuid,boolean);
--   recriar aplicacoes_delete (002), inventario_itens_all (006), current_user_role() (002),
--   fn_decrement_lote_aplicacao/fn_restore_lote_aplicacao (014);
--   drop policy org_guard nas 3 tabelas. Colunas cancelada_* podem ficar.
-- =============================================================
