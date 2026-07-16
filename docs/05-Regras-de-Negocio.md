# 05 — Regras de Negócio

> Regras extraídas do código (SQL + TypeScript). Somente leitura.
> Cada regra indica a **origem**. Nomes de `.sql` marcados **[avulso]** foram aplicados manualmente e **não estão no repositório** (ver a convenção detalhada em `02-Banco-de-Dados.md`); referências a `supabase/migrations/00X` existem no repo.

---

## RN-01 — Baixa automática de estoque
Ao inserir um `aplicacao_item`, o gatilho `trg_decrement_lote` desconta do lote o **líquido = `quantidade_usada` − `quantidade_sobrou`**.
- **Com `lote_id`:** desconta daquele lote (`GREATEST(0, ...)` nunca deixa negativo).
- **Sem `lote_id`:** distribui o consumo pelos lotes do defensivo por **FEFO** (vence antes, sai antes).
- Sempre registra uma `movimentacao` `saida_aplicacao`.

*Origem:* `fn_decrement_lote_aplicacao()` — Desktop `desconto_estoque_robusto.sql` **[avulso, não versionado]**.

---

## RN-02 — Controle FEFO (First-Expire, First-Out)
Quando não há lote escolhido, o consumo sai primeiro dos lotes com menor `data_vencimento` (`ORDER BY data_vencimento ASC NULLS LAST, created_at ASC`). Também orienta a RPC `lotes_por_vencimento`.

*Origem:* `desconto_estoque_robusto.sql`; `003_functions.sql` (`lotes_por_vencimento`).

---

## RN-03 — Sobra volta ao estoque
A sobra informada retorna ao lote e gera `movimentacao` `devolucao_sobra`.
- Na **exclusão** de um item: `trg_restore_lote` devolve o líquido.
- No **encerramento** da aplicação: a RPC atômica `encerrar_aplicacao` grava a sobra, devolve ao lote e registra a movimentação — tudo numa transação.

*Origem:* `sobra_volta_estoque.sql` **[avulso]**; `encerrar_aplicacao` — `003_functions.sql`.

---

## RN-04 — Movimentações automáticas (ledger)
Todo evento de estoque gera um registro em `movimentacoes`, nunca digitado à mão. Tipos:
`entrada` · `saida_aplicacao` · `devolucao_sobra` · `ajuste` · `descarte`.

*Origem:* gatilhos de estoque + `aplicar_inventario`.

---

## RN-05 — Controle de carência e reentrada
Cada defensivo tem `carencia_dias` (dias até poder colher) e `reentrada_horas` (horas até pessoas reentrarem no talhão). O Dashboard percorre as aplicações recentes (últimos 90 dias) e calcula, por item:
- **Reentrada:** `data_aplicação + reentrada_horas`; se ainda no futuro, exibe alerta com horas restantes.
- **Carência:** `data_aplicação + carencia_dias`; se ainda no futuro, exibe alerta com dias restantes.

*Origem:* `dashboard/page.tsx`; colunas em `fix_defensivos_colunas.sql` **[avulso]**; valores de bula em `update_final_bula.sql`.

---

## RN-06 — Alertas ativos (estoque e vencimento)
A RPC `alertas_ativos()` retorna três categorias com severidade:
1. **`lote_vencido`** — lote com saldo e `data_vencimento < hoje` → severidade **crítico**.
2. **`vencimento_proximo`** — vence entre hoje e +90 dias → **alto** (≤30d) ou **médio**.
3. **`estoque_baixo`** — soma dos lotes ≤ `estoque_minimo` (com mínimo > 0) → **alto**.

*Origem:* `003_functions.sql`.

---

## RN-07 — Prejuízo com produtos vencidos
O Dashboard soma, para lotes vencidos com saldo, `quantidade_atual × preco_unitario` e exibe em card de alerta, com tabela detalhada por produto.

*Origem:* `dashboard/page.tsx`.

---

## RN-08 — Cálculo de estoque atual
"Estoque" não é tabela — é a **soma** de `lotes.quantidade_atual` por defensivo, via RPC `estoque_atual`, que também devolve `em_alerta` (≤ mínimo) e `tem_vencido`.

*Origem:* `003_functions.sql`.

> **Atenção — "custo médio":** o rótulo "Valor em Estoque — custo médio ponderado" no Dashboard é a **soma simples** de `quantidade_atual × preco_unitario`. **Não existe** cálculo de média ponderada por entradas. Custo médio real seria implementação nova.

---

## RN-09 — Ajuste por inventário físico
`aplicar_inventario(id)` (somente `admin`/`viewer`):
- Percorre os itens com `diferenca <> 0`.
- **Sobra (`diferenca > 0`):** soma no lote mais recente; se não houver lote, cria um "lote de ajuste".
- **Falta (`diferenca < 0`):** remove dos lotes começando pelo mais recente.
- Registra `movimentacao` `ajuste` e marca o inventário como `aplicado` (idempotente — não aplica duas vezes; lança exceção se já aplicado).

*Origem:* `inventario_ajusta_estoque.sql` **[avulso]**.

---

## RN-10 — Criação automática de perfil
Ao inserir em `auth.users`, `handle_new_user()` cria a linha em `profiles` com nome (metadata ou parte do e-mail) e papel padrão `field`.

*Origem:* `001_tables.sql`.

---

## RN-11 — Encerramento com validação de permissão
`encerrar_aplicacao` só prossegue se a aplicação está `em_andamento` e o usuário é o `responsavel` ou `admin`; caso contrário lança exceção.

*Origem:* `003_functions.sql`.

---

## RN-12 — Autorização por papel (RLS)
Regras de acesso são aplicadas no banco (ver `08-Seguranca.md`). Exemplos de regra de negócio embutida:
- **Campo (`field`)** só vê aplicações onde é `responsavel` e só edita as próprias `em_andamento`.
- **Campo e preços — como funciona hoje (não é o que parece):** a intenção do projeto é que o papel `field` não veja preços/valores, e por isso o app lê os lotes pela view `lotes_field_view` (que omite `preco_unitario`/`valor_total`). **Porém, isso é uma convenção do cliente, não uma barreira imposta pelo banco.** A policy `lotes_select_field` (em `002_rls.sql`) concede ao `field` `SELECT` na tabela `lotes` inteira, e a RLS do PostgreSQL é **por linha, não por coluna** — logo, um usuário `field` autenticado poderia consultar `preco_unitario` diretamente na tabela `lotes`. A restrição de preço existe apenas porque a interface não pede essas colunas. Ver detalhes e mitigação em `08-Seguranca.md`.
- **Importar** é exclusivo de `admin` (inclusive na Edge Function).

*Origem:* `002_rls.sql` + fixes avulsos.

---

## RN-13 — Multiempresa (isolamento por organização)
`fn_set_org()` carimba `organizacao_id` em cada INSERT; `org_guard` (política RESTRICTIVE) exige `organizacao_id = current_org()` para leitura/escrita. Garante que uma empresa não veja dados de outra.

*Origem:* Fase 0/1 **[avulso]**. Cobertura nas tabelas-núcleo deve ser confirmada no banco.

---

## RN-14 — Validações de formulário (frontend)
- Nova/Editar Aplicação: exige fazenda, ≥1 talhão, data, e defensivo+dose/qtd em cada item.
- Cultura tem default "Cana" (compatibilidade retroativa).
- Talhões podem ser múltiplos (junção `aplicacao_talhoes`).

*Origem:* `nova-aplicacao-client.tsx`, `editar-aplicacao-client.tsx`.

---

## RN-15 — Importação de planilha SIG (cana)
A Edge Function `import-inventario` (somente admin) lê a planilha SIG, faz **upsert** de `fazendas` (conflito por `nome`) e insere/atualiza `talhoes` (chave lógica: `fazenda_id` + `numero_talhao` + `setor`). Normaliza sistema de colheita, status, número de corte e datas `DD/MM/YYYY`.

*Origem:* `supabase/functions/import-inventario/index.ts`.

---

<sub>← [04 — Fluxo dos Módulos](04-Fluxo-dos-Modulos.md) · [⌂ MASTER](MASTER.md) · [06 — Infraestrutura →](06-Infraestrutura.md)</sub>
