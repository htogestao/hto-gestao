# ENGINEERING — Princípios Técnicos

> Define **como** se constrói e evolui o HtoGestão. Referência obrigatória antes de abrir um Pull Request.
> Documento vivo; discuta mudanças antes de alterar.

---

## 1. Filosofia do projeto

O HtoGestão existe para dar **rastreabilidade e controle** ao produtor rural, com **estabilidade acima de tudo**: há um produtor real em produção. Toda decisão técnica é medida por uma pergunta — *“isso pode quebrar o que já funciona?”*. Se a resposta for “talvez”, vai devagar, em passos pequenos e reversíveis.

Construímos para **durar e crescer** (rumo a multi-culturas e multiempresa), não para impressionar. Código chato e previsível é uma qualidade.

## 2. Clean Code

- Nomes revelam intenção; um nome bom dispensa comentário.
- Funções pequenas, com **uma responsabilidade**.
- Comentário explica **por quê** (uma restrição, uma decisão), nunca **o quê** o código já diz.
- Código novo deve **parecer** com o código ao redor (mesma idiomática, mesma densidade de comentário).
- Remova código morto em vez de comentá-lo.

## 3. Simplicidade acima de complexidade

- A solução mais simples que resolve o problema **vence**. Abstrações só quando a duplicação real justificar.
- Não adicione dependência, camada ou padrão “para o futuro” sem necessidade presente.
- Prefira o mecanismo que o framework/banco já oferece (RLS, triggers, RSC) a reinventá-lo.

## 4. Não duplicar código (DRY)

- Uma fonte única por utilitário e por tipo. Tipos de dados vêm de `@agro/shared`.
- Se um trecho aparece em ≥2 lugares, extraia. (Ex. conhecido: formulários **Nova/Editar aplicação** quase idênticos — candidatos a unificação.)
- Antes de escrever, **procure** se já existe: `src/components/ui/`, `src/components/`, `@agro/shared`.

## 5. Sempre reutilizar componentes

- Novos elementos de UI primeiro tentam compor os existentes (`Button`, `Input`, `Card`, `Badge`, `Select`, cards de alerta, gráfico).
- Componentes com responsabilidade única e props claras. Nada de componente “canivete suíço”.

## 6. Sempre versionar migrations

- **Toda** mudança de banco é uma migration versionada em `supabase/migrations/` (`00X_descricao.sql`), aplicada em ordem.
- **Proibido** alterar o banco apenas pelo SQL Editor sem versionar — é a origem da dívida `[avulso]` atual.
- Migrations são **aditivas e reversíveis** sempre que possível; backup antes; nunca reescrever uma migration já aplicada (crie a próxima).
- Scripts destrutivos ficam **fora** da pasta de migrations, renomeados com aviso.

## 7. Nunca colocar regra crítica apenas no frontend

- Baixa de estoque, FEFO, devolução de sobra, permissões, isolamento por empresa: **vivem no banco** (triggers, RPC, RLS).
- O frontend valida por **conveniência de UX**, não por segurança. Um cliente malicioso ignora o frontend.
- Se uma regra precisa ser garantida, ela precisa estar no PostgreSQL.

## 8. Hierarquia de prioridades

Nesta ordem, quando houver conflito:

1. **Segurança primeiro** — dados corretos e protegidos por papel/empresa. RLS é a linha de defesa real.
2. **Performance segundo** — índices, paginação, cálculo no banco quando pesado.
3. **UX terceiro** — importante, mas não à custa de 1 e 2.

## 9. Compatibilidade e não-regressão

- **Sempre manter compatibilidade** — mudanças de schema aditivas; defaults preservam o comportamento antigo.
- **Nunca quebrar comportamento existente.** Se algo muda para o usuário, é decisão de produto explícita, não efeito colateral.
- Evolução por **fases**: uma mudança por vez, verificável, com rota de volta.

---

## 10. Como revisar Pull Requests

Um PR só é aprovado quando o revisor consegue responder “sim” a tudo:

- [ ] O objetivo do PR está claro e é **uma coisa só**?
- [ ] **Não quebra** comportamento existente (telas, regras, layout)?
- [ ] Nenhuma **regra crítica** ficou só no frontend?
- [ ] Mudança de banco veio com **migration versionada**?
- [ ] **Sem duplicação** — reutiliza componentes/tipos existentes?
- [ ] **Segurança:** a RLS cobre os novos dados? Papéis corretos?
- [ ] **Sem segredos** no diff (`.env`, chaves, project ref, e-mails)?
- [ ] **Sem artefatos** de build (`.next/`) nem `tsconfig.tsbuildinfo`?
- [ ] Documentação em `docs/` atualizada quando a estrutura muda?
- [ ] O código **parece** com o do entorno (padrões do projeto)?

## 11. Como revisar código produzido por IA

Código de IA é aceito, mas passa por escrutínio extra — ele tende a parecer correto e estar sutilmente errado:

- [ ] **Verifique as afirmações contra o código real** — a IA pode citar arquivos, funções ou colunas que não existem.
- [ ] **Cuidado com “melhorias” não pedidas** — refatorações silenciosas que mudam comportamento.
- [ ] **Regras de negócio:** confirme que a IA não moveu para o frontend algo que deve estar no banco.
- [ ] **RLS e segurança:** a IA pode assumir proteção que não existe (ex.: confundir view com restrição de coluna).
- [ ] **Migrations:** garanta que mudou o banco via migration versionada, não por SQL avulso.
- [ ] **Type-check e build** passam? (O build atual ignora erros de tipo — rode `pnpm type-check` à parte.)
- [ ] A IA **testou/observou** o resultado, ou só afirmou que funciona? Exija evidência.
- [ ] O diff é **mínimo** e focado no pedido?

## 12. Checklist antes de fazer commit

- [ ] O commit é **coeso** (uma mudança lógica) e a mensagem é clara e profissional.
- [ ] `pnpm build:web` passa localmente.
- [ ] `pnpm type-check` executado (o build de produção ignora erros de tipo).
- [ ] Nenhum segredo, `.env*.local` ou `.next/` no staging.
- [ ] Nenhuma alteração não intencional (revisar `git diff`).
- [ ] Documentação atualizada se a arquitetura/estrutura mudou.

## 13. Checklist antes do deploy

- [ ] Build local **verde** (é o mesmo build que o Vercel roda).
- [ ] **Se há mudança de banco:** a migration foi aplicada no Supabase **antes** do código que depende dela.
- [ ] Sem migration pendente que o código novo exija.
- [ ] Push na `main` → acompanhar o deploy no Vercel até **Status: Ready**.
- [ ] Abrir a URL de produção e confirmar a tela de login/carga sem erro.
- [ ] Variáveis de ambiente presentes no painel do Vercel.
- [ ] Rollback pensado: sabe-se como reverter (revert do commit) se algo quebrar.

---

<sub>← [09 — Roadmap](09-Roadmap.md) · [⌂ MASTER](MASTER.md) · [Voltar ao início →](MASTER.md)</sub>
