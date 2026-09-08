-- =============================================================
-- 012 · Seletor de organização (usuário com acesso a mais de 1 empresa)
-- =============================================================
-- Caso de uso: o analista (admin) atende mais de um cliente (Agrícola MV,
-- AGRO MÁXIMO, ...) e precisa trocar de empresa sem logout/login.
--
-- Desenho: reaproveita o org_guard/current_org() já existentes.
-- `usuario_organizacoes` é só a lista de empresas que o usuário TEM
-- PERMISSÃO de acessar; trocar_organizacao() valida essa permissão e
-- atualiza profiles.organizacao_id (é esse campo que current_org() lê).
-- Não muda nada pra quem só tem 1 empresa (Felipe, Thiago, etc.) — a
-- troca só aparece pra quem tiver linhas em usuario_organizacoes.
-- Aditivo, reversível: não altera org_guard nem policies existentes.
-- =============================================================

create table if not exists public.usuario_organizacoes (
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  organizacao_id  uuid not null references public.organizacoes(id) on delete cascade,
  criado_em       timestamptz not null default now(),
  primary key (profile_id, organizacao_id)
);

alter table public.usuario_organizacoes enable row level security;

create policy usuario_organizacoes_select_own
  on public.usuario_organizacoes for select
  using (profile_id = auth.uid());

-- Permite ler nome/id das organizações às quais o usuário tem acesso
-- concedido (além da própria organização ativa, já coberta por
-- org_select_own) — necessário pra montar a lista do seletor.
create policy org_select_membership
  on public.organizacoes for select
  using (
    id in (
      select organizacao_id from public.usuario_organizacoes
      where profile_id = auth.uid()
    )
  );

create or replace function public.trocar_organizacao(p_organizacao_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not exists (
    select 1 from public.usuario_organizacoes
    where profile_id = auth.uid() and organizacao_id = p_organizacao_id
  ) then
    raise exception 'Sem permissão para acessar esta organização';
  end if;

  update public.profiles set organizacao_id = p_organizacao_id where id = auth.uid();
end;
$$;

-- Libera o admin (Henrique · admin@agro.com) para as empresas existentes hoje.
insert into public.usuario_organizacoes (profile_id, organizacao_id)
select 'e203adf0-f9ed-40f7-9079-7784db5cf590', id from public.organizacoes
on conflict do nothing;
