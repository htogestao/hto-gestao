-- =============================================================
-- Ajuste retroativo — 86 lotes "Estoque inicial" zerados (jun/2026)
-- =============================================================
-- Ver docs/09-Roadmap.md Parte E, item 2. Origem: script de carga
-- não versionado, não bug em código (Tarefa 1 descartou o código
-- versionado — nenhum commit tocou importarDefensivos() entre
-- 31/05/2026 e hoje). +6.023 un distribuídas proporcionalmente à
-- quantidade_comprada de cada lote. Reversível: fica registrado
-- como `ajuste` no razão, não sobrescreve histórico.
-- =============================================================

with base as (
  select
    id as lote_id,
    defensivo_id,
    quantidade_comprada,
    round(6023 * quantidade_comprada / 7301, 3) as ajuste
  from public.lotes
  where quantidade_atual = 0
    and quantidade_comprada > 0
    and observacoes = 'Estoque inicial — importado da planilha física'
),
upd as (
  update public.lotes l
  set quantidade_atual = b.ajuste
  from base b
  where l.id = b.lote_id
  returning l.id
)
insert into public.movimentacoes (defensivo_id, lote_id, tipo, quantidade, usuario_id, observacoes)
select
  defensivo_id, lote_id, 'ajuste', ajuste,
  'e203adf0-f9ed-40f7-9079-7784db5cf590',
  'Ajuste retroativo — origem: script de carga não versionado (jun/2026), não bug de código; estimado por razão, pendente de confirmação física'
from base;
