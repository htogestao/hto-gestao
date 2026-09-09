-- =============================================================
-- Corrige lote errado selecionado: HEXARON WG, Fazenda Guanabara
-- =============================================================
-- Achado ao investigar o estoque zerado do HEXARON WG (ver commits
-- bca6e46/d7d281c). Depois de cancelar a aplicação duplicada
-- (3bf4f377), sobrou uma inconsistência: a aplicação real
-- (d02dc9d8, Fazenda Guanabara, 02/09/2026) retirou 1.100 kg (sobra
-- 20 kg, líquido 1.080 kg) do lote NF151 — que só tinha 45 kg
-- comprados. O produtor confirmou a causa: o operador selecionou o
-- lote errado no formulário (NF151) quando deveria ter escolhido o
-- NF4960, que tinha 1.200 kg disponíveis (suficiente pra cobrir a
-- retirada).
--
-- Este script corrige os DOIS lotes e o item da aplicação, sem
-- apagar nenhuma movimentação existente (razão auditável, igual ao
-- padrão já usado no ajuste retroativo de junho):
--   NF151 (cc62f86b):  1.080,000 -> 45,000   (devolve o que nunca deveria ter saído daqui)
--   NF4960 (9b92eabb): 1.200,000 -> 120,000  (debita a retirada real, que era daqui)
--   aplicacao_itens.lote_id do item HEXARON WG na aplicação d02dc9d8
--     passa de NF151 pra NF4960, pra bater com o razão corrigido.
--
-- Pré-condições checadas manualmente antes de rodar (ver comentário
-- no fim): os dois lotes precisam estar exatamente nos valores atuais
-- esperados, senão o script não faz nada (WHERE trava por segurança).
-- =============================================================

do $$
declare
  v_hexaron_id  uuid := 'd0000000-0000-0000-0000-000000000022';
  v_org_id      uuid := '52f1c460-cdf7-436a-b6fc-a032f890a028'; -- Agrícola MV
  v_lote_151    uuid := 'cc62f86b-a3b8-4182-a119-6a13f515be9c';
  v_lote_4960   uuid := '9b92eabb-f11d-4351-b2ed-cb6f8ff0055b';
  v_item_id     uuid := '3f4aa0f7-d5f6-4d3a-aba8-cc2dcd006879';
  v_admin       uuid := 'e203adf0-f9ed-40f7-9079-7784db5cf590';
  v_atual_151   numeric;
  v_atual_4960  numeric;
begin
  select quantidade_atual into v_atual_151  from public.lotes where id = v_lote_151;
  select quantidade_atual into v_atual_4960 from public.lotes where id = v_lote_4960;

  if v_atual_151 is distinct from 1080.000 or v_atual_4960 is distinct from 1200.000 then
    raise exception 'Estado inesperado (NF151=%, NF4960=%) — não bate com o esperado (1080/1200). Abortando sem mexer em nada, confira manualmente.', v_atual_151, v_atual_4960;
  end if;

  -- Devolve os 1.080 kg que nunca deveriam ter saído do NF151
  update public.lotes set quantidade_atual = 45.000 where id = v_lote_151;
  insert into public.movimentacoes (defensivo_id, lote_id, tipo, quantidade, usuario_id, observacoes, organizacao_id)
  values (v_hexaron_id, v_lote_151, 'ajuste', -1035.000, v_admin,
    'Correção: lote errado selecionado na aplicação d02dc9d8 (Fazenda Guanabara, 02/09/2026) — a retirada de 1.100kg/sobra 20kg deveria ter sido do lote NF4960 (saldo suficiente), não do NF151 (só 45kg comprados, confirmado com o produtor em 09/09/2026). Devolvendo o NF151 ao valor da entrada original.',
    v_org_id);

  -- Debita a retirada real (1.080 kg líquido) do lote correto
  update public.lotes set quantidade_atual = 120.000 where id = v_lote_4960;
  insert into public.movimentacoes (defensivo_id, lote_id, tipo, quantidade, usuario_id, observacoes, organizacao_id)
  values (v_hexaron_id, v_lote_4960, 'ajuste', -1080.000, v_admin,
    'Correção: retirada de 1.080kg líquidos (1.100 retirada - 20 sobra) da aplicação d02dc9d8 (Fazenda Guanabara, 02/09/2026), debitada por engano do NF151. Este é o lote correto (tinha saldo suficiente).',
    v_org_id);

  -- Aponta o item da aplicação pro lote certo, pra bater com o razão daqui pra frente
  update public.aplicacao_itens set lote_id = v_lote_4960 where id = v_item_id and lote_id = v_lote_151;

  if not found then
    raise exception 'Item da aplicação não encontrado no estado esperado — revertendo tudo.';
  end if;
end $$;
