-- =============================================================
-- 021 · Criação de usuário por admin via lista de convites pendentes
-- =============================================================
-- Substitui a 020 (que lia app_metadata e também não funcionou).
-- Fato verificado em produção (09/10/2026): no INSERT em auth.users o
-- GoTrue entrega SÓ user_metadata — `invited_at`, `email_confirmed_at`
-- e `app_metadata` são gravados DEPOIS, num UPDATE. Logo a 016 (que
-- exigia invited_at/email_confirmed_at) e a 020 (app_metadata)
-- recusavam TODA criação de usuário, inclusive a feita por admin.
-- Como user_metadata é controlável por quem se cadastra, ele não pode
-- decidir empresa sozinho (era o C1 da auditoria).
--
-- Solução independente da ordem interna do GoTrue: um admin registra
-- antes o convite (e-mail -> empresa) em `convites_pendentes`, tabela
-- sem nenhum acesso pela API (RLS ligada, sem policy, grants revogados;
-- só service_role/postgres escrevem). handle_new_user() só cria o perfil
-- se existir convite pro e-mail, usa a empresa DO CONVITE (ignora
-- qualquer metadado) e consome o convite. Sem convite = cadastro recusado.
-- Papel continua sempre 'field' (admin sobe na tela Usuários).
--
-- Aditivo, reversível (rollback no fim).
-- =============================================================

create table if not exists public.convites_pendentes (
  email          text primary key,
  organizacao_id uuid not null references public.organizacoes(id),
  criado_em      timestamptz not null default now(),
  constraint convites_email_minusculo check (email = lower(email))
);
alter table public.convites_pendentes enable row level security;
revoke all on public.convites_pendentes from anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_org uuid;
begin
  select organizacao_id into v_org
  from public.convites_pendentes
  where email = lower(new.email);

  if v_org is null then
    raise exception 'Cadastro recusado: não há convite de administrador para este e-mail.'
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
    'field',
    v_org
  );

  delete from public.convites_pendentes where email = lower(new.email);
  return new;
end;
$function$;

-- =============================================================
-- Rollback: recriar handle_new_user() como na 016; drop table convites_pendentes.
-- Para convidar alguém (como service_role/postgres, nunca pela API):
--   insert into public.convites_pendentes (email, organizacao_id) values (lower('x@y'), '<uuid empresa>');
--   ...e então criar o usuário pelo Admin API / painel com esse mesmo e-mail.
-- =============================================================
