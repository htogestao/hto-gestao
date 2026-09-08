-- 010_catalogo_agrotoxicos_pr.sql
-- Catálogo de referência (somente leitura) dos agrotóxicos aptos a comércio e uso
-- no Paraná, publicado pela ADAPAR. NÃO é escopado por organização — é a mesma
-- lista oficial para todas as empresas do sistema. Serve para autocompletar e
-- validar o cadastro de `defensivos` (nome comercial, empresa, ingrediente ativo,
-- classe, classe toxicológica, nº de registro), não substitui o cadastro
-- operacional por organização.

create table public.catalogo_agrotoxicos_pr (
  id                    uuid primary key default uuid_generate_v4(),
  nome_comercial        text not null,
  empresa               text,
  classe                text,
  ingrediente_ativo     text,
  concentracao          text,
  registro              text,
  classe_toxicologica   text,
  restricao_uso         text,
  pagina_origem         int,
  atualizacao_adapar    date not null default '2026-07-03',
  created_at            timestamptz not null default now()
);

create index idx_catalogo_agrotoxicos_pr_nome on public.catalogo_agrotoxicos_pr (lower(nome_comercial));
create index idx_catalogo_agrotoxicos_pr_registro on public.catalogo_agrotoxicos_pr (registro);

alter table public.catalogo_agrotoxicos_pr enable row level security;

-- leitura liberada para todos os perfis autenticados do sistema (dado público/regulatório)
drop policy if exists "catalogo_agrotoxicos_pr_select" on public.catalogo_agrotoxicos_pr;
create policy "catalogo_agrotoxicos_pr_select" on public.catalogo_agrotoxicos_pr
  as permissive for select to public
  using (current_user_role() = any (array['admin'::text, 'viewer'::text, 'field'::text]));

-- escrita restrita (carga/atualização do catálogo é manual, via migration/admin)
drop policy if exists "catalogo_agrotoxicos_pr_write" on public.catalogo_agrotoxicos_pr;
create policy "catalogo_agrotoxicos_pr_write" on public.catalogo_agrotoxicos_pr
  as permissive for all to public
  using (current_user_role() = 'admin'::text)
  with check (current_user_role() = 'admin'::text);
