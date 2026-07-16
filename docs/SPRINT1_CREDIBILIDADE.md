# SPRINT 1 — Credibilidade dos Dados · Plano Técnico Definitivo

> Transforma a auditoria (`REPORTS_AUDIT.md`) em um plano de implementação executável.
> **Modo de criação: somente leitura** — nenhum código, banco, migration, exportação ou documento existente foi alterado; nada foi commitado.
> **Meta da Sprint 1:** após ela, **toda informação financeira, de área, de custo e de exportação tem uma única fonte de verdade e é auditável** (reconciliável contra o razão de estoque).

---

## 0. Princípio orientador

O problema não é "vários relatórios errados". É **não existir um fato canônico**. A Sprint 1 cria essa fonte única e faz todos os consumidores beberem dela. Corrigir relatório a relatório sem isso apenas re-espalha a divergência.

> **Fonte de verdade candidata (ver §5): o razão `movimentacoes`.** Ele já registra o que *de fato* saiu e voltou do estoque (`saida_aplicacao` − `devolucao_sobra`), escrito pelo gatilho. Reconciliar os relatórios contra o razão é o que torna os números **auditáveis por construção**.

---

## 1. Problemas detalhados (P1–P8 + novos P9–P11)

Cada problema com as 9 dimensões obrigatórias.

### P1 · Ausência de fato canônico
1. **Descrição:** custo e consumo são recalculados no frontend, um por relatório, com regras diferentes.
2. **Causa raiz:** modelagem / duplicação de lógica (sem view/RPC de agregação).
3. **Arquivos:** `relatorios-client.tsx`, `exportar-client.tsx`, `dashboard/page.tsx`, `aplicacoes-client.tsx`.
4. **Fluxo afetado:** Backend (RPC crua) → Frontend (agrega ad-hoc) → Exportação (reagrega de novo). O Banco **não** consolida.
5. **Impacto p/ produtor:** números que não batem entre telas; perda de confiança no sistema.
6. **Impacto financeiro:** custo/ha diverge conforme a tela — decisão sobre base instável.
7. **Outros módulos:** todos os que exibem custo/consumo.
8. **Risco da correção:** médio — centralizar muda todos os consumidores de uma vez.
9. **Validação c/ dados reais:** o mesmo indicador (ex.: custo total de uma fazenda no período) retorna **idêntico** em relatório, export e dashboard.

### P2 · Definição de custo divergente (bruto × líquido)
1. **Descrição:** `custo_talhao` e `executivo` usam `quantidade_usada × preço` (**bruto**, inclui sobra devolvida); `aplicacoes_fazenda` usa `(usada − sobra)` (**líquido**).
2. **Causa raiz:** duplicação de lógica; nenhuma definição oficial de "custo".
3. **Arquivos:** `relatorios-client.tsx` (`imprimirCustoTalhao`, `imprimirExecutivo`, `imprimirAplicacoesFazenda`).
4. **Fluxo:** Frontend — cálculo diverge; Banco/Backend não impõem a regra.
5. **Impacto produtor:** custo do talhão **maior do que o real** (paga-se pela sobra que voltou).
6. **Impacto financeiro:** **superestimação sistemática do custo** e do custo/ha; distorce ranking de talhões/fazendas.
7. **Outros módulos:** qualquer decisão de custo; comparação entre safras fica viesada.
8. **Risco da correção:** **médio-alto** — o custo vai **cair** ao corrigir; o produtor precisa entender que o número antigo estava inflado (gestão de mudança).
9. **Validação:** para uma aplicação com sobra conhecida, `custo = (usada − sobra) × preço`; conferir manualmente e reconciliar com o razão (`saida − devolucao`).

### P3 · Multi-talhão ignorado no financeiro
1. **Descrição:** `custo_talhao`/`executivo`/exports usam só `talhao_id` primário; a junção `aplicacao_talhoes` é ignorada.
2. **Causa raiz:** JOIN/modelagem — o modelo multi-talhão existe mas não é consumido.
3. **Arquivos:** `relatorios-client.tsx`, `exportar-client.tsx`, `talhoes/[id]/historico/page.tsx` (filtro), `dashboard/page.tsx` (alertas).
4. **Fluxo:** Backend traz só o talhão primário → Frontend atribui tudo a ele.
5. **Impacto produtor:** custo de uma operação de N talhões cai todo em 1; **histórico do talhão secundário some**.
6. **Impacto financeiro:** atribuição de custo **errada por talhão** (o mais usado para decisão de arrendamento/rentabilidade).
7. **Outros módulos:** Central de Alertas (carência/reentrada de talhão secundário não aparece — **risco de segurança de colheita**).
8. **Risco da correção:** **alto** — exige política de rateio (por área) e muda a atribuição histórica.
9. **Validação:** operação real multi-talhão; a soma dos custos rateados por talhão = custo total da operação; talhão secundário aparece no histórico e nos alertas.

### P4 · Fan-out de área em saída de grão-item
1. **Descrição:** `Export Aplicações` faz `flatMap(aplicação→itens)` e repete `Área (ha)` por produto → soma no Excel multiplica.
2. **Causa raiz:** transformação de dados (fan-out por `flatMap`).
3. **Arquivos:** `exportar-client.tsx` (bloco `aplicacoes`).
4. **Fluxo:** Backend (nested) → Frontend (achata) → Exportação (área somável e errada).
5. **Impacto produtor:** planilha com "área tratada" 2–5× a real.
6. **Impacto financeiro:** custo/ha calculado sobre área inflada fica **subestimado**; contradiz P2/P5.
7. **Outros módulos:** qualquer análise feita a partir da planilha exportada.
8. **Risco da correção:** **baixo** — separar em abas por grão (padrão que o Export Estoque já usa).
9. **Validação:** somar a coluna de área na aba de Operação = área real; na aba de Item não há total de área.

### P5 · Área cumulativa rotulada como "tratada"
1. **Descrição:** somar `area_aplicada_ha` entre aplicações conta passadas repetidas; rótulo "ha tratados"/"área total aplicada".
2. **Causa raiz:** agregação + rótulo (falta distinguir área **distinta** de área **acumulada**).
3. **Arquivos:** `relatorios-client.tsx` (`aplicacoes_fazenda`, `custo_talhao`, `executivo`).
4. **Fluxo:** Frontend soma sem `DISTINCT`.
5. **Impacto produtor:** acha que tratou mais hectares do que existem no talhão.
6. **Impacto financeiro:** custo/ha diluído sobre hectares inexistentes.
7. **Outros módulos:** produtividade futura (t/ha) herdaria o erro.
8. **Risco da correção:** **médio** — decidir e nomear dois indicadores distintos.
9. **Validação:** "área tratada" ≤ área do talhão; "área aplicada acumulada" pode excedê-la (e é rotulada assim).

### P6 · Razão custo/ha com denominador inconsistente
1. **Descrição:** em `custo_talhao`, R$/ha por linha usa **área do talhão**; o rodapé usa **área aplicada acumulada**.
2. **Causa raiz:** frontend (duas bases de "hectare").
3. **Arquivos:** `relatorios-client.tsx` (`imprimirCustoTalhao`).
4. **Fluxo:** Frontend.
5. **Impacto produtor:** linha e total do mesmo relatório não fecham.
6. **Impacto financeiro:** custo/ha ambíguo — nenhuma das duas versões é confiável.
7. **Outros módulos:** executivo tem a mesma classe de razão.
8. **Risco da correção:** **baixo** — um denominador só (`Σcusto ÷ Σárea tratada`).
9. **Validação:** o custo/ha do total = custo total ÷ área total, e é coerente com a média das linhas ponderada por área.

### P7 · Soma de quantidades entre unidades diferentes
1. **Descrição:** lista de aplicações mostra "X unid. total" somando `quantidade_usada` de produtos em L e kg.
2. **Causa raiz:** frontend / grão errado (soma cruza unidades).
3. **Arquivos:** `aplicacoes-client.tsx`; ranking "volume total" no `executivo`.
4. **Fluxo:** Frontend.
5. **Impacto produtor:** número sem significado físico (L + kg).
6. **Impacto financeiro:** baixo direto, mas mina a credibilidade.
7. **Outros módulos:** rankings de "mais usado".
8. **Risco da correção:** **baixo** — agrupar por (produto, unidade) ou remover o total.
9. **Validação:** nenhum total mistura unidades; totais aparecem por unidade.

### P8 · Camada de leitura pré-DOMAIN
1. **Descrição:** tudo baseado em "Aplicação" (data única, talhão primário), não em Operação/Apontamento (talhão×dia).
2. **Causa raiz:** modelagem (o modelo-alvo do `DOMAIN.md` ainda não existe fisicamente).
3. **Arquivos:** toda a camada de leitura.
4. **Fluxo:** estrutural.
5. **Impacto produtor:** histórico/custo por talhão×dia impossível hoje.
6. **Impacto financeiro:** custo por safra/operação limitado.
7. **Outros módulos:** todos.
8. **Risco da correção:** **alto** (é a evolução Operação/Apontamento).
9. **Validação:** — **fora do escopo da Sprint 1** (é a fundação da Sprint 4). A view canônica desta sprint é desenhada para **sobreviver** a essa migração (ver §5).

### 🆕 P9 · Preço/lote nulo → custo silenciosamente zero
1. **Descrição:** item sem `lote_id` (baixa FEFO sem lote) ou lote com `preco_unitario` nulo → custo contribui **0**.
2. **Causa raiz:** modelagem (custo depende do lote; FEFO/nulo quebra a atribuição de preço).
3. **Arquivos:** `relatorios-client.tsx` (custo_talhao/executivo, `i.lote?.preco_unitario ?? 0`).
4. **Fluxo:** Backend (lote nulo) → Frontend (zera custo).
5. **Impacto produtor:** custo **subestimado** sem aviso.
6. **Impacto financeiro:** junto com P2 (que superestima), os erros se mascaram — número não confiável em nenhuma direção.
7. **Outros módulos:** todo custo.
8. **Risco da correção:** médio — definir política de preço (preço médio do produto? custo de reposição? sinalizar "sem preço").
9. **Validação:** relatório sinaliza itens sem preço; total distingue "custo apurado" de "itens sem preço".

### 🆕 P10 · População inconsistente por filtro de status
1. **Descrição:** `custo_talhao`/`executivo` filtram `status = 'encerrada'`; `aplicacoes_fazenda` e o dashboard contam **todas**. Relatórios não reconciliam entre si.
2. **Causa raiz:** SQL/frontend (filtros divergentes).
3. **Arquivos:** `relatorios-client.tsx`, `dashboard/page.tsx`.
4. **Fluxo:** Backend (filtro) → Frontend.
5. **Impacto produtor:** "custo do mês" e "aplicações do mês" contam operações diferentes.
6. **Impacto financeiro:** custo pode ignorar operações em andamento com estoque já baixado.
7. **Outros módulos:** dashboard × relatórios não fecham.
8. **Risco da correção:** baixo — política única de status (o que "conta" como custo).
9. **Validação:** definido o critério, todos os relatórios usam a mesma população; totais reconciliam.

### 🆕 P11 · Governança/auditabilidade da exportação
1. **Descrição:** exports não carimbam a **definição** usada (líquido? status? rateio?) nem a versão — impossível auditar depois.
2. **Causa raiz:** processo (sem metadados de geração).
3. **Arquivos:** `exportar-client.tsx`, `relatorios-client.tsx`.
4. **Fluxo:** Exportação.
5. **Impacto produtor:** duas planilhas iguais no nome, números diferentes, sem explicação.
6. **Impacto financeiro:** relatório enviado a terceiros (banco, usina) sem rastreabilidade.
7. **Outros módulos:** todos os exports/PDF.
8. **Risco da correção:** baixo — cabeçalho com filtros + "definições vigentes" + data.
9. **Validação:** todo arquivo gerado traz período, filtros e a definição de custo aplicada.

---

## 2. Ordem ideal de implementação (dependências técnicas)

A ordem segue as dependências: **primeiro a fonte única, depois os consumidores.** P8 fica fora (Sprint 4). P1/P2/P3/P9 são resolvidos **dentro** da view canônica (não são etapas separadas de frontend).

```
Etapa 0 (pré-requisito) ─► Etapa 1 (fonte única) ─► Etapa 2 (financeiros) ─► Etapa 3 (exports) ─► Etapa 4 (rótulos/unidades) ─► Etapa 5 (reconciliação)
        │                        │
   consolida migrations     resolve P1,P2,P3,P9 no banco
```

---

## 3. Etapas

### Etapa 0 — Linha de base versionada *(pré-requisito inegociável)*
- **Objetivo:** ter o banco reproduzível antes de adicionar objetos novos (senão a view vira mais dívida avulsa).
- **Arquivos:** `supabase/migrations/` (via `supabase db pull`); versionar o gatilho de estoque.
- **Banco afetado:** nenhum dado; apenas versionamento do schema atual.
- **Complexidade:** Média · **Risco:** Médio (não muda comportamento; muda governança) · **Tempo:** 1–2 dias.
- **Como testar:** `db pull` reproduz o schema; `db diff` limpo.
- **Critério de aceite:** schema atual versionado em `migrations/`; gatilho de baixa versionado.

### Etapa 1 — Fonte única de custo/consumo/área *(o coração)*
- **Objetivo:** criar a camada canônica que resolve **P1, P2, P3, P9** de uma vez.
- **Conteúdo (views/RPCs — nomes ilustrativos):**
  - `v_consumo_item` — grão Item: consumo **líquido** reconciliado com o razão (`saida − devolucao`), custo líquido, **flag de item sem preço** (P9).
  - `v_custo_operacao_talhao` — rateio por talhão via `aplicacao_talhoes` (proporcional à área) (P3).
  - medidas explícitas: **área tratada (DISTINCT)** vs **área aplicada (acumulada)** (base de P5).
- **Arquivos:** nova migration com as views/RPCs. (Nenhum componente ainda.)
- **Banco afetado:** **novos objetos de leitura** (views/RPC); **não** altera tabelas, triggers, RLS ou dados.
- **Complexidade:** **Alta** · **Risco:** Médio (objetos read-only; não tocam a escrita/estoque) · **Tempo:** 3–5 dias.
- **Como testar:** `SELECT` direto nas views reconcilia com `movimentacoes` (consumo) e com um cálculo manual (custo) numa operação real.
- **Critério de aceite:** `Σ consumo da view = Σ (saida−devolucao) do razão`, por produto e período; itens sem preço sinalizados.

### Etapa 2 — Reescrever os financeiros sobre a view
- **Objetivo:** Custo por Talhão, Executivo e Aplicações por Fazenda passam a **ler a view** (fim do bruto/líquido e do multi-talhão errado). Resolve P1(consumidores), P2, P3, P6, P10.
- **Arquivos:** `relatorios-client.tsx`.
- **Banco afetado:** nenhum (consome as views da Etapa 1).
- **Complexidade:** Média · **Risco:** **Médio** (os números **mudam** — reconciliação obrigatória) · **Tempo:** 2–3 dias.
- **Como testar:** relatório antigo × novo lado a lado; diferença explicada (custo cai pelo líquido; atribuição muda pelo rateio).
- **Critério de aceite:** os três relatórios produzem **o mesmo custo** para o mesmo recorte; custo/ha com denominador único.

### Etapa 3 — Corrigir exportações (fan-out + grão)
- **Objetivo:** Export Aplicações separado por grão; área só na aba de Operação (P4); metadados de geração (P11).
- **Arquivos:** `exportar-client.tsx`.
- **Banco afetado:** nenhum.
- **Complexidade:** Média · **Risco:** Baixo · **Tempo:** 1–2 dias.
- **Como testar:** somar área na aba de Operação = área real; aba de Item sem total de área; cabeçalho com definições.
- **Critério de aceite:** nenhuma coluna de área somável fora do grão de Operação.

### Etapa 4 — Área distinta vs acumulada, rótulos e unidades
- **Objetivo:** dois indicadores de área nomeados (P5); denominador único de custo/ha (P6); "unid total" por unidade (P7); rótulo "custo médio ponderado".
- **Arquivos:** `relatorios-client.tsx`, `aplicacoes-client.tsx`, `dashboard/page.tsx`.
- **Banco afetado:** nenhum.
- **Complexidade:** Baixa · **Risco:** Baixo · **Tempo:** 1 dia.
- **Como testar:** rótulos conferem com a definição; nenhum total mistura L/kg.
- **Critério de aceite:** todo indicador de área/quantidade é inequívoco quanto a grão e unidade.

### Etapa 5 — Reconciliação e validação com dados reais
- **Objetivo:** provar a credibilidade — todo número reconcilia com o razão de estoque.
- **Arquivos:** nenhum (é validação); registrar um roteiro de reconciliação.
- **Banco afetado:** nenhum.
- **Complexidade:** Baixa · **Risco:** Baixo · **Tempo:** 1 dia.
- **Como testar:** escolher 1 fazenda real, 1 mês; conferir Consumo (razão) × Custo (view) × Export × Dashboard.
- **Critério de aceite:** os quatro batem; diferenças, quando houver, têm causa documentada.

---

## 4. Roadmap da Sprint 1

```
Sprint 1 — Credibilidade dos Dados
├── Etapa 0 · Linha de base versionada (db pull + gatilho)      [pré-requisito]
├── Etapa 1 · Fonte única: views de consumo/custo/área          [resolve P1,P2,P3,P9]
├── Etapa 2 · Reescrever financeiros sobre a view               [resolve P6,P10 + consumidores]
├── Etapa 3 · Corrigir exportações (fan-out + metadados)        [resolve P4,P11]
├── Etapa 4 · Área distinta×acumulada, rótulos e unidades       [resolve P5,P7]
└── Etapa 5 · Reconciliação com dados reais (razão de estoque)  [prova a meta]
        P8 (Operação/Apontamento) → fora da Sprint 1 (Sprint 4/fundação)
```

---

## 5. Simplificação e questionamento arquitetural

**Questiono a premissa de "recalcular custo/consumo".** O sistema já tem uma fonte que registra o que *realmente* saiu do estoque: o razão **`movimentacoes`**, escrito pelo gatilho. Reconstruir "consumo líquido" a partir de `(usada − sobra)` nos itens **duplica** uma verdade que já existe — e pode divergir dela.

**Alternativa recomendada (mais simples, mais robusta, mais aderente ao domínio):**
- **Consumo = razão.** A view de consumo deriva de `movimentacoes` (`saida_aplicacao − devolucao_sobra`). Por construção, **relatório e estoque nunca divergem** — é a definição de auditável.
- **Custo = consumo × preço**, com o preço resolvido explicitamente (P9): quando o lote é conhecido, usa o preço do lote; quando é FEFO/nulo, usa **preço médio do produto** e **sinaliza**. O custo passa a ter uma regra única e rastreável.
- **Área via junção, não via `area_aplicada_ha`.** O campo `area_aplicada_ha` é um número livre por operação, ambíguo em multi-talhão. **Proposta: deprecar** `area_aplicada_ha` como fonte e derivar área da junção `aplicacao_talhoes` (área por talhão). Menos ambiguidade, atribuição correta.

**Por que é melhor:** elimina a definição divergente (não há "recalcular" — há "ler o que aconteceu"); reconcilia com estoque automaticamente; e prepara o terreno para o modelo Operação/Apontamento (o razão e a junção já são por talhão). A view vira o **seam** que sobrevive à migração da Sprint 4: quando `aplicacoes` virar `operacoes`+`apontamentos`, só a view muda; os relatórios não.

---

## 6. Revisão crítica do próprio plano

Onde este plano pode falhar ou ainda depende de decisão:

- **⚠ Dependência dura da Etapa 0.** Adicionar views sem consolidar as migrations perpetua a dívida avulsa. Se a Etapa 0 for pulada "por pressa", a Sprint 1 nasce em dívida. **Não pular.**
- **⚠ Sem rede de testes.** O projeto não tem testes e o type-check está desligado. A Sprint 1 **muda números financeiros** sem malha de segurança. Mitigação mínima: a Etapa 5 (reconciliação manual) vira **obrigatória**, idealmente com 2–3 casos congelados como "testes de reconciliação".
- **⚠ Fator humano (mudança de número).** O custo vai **cair** (líquido) e a atribuição por talhão vai **mudar** (rateio). Para um produtor não-técnico, "meu custo diminuiu no sistema" pode gerar desconfiança. **Decisão necessária:** comunicar explicitamente que os números antigos estavam inflados, com um "de-para".
- **Decisões pendentes antes de codar:**
  1. **Fonte do consumo:** razão (`movimentacoes`) **ou** recomputo `(usada−sobra)`? (Recomendo o razão.)
  2. **Preço quando FEFO/lote nulo (P9):** preço médio do produto? último preço? sinalizar e não custear? (Recomendo médio + flag.)
  3. **Rateio multi-talhão (P3):** proporcional à área do talhão? igual? Como ratear dados **legados** cuja área é só de operação?
  4. **`area_aplicada_ha`:** deprecar como fonte e usar a junção? (Recomendo sim.)
  5. **População de custo (P10):** só `encerrada` conta como custo, ou também `em_andamento` (já baixou estoque)?
  6. **Camada:** views SQL (auditável, recomendado) **ou** módulo TS compartilhado (mais rápido, mas não auditável por `SELECT`)? (Recomendo views.)
- **Lacuna de acesso:** eu **não tenho acesso ao Supabase** — não posso construir/testar as views nem confirmar o filtro real do histórico (P3). Isso é trabalho do desenvolvedor com acesso.
- **Escopo:** P8 (Operação/Apontamento) **não** está na Sprint 1. Se o negócio exigir custo por safra/operação já, isso puxa a Sprint 4 para cima e **rediscute a ordem**.

> **Conclusão:** o plano entrega a meta (fonte única + auditabilidade) **se e somente se** a Etapa 0 for feita, a reconciliação (Etapa 5) for tratada como teste obrigatório, e as 6 decisões pendentes forem tomadas antes de codar. A alternativa do §5 (consumo = razão) é o caminho mais robusto e o que mais reduz risco e código.

---

<sub>Plano técnico · somente leitura — nenhum código, banco, migration, exportação ou documento existente alterado; nenhum commit. Deriva de `REPORTS_AUDIT.md` e obedece a `REPORTS.md`/`DOMAIN.md`/`ENGINEERING.md`. Estimativas de tempo são aproximações de desenvolvimento, não compromissos. Itens dependentes do banco vivo exigem acesso ao Supabase.</sub>
