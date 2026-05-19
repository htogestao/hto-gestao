-- =============================================
-- Row Level Security — 3 roles: admin / viewer / field
-- =============================================

create or replace function public.current_user_role()
returns text language sql stable security definer as $$
  select role from public.profiles where id = auth.uid()
$$;

-- ─── PROFILES ────────────────────────────────
alter table public.profiles enable row level security;

create policy "profiles_select" on public.profiles for select
  using (id = auth.uid() or current_user_role() in ('admin','viewer'));

create policy "profiles_insert" on public.profiles for insert
  with check (current_user_role() = 'admin');

create policy "profiles_update" on public.profiles for update
  using (id = auth.uid() or current_user_role() = 'admin');

create policy "profiles_delete" on public.profiles for delete
  using (current_user_role() = 'admin');

-- ─── FAZENDAS ────────────────────────────────
alter table public.fazendas enable row level security;

create policy "fazendas_select" on public.fazendas for select
  using (current_user_role() in ('admin','viewer','field'));

create policy "fazendas_insert" on public.fazendas for insert
  with check (current_user_role() = 'admin');

create policy "fazendas_update" on public.fazendas for update
  using (current_user_role() = 'admin');

create policy "fazendas_delete" on public.fazendas for delete
  using (current_user_role() = 'admin');

-- ─── TALHÕES ─────────────────────────────────
alter table public.talhoes enable row level security;

create policy "talhoes_select" on public.talhoes for select
  using (current_user_role() in ('admin','viewer','field'));

create policy "talhoes_insert" on public.talhoes for insert
  with check (current_user_role() = 'admin');

create policy "talhoes_update" on public.talhoes for update
  using (current_user_role() = 'admin');

create policy "talhoes_delete" on public.talhoes for delete
  using (current_user_role() = 'admin');

-- ─── DEFENSIVOS ──────────────────────────────
alter table public.defensivos enable row level security;

create policy "defensivos_select" on public.defensivos for select
  using (current_user_role() in ('admin','viewer','field'));

create policy "defensivos_insert" on public.defensivos for insert
  with check (current_user_role() = 'admin');

create policy "defensivos_update" on public.defensivos for update
  using (current_user_role() = 'admin');

create policy "defensivos_delete" on public.defensivos for delete
  using (current_user_role() = 'admin');

-- ─── LOTES ───────────────────────────────────
-- field acessa lotes via view sem colunas financeiras
alter table public.lotes enable row level security;

create policy "lotes_select_admin_viewer" on public.lotes for select
  using (current_user_role() in ('admin','viewer'));

create policy "lotes_select_field" on public.lotes for select
  using (current_user_role() = 'field');

create policy "lotes_insert" on public.lotes for insert
  with check (current_user_role() = 'admin');

create policy "lotes_update" on public.lotes for update
  using (current_user_role() = 'admin');

create policy "lotes_delete" on public.lotes for delete
  using (current_user_role() = 'admin');

-- VIEW para campo: sem preço nem valor
create or replace view public.lotes_field_view
with (security_invoker = true) as
  select
    id, defensivo_id, data_compra, quantidade_comprada,
    quantidade_atual, data_fabricacao, data_vencimento,
    lote_fabricante, observacoes, created_at
  from public.lotes;

-- ─── APLICAÇÕES ──────────────────────────────
alter table public.aplicacoes enable row level security;

create policy "aplicacoes_select_admin_viewer" on public.aplicacoes for select
  using (current_user_role() in ('admin','viewer'));

create policy "aplicacoes_select_field" on public.aplicacoes for select
  using (current_user_role() = 'field' and responsavel_id = auth.uid());

create policy "aplicacoes_insert" on public.aplicacoes for insert
  with check (current_user_role() in ('admin','field'));

create policy "aplicacoes_update" on public.aplicacoes for update
  using (
    current_user_role() = 'admin'
    or (current_user_role() = 'field' and responsavel_id = auth.uid() and status = 'em_andamento')
  );

create policy "aplicacoes_delete" on public.aplicacoes for delete
  using (current_user_role() = 'admin');

-- ─── APLICAÇÃO ITENS ─────────────────────────
alter table public.aplicacao_itens enable row level security;

create policy "aplic_itens_select" on public.aplicacao_itens for select
  using (
    current_user_role() in ('admin','viewer')
    or exists (
      select 1 from public.aplicacoes a
      where a.id = aplicacao_id and a.responsavel_id = auth.uid()
    )
  );

create policy "aplic_itens_insert" on public.aplicacao_itens for insert
  with check (
    current_user_role() = 'admin'
    or (
      current_user_role() = 'field'
      and exists (
        select 1 from public.aplicacoes a
        where a.id = aplicacao_id
          and a.responsavel_id = auth.uid()
          and a.status = 'em_andamento'
      )
    )
  );

create policy "aplic_itens_update" on public.aplicacao_itens for update
  using (current_user_role() = 'admin');

create policy "aplic_itens_delete" on public.aplicacao_itens for delete
  using (current_user_role() = 'admin');

-- ─── MOVIMENTAÇÕES ───────────────────────────
alter table public.movimentacoes enable row level security;

create policy "movim_select" on public.movimentacoes for select
  using (
    current_user_role() in ('admin','viewer')
    or (current_user_role() = 'field' and usuario_id = auth.uid())
  );

create policy "movim_insert" on public.movimentacoes for insert
  with check (current_user_role() in ('admin','field'));

create policy "movim_update" on public.movimentacoes for update
  using (current_user_role() = 'admin');

create policy "movim_delete" on public.movimentacoes for delete
  using (current_user_role() = 'admin');
