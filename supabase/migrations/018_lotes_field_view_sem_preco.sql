-- =============================================================
-- 018 · Papel `field` (líder) deixa de ler a tabela `lotes`
-- =============================================================
-- Achado da auditoria: a policy lotes_select_field liberava a tabela
-- inteira para o líder, inclusive preco_unitario e valor_total. RLS é
-- por linha, não por coluna; a "proteção" era só a tela não mostrar.
--
-- Solução: o líder lê SOMENTE pela view lotes_field_view, que não tem as
-- colunas de preço. A view passa a ser SECURITY DEFINER (dona: postgres),
-- por isso NÃO herda a RLS de lotes — o escopo é explícito no WHERE:
-- empresa do usuário + usuário ativo com papel. Sem a policy, a tabela
-- `lotes` devolve zero linhas para o líder (RLS sem policy permissiva).
-- Admin/viewer continuam lendo `lotes` direto, com preço.
--
-- A view antiga tinha menos colunas; recriada com numero_nf, fornecedor,
-- organizacao_id e cultura_id (o web usa nas telas de aplicação/estoque).
-- Mobile já lia por esta view (sync.ts). Aditivo e reversível.
-- =============================================================

drop policy if exists lotes_select_field on public.lotes;

drop view if exists public.lotes_field_view;
create view public.lotes_field_view
with (security_invoker = false) as
  select
    id, defensivo_id, numero_nf, fornecedor, data_compra,
    quantidade_comprada, quantidade_atual,
    data_fabricacao, data_vencimento, lote_fabricante, observacoes,
    created_at, organizacao_id, cultura_id
  from public.lotes
  where organizacao_id = public.current_org()
    and public.current_user_role() is not null;

revoke all on public.lotes_field_view from public, anon;
grant select on public.lotes_field_view to authenticated;

-- =============================================================
-- Rollback: recriar a policy lotes_select_field (002) e a view com
-- security_invoker = true.
-- =============================================================
