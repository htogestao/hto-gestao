-- =============================================================
-- 013 · aplicacoes.operacao (objetivo da aplicação)
-- =============================================================
-- Formaliza coluna que já existe em produção (rodada via SQL avulso
-- em supabase/add_operacao_aplicacoes.sql, nunca versionada — ver
-- CONTRIBUTING.md sobre o processo que evita isso daqui pra frente).
-- IF NOT EXISTS: idempotente, seguro rodar de novo mesmo já existindo.
--
-- Aditivo · reversível · nullable · sem CHECK constraint.
-- Motivo do "sem CHECK": a lista de operações evolui na interface
-- (Dessecação, Fundo de sulco, Pós-plantio, Pré/Pós-emergente,
-- Fungicida, Inseticida, Maturador, Outro...) sem exigir migration.
-- Nesta fase é texto livre; evoluir para cadastro próprio (tabela
-- `operacoes`) é dívida técnica registrada em docs/09-Roadmap.md.
-- =============================================================

alter table public.aplicacoes
  add column if not exists operacao text;

comment on column public.aplicacoes.operacao is
  'Objetivo/processo da aplicacao (Dessecacao, Fundo de sulco, Pos-plantio, etc.). Texto livre nesta fase; evoluir para cadastro proprio depois.';

-- =============================================================
-- Rollback (se necessário):
-- alter table public.aplicacoes drop column if exists operacao;
-- =============================================================
