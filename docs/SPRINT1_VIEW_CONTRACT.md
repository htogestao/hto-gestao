# SPRINT 1 — Contrato da Fonte Única (views canônicas)

> Desenho da camada de leitura única para financeiro/consumo/área. **Somente projeto — nenhum SQL executado.**
> Aplica as 6 decisões congeladas (`SPRINT1_DECISOES.md`). Nomes ilustrativos (ajustáveis na implementação).

## Objetivo
Todo relatório/export/dashboard financeiro passa a **consumir estas views**, nunca reagregar. Consumo reconcilia com o razão de estoque por construção → **auditável**.

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
- **Campos:** `aplicacao_id`, `talhao_id`, `fazenda_id`, `data`, `defensivo_id`, `classe`, `unidade`, `qtd_liquida_talhao = qtd_liquida × fator_rateio`, `custo_talhao = custo × fator_rateio`, `preco_fonte`, `origem_rateio`.
- **É daqui que todos os financeiros somam.**

## Área — 2 medidas explícitas (P5)
- **Área tratada (distinta):** `Σ DISTINCT talhao.area_ha` entre os talhões que tiveram ≥1 operação no recorte. Não conta passadas. → base de custo/ha.
- **Área aplicada (acumulada):** `Σ area_ha` por operação×talhão (conta passadas). Indicador **separado e rotulado**.
- **Custo/ha (D6, P6):** sempre `Σ custo_talhao ÷ área tratada` no nível agregado. Denominador único.

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

## Reconciliação (a prova de auditabilidade)
Invariante: `Σ v_consumo_item.qtd_liquida` (produto, período) **=** `Σ (saida−devolucao)` do razão **=** queda de estoque no período. Se não bate, a view está errada — não o estoque.

## Riscos / pendências desta modelagem
- **Era pré-gatilho:** operações antigas sem razão dependem do fallback item-based (`preco_fonte='legado'`). Confirmar no banco quantas são (não tenho acesso).
- **Preço médio não é "as-of":** muda ao entrar/sair lote; custo histórico pode variar. Aceito por D2; documentar.
- **Rateio de dados legados** (D3 fallback) é aproximado; marcado `origem='legado'`.
- **Depende da Etapa 0** (db pull + gatilho versionado) antes de virar migration.

<sub>Contrato de projeto · somente leitura · sem SQL executado · sem commit de código.</sub>
