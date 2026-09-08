-- =============================================================
-- Script de DADO — corrige organizacao_id nulo nas 86 movimentações
-- do ajuste retroativo (ver supabase/ajuste_retroativo_86_lotes_jun2026.sql)
-- =============================================================
-- JÁ RODOU em produção em 2026-09-08 (Tarefa B da sessão pós-auditoria).
-- NÃO REEXECUTAR — é idempotente (filtra organizacao_id IS NULL), mas
-- não há motivo para rodar de novo.
--
-- Causa: o ajuste foi executado via Management API, sem sessão de
-- usuário; fn_set_org() usa current_org() = auth.uid() → NULL. Com
-- organizacao_id NULL, o org_guard esconde as 86 linhas de todo usuário
-- (Movimentações, export, backup, reconciliação).
--
-- Escopo: SÓ organizacao_id, copiado de lotes.organizacao_id do lote da
-- própria movimentação. Quantidade, lote, data e observação intocados.
-- Pré-condição verificada antes de aplicar: as 86 linhas apontam para
-- lotes de uma única empresa (Agrícola MV, 52f1c460-…).
-- A possível dupla contagem (C4 da auditoria) NÃO é tratada aqui —
-- depende de contagem física.
-- =============================================================

update public.movimentacoes m
set organizacao_id = l.organizacao_id
from public.lotes l
where l.id = m.lote_id
  and m.tipo = 'ajuste'
  and m.organizacao_id is null
  and m.observacoes like 'Ajuste retroativo — origem: script de carga não versionado%';
