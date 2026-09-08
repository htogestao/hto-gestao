-- =============================================================
-- 016 · Fecha C1 e C2 da auditoria de 2026-09-08
-- =============================================================
-- C1) handle_new_user() aceitava `role` e `organizacao_id` de
--     raw_user_meta_data — que quem se cadastra controla no signup
--     (options.data). Com cadastro público ligado, qualquer pessoa
--     nascia admin na primeira empresa. O cadastro público já foi
--     desligado no painel (disable_signup); esta migration é a
--     segunda camada, para que o gatilho nunca mais dependa disso.
--     Regra nova: papel SEMPRE 'field' na criação (admin ajusta na tela
--     Usuários depois); organizacao_id só é aceito quando o usuário foi
--     criado por convite/admin (invited_at ou email_confirmed_at já
--     preenchidos no INSERT — um signup público chega com os dois nulos);
--     sem organizacao_id válida o cadastro é REJEITADO (nada de
--     "primeira empresa" como fallback).
--
-- C2) profiles_update não tem WITH CHECK e `authenticated` tem UPDATE em
--     todas as colunas: qualquer logado fazia PATCH em si mesmo para
--     role='admin' ou ativo=true. Opção escolhida: trigger BEFORE UPDATE
--     em profiles (mais simples que revogar coluna + RPC, e mantém a tela
--     Usuários como está). Bloqueia mudança de role/ativo/organizacao_id
--     quando a chamada vem do papel `authenticated` (PostgREST) e o alvo é
--     o próprio usuário OU quem chama não é admin. Funções SECURITY DEFINER
--     (trocar_organizacao) e scripts via Management API rodam como
--     postgres e continuam livres.
--
-- Aditivo, idempotente. Não altera dados nem policies existentes.
-- =============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_org uuid;
  v_criado_por_admin boolean;
begin
  -- Convite (inviteUserByEmail) preenche invited_at; "Create user" no
  -- painel/Admin API com auto-confirm preenche email_confirmed_at.
  -- Signup público chega com os dois nulos (confirmação por e-mail
  -- desligada só se mailer_autoconfirm for ligado — hoje está desligado).
  v_criado_por_admin := new.invited_at is not null or new.email_confirmed_at is not null;

  if v_criado_por_admin then
    v_org := nullif(new.raw_user_meta_data->>'organizacao_id', '')::uuid;
  end if;

  if v_org is null then
    raise exception 'Cadastro recusado: usuário precisa ser convidado por um administrador com a empresa definida (organizacao_id).'
      using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.organizacoes where id = v_org and ativo) then
    raise exception 'Cadastro recusado: empresa % inexistente ou inativa.', v_org
      using errcode = 'P0001';
  end if;

  insert into public.profiles (id, nome, role, organizacao_id)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nome', ''), split_part(new.email, '@', 1)),
    'field',   -- papel nunca vem do metadado; admin ajusta na tela Usuários
    v_org
  );
  return new;
end;
$function$;

-- C2 ─────────────────────────────────────────────────────────────
-- SECURITY INVOKER de propósito: dentro de uma função SECURITY DEFINER,
-- current_user vira o dono (postgres) e a checagem abaixo não veria mais
-- o papel `authenticated` do PostgREST. Como invoker, current_user é quem
-- fez o UPDATE. A função só lê auth.uid() e current_user_role(), que já
-- são acessíveis ao papel authenticated.
create or replace function public.fn_profiles_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $function$
declare
  v_caller_role text;
begin
  -- Só interessa quando algum campo sensível muda.
  if new.role is not distinct from old.role
     and new.ativo is not distinct from old.ativo
     and new.organizacao_id is not distinct from old.organizacao_id then
    return new;
  end if;

  -- Chamadas via PostgREST rodam como `authenticated` (ou `anon`).
  -- SECURITY DEFINER (trocar_organizacao) e scripts administrativos
  -- rodam como postgres/service_role e passam.
  if current_user in ('authenticated', 'anon') then
    v_caller_role := public.current_user_role();

    if auth.uid() = new.id then
      raise exception 'Não é permitido alterar o próprio papel, status ou empresa.'
        using errcode = '42501';
    end if;

    if v_caller_role is distinct from 'admin' then
      raise exception 'Apenas administradores alteram papel, status ou empresa de um usuário.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$function$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
  before update on public.profiles
  for each row execute function public.fn_profiles_guard();

-- =============================================================
-- Rollback (se necessário):
--   drop trigger if exists trg_profiles_guard on public.profiles;
--   drop function if exists public.fn_profiles_guard();
--   handle_new_user(): recriar a versão da migration 011.
-- =============================================================
