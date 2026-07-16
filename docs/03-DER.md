# 03 — DER (Diagrama Entidade-Relacionamento)

> Relacionamentos entre as tabelas do HtoGestão. Somente leitura.

---

## 1. Diagrama (Mermaid)

```mermaid
erDiagram
    organizacoes   ||--o{ profiles       : "organizacao_id"
    organizacoes   ||--o{ fazendas       : "organizacao_id"
    organizacoes   ||--o{ talhoes        : "organizacao_id"
    organizacoes   ||--o{ defensivos     : "organizacao_id"
    organizacoes   ||--o{ lotes          : "organizacao_id"
    organizacoes   ||--o{ aplicacoes     : "organizacao_id"
    organizacoes   ||--o{ movimentacoes  : "organizacao_id"
    organizacoes   ||--o{ inventario_fisico : "organizacao_id"
    organizacoes   ||--o{ culturas       : "organizacao_id"
    organizacoes   ||--o{ safras         : "organizacao_id"
    organizacoes   ||--o{ ciclos         : "organizacao_id"

    auth_users     ||--|| profiles       : "espelha"

    fazendas       ||--o{ talhoes        : "possui"
    fazendas       ||--o{ aplicacoes     : "recebe"

    talhoes        ||--o{ ciclos         : "tem por safra"
    talhoes        ||--o{ aplicacoes     : "principal"
    talhoes        ||--o{ aplicacao_talhoes : "vinculado"

    culturas       ||--o{ ciclos         : "define"
    culturas       ||--o{ aplicacoes     : "classifica"
    culturas       ||--o{ lotes          : "destina (opcional)"
    safras         ||--o{ ciclos         : "agrupa"

    defensivos     ||--o{ lotes          : "estocado em"
    defensivos     ||--o{ aplicacao_itens: "usado em"
    defensivos     ||--o{ movimentacoes  : "movimenta"

    lotes          ||--o{ aplicacao_itens: "consumido em"
    lotes          ||--o{ movimentacoes  : "afeta"

    aplicacoes     ||--o{ aplicacao_itens: "contém"
    aplicacoes     ||--o{ aplicacao_talhoes : "espalha em"
    aplicacoes     ||--o{ movimentacoes  : "gera"

    profiles       ||--o{ aplicacoes     : "responsável"
    profiles       ||--o{ movimentacoes  : "autor"
    profiles       ||--o{ lotes          : "created_by"

    inventario_fisico ||--o{ inventario_itens : "contém"
    defensivos     ||--o{ inventario_itens : "contado"
```

---

## 2. Cardinalidades e chaves

| Relacionamento | Cardinalidade | Chave estrangeira | ON DELETE |
|---|---|---|---|
| `fazendas` → `talhoes` | 1 : N | `talhoes.fazenda_id` | CASCADE |
| `talhoes` → `aplicacoes` (principal) | 1 : N | `aplicacoes.talhao_id` | — |
| `talhoes` ↔ `aplicacoes` (N:N) | N : N | `aplicacao_talhoes(aplicacao_id, talhao_id)` | CASCADE (aplicacao) |
| `fazendas` → `aplicacoes` | 1 : N | `aplicacoes.fazenda_id` | — |
| `defensivos` → `lotes` | 1 : N | `lotes.defensivo_id` | — |
| `lotes` → `aplicacao_itens` | 1 : N | `aplicacao_itens.lote_id` (nullable) | — |
| `aplicacoes` → `aplicacao_itens` | 1 : N | `aplicacao_itens.aplicacao_id` | CASCADE |
| `aplicacoes` → `movimentacoes` | 1 : N | `movimentacoes.aplicacao_id` | — |
| `defensivos` → `movimentacoes` | 1 : N | `movimentacoes.defensivo_id` | — |
| `lotes` → `movimentacoes` | 1 : N | `movimentacoes.lote_id` | — |
| `talhoes` → `ciclos` | 1 : N | `ciclos.talhao_id` | CASCADE |
| `safras` → `ciclos` | 1 : N | `ciclos.safra_id` | — |
| `culturas` → `ciclos` | 1 : N | `ciclos.cultura_id` | — |
| `culturas` → `aplicacoes` | 1 : N | `aplicacoes.cultura_id` (NOT NULL) | — |
| `culturas` → `lotes` | 1 : N | `lotes.cultura_id` (nullable) | — |
| `profiles` → `aplicacoes` | 1 : N | `aplicacoes.responsavel_id` | — |
| `inventario_fisico` → `inventario_itens` | 1 : N | `inventario_itens.inventario_id` | — |
| `organizacoes` → profiles, fazendas, talhoes, defensivos, lotes, aplicacoes, movimentacoes, inventario_fisico, culturas, safras, ciclos | 1 : N | `*.organizacao_id` **(avulso — não versionado)** | — |

---

## 3. Regra de modelagem central — Cultura por Ciclo

A cultura **não pertence ao talhão diretamente**. Ela pertence ao par **talhão × safra**, materializado na tabela `ciclos`:

```
talhao ──┐
         ├──> ciclo ──> cultura
safra ───┘            (nesta safra, este talhão é desta cultura)
```

Isso permite **rotação de culturas** (o mesmo talhão ser cana numa safra e soja na seguinte). O campo `talhoes.cultura_atual` (texto) é um resquício denormalizado — a fonte estruturada é `ciclos`.

---

## 4. Fluxograma do banco (dependências de escrita)

```mermaid
flowchart LR
    DEF[defensivos] --> LOT[lotes]
    CUL[culturas] --> LOT
    CUL --> APL[aplicacoes]
    FAZ[fazendas] --> TAL[talhoes]
    FAZ --> APL
    TAL --> APL
    TAL --> AT[aplicacao_talhoes]
    APL --> AT
    APL --> AI[aplicacao_itens]
    DEF --> AI
    LOT --> AI
    AI -.trigger.-> MOV[movimentacoes]
    AI -.trigger.-> LOT
    INV[inventario_fisico] --> II[inventario_itens]
    II -.RPC aplicar_inventario.-> LOT
    II -.RPC.-> MOV
```

Linhas contínuas = FK direta. Linhas tracejadas = efeito automático (trigger/RPC).

---

## 5. Tabelas "folha" e "raiz"

- **Raízes** (ninguém aponta para elas por FK de dados de negócio, tudo nasce delas): `defensivos`, `fazendas`, `culturas`, `safras`, `organizacoes`.
- **Centrais** (mais acopladas): `lotes`, `aplicacoes`, `aplicacao_itens`.
- **Folhas** (consomem, ninguém depende): `movimentacoes` (auditoria), e conceitualmente Dashboard/Relatórios (não são tabelas).

---

<sub>← [02 — Banco de Dados](02-Banco-de-Dados.md) · [⌂ MASTER](MASTER.md) · [04 — Fluxo dos Módulos →](04-Fluxo-dos-Modulos.md)</sub>
