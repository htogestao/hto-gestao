# SPRINT 1 — Contrato da Fonte Única (views canônicas)

> Desenho da camada de leitura única para financeiro/consumo/área. **Somente projeto — nenhum SQL executado.**
> Aplica as 6 decisões congeladas (`SPRINT1_DECISOES.md`). Nomes ilustrativos (ajustáveis na implementação).

## Objetivo
Todo relatório/export/dashboard financeiro passa a **consumir estas views**, nunca reagregar. Consumo reconcilia com o razão de estoque por construção → **auditável**.

## Princípio arquitetural — SSFT (Single Source of Financial Truth)

> **Princípio permanente do sistema**, de mesmo nível que as decisões estruturais do domínio (`DOMAIN.md`). Toda implementação futura é validada contra ele.

**Definição:** toda informação financeira (custos, consumo, área, estoque, indicadores e métricas derivadas) tem **exatamente uma implementação oficial**. Nenhum relatório, exportação, dashboard ou componente de interface pode reproduzir ou recalcular essa lógica.

**Corolários:**
- Uma fonte oficial por regra financeira; toda alteração de regra ocorre num **único lugar**.
- Frontend **nunca** implementa regra financeira.
- Exportações usam **exatamente a mesma fonte** dos dashboards.
- Dois relatórios com números diferentes para o mesmo filtro = **bug de implementação**.
- Nenhuma feature nova pode violar o SSFT.

**Regra de camadas (fronteira de leitura):**
1. Relatório/export **não recalcula** custo, consumo, área tratada/aplicada nem qualquer indicador financeiro a partir de tabelas de domínio.
2. Indicadores derivados (custo/ha, custo total, consumo líquido, área tratada…) vêm **exclusivamente da camada de indicadores** (RPCs / views agregadas).
3. Relatórios de detalhe (item, operação, movimentação, estoque, compras, vencimentos) podem consumir as views canônicas **V2/V3/V4 apenas para exibição**, sem produzir nova regra financeira.
4. Tabelas de domínio só por acesso direto de: **CRUD, serviços internos, processos administrativos** — nunca cálculo financeiro em relatório.
5. Frontend = **apresentação**: filtrar, ordenar, paginar, formatar. Nunca recalcular indicador.
6. Fronteira verificada por **check de CI** sobre `relatorios-client.tsx` / `exportar-client.tsx`.

## Camadas (4 views, do fato para a agregação)

### V1 · `v_preco_medio_produto` — apoio (D2)
- **Grão:** defensivo.
- **Campos:** `defensivo_id`, `preco_medio` = Σ(qtd_comprada×preço)/Σ(qtd_comprada) sobre lotes com `preco_unitario` não nulo.
- **Regra:** base de preço quando o lote do consumo é nulo/sem preço.

### V2 · `v_consumo_item` — fato de consumo (D1, D2)
- **Grão:** aplicação × defensivo × lote.
- **Fonte:** `movimentacoes` (razão). `qtd_liquida = Σ saida_aplicacao − Σ devolucao_sobra`.
- **Campos:** `aplicacao_id`, `defensivo_id`, `lote_id`, `unidade`, `qtd_liquida`, `preco_aplicado`, `preco_fonte` (`lote`|`medio`|`sem_preco`), `custo = qtd_liquida × preco_aplicado`.
- **Regra de preço (D2):** `lote.preco_unitario` se houver; senão `v_preco_medio_produto`; senão `preco_fonte='sem_preco'` e `custo=NULL` (sinalizado, **não** zero silencioso — corrige P9).
- **Fallback legado (ver Riscos):** operações **anteriores ao gatilho** sem linhas no razão → derivar `qtd_liquida = usada − sobra` dos `aplicacao_itens`, `preco_fonte='legado'`.

### V3 · `v_operacao_talhao` — rateio (D3, D4)
- **Grão:** aplicação × talhão.
- **Fonte:** `aplicacao_talhoes` ⋈ `talhoes.area_ha`.
- **Campos:** `aplicacao_id`, `talhao_id`, `area_ha`, `fator_rateio` = `area_ha / Σ area_ha da operação`, `origem` (`juncao`|`legado`).
- **Regra:** área e custo são atribuídos ao talhão por `fator_rateio`. **Deprecar `area_aplicada_ha`** como fonte (D4).
- **Fallback (D3):** operação sem junção → talhão primário, `fator_rateio=1`, `origem='legado'`; se vários talhões sem área → rateio igual (`1/n`), sinalizado.

### V4 · `v_custo_talhao` — fato consumível principal (D3)
- **Grão:** aplicação × talhão × defensivo.
- **Composição:** `v_consumo_item` × `v_operacao_talhao`.
- **Campos:** `aplicacao_id`, `talhao_id`, `area_talhao_ha` (área **cadastral** do talhão), `fazenda_id`, `data`, `defensivo_id`, `classe`, `unidade`, `qtd_liquida_talhao = qtd_liquida × fator_rateio`, `custo_talhao = custo × fator_rateio`, `preco_fonte`, `origem_rateio`.
- **Fato puro:** entrega só fatos consolidados + chaves/atributos para agregação (inclui `area_talhao_ha`, insumo da área tratada DISTINCT). **Não calcula razões derivadas** (custo/ha etc.) — isso é da camada de indicadores.
- **É daqui que todos os financeiros somam.**

## Área — 2 medidas explícitas (P5)
- **Área tratada (distinta):** `Σ DISTINCT talhao.area_ha` entre os talhões que tiveram ≥1 operação no recorte. Não conta passadas. → base de custo/ha.
- **Área aplicada (acumulada):** `Σ area_ha` por operação×talhão (conta passadas). Indicador **separado e rotulado**.
- **Custo/ha (D6, P6):** `Σ custo_talhao ÷ área tratada`, calculado **só na camada de indicadores** (RPC), nunca no frontend. Denominador único.

## Camada de indicadores — RPC parametrizada por recorte
> Implementação **única** dos indicadores financeiros (SSFT). Parametrizada pelo recorte (período, fazenda, cultura, talhão) — uma implementação serve todos os grãos. Consome V4 (+V1–V3); nunca tabelas de domínio.

**Saída por recorte:**
- `custo_confirmado` — Σ dos itens **com preço** (sempre calculável).
- `custo_total` — = `custo_confirmado` **quando `possui_itens_sem_preco = false`**; senão `NULL`.
- `possui_itens_sem_preco` (bool).
- `qtd_pendente_preco` — volume/itens sem preço no recorte. O "pendente" é **quantidade, não R$**: a camada oficial **não estima** valor monetário sem preço confiável (decisão c1).
- `area_tratada_ha` — `Σ DISTINCT area_talhao_ha`; `NULL` se algum talhão do recorte estiver sem área.
- `area_aplicada_ha` — acumulada (conta passadas).
- `custo_ha` — só quando **`custo_total` completo E `area_tratada_ha` completa** (portão duplo); senão `NULL` + motivo na qualidade.
- **Qualidade dos dados** — flags não-lossy: `tem_sem_preco`, `tem_consumo_legado` (V2), `tem_rateio_legado` (V3), `tem_inconsistencia_estoque`; + `qualidade_resumo` enum (`OK`|`PARCIAL_SEM_PRECO`|`DADOS_LEGADOS`|`INCONSISTENCIA_ESTOQUE`, por precedência) para badge (decisão c2: flags **e** resumo).
  - `INCONSISTENCIA_ESTOQUE`: no recorte, `Σ V2.qtd_liquida ≠ Σ(saída−devolução)` do razão **ou** `qtd_liquida < 0`. (Sprint 1: cálculo ao vivo; materializar depois se pesar.)
- `confiabilidade` (`ALTA`|`MEDIA`|`BAIXA`) — **confiança operacional** do indicador para tomada de decisão. As flags explicam o *motivo*; este campo resume se **dá para decidir**. Derivação por precedência:
  - **BAIXA** — `tem_sem_preco` **ou** `tem_inconsistencia_estoque` **ou** `area_tratada_ha` NULL **ou** `custo_total` NULL (qualquer coisa que comprometa decisão financeira).
  - **MEDIA** — senão, `tem_consumo_legado` **ou** `tem_rateio_legado` (legado/incompleto que não invalida o resultado).
  - **ALTA** — senão: tudo completo e reconciliado.

**Contrato oficial** de saída para dashboards, exportações e integrações futuras.

## População (D5)
- `status IN ('encerrada','em_andamento')` (estoque já baixa na inserção do item). Operações `em_andamento` marcadas **"parcial"** no relatório.

## Contrato para os consumidores
| Consumidor | Consome | Agrega por |
|---|---|---|
| Custo por Talhão | `v_custo_talhao` | talhão |
| Executivo | `v_custo_talhao` | fazenda |
| Aplicações por Fazenda | `v_custo_talhao` + `v_consumo_item` | fazenda/operação |
| Export Aplicações | aba Operação (`v_operacao_talhao`) + aba Item (`v_consumo_item`) | grãos separados |
| Dashboard custo | `v_custo_talhao` | período |

> **Indicadores** (custo/ha, totais, qualidade) vêm sempre da **RPC de indicadores** — a coluna "Consome" indica só o **fato-base**. Nenhum consumidor lê tabela de domínio para cálculo (SSFT).

## Reconciliação (a prova de auditabilidade)
Invariante: `Σ v_consumo_item.qtd_liquida` (produto, período) **=** `Σ (saida−devolucao)` do razão **=** queda de estoque no período. Se não bate, a view está errada — não o estoque.

## Riscos / pendências desta modelagem
- **Era pré-gatilho:** operações antigas sem razão dependem do fallback item-based (`preco_fonte='legado'`). Confirmar no banco quantas são (não tenho acesso).
- **Preço médio não é "as-of":** muda ao entrar/sair lote; custo histórico pode variar. Aceito por D2; documentar.
- **Rateio de dados legados** (D3 fallback) é aproximado; marcado `origem='legado'`.
- **Depende da Etapa 0** (db pull + gatilho versionado) antes de virar migration.

<sub>Contrato de projeto · somente leitura · sem SQL executado · sem commit de código.</sub>
