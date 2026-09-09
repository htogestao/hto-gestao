-- =============================================================
-- Corrige unidade cadastrada do REPORTH (Agrícola MV): L -> kg
-- =============================================================
-- Origem: contagem física do estoque de 09/09/2026 (scan enviado pelo
-- analista). O produtor confirmou que REPORTH é medido em kg; o
-- cadastro em public.defensivos estava com unidade = 'L' desde a
-- criação do produto — não há como saber se foi erro de digitação no
-- import inicial ou trapo herdado da planilha física original.
--
-- Só altera a UNIDADE do cadastro do produto. NÃO altera nenhuma
-- quantidade (lotes.quantidade_atual, movimentacoes, etc.) — isso é
-- tratado à parte, depois que as diferenças de saldo forem revisadas
-- e autorizadas (ver comparativo_estoque_fisico_MV_2026-09-09.xlsx).
--
-- Idempotente (WHERE já filtra pelo estado atual); rodar uma vez.
-- =============================================================

update public.defensivos
set unidade = 'kg'
where id = '0eb3a08d-d6b0-493c-b5aa-57b1733e5e00'  -- REPORTH, Agrícola MV
  and organizacao_id = '52f1c460-cdf7-436a-b6fc-a032f890a028'
  and unidade = 'L';
