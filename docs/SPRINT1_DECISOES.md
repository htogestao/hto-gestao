# SPRINT 1 — Decisões que travam a Etapa 1

> 6 decisões que definem o desenho da fonte única (view canônica). Somente leitura; nada implementado.
> Formato: opções · recomendação · porquê · risco. Marque sua escolha em cada uma.

## D1 · Fonte do consumo
- **A) Razão `movimentacoes`** (`saida_aplicacao − devolucao_sobra`) · **B)** Recomputar `(usada − sobra)` dos itens.
- **Recomendo A.** Reconciliação com estoque por construção — relatório e estoque **não podem divergir**. B duplica uma verdade que já existe.
- Risco de A: razão pode ter `lote_id`/`defensivo` sem preço → custo depende de D2. Consumo (quantidade) é sólido.
- [ ] A  [ ] B

## D2 · Preço quando lote nulo / FEFO
- **A)** Preço médio ponderado do produto (dos lotes com preço) · **B)** Último preço de compra · **C)** Não custear, só sinalizar.
- **Recomendo A + flag.** Custo estável e rastreável; itens sem base de preço marcados. C deixa custo incompleto; B é volátil.
- Risco: preço médio muda ao entrar/sair lote — custo histórico não é "as-of". Aceitável se documentado.
- [ ] A  [ ] B  [ ] C

## D3 · Rateio multi-talhão
- **A)** Proporcional à área de cada talhão (junção) · **B)** Igual entre talhões · **C)** Manter no primário (status quo).
- **Recomendo A.** Aderente ao domínio (custo/ha por talhão). **Rejeito C** (é a causa do P3).
- Decisão dependente: dados **legados** têm só área de operação → ratear por `talhoes.area_ha` da junção; onde faltar área, cair para B (igual) e sinalizar.
- [ ] A  [ ] B  [ ] C

## D4 · `area_aplicada_ha` como fonte de área
- **A)** Deprecar; derivar área da junção `aplicacao_talhoes` · **B)** Manter o campo livre.
- **Recomendo A.** Campo livre por operação é ambíguo em multi-talhão e alimenta P5. Junção dá área por talhão.
- Risco: aplicações antigas sem junção completa → fallback para `area_aplicada_ha` marcado como "legado".
- [ ] A  [ ] B

## D5 · População de custo (status)
- **A)** Só `encerrada` · **B)** `encerrada` + `em_andamento` (já baixou estoque) · **C)** Todas, com coluna de status.
- **Recomendo B.** Estoque é baixado na inserção do item, independente do status → custo real inclui `em_andamento`. A subconta; diverge do dashboard (P10).
- Risco: operação aberta pode ter itens a acrescentar → custo "parcial". Mitigar: marcar operações abertas no relatório.
- [ ] A  [ ] B  [ ] C

## D6 · Camada de agregação
- **A)** Views/RPC SQL · **B)** Módulo TS compartilhado (`@agro/shared`).
- **Recomendo A.** Auditável por `SELECT` (a meta é auditabilidade); serve web + mobile; tira agregação pesada do cliente. B é mais rápido de codar mas não é auditável nem reaproveitável no mobile.
- Risco de A: exige Etapa 0 (consolidar migrations) antes, senão vira dívida avulsa.
- [ ] A  [ ] B

---

### Resumo das recomendações
D1=A (razão) · D2=A (preço médio+flag) · D3=A (rateio por área, fallback igual) · D4=A (deprecar campo) · D5=B (encerrada+andamento) · D6=A (views SQL).

**Se aceitar as 6 recomendações**, a Etapa 1 fica: uma view de consumo derivada do razão, custo = consumo × preço(médio/lote) com flag, área e custo rateados por talhão via junção, população = encerrada+andamento, em SQL versionado após Etapa 0.

<sub>Somente leitura · nenhuma alteração de código/banco/migration · sem commit.</sub>
