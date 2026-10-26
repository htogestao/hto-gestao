-- =============================================================
-- 020 · handle_new_user(): empresa vem de app_metadata (só admin escreve)
-- =============================================================
-- Bug introduzido pela 016: a função só aceitava `organizacao_id` se o
-- usuário chegasse no INSERT com `invited_at` ou `email_confirmed_at`
-- preenchidos. O GoTrue grava os dois DEPOIS do INSERT, então TODA
-- criação de usuário (convite, Create user, generate_link) passou a ser
-- recusada com "Cadastro recusado: ... organizacao_id" — ninguém novo
-- conseguia ser criado. Só o caminho negativo (signup público) foi
-- testado na 016; o positivo (admin cria usuário) não.
--
-- Correção: a empresa passa a vir de `raw_app_meta_data->>'organizacao_id'`.
-- app_metadata só é gravável por quem tem a service_role (Admin API);
-- um signup público não consegue setar — mantém o fechamento do C1
-- (o `user_metadata`, controlado pelo próprio usuário, nunca mais decide
-- empresa). Papel continua sempre 'field' (admin sobe na tela Usuários).
--
-- Aditivo, reversível (rollback no fim).
-- =============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_org uuid;
begin
  v_org := nullif(new.raw_app_meta_data->>'organizacao_id', '')::uuid;

  if v_org is null then
    raise exception 'Cadastro recusado: usuário precisa ser criado por um administrador com a empresa definida (app_metadata.organizacao_id).'
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

-- =============================================================
-- Rollback: recriar handle_new_user() como na migration 016.
-- =============================================================
