-- =============================================================
-- Reverte cancelamento indevido: aplicação AKTUS, Fazenda Cabeceira
-- Limpa (23/07/2026), cancelada por engano em 09/09/2026
-- =============================================================
-- cancelar_aplicacao() não tem "desfazer" no app de propósito (é
-- exclusão lógica, pensada pra não ser mexida por fora da RPC) — mas
-- o usuário confirmou que cancelou essa por engano e pediu pra
-- restaurar. Reverte manualmente:
--   1) debita de novo o líquido que tinha sido estornado (12,425 L)
--      do lote NF7877, com um 'ajuste' negativo (mantém as duas
--      movimentações antigas no razão, não apaga nada).
--   2) volta status pra 'encerrada' (era uma aplicação já concluída
--      — período 08:17-10:17, área e consumo preenchidos) e limpa os
--      campos de cancelamento.
-- Idempotente via checagem de pré-condição (só roda se ainda estiver
-- cancelada com o estorno esperado).
-- =============================================================

do $$
declare
  v_aplicacao_id uuid := 'fb66ef09-bd11-4ca1-8864-8dcef9c1c86b';
  v_lote_id      uuid := '42fa3137-e7f1-43e6-9516-d748a5e2e860';
  v_defensivo_id uuid := 'd0000000-0000-0000-0000-000000000002'; -- AKTUS
  v_org_id       uuid := '52f1c460-cdf7-436a-b6fc-a032f890a028'; -- Agrícola MV
  v_admin        uuid := 'e203adf0-f9ed-40f7-9079-7784db5cf590';
  v_status       text;
  v_lote_atual   numeric;
begin
  select status into v_status from public.aplicacoes where id = v_aplicacao_id;
  if v_status is distinct from 'cancelada' then
    raise exception 'Aplicação não está cancelada (status=%) — nada a reverter.', v_status;
  end if;

  select quantidade_atual into v_lote_atual from public.lotes where id = v_lote_id;
  if v_lote_atual < 12.425 then
    raise exception 'Lote NF7877 não tem os 12,425L pra debitar de volta (saldo atual=%).', v_lote_atual;
  end if;

  update public.lotes set quantidade_atual = quantidade_atual - 12.425 where id = v_lote_id;
  insert into public.movimentacoes (defensivo_id, lote_id, tipo, quantidade, usuario_id, observacoes, organizacao_id)
  values (v_defensivo_id, v_lote_id, 'ajuste', -12.425, v_admin,
    'Reversão de cancelamento indevido da aplicação ' || v_aplicacao_id::text || ' (Fazenda Cabeceira Limpa, 23/07/2026) — usuário cancelou por engano em 09/09/2026 e pediu pra restaurar.',
    v_org_id);

  update public.aplicacoes
  set status = 'encerrada', cancelada_em = null, cancelada_por = null, motivo_cancelamento = null
  where id = v_aplicacao_id;
end $$;
