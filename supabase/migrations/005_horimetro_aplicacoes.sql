-- =============================================================
-- 005 · horimetro_inicial / horimetro_final em aplicacoes
-- =============================================================
-- Corrige o erro de lançamento de aplicação:
--   "Could not find the 'horimetro_final' column of 'aplicacoes'"
-- Confirmado via API REST (read-only): horimetro_inicial e
-- horimetro_final NAO existiam no banco (nao era cache).
--
-- Aditivo, reversivel, nullable. Nao altera dados, RLS, triggers
-- nem o gatilho de baixa de estoque.
-- =============================================================

alter table public.aplicacoes
  add column if not exists horimetro_inicial numeric,
  add column if not exists horimetro_final   numeric;

comment on column public.aplicacoes.horimetro_inicial is
  'Leitura do horimetro do maquinario no inicio da operacao.';
comment on column public.aplicacoes.horimetro_final is
  'Leitura do horimetro do maquinario no fim da operacao.';

-- Recarrega o schema cache do PostgREST para refletir as colunas novas
notify pgrst, 'reload schema';

-- =============================================================
-- Rollback (se necessario):
-- alter table public.aplicacoes drop column if exists horimetro_inicial;
-- alter table public.aplicacoes drop column if exists horimetro_final;
-- =============================================================
