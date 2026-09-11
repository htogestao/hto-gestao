-- =============================================================
-- Correção pontual — 24 lotes "Estoque inicial" fantasma (jun/2026)
-- que duplicam saldo de lote de compra real já em uso ativo
-- =============================================================
-- Contexto: o ajuste_retroativo_86_lotes_jun2026.sql (2026-09-08)
-- restaurou saldo de 86 lotes "Estoque inicial sem NF" que tinham
-- sido zerados. A auditoria de 2026-09-08 já suspeitava que esse
-- zeramento era limpeza deliberada de duplicidade, não bug — mas
-- não tinha como confirmar sem contagem física ("só contagem
-- física resolve", ver memória htogestao-estoque-custo).
--
-- Gatilho: time de campo reportou o MIRATO fisicamente zerado.
-- Investigação (2026-09-11) achou: o lote "Estoque inicial sem NF"
-- do MIRATO tinha 160,87L parados desde 08/06/2026, nunca usados em
-- nenhuma aplicação, enquanto o lote REAL (NF 1780, comprado
-- 13/04/2026) vinha sendo consumido normalmente e chegou a 12,45L
-- após a aplicação da Filadélfia (04/09). O sistema somava os dois
-- e mostrava 173L — o time via a prateleira vazia porque os 160,87L
-- nunca existiram fisicamente pra consumo.
--
-- Varredura completa (só leitura) achou 89 lotes no mesmo padrão
-- ("Estoque inicial" sem NF, saldo>0, zero consumo histórico).
-- Destes, 24 têm evidência forte de duplicidade: existe um lote
-- irmão do mesmo defensivo+empresa com NF/data de compra real E
-- histórico de saída de aplicação comprovado (ou seja, o irmão é
-- o lote realmente em uso). Os outros 65 (11 da AGRO MÁXIMO sem
-- nenhum irmão — estoque inicial legítimo, não mexer; e 54 da
-- Agrícola MV cujo irmão também nunca foi consumido — evidência
-- fraca, não mexidos aqui, precisam de contagem física ou decisão
-- manual) NÃO são tocados por este script.
--
-- Ação: zera quantidade_atual dos 24 lotes fantasma (mantém
-- quantidade_comprada como registro histórico do que a planilha
-- física de jun/2026 apontou — não apaga o lote) e registra um
-- 'ajuste' negativo no razão, auditável e reversível (mesmo padrão
-- do ajuste_retroativo_86_lotes_jun2026.sql).
--
-- organizacao_id é setado explicitamente no INSERT (não confiar no
-- trigger fn_set_org, que preenche via current_org()/auth.uid() —
-- rodando pela Management API sem sessão seria NULL, repetindo o
-- mesmo bug já corrigido em fix_org_movimentacoes_ajuste_retroativo_2026-09.sql).
-- =============================================================

with alvo as (
  select id as lote_id, defensivo_id, organizacao_id, quantidade_atual as valor
  from public.lotes
  where id in (
    '06cd606b-6b61-4191-b17f-f3528a8ecdf5', -- AGRUS START
    '43782c77-e760-4f4f-92ba-66a1c6636306', -- AKTUS
    '5b0f523c-157c-46f1-a4b7-d4013dc781fe', -- ALION
    'e9de5879-4f7b-4074-b0e3-61aca3c6b76d', -- ALTACOR
    '03726fec-9330-415a-a8a5-0d9e33648f41', -- ARREIO
    '66d26b84-2fa1-4db6-85dd-1611238478a8', -- BROKER 750 WG
    'de704db2-0561-45b8-a95e-a52c7c088bcb', -- COACT
    'b57b913c-3589-4627-97cb-f8f72d1f8c51', -- COMPASS
    '2d84f51a-6584-4094-8a00-09258769f02d', -- CONECT TOP OIL
    'a93a4870-a44a-4001-96e8-4d7926fcd2e5', -- ETHREL
    '23918aa6-e86a-4a55-af3b-1cff438bd9a5', -- GALES
    'e0d9f599-dd48-4c71-87a3-3b4a994a1735', -- GALOPEIRO
    '1febcdbb-0dbc-4b25-ae74-b56ef71448eb', -- HEXARON WG
    '5c8505ec-9d55-4eda-af06-f71ad385b32a', -- LUMICA
    '4e5dc7ed-b659-4e4e-96a7-45c6941d8d5a', -- MESOTRIONA
    '65e31f4b-06c8-4b7f-a45f-c322c7e4f76c', -- METRIBUZIM 480 SC
    '24b86222-a6a3-4419-931b-4fd6175aa100', -- METSULFURON
    'b2414759-0124-4719-bb35-c7f02ac5529c', -- MIRATO
    '2e75805b-651a-4eb7-96f4-14c7a585d938', -- NONGRASS
    '48f7a49e-2ed7-4c98-b274-42c34ad20cde', -- OSBAR
    '2153d3d0-156f-4d98-badb-96186a1e696f', -- QUID OIL
    '68b4edc6-6d1a-496b-b6eb-036a92fad790', -- REPHON 800 WG
    '1fab1d12-af81-4815-96da-4c3db4a3c0bf', -- REPORTH
    'fed14722-df49-4682-b9aa-1c1fe52943b0'  -- RITMO
  )
),
upd as (
  update public.lotes l
  set quantidade_atual = 0
  from alvo a
  where l.id = a.lote_id
  returning l.id
)
insert into public.movimentacoes (defensivo_id, lote_id, tipo, quantidade, organizacao_id, usuario_id, observacoes)
select defensivo_id, lote_id, 'ajuste', -valor, organizacao_id,
  'e203adf0-f9ed-40f7-9079-7784db5cf590',
  'Correção de duplicidade confirmada 2026-09-11: lote "Estoque inicial sem NF" (jun/2026) nunca consumido, duplicava saldo de lote de compra real ativamente usado. Reversão pontual do ajuste_retroativo_86_lotes_jun2026.sql para este lote. Gatilho: MIRATO reportado zerado fisicamente pelo time de campo.'
from alvo;

-- Verificação (rodar depois): deve retornar as 24 linhas com quantidade_atual = 0
-- select id, quantidade_comprada, quantidade_atual from public.lotes where id in (...);

-- Rollback (se necessário): restaurar quantidade_atual = quantidade_comprada * 6023/7301
-- proporcional por lote (mesma fórmula do ajuste_retroativo_86_lotes_jun2026.sql) e
-- apagar as movimentações 'ajuste' inseridas por este script (observacoes contém
-- 'Correção de duplicidade confirmada 2026-09-11').
