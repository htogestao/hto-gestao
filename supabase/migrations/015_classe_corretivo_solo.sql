-- =============================================================
-- 015 · Nova classe de defensivo: corretivo_solo (calcário, gesso)
-- =============================================================
-- Separa corretivo de solo (calcário, gesso) de fertilizante de
-- verdade (ureia, KCl) — evita misturar os dois em relatórios que
-- filtram por classe. Decisão de produto, não técnica.
-- Aditivo: só adiciona um valor ao CHECK existente, não remove nada.
-- =============================================================

alter table public.defensivos drop constraint defensivos_classe_check;

alter table public.defensivos add constraint defensivos_classe_check
  check (classe = any (array[
    'herbicida', 'fungicida', 'inseticida', 'acaricida', 'adjuvante',
    'espalhante_adesivo', 'fertilizante', 'fertilizante_foliar',
    'adubo_foliar', 'corretivo_solo', 'nematicida', 'inoculante',
    'maturador', 'regulador_crescimento', 'ativador_crescimento',
    'fungicida_herbicida', 'outro'
  ]));
