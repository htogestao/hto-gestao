-- =============================================================
-- 006 · Reconciliação Etapa 0 — objetos aplicados no painel, nunca versionados
-- =============================================================
-- Gerado a partir do schema REAL de produção (dump via Management API,
-- 2026-07-24). Versiona EXATAMENTE como está em produção (sem refatorar).
-- Contém só o DELTA: funções/triggers/policies/índices que NÃO estavam
-- em 001-005. Documentação/reprodutibilidade — o banco JÁ tem tudo isto.
-- =============================================================
--
-- ⚠️ GAP CONHECIDO — ESTE ARQUIVO NÃO É A FONTE COMPLETA DO SCHEMA.
-- As tabelas abaixo EXISTEM em produção mas NÃO estão versionadas em
-- nenhuma migration (foram criadas via painel; o dump Docker-free via
-- Management API não captura FKs/constraints para reconstruí-las com
-- fidelidade):
--   organizacoes, culturas, safras, ciclos, operadores, frotas,
--   aplicacao_talhoes, inventario_fisico, inventario_itens
--   + view lotes_field_view
--   + colunas adicionadas por ALTER em tabelas do 001 (organizacao_id,
--     cultura_id, operacao, operador_id/operador, frota_id/frota,
--     tipo_aplicacao, hora_inicio/fim, temperatura/umidade/vento, etc.)
--
-- Portanto, rodar 001→006 num banco vazio NÃO recria a produção.
-- Para fechar o gap (reprodutibilidade 100% do zero) é preciso um
-- pg_dump --schema-only real (binário nativo, Docker-free) e versionar
-- as tabelas/colunas num 007_tabelas_completo.sql. Ver "passo (ii)".
-- =============================================================

-- ─────────── FUNÇÕES ───────────

CREATE OR REPLACE FUNCTION public.aplicar_inventario(p_inventario_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_role      text;
  v_item      record;
  v_lote      record;
  v_diff      numeric;
  v_remover   numeric;
  v_tirar     numeric;
  v_lote_novo uuid;
BEGIN
  v_role := public.current_user_role();
  IF v_role NOT IN ('admin','viewer') THEN
    RAISE EXCEPTION 'Sem permissão para aplicar inventário';
  END IF;

  IF EXISTS (SELECT 1 FROM public.inventario_fisico WHERE id = p_inventario_id AND aplicado) THEN
    RAISE EXCEPTION 'Este inventário já foi aplicado ao estoque';
  END IF;

  FOR v_item IN
    SELECT defensivo_id, diferenca
    FROM public.inventario_itens
    WHERE inventario_id = p_inventario_id AND diferenca <> 0
  LOOP
    v_diff := v_item.diferenca;

    IF v_diff > 0 THEN
      SELECT id INTO v_lote_novo
      FROM public.lotes
      WHERE defensivo_id = v_item.defensivo_id
      ORDER BY created_at DESC
      LIMIT 1;

      IF v_lote_novo IS NULL THEN
        INSERT INTO public.lotes (defensivo_id, quantidade_comprada, quantidade_atual, observacoes)
        VALUES (v_item.defensivo_id, v_diff, v_diff, 'Ajuste de inventário físico');
      ELSE
        UPDATE public.lotes SET quantidade_atual = quantidade_atual + v_diff
        WHERE id = v_lote_novo;
      END IF;
    ELSE
      v_remover := -v_diff;
      FOR v_lote IN
        SELECT id, quantidade_atual
        FROM public.lotes
        WHERE defensivo_id = v_item.defensivo_id AND quantidade_atual > 0
        ORDER BY created_at DESC
      LOOP
        EXIT WHEN v_remover <= 0;
        v_tirar := LEAST(v_lote.quantidade_atual, v_remover);
        UPDATE public.lotes SET quantidade_atual = quantidade_atual - v_tirar
        WHERE id = v_lote.id;
        v_remover := v_remover - v_tirar;
      END LOOP;
    END IF;

    INSERT INTO public.movimentacoes (defensivo_id, tipo, quantidade, usuario_id, observacoes)
    VALUES (
      v_item.defensivo_id, 'ajuste', v_diff, auth.uid(),
      'Ajuste por inventário físico ' || p_inventario_id::text
    );
  END LOOP;

  UPDATE public.inventario_fisico
  SET aplicado = true, aplicado_em = now()
  WHERE id = p_inventario_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.current_org()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT organizacao_id FROM public.profiles WHERE id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.fn_decrement_lote_aplicacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_net  numeric;
  v_rest numeric;
  v_lote record;
  v_take numeric;
BEGIN
  v_net := GREATEST(0, NEW.quantidade_usada - COALESCE(NEW.quantidade_sobrou, 0));

  IF NEW.lote_id IS NOT NULL THEN
    UPDATE public.lotes
    SET quantidade_atual = GREATEST(0, quantidade_atual - v_net)
    WHERE id = NEW.lote_id;
  ELSE
    v_rest := v_net;
    FOR v_lote IN
      SELECT id, quantidade_atual FROM public.lotes
      WHERE defensivo_id = NEW.defensivo_id AND quantidade_atual > 0
      ORDER BY data_vencimento ASC NULLS LAST, created_at ASC
    LOOP
      EXIT WHEN v_rest <= 0;
      v_take := LEAST(v_lote.quantidade_atual, v_rest);
      UPDATE public.lotes SET quantidade_atual = quantidade_atual - v_take WHERE id = v_lote.id;
      v_rest := v_rest - v_take;
    END LOOP;
  END IF;

  INSERT INTO public.movimentacoes
    (defensivo_id, lote_id, tipo, quantidade, aplicacao_id, usuario_id, observacoes)
  VALUES
    (NEW.defensivo_id, NEW.lote_id, 'saida_aplicacao', NEW.quantidade_usada,
     NEW.aplicacao_id, auth.uid(), 'Saída por aplicação');

  IF COALESCE(NEW.quantidade_sobrou, 0) > 0 THEN
    INSERT INTO public.movimentacoes
      (defensivo_id, lote_id, tipo, quantidade, aplicacao_id, usuario_id, observacoes)
    VALUES
      (NEW.defensivo_id, NEW.lote_id, 'devolucao_sobra', NEW.quantidade_sobrou,
       NEW.aplicacao_id, auth.uid(), 'Sobra devolvida ao estoque');
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_restore_lote_aplicacao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_net  numeric;
  v_lote uuid;
BEGIN
  v_net := GREATEST(0, OLD.quantidade_usada - COALESCE(OLD.quantidade_sobrou, 0));
  v_lote := OLD.lote_id;
  IF v_lote IS NULL THEN
    SELECT id INTO v_lote FROM public.lotes
    WHERE defensivo_id = OLD.defensivo_id ORDER BY created_at DESC LIMIT 1;
  END IF;
  IF v_lote IS NOT NULL THEN
    UPDATE public.lotes SET quantidade_atual = quantidade_atual + v_net WHERE id = v_lote;
    INSERT INTO public.movimentacoes
      (defensivo_id, lote_id, tipo, quantidade, aplicacao_id, usuario_id, observacoes)
    VALUES
      (OLD.defensivo_id, v_lote, 'devolucao_sobra', v_net,
       OLD.aplicacao_id, auth.uid(), 'Devolução por exclusão de aplicação');
  END IF;
  RETURN OLD;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.fn_set_org()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF NEW.organizacao_id IS NULL THEN
    NEW.organizacao_id := public.current_org();
  END IF;
  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE v_org uuid;
BEGIN
  SELECT id INTO v_org FROM public.organizacoes ORDER BY criado_em LIMIT 1;
  INSERT INTO public.profiles (id, nome, role, organizacao_id)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role','field'),
    v_org
  );
  RETURN new;
END;
$function$
;


-- ─────────── TRIGGERS ───────────

DROP TRIGGER IF EXISTS trg_decrement_lote ON public.aplicacao_itens;
CREATE TRIGGER trg_decrement_lote AFTER INSERT ON public.aplicacao_itens FOR EACH ROW EXECUTE FUNCTION fn_decrement_lote_aplicacao();

DROP TRIGGER IF EXISTS trg_restore_lote ON public.aplicacao_itens;
CREATE TRIGGER trg_restore_lote AFTER DELETE ON public.aplicacao_itens FOR EACH ROW EXECUTE FUNCTION fn_restore_lote_aplicacao();

DROP TRIGGER IF EXISTS trg_set_org ON public.fazendas;
CREATE TRIGGER trg_set_org BEFORE INSERT ON public.fazendas FOR EACH ROW EXECUTE FUNCTION fn_set_org();

DROP TRIGGER IF EXISTS trg_set_org ON public.talhoes;
CREATE TRIGGER trg_set_org BEFORE INSERT ON public.talhoes FOR EACH ROW EXECUTE FUNCTION fn_set_org();

DROP TRIGGER IF EXISTS trg_set_org ON public.defensivos;
CREATE TRIGGER trg_set_org BEFORE INSERT ON public.defensivos FOR EACH ROW EXECUTE FUNCTION fn_set_org();

DROP TRIGGER IF EXISTS trg_set_org ON public.lotes;
CREATE TRIGGER trg_set_org BEFORE INSERT ON public.lotes FOR EACH ROW EXECUTE FUNCTION fn_set_org();

DROP TRIGGER IF EXISTS trg_set_org ON public.aplicacoes;
CREATE TRIGGER trg_set_org BEFORE INSERT ON public.aplicacoes FOR EACH ROW EXECUTE FUNCTION fn_set_org();

DROP TRIGGER IF EXISTS trg_set_org ON public.movimentacoes;
CREATE TRIGGER trg_set_org BEFORE INSERT ON public.movimentacoes FOR EACH ROW EXECUTE FUNCTION fn_set_org();

DROP TRIGGER IF EXISTS trg_set_org ON public.inventario_fisico;
CREATE TRIGGER trg_set_org BEFORE INSERT ON public.inventario_fisico FOR EACH ROW EXECUTE FUNCTION fn_set_org();

DROP TRIGGER IF EXISTS trg_set_org ON public.culturas;
CREATE TRIGGER trg_set_org BEFORE INSERT ON public.culturas FOR EACH ROW EXECUTE FUNCTION fn_set_org();

DROP TRIGGER IF EXISTS trg_set_org ON public.safras;
CREATE TRIGGER trg_set_org BEFORE INSERT ON public.safras FOR EACH ROW EXECUTE FUNCTION fn_set_org();

DROP TRIGGER IF EXISTS trg_set_org ON public.ciclos;
CREATE TRIGGER trg_set_org BEFORE INSERT ON public.ciclos FOR EACH ROW EXECUTE FUNCTION fn_set_org();


-- ─────────── RLS POLICIES ───────────

DROP POLICY IF EXISTS "aplic_talhoes_delete" ON public.aplicacao_talhoes;
CREATE POLICY "aplic_talhoes_delete" ON public.aplicacao_talhoes AS PERMISSIVE FOR DELETE TO public
  USING (((current_user_role() = ANY (ARRAY['admin'::text, 'viewer'::text])) OR (EXISTS ( SELECT 1
   FROM aplicacoes a
  WHERE ((a.id = aplicacao_talhoes.aplicacao_id) AND (a.responsavel_id = auth.uid()))))));

DROP POLICY IF EXISTS "aplic_talhoes_insert" ON public.aplicacao_talhoes;
CREATE POLICY "aplic_talhoes_insert" ON public.aplicacao_talhoes AS PERMISSIVE FOR INSERT TO public
  WITH CHECK ((current_user_role() = ANY (ARRAY['admin'::text, 'viewer'::text, 'field'::text])));

DROP POLICY IF EXISTS "aplic_talhoes_select" ON public.aplicacao_talhoes;
CREATE POLICY "aplic_talhoes_select" ON public.aplicacao_talhoes AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_role() = ANY (ARRAY['admin'::text, 'viewer'::text, 'field'::text])));

DROP POLICY IF EXISTS "org_guard" ON public.aplicacoes;
CREATE POLICY "org_guard" ON public.aplicacoes AS RESTRICTIVE FOR ALL TO public
  USING ((organizacao_id = current_org()))
  WITH CHECK ((organizacao_id = current_org()));

DROP POLICY IF EXISTS "ciclos_select" ON public.ciclos;
CREATE POLICY "ciclos_select" ON public.ciclos AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_role() = ANY (ARRAY['admin'::text, 'viewer'::text, 'field'::text])));

DROP POLICY IF EXISTS "ciclos_write" ON public.ciclos;
CREATE POLICY "ciclos_write" ON public.ciclos AS PERMISSIVE FOR ALL TO public
  USING ((current_user_role() = ANY (ARRAY['admin'::text, 'viewer'::text])))
  WITH CHECK ((current_user_role() = ANY (ARRAY['admin'::text, 'viewer'::text])));

DROP POLICY IF EXISTS "org_guard" ON public.ciclos;
CREATE POLICY "org_guard" ON public.ciclos AS RESTRICTIVE FOR ALL TO public
  USING ((organizacao_id = current_org()))
  WITH CHECK ((organizacao_id = current_org()));

DROP POLICY IF EXISTS "culturas_select" ON public.culturas;
CREATE POLICY "culturas_select" ON public.culturas AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_role() = ANY (ARRAY['admin'::text, 'viewer'::text, 'field'::text])));

DROP POLICY IF EXISTS "culturas_write" ON public.culturas;
CREATE POLICY "culturas_write" ON public.culturas AS PERMISSIVE FOR ALL TO public
  USING ((current_user_role() = ANY (ARRAY['admin'::text, 'viewer'::text])))
  WITH CHECK ((current_user_role() = ANY (ARRAY['admin'::text, 'viewer'::text])));

DROP POLICY IF EXISTS "org_guard" ON public.culturas;
CREATE POLICY "org_guard" ON public.culturas AS RESTRICTIVE FOR ALL TO public
  USING ((organizacao_id = current_org()))
  WITH CHECK ((organizacao_id = current_org()));

DROP POLICY IF EXISTS "org_guard" ON public.defensivos;
CREATE POLICY "org_guard" ON public.defensivos AS RESTRICTIVE FOR ALL TO public
  USING ((organizacao_id = current_org()))
  WITH CHECK ((organizacao_id = current_org()));

DROP POLICY IF EXISTS "org_guard" ON public.fazendas;
CREATE POLICY "org_guard" ON public.fazendas AS RESTRICTIVE FOR ALL TO public
  USING ((organizacao_id = current_org()))
  WITH CHECK ((organizacao_id = current_org()));

DROP POLICY IF EXISTS "frotas_select" ON public.frotas;
CREATE POLICY "frotas_select" ON public.frotas AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_role() = ANY (ARRAY['admin'::text, 'viewer'::text, 'field'::text])));

DROP POLICY IF EXISTS "frotas_write" ON public.frotas;
CREATE POLICY "frotas_write" ON public.frotas AS PERMISSIVE FOR ALL TO public
  USING ((current_user_role() = ANY (ARRAY['admin'::text, 'viewer'::text])))
  WITH CHECK ((current_user_role() = ANY (ARRAY['admin'::text, 'viewer'::text])));

DROP POLICY IF EXISTS "org_guard" ON public.frotas;
CREATE POLICY "org_guard" ON public.frotas AS RESTRICTIVE FOR ALL TO public
  USING ((organizacao_id = current_org()))
  WITH CHECK ((organizacao_id = current_org()));

DROP POLICY IF EXISTS "inventario_all" ON public.inventario_fisico;
CREATE POLICY "inventario_all" ON public.inventario_fisico AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "org_guard" ON public.inventario_fisico;
CREATE POLICY "org_guard" ON public.inventario_fisico AS RESTRICTIVE FOR ALL TO public
  USING ((organizacao_id = current_org()))
  WITH CHECK ((organizacao_id = current_org()));

DROP POLICY IF EXISTS "inventario_itens_all" ON public.inventario_itens;
CREATE POLICY "inventario_itens_all" ON public.inventario_itens AS PERMISSIVE FOR ALL TO public
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "org_guard" ON public.lotes;
CREATE POLICY "org_guard" ON public.lotes AS RESTRICTIVE FOR ALL TO public
  USING ((organizacao_id = current_org()))
  WITH CHECK ((organizacao_id = current_org()));

DROP POLICY IF EXISTS "org_guard" ON public.movimentacoes;
CREATE POLICY "org_guard" ON public.movimentacoes AS RESTRICTIVE FOR ALL TO public
  USING ((organizacao_id = current_org()))
  WITH CHECK ((organizacao_id = current_org()));

DROP POLICY IF EXISTS "operadores_select" ON public.operadores;
CREATE POLICY "operadores_select" ON public.operadores AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_role() = ANY (ARRAY['admin'::text, 'viewer'::text, 'field'::text])));

DROP POLICY IF EXISTS "operadores_write" ON public.operadores;
CREATE POLICY "operadores_write" ON public.operadores AS PERMISSIVE FOR ALL TO public
  USING ((current_user_role() = ANY (ARRAY['admin'::text, 'viewer'::text])))
  WITH CHECK ((current_user_role() = ANY (ARRAY['admin'::text, 'viewer'::text])));

DROP POLICY IF EXISTS "org_guard" ON public.operadores;
CREATE POLICY "org_guard" ON public.operadores AS RESTRICTIVE FOR ALL TO public
  USING ((organizacao_id = current_org()))
  WITH CHECK ((organizacao_id = current_org()));

DROP POLICY IF EXISTS "org_select_own" ON public.organizacoes;
CREATE POLICY "org_select_own" ON public.organizacoes AS PERMISSIVE FOR SELECT TO public
  USING ((id = current_org()));

DROP POLICY IF EXISTS "org_guard" ON public.profiles;
CREATE POLICY "org_guard" ON public.profiles AS RESTRICTIVE FOR ALL TO public
  USING ((organizacao_id = current_org()))
  WITH CHECK ((organizacao_id = current_org()));

DROP POLICY IF EXISTS "org_guard" ON public.safras;
CREATE POLICY "org_guard" ON public.safras AS RESTRICTIVE FOR ALL TO public
  USING ((organizacao_id = current_org()))
  WITH CHECK ((organizacao_id = current_org()));

DROP POLICY IF EXISTS "safras_select" ON public.safras;
CREATE POLICY "safras_select" ON public.safras AS PERMISSIVE FOR SELECT TO public
  USING ((current_user_role() = ANY (ARRAY['admin'::text, 'viewer'::text, 'field'::text])));

DROP POLICY IF EXISTS "safras_write" ON public.safras;
CREATE POLICY "safras_write" ON public.safras AS PERMISSIVE FOR ALL TO public
  USING ((current_user_role() = ANY (ARRAY['admin'::text, 'viewer'::text])))
  WITH CHECK ((current_user_role() = ANY (ARRAY['admin'::text, 'viewer'::text])));

DROP POLICY IF EXISTS "org_guard" ON public.talhoes;
CREATE POLICY "org_guard" ON public.talhoes AS RESTRICTIVE FOR ALL TO public
  USING ((organizacao_id = current_org()))
  WITH CHECK ((organizacao_id = current_org()));


-- ─────────── ÍNDICES ───────────

CREATE INDEX IF NOT EXISTS idx_aplicacoes_cultura ON public.aplicacoes USING btree (cultura_id);

CREATE INDEX IF NOT EXISTS idx_aplicacoes_org ON public.aplicacoes USING btree (organizacao_id);

CREATE INDEX IF NOT EXISTS idx_ciclos_org ON public.ciclos USING btree (organizacao_id);

CREATE INDEX IF NOT EXISTS idx_ciclos_safra ON public.ciclos USING btree (safra_id);

CREATE INDEX IF NOT EXISTS idx_ciclos_talhao ON public.ciclos USING btree (talhao_id);

CREATE INDEX IF NOT EXISTS idx_culturas_org ON public.culturas USING btree (organizacao_id);

CREATE INDEX IF NOT EXISTS idx_defensivos_org ON public.defensivos USING btree (organizacao_id);

CREATE INDEX IF NOT EXISTS idx_fazendas_org ON public.fazendas USING btree (organizacao_id);

CREATE INDEX IF NOT EXISTS idx_inv_org ON public.inventario_fisico USING btree (organizacao_id);

CREATE INDEX IF NOT EXISTS idx_lotes_cultura ON public.lotes USING btree (cultura_id);

CREATE INDEX IF NOT EXISTS idx_lotes_org ON public.lotes USING btree (organizacao_id);

CREATE INDEX IF NOT EXISTS idx_movim_org ON public.movimentacoes USING btree (organizacao_id);

CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles USING btree (organizacao_id);

CREATE INDEX IF NOT EXISTS idx_safras_org ON public.safras USING btree (organizacao_id);

CREATE INDEX IF NOT EXISTS idx_talhoes_org ON public.talhoes USING btree (organizacao_id);
