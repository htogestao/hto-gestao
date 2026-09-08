-- =============================================================
-- Script de DADO — marca como canceladas as 2 aplicações órfãs
-- =============================================================
-- JÁ RODOU em produção em 2026-09-08 (sessão I1+I2+I3). NÃO REEXECUTAR
-- (idempotente pelo filtro, mas sem motivo para rodar de novo).
--
-- Origem (auditoria, item I3): "Excluir" na tela Editar apagava os itens
-- (gatilho devolveu o estoque e gravou no razão) e depois falhava ao apagar
-- o cabeçalho, porque movimentacoes.aplicacao_id é FK sem ON DELETE. A tela
-- ignorava o erro. Resultado: 2 aplicações sem itens, com estoque já
-- devolvido, contando em "aplicações no mês".
--   10b184a0-67ca-46db-8c67-a50f0477ea6a (24/06/2026, em_andamento, 6 movs)
--   14ee10a5-4068-4d8a-b697-2057bc4f087c (27/07/2026, encerrada, 3 movs)
--
-- Tratamento: status 'cancelada' (modelo da migration 017). NÃO mexe em
-- estoque nem razão — o estorno já aconteceu no dia da exclusão. Requer 017.
-- Rodado como postgres (Management API): trg_aplicacoes_guard só barra
-- chamadas via papel authenticated/anon.
-- =============================================================

update public.aplicacoes
set status = 'cancelada',
    cancelada_em = now(),
    motivo_cancelamento = 'Cabeçalho órfão de exclusão que falhou (auditoria 2026-09-08); estoque já estornado pelo gatilho na data da exclusão'
where id in ('10b184a0-67ca-46db-8c67-a50f0477ea6a', '14ee10a5-4068-4d8a-b697-2057bc4f087c')
  and status <> 'cancelada'
  and not exists (select 1 from public.aplicacao_itens i where i.aplicacao_id = aplicacoes.id);
