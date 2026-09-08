-- =============================================================
-- 011 · handle_new_user() respeita organizacao_id do convite
-- =============================================================
-- Bug: o gatilho amarrava TODO usuário novo à primeira organização
-- cadastrada (ORDER BY criado_em LIMIT 1), ignorando qual empresa
-- o convite era de fato para. Nunca dava problema com uma única
-- empresa (Agrícola MV); passa a dar assim que existe uma segunda
-- (AGRO MÁXIMO) — o usuário novo nasceria na empresa errada.
--
-- Fix aditivo: lê organizacao_id de raw_user_meta_data (mesmo padrão
-- já usado para `role`). Convite sem esse metadado mantém o
-- comportamento antigo (primeira organização) — não quebra nada
-- existente. READ/WRITE só na função; não altera dados.
-- =============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $function$
DECLARE
  v_org uuid;
BEGIN
  v_org := (new.raw_user_meta_data->>'organizacao_id')::uuid;

  IF v_org IS NULL THEN
    SELECT id INTO v_org FROM public.organizacoes ORDER BY criado_em LIMIT 1;
  END IF;

  INSERT INTO public.profiles (id, nome, role, organizacao_id)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role','field'),
    v_org
  );
  RETURN new;
END;
$function$;

-- Nova organização: cliente distinto da Agrícola MV, dados isolados via org_guard.
insert into public.organizacoes (nome, ativo)
values ('AGRO MÁXIMO', true);
