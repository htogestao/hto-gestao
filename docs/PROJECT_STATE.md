# PROJECT_STATE — Âncora de Contexto

> Leia **este arquivo primeiro** ao iniciar um chat novo. É um índice de estado (1–2 páginas), não a fonte detalhada — o detalhe vive nos docs linkados. **Atualizar ao fim de cada ciclo/etapa.**
> Última atualização: 2026-07-16.

## 1. Projeto
Sistema de gestão agrícola (cana). **Talhão é o centro do histórico.** Web (Next.js 14) + Mobile (Expo) + Supabase (Postgres/RLS/RPC). Monorepo pnpm. Deploy Vercel (`main` → auto). Produção: `hto-gestao-web.vercel.app` (verificação visual é do dono; não faço login).

## 2. Modelo de domínio (CONGELADO — ver `DOMAIN.md`)
- **Talhão → Operação → Apontamento (Diário, talhão×dia) → Item(produto+lote).**
- Custo/estoque/alertas = **derivações**, não tabelas.
- 7 decisões congeladas: grão talhão×dia; acréscimo de área informa dose (não baixa estoque); carência/reentrada por data do apontamento; operação inativa sugere fechar (nunca auto); custo de produto agora + horas-máquina como costura; safra manual gera ciclos; produto sem saldo oculto só no seletor.

## 3. Regras imutáveis (não alterar sem decisão explícita)
1. **Não mexer no gatilho de baixa de estoque** sem rede de testes.
2. **Consolidar migrations (db pull) antes de adicionar objetos de schema.**
3. **Custo = líquido** (usada − sobra); nunca bruto.
4. **Sem duplicação de área** (fan-out proibido; ver `REPORTS.md`).
5. **Fonte única auditável** para financeiro/área/custo/export.
6. **Confiabilidade do dado > feature nova.** Dado errado em relatório financeiro é mais grave que feature inexistente.

## 4. Sprint atual — Sprint 1: Credibilidade dos Dados
**Meta:** financeiro/área/custo/export com fonte única, reconciliável com o razão de estoque.
- Problemas: `REPORTS_AUDIT.md` (P1–P8) + `SPRINT1_CREDIBILIDADE.md` (P9–P11).
- Plano/etapas: `SPRINT1_CREDIBILIDADE.md` (Etapas 0–5).
- **Decisões CONGELADAS ✅ (2026-07-16):** D1=razão · D2=preço médio+flag · D3=rateio por área (fallback igual) · D4=deprecar `area_aplicada_ha` · D5=encerrada+andamento · D6=views SQL. **Etapa 1 destravada.** (`SPRINT1_DECISOES.md`)

## 5. Próximas tarefas (ordem)
1. ✅ 6 decisões congeladas.
2. Desenhar **contrato da view canônica** (campos/grão/regras) — revisão antes de implementar. ← PRÓXIMO
3. Etapa 0: `supabase db pull` + versionar gatilho.
4. Etapa 1: views de consumo/custo/área.
5. Etapas 2–5: financeiros → exports → rótulos → reconciliação.

## 6. Estado do working tree (NÃO commitado)
- `packages/web/app/globals.css`, `packages/web/src/components/ui/card.tsx` → **refinamento visual CONGELADO** (parcial; retomar em sprint de UX dedicada; não continuar agora).
- `docs/` → toda a documentação (untracked; commitar quando o dono autorizar).
- Nenhuma mudança em relatórios/exportações.

## 7. Sprints já entregues
- Sprint 01 (UX) — commit `2d145be` em produção: ocultar produto sem saldo no seletor; ordenação alfabética; dashboard reformulado (3 KPIs + Top Produtos + Central de Alertas).

## 8. Mapa de documentos
`MASTER.md` (entrada) · `DOMAIN.md` (domínio+7 decisões) · `REPORTS.md` (regras de relatório) · `REPORTS_AUDIT.md` (auditoria) · `SPRINT1_CREDIBILIDADE.md` (plano) · `SPRINT1_DECISOES.md` (6 decisões) · `ENGINEERING.md` (princípios/checklists) · `01–09` (arquitetura/banco/etc).

## 9. Fluxo de trabalho (ciclos)
Chat 1 Planejamento · Chat 2 Implementação · Chat 3 Validação · Chat 4 Próxima sprint. Cada chat começa lendo este arquivo. Atualizar §4–§7 ao fim de cada ciclo.

<sub>Índice de estado · aponta para docs autoritativos · manter enxuto e atualizado.</sub>
