-- =============================================================
-- 019 · Bloqueia baixa de estoque maior que o saldo disponível
-- =============================================================
-- Achado ao investigar "estoque de HEXARON WG zerado sem explicação"
-- (Fazenda Guanabara, 02/09/2026): a líder salvou a mesma aplicação
-- DUAS vezes (clique duplo / reenvio), 5,6s de diferença, idêntica em
-- tudo. fn_decrement_lote_aplicacao() nunca validou se o lote tinha
-- saldo suficiente — só fazia `quantidade_atual = greatest(0, atual -
-- retirado)`, ou seja, aceita QUALQUER retirada e trava em zero sem
-- avisar. Auditoria no banco inteiro achou o mesmo padrão (retirada
-- líquida > tudo que já esteve disponível no lote) em outros lotes;
-- alguns têm causa clara (duplicidade), outros ainda em investigação
-- manual — não foram tocados por este script.
--
-- Esta migration faz a baixa de estoque REJEITAR (erro visível pro
-- usuário) em vez de aceitar e zerar silenciosamente, nos dois
-- caminhos da função: lote explícito e fallback FEFO (sem lote_id).
--
-- Efeito colateral aceito: como o app grava aplicação → talhões →
-- itens em 3 chamadas separadas (não é uma transação só), se o erro
-- disparar na hora de gravar os itens, a aplicação já foi criada
-- (cabeçalho fica no ar, 0 itens) — mesma situação que já existia por
-- outros motivos (RLS, etc.) e que `cancelar_aplicacao()`/exclusão
-- lógica já sabem tratar. Prioridade: nunca mais corromper saldo
-- silenciosamente > nunca deixar um cabeçalho órfão. Aditivo,
-- reversível (rollback no final).
-- =============================================================

create or replace function public.fn_decrement_lote_aplicacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_net  numeric;
  v_rest numeric;
  v_lote record;
  v_take numeric;
  v_org  uuid;
  v_status text;
  v_lote_org uuid;
  v_lote_atual numeric;
  v_def_org uuid;
  v_def_nome text;
begin
  select organizacao_id, status into v_org, v_status from public.aplicacoes where id = new.aplicacao_id;
  if v_org is null then
    raise exception 'Aplicação % não encontrada ou sem empresa.', new.aplicacao_id;
  end if;
  if v_status = 'cancelada' then
    raise exception 'Aplicação cancelada não aceita itens.';
  end if;
  select organizacao_id, nome_comercial into v_def_org, v_def_nome from public.defensivos where id = new.defensivo_id;
  if v_def_org is distinct from v_org then
    raise exception 'Defensivo % não pertence à empresa da aplicação.', new.defensivo_id using errcode = '42501';
  end if;

  v_net := greatest(0, new.quantidade_usada - coalesce(new.quantidade_sobrou, 0));

  if new.lote_id is not null then
    select organizacao_id, quantidade_atual into v_lote_org, v_lote_atual from public.lotes where id = new.lote_id;
    if v_lote_org is distinct from v_org then
      raise exception 'Lote % não pertence à empresa da aplicação.', new.lote_id using errcode = '42501';
    end if;
    if v_lote_atual < v_net - 0.001 then
      raise exception 'Estoque insuficiente no lote de %: disponível %, tentando retirar %. Confira se essa aplicação já não foi salva antes (duplicidade) ou escolha outro lote.',
        coalesce(v_def_nome, new.defensivo_id::text), v_lote_atual, v_net using errcode = '23514';
    end if;
    update public.lotes
    set quantidade_atual = quantidade_atual - v_net
    where id = new.lote_id;
  else
    v_rest := v_net;
    for v_lote in
      select id, quantidade_atual from public.lotes
      where defensivo_id = new.defensivo_id and quantidade_atual > 0
        and organizacao_id = v_org
      order by data_vencimento asc nulls last, created_at asc
    loop
      exit when v_rest <= 0;
      v_take := least(v_lote.quantidade_atual, v_rest);
      update public.lotes set quantidade_atual = quantidade_atual - v_take where id = v_lote.id;
      v_rest := v_rest - v_take;
    end loop;
    if v_rest > 0.001 then
      raise exception 'Estoque insuficiente de %: faltam % (nenhum lote com saldo disponível). Confira se essa aplicação já não foi salva antes (duplicidade).',
        coalesce(v_def_nome, new.defensivo_id::text), v_rest using errcode = '23514';
    end if;
  end if;

  insert into public.movimentacoes
    (defensivo_id, lote_id, tipo, quantidade, aplicacao_id, usuario_id, observacoes, organizacao_id)
  values
    (new.defensivo_id, new.lote_id, 'saida_aplicacao', new.quantidade_usada,
     new.aplicacao_id, auth.uid(), 'Saída por aplicação', v_org);

  if coalesce(new.quantidade_sobrou, 0) > 0 then
    insert into public.movimentacoes
      (defensivo_id, lote_id, tipo, quantidade, aplicacao_id, usuario_id, observacoes, organizacao_id)
    values
      (new.defensivo_id, new.lote_id, 'devolucao_sobra', new.quantidade_sobrou,
       new.aplicacao_id, auth.uid(), 'Sobra devolvida ao estoque', v_org);
  end if;
  return new;
end;
$function$;

-- =============================================================
-- Rollback (se necessário): recriar fn_decrement_lote_aplicacao() como
-- estava na migration 017 (greatest(0, ...) sem validação).
-- =============================================================
