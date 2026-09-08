# Contribuindo com o HtoGestão

## Regra de SQL — sem exceção

**Nenhum SQL roda direto no Supabase SQL Editor sem antes existir como arquivo em `supabase/migrations/NNN_descricao.sql`, commitado.**

Motivo: um script rodado só no SQL Editor, sem ficar no repositório, não deixa rastro. Se algo der errado depois, não tem como saber o que foi feito, quando, nem reverter com segurança — foi exatamente assim que um bug de estoque (~6.000 unidades "sumidas") ficou sem causa raiz recuperável em produção (ver `docs/09-Roadmap.md`, Parte E).

Fluxo correto para qualquer mudança de schema (tabela, coluna, view, function, trigger, policy, índice):

1. Escrever o SQL em `supabase/migrations/NNN_descricao.sql` (número sequencial, um a mais que a última migration existente).
2. Commitar esse arquivo.
3. Só então colar o conteúdo no Supabase SQL Editor (ou rodar via API) e aplicar em produção.
4. Mudanças aditivas e idempotentes sempre que possível (`add column if not exists`, `create or replace function`, `create table if not exists`) — permite rodar de novo sem erro se precisar reconciliar.

### Exceção — scripts de dado (não são schema)

Carga de estoque inicial de um cliente, ajuste pontual de inventário, import de um catálogo de referência — isso é **dado**, não schema, e não faz sentido virar `migrations/NNN`. Mesmo assim, **precisa ser commitado**: arquivo solto em `supabase/` (fora de `migrations/`), com um comentário de cabeçalho dizendo:
- o que o script faz,
- que **já rodou** em produção (não reexecutar),
- data e contexto (ex.: qual organização, qual incidente).

Exemplos já seguindo esse padrão: `supabase/agro_maximo_estoque_inicial.sql`, `supabase/ajuste_retroativo_86_lotes_jun2026.sql`, `supabase/catalogo_agrotoxicos_pr_seed.sql`.

## Segurança

- Nunca commitar senha, token ou chave em texto plano — nem como "exemplo". Usar placeholder óbvio (`CHANGE_ME_BEFORE_RUNNING`) e instrução no cabeçalho do arquivo.
- O repositório é **público** (exigência do plano Vercel Hobby) — tudo que for commitado é visível a qualquer pessoa, para sempre (histórico de git não é lugar seguro para segredo, mesmo que o arquivo seja apagado depois).
