# REPORTS_AUDIT — Auditoria Arquitetural da Camada de Leitura

> Auditoria **somente leitura** de todos os consumidores de dados (dashboards, KPIs, gráficos, relatórios PDF, exportações Excel, RPCs) à luz de `DOMAIN.md` e `REPORTS.md`.
> Nenhum arquivo, banco, migration ou exportação foi alterado. Objetivo: mapear violações de domínio, granularidade, agregação e somabilidade — a duplicação de área no financeiro é tratada como **sintoma**, não como a doença.
> Base analisada: `relatorios-client.tsx`, `exportar-client.tsx`, `dashboard/page.tsx`, `grafico-estoque.tsx`, `central-alertas.tsx`, `estoque-table.tsx`, `aplicacoes-client.tsx`, `historico-client.tsx`, e as RPCs `estoque_atual` / `alertas_ativos` / `lotes_por_vencimento`.

---

## 1. Veredito e diagnóstico

**A camada de leitura é anterior ao domínio congelado e não tem um "fato" canônico.** Cada relatório reconstrói `aplicações → itens` no frontend, cada um à sua maneira. Não há uma view/RPC única de "custo do item" ou "custo da operação". O resultado é **lógica duplicada, divergente e frequentemente incorreta** — a duplicação de área é apenas a manifestação mais visível.

Contagem: **7 consumidores ✅ conformes · 5 ⚠ parciais · 4 ❌ não conformes.** Os 4 não-conformes são justamente os que envolvem **dinheiro e área** (Custo por Talhão, Executivo, Export Aplicações, Aplicações por Fazenda).

---

## 2. Padrões sistêmicos (as causas-raiz)

> Estes são os problemas reais. Corrigir relatório por relatório sem atacá-los apenas espalha a inconsistência.

- **P1 · Não existe fato canônico.** Custo e consumo são recalculados em cada tela. Não há fonte única. → *causa: modelagem / duplicação de lógica.*
- **P2 · Definição de custo divergente.** `custo_talhao` e `executivo` usam **`quantidade_usada × preço` (BRUTO)** — incluindo a sobra devolvida ao estoque. `aplicacoes_fazenda` usa **`usada − sobra` (LÍQUIDO)**. **Dois números de custo no mesmo sistema.** O bruto **superestima o custo** (conta produto que voltou ao lote). → *causa: duplicação de lógica.*
- **P3 · Multi-talhão ignorado nos financeiros.** A junção `aplicacao_talhoes` (modelo correto de multi-talhão) existe, mas `custo_talhao`, `executivo`, os exports e o histórico usam só `talhao_id` **primário**. Uma operação que cobre 5 talhões tem **todo o custo e área jogados em 1 talhão**; e o histórico de um talhão **perde** as operações em que ele é secundário. → *causa: JOIN/modelagem.*
- **P4 · Fan-out de área em saída de grão-item.** `Export Aplicações` faz `flatMap(aplicação → itens)` e repete `Área (ha)` em cada linha de produto. Somar a coluna no Excel = área × nº de produtos. → *causa: transformação de dados (fan-out).*
- **P5 · Área cumulativa rotulada como "tratada".** Somar `area_aplicada_ha` entre aplicações conta **passadas repetidas** no mesmo hectare. Rotulado "ha tratados" / "área total aplicada" → induz leitura como hectares distintos. → *causa: agregação + rótulo.*
- **P6 · Razão custo/ha com denominador inconsistente.** Em `custo_talhao`, a coluna R$/ha usa **área do talhão**; o rodapé usa **área aplicada acumulada**. Duas definições de "hectare" no mesmo relatório. → *causa: frontend.*
- **P7 · Soma de quantidades entre unidades diferentes.** A lista de aplicações mostra "X unid. total" somando `quantidade_usada` de produtos distintos — **L + kg no mesmo total.** → *causa: frontend / grão errado.*
- **P8 · Toda a leitura é pré-DOMAIN.** Baseada em "Aplicação" (data única, talhão primário), não em Operação/Apontamento (talhão×dia). Não há grão de apontamento nem separação planejado/realizado. → *causa: modelagem.*

---

## 3. Auditoria por consumidor

### 3.1 Dashboard — KPIs e gráfico

| Item | Finalidade / usuário | Grão atual | Grão correto | Conformidade |
|---|---|---|---|---|
| **Defensivos em Estoque** (contagem) | quantos produtos há · admin/viewer/field | Produto | Produto | ✅ Conforme (contagem) |
| **Valor em Estoque** | capital parado · admin/viewer | Lote (Σ qty×preço) | Lote | ✅ Conforme (aditiva no grão lote; sem join) |
| **Aplicações no Mês** | ritmo operacional · todos | Operação (contagem) | Operação | ✅ Conforme |
| **Top Produtos em Estoque** (gráfico) | onde está o estoque · todos | Produto | Produto | ✅ Conforme |
| **Central de Alertas** | decisão diária (vencimento/reentrada/carência) · todos | Lote (vencimento) + Apontamento×Produto (reentrada/carência) | idem | ⚠ Parcial |

**Central de Alertas — ressalva:** reentrada/carência são calculadas por `aplicação.data` e mostram só o **talhão primário** (`talhao:talhoes(nome)`). Numa aplicação multi-talhão, os talhões secundários **não recebem alerta** (P3). Risco: um talhão em carência não aparecer. Impacto: **segurança de colheita/reentrada**. Prioridade: média.

**Rótulo enganoso menor:** "Valor em Estoque — Custo médio ponderado" é, na verdade, `Σ qty×preço` (soma), não média ponderada. Já registrado em `DOMAIN.md`; corrigir o rótulo. Baixa.

### 3.2 Estoque (tela) e relatórios de estoque/vencimentos

| Relatório | Grão atual | Grão correto | Conformidade | Nota |
|---|---|---|---|---|
| Estoque & Lotes (tela) | Produto + Lote (aninhado) | idem | ✅ Conforme | ordenação alfabética adicionada |
| Estoque Atual / Completo (PDF) | Produto | Produto | ✅ Conforme | via `estoque_atual` (sem fan-out) |
| Export Estoque (Excel) | Aba Resumo=Produto · Aba Lotes=Lote | idem | ✅ Conforme | **abas separadas por grão — o padrão certo** |
| Vencidos e a Vencer (PDF) | Lote | Lote | ✅ Conforme | — |

Este bloco é o **modelo a seguir**: cada saída tem um grão, e quando há dois grãos (produto + lote) eles vão em **abas/tabelas separadas**, nunca somados juntos.

### 3.3 Relatório: Custo por Talhão ❌ (financeiro)

- **Finalidade:** quanto se gastou de defensivo em cada talhão, com R$/ha. **Usuário:** admin/viewer (gestão de custo). **Decisão:** onde o dinheiro está indo.
- **Grão atual:** Talhão, mas agregando por `talhao_id` **primário** e somando entre aplicações.
- **Grão correto (REPORTS.md):** Talhão, agregando Operações **atribuídas por talhão via junção**, com custo **líquido** e área **distinta**.
- **Fan-out / métricas:**
  - **P2:** custo = `quantidade_usada × preço` (**bruto** — conta sobra devolvida). Superestima.
  - **P3:** multi-talhão → custo/área da operação inteira caem no talhão primário.
  - **P5/P6:** `areaAplicada` soma área entre aplicações (cumulativa); R$/ha por linha usa `area_ha` do talhão, rodapé usa `areaAplicada` — **dois denominadores**.
- **Conformidade:** ❌ Não conforme (viola P2, P3, P5, P6 e "somar razões"/"não misturar área distinta com cumulativa").
- **Risco / impacto no negócio:** decisão de custo **sobre número inflado e mal atribuído** — pode condenar um talhão que na verdade não gastou aquilo. **Alto.** **Prioridade: Sprint 1.**

### 3.4 Relatório: Executivo ❌ (financeiro)

- **Finalidade:** custo por fazenda, custo/ha, defensivos mais usados. **Usuário:** admin/viewer (visão executiva).
- **Grão atual:** Fazenda. **Grão correto:** Fazenda (agregando operações), custo líquido, área distinta.
- **Métricas:** custo **bruto** (P2); área somada por aplicação (cumulativa, P5); custo/ha = `Σcusto/Σárea` (o método da razão está **certo**, mas sobre bases infladas). "Defensivos mais usados" soma `quantidade_usada` por produto (grão produto ✅), porém **bruto** e **sem unidade** no ranking (mistura L/kg no "volume total" — P7).
- **Conformidade:** ❌ Não conforme (P2, P5, P7). **Impacto:** alto (número executivo enganoso). **Prioridade: Sprint 1.**

### 3.5 Relatório: Aplicações por Fazenda ❌/⚠

- **Finalidade:** dossiê por fazenda (talhões, produtos, pragas, carência). **Usuário:** admin/viewer/field.
- **Grão:** Fazenda → Aplicação → Item. Consumo por produto usa **líquido** (`usada − sobra`) ✅ (melhor que os financeiros!). **Mas** `areaTotal += area_aplicada_ha` entre aplicações = **área cumulativa rotulada "ha tratados"** (P5); usa junção de talhões para listar, mas soma área da operação (não por talhão).
- **Conformidade:** ❌ no indicador de área ("ha tratados"), ⚠ no resto. **Impacto:** médio (área tratada superestimada; consumo está ok). **Prioridade: Sprint 2.**

### 3.6 Relatórios conformes

| Relatório | Grão | Conformidade | Nota |
|---|---|---|---|
| Aplicações por Período (PDF) | Aplicação | ⚠ Parcial | área 1×/aplicação (ok); só talhão primário (P3); qtd bruta na string |
| Histórico de Compras (PDF) | Lote | ✅ Conforme | `valor_total` aditivo no grão lote |

### 3.7 Exportações Excel

| Export | Grão atual | Grão correto | Conformidade | Nota |
|---|---|---|---|---|
| Estoque | Produto + Lote (abas) | idem | ✅ Conforme | padrão correto |
| Fazendas/Talhões | 2 abas separadas | idem | ✅ Conforme | — |
| **Aplicações** | **Item (fan-out)** | Item, com área só como **contexto** | ❌ **Não conforme** | `flatMap` repete `Área (ha)` por produto → soma multiplica (P4). **Anti-pattern explícito do REPORTS.md.** **Sprint 1.** |
| Movimentações | Movimentação | Movimentação | ✅ Conforme | ledger, sem agregação |
| Compras | Lote | Lote | ✅ Conforme | — |
| Backup Completo | 1 aba por tabela | idem | ✅ Conforme | dump; cada aba um grão |

### 3.8 Listas e histórico

- **Lista de Aplicações (`aplicacoes-client`):** mostra `Σ quantidade_usada` como **"X unid. total"** — soma unidades diferentes (P7). ⚠ Parcial. Baixa/Sprint 3.
- **Histórico do Talhão (`historico-client`):** timeline por talhão. Estatísticas são **contagens/distintos** (ok). Mas o gráfico "Aplicações por mês e tipo" conta **itens** (produtos), não aplicações — rótulo enganoso (grão item rotulado como operação). E, por P3, se o talhão for **secundário** numa operação multi-talhão, essas operações **somem** do histórico dele. ⚠ Parcial. Impacto: histórico incompleto. Sprint 2/3.

### 3.9 RPCs / funções do banco

| Função | Grão | Conformidade | Nota |
|---|---|---|---|
| `estoque_atual` | Produto (Σ lotes) | ✅ Conforme | LEFT JOIN + `>0`; sem fan-out |
| `alertas_ativos` | Lote / Produto | ✅ Conforme | grãos corretos por tipo |
| `lotes_por_vencimento` | Lote | ✅ Conforme | **aparentemente não usada** (candidata a remoção) |

**As RPCs estão certas.** O problema não está no banco — está na **re-agregação ad-hoc no frontend**. Isso é importante: a correção deve **subir** a lógica para o banco (views/RPCs), não continuar espalhando no cliente.

---

## 4. Matriz de conformidade

| Relatório / Consumidor | Grão Atual | Grão Correto | Conforme | Prioridade |
|---|---|---|---|---|
| KPI Defensivos em Estoque | Produto | Produto | ✅ | — |
| KPI Valor em Estoque | Lote | Lote | ✅ | — |
| KPI Aplicações no Mês | Operação | Operação | ✅ | — |
| Gráfico Top Produtos | Produto | Produto | ✅ | — |
| Central de Alertas | Lote + Apont×Produto | idem | ⚠ | Sprint 2 |
| Estoque (tela) | Produto+Lote | idem | ✅ | — |
| Estoque / Vencidos (PDF) | Produto / Lote | idem | ✅ | — |
| Export Estoque | Produto+Lote (abas) | idem | ✅ | — |
| Export Fazendas/Talhões | 2 grãos (abas) | idem | ✅ | — |
| Histórico de Compras / Export Compras | Lote | Lote | ✅ | — |
| Export Movimentações | Movimentação | Movimentação | ✅ | — |
| Backup Completo | tabela/aba | idem | ✅ | — |
| Aplicações por Período (PDF) | Aplicação | Operação | ⚠ | Sprint 3 |
| Aplicações por Fazenda (PDF) | Fazenda→Item | idem (área distinta) | ❌ | Sprint 2 |
| Lista de Aplicações ("unid total") | Aplicação | por unidade | ⚠ | Sprint 3 |
| Histórico do Talhão | Aplicação | Apontamento | ⚠ | Sprint 2 |
| **Custo por Talhão (PDF)** | **Talhão (primário/bruto)** | **Talhão (junção/líquido)** | **❌** | **Sprint 1** |
| **Executivo (PDF)** | **Fazenda (bruto)** | **Fazenda (líquido)** | **❌** | **Sprint 1** |
| **Export Aplicações (Excel)** | **Item (fan-out área)** | **Item (área=contexto)** | **❌** | **Sprint 1** |

---

## 5. Correção arquitetural (o modelo correto — não implementar agora)

O conserto **não** é ajustar cada relatório. É criar um **fato canônico único** e fazer todos consumirem dele.

1. **Fonte única de custo (no banco).** Definir **uma vez**, em view/RPC:
   `custo_item = (quantidade_usada − quantidade_sobrou) × preço_do_lote` (líquido). Todo relatório usa isto — fim do bruto/líquido divergente (P1, P2).
2. **Camada de leitura em views/RPCs por grão** (não re-agregar no frontend):
   - `v_item` (grão Item: produto, lote, qty líquida, custo) — para Consumo/Custo.
   - `v_operacao` / `v_apontamento` (grão Operação/Apontamento: área, custo total) — para Financeiro e Histórico.
   Cada view soma só o que é dono do seu grão (REPORTS.md §4).
3. **Multi-talhão por rateio (P3).** Atribuir área e custo ao talhão **via `aplicacao_talhoes`**, rateando por proporção de área quando a operação cobre vários talhões. Nunca usar só o `talhao_id` primário em financeiro/histórico.
4. **Separar "área tratada (distinta)" de "área aplicada (acumulada)" (P5).** Área tratada = `DISTINCT apontamento` (hectares reais). Passadas repetidas são um indicador **diferente** e rotulado como tal.
5. **Razões recalculadas no nível, com um denominador só (P6).** `custo/ha = Σcusto ÷ Σárea_tratada`, sempre a mesma base.
6. **Exportações: uma aba por grão (P4).** Área só totaliza na aba de Operação/Apontamento; na aba de Item ela é **coluna de contexto**, sem soma. Seguir o padrão que o Export Estoque já usa.
7. **Quantidade sempre com unidade (P7).** Nunca somar L com kg; agrupar por (produto, unidade).
8. **Alinhar ao modelo Operação/Apontamento (P8).** Quando a estrutura de apontamento existir, as views passam a ter o grão talhão×dia naturalmente — carência/reentrada por data do apontamento, histórico completo do talhão.

> Princípio: **a lógica de agregação pertence ao banco (views/RPCs), não ao componente.** Hoje ela está espalhada e duplicada no cliente — essa é a dívida arquitetural central.

---

## 6. Roadmap de implementação (por prioridade)

### 🔴 Sprint 1 — Parar de mentir sobre dinheiro e área
- Definir **custo líquido canônico** (fonte única) e aplicar em **Custo por Talhão** e **Executivo** (fim do custo bruto).
- Corrigir o **fan-out do Export Aplicações**: área vira contexto (não somável) ou vai para aba separada de Operação.
- *Resultado:* os três números financeiros deixam de estar inflados/duplicados.

### 🟡 Sprint 2 — Atribuição correta (multi-talhão + área distinta)
- Rateio por `aplicacao_talhoes` em todos os financeiros e no histórico do talhão.
- Separar **área tratada (distinta)** de **área aplicada (acumulada)**; corrigir rótulos "ha tratados".
- Central de Alertas e Histórico do Talhão passam a considerar talhões secundários.

### 🟢 Sprint 3 — Consistência e clareza
- Denominador único de custo/ha; "unid total" por unidade; gráfico do histórico (item × aplicação); rótulo "custo médio ponderado".
- Remover `lotes_por_vencimento` se confirmada como morta.

### 🔵 Sprint 4 — Fundação (arquitetural)
- Criar as **views/RPCs canônicas** (`v_item`, `v_operacao`/`v_apontamento`) e **reescrever relatórios/exports para consumi-las** — encerrando a re-agregação no frontend.
- Depende da consolidação de migrations e, idealmente, do modelo Operação/Apontamento (ver `DOMAIN.md §13`).

---

## 7. Discordâncias críticas (onde eu não concordo com o desenho atual)

- **Agregação no frontend é o erro estrutural.** Cada relatório reimplementa "custo" e "consumo" em JavaScript, com regras diferentes. Isso **garante** divergência. A agregação tem de descer para o banco. Não adianta corrigir um relatório: sem fonte única, o próximo já nasce divergente.
- **Custo bruto é um bug de negócio, não de UI.** Contar a sobra devolvida como custo infla despesa e distorce custo/ha — a métrica mais usada para decisão. É o achado mais grave e deve ser Sprint 1.
- **Usar `talhao_id` primário em financeiro é modelagem incorreta.** A junção multi-talhão existe justamente para isso; ignorá-la nos custos concentra despesa no talhão errado. Discordo de qualquer correção que mantenha o primário.
- **"Área tratada" e "área aplicada" são métricas diferentes e estão fundidas.** Enquanto forem o mesmo campo somado, todo relatório de área induz erro. Precisa de dois indicadores explícitos.
- **Simplificação recomendada:** os relatórios financeiros (`custo_talhao`, `executivo`) e o dossiê (`aplicacoes_fazenda`) compartilham 80% de lógica reimplementada 3×. Deveriam ser **três visões de uma mesma view de fato**, não três funções independentes. Isso reduz código, remove divergência e alinha com `ENGINEERING.md` (não duplicar).

---

<sub>Auditoria arquitetural · somente leitura — nenhum código, banco, migration, exportação ou documento existente alterado. Cruza a camada de leitura com `DOMAIN.md` e `REPORTS.md`. Itens que dependem do banco vivo (ex.: filtro exato do histórico por `talhao_id`) devem ser confirmados no Supabase, ao qual não tenho acesso. Ver também [REPORTS](REPORTS.md) · [DOMAIN](DOMAIN.md) · [ENGINEERING](ENGINEERING.md).</sub>
