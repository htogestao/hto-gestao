# 02 — Banco de Dados

> Referência completa do schema PostgreSQL (Supabase). Somente leitura.
>
> **Duas origens de schema:**
> - **Versionado** em `supabase/migrations/001–004` — schema-núcleo, RLS e funções. Estes arquivos **existem no repositório**.
> - **Avulso** — mudanças posteriores (multiempresa, gatilho de baixa de estoque, bula, culturas/safras/ciclos, inventário, campos novos de aplicação), aplicadas manualmente no SQL Editor do Supabase. Estão marcadas **[avulso]**.
>
> ⚠️ **Convenção de referência a SQL — importante:** todo nome de arquivo `.sql` citado nesta documentação com o marcador **[avulso]** (ex.: `desconto_estoque_robusto.sql`, `fix_lotes_permissao.sql`, `inventario_ajusta_estoque.sql`) **NÃO faz parte das migrations versionadas e NÃO existe neste repositório** — não procure por ele em `supabase/`. Esses arquivos foram executados manualmente e não estão sob controle de versão. Apenas os que apontam para `supabase/migrations/00X_*.sql` existem no repo.
>
> Consequência: o banco vivo é a fonte da verdade; o repositório reproduz apenas até `004`. Regularizar isso é a dívida nº 1 em `09-Roadmap.md`.

---

## 1. Tabelas

### 1.1 `profiles` — usuários e papéis
Espelha `auth.users`. Criado automaticamente no cadastro (trigger `handle_new_user`).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid **PK** | FK → `auth.users(id)` `ON DELETE CASCADE` |
| `nome` | text NOT NULL | |
| `telefone` | text | |
| `role` | text NOT NULL | **CHECK** in (`admin`,`viewer`,`field`) · default `field` |
| `ativo` | boolean NOT NULL | default `true` |
| `created_at` | timestamptz | default `now()` |
| `organizacao_id` | uuid | **[avulso]** FK → `organizacoes` |

### 1.2 `fazendas`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid **PK** | default `uuid_generate_v4()` |
| `nome` | text NOT NULL | |
| `municipio`, `uf` | text, char(2) | |
| `area_total_ha` | numeric(10,2) | |
| `latitude`, `longitude` | numeric(10,6) | |
| `codigo_externo`, `polo`, `fornecedor_principal` | text | integração SIG |
| `vencimento_contrato` | date | |
| `unidade_industrial`, `observacoes` | text | |
| `created_at` | timestamptz | |
| `created_by` | uuid | FK → `profiles(id)` |
| `organizacao_id` | uuid | **[avulso]** |

### 1.3 `talhoes`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid **PK** | |
| `fazenda_id` | uuid NOT NULL | FK → `fazendas(id)` **ON DELETE CASCADE** |
| `nome` | text NOT NULL | |
| `cultura_atual` | text | denormalizado (ver `ciclos` como fonte estruturada) |
| `area_ha` | numeric(10,2) | |
| `codigo_sig`, `numero_talhao`, `setor`, `bloco`, `bloco_colheita` | text/int | SIG |
| `variedade`, `numero_corte`, `data_plantio`, `data_colheita_prev` | | cana |
| `sistema_colheita` | text | **CHECK** in (`mecanizada`,`manual`,`semimecanizada`) or null |
| `status_colheita` | text | **CHECK** in (`a_colher`,`colhendo`,`colhido`,`reforma`,`outro`) or null |
| `tch_estimado`, `toneladas_estimadas` | numeric | produtividade |
| `ambiente`, `espacamento`, `dist_terra_km`, `dist_asfalto_km`, `unidade_industrial` | | |
| `num_cortes`, `status_area` | | **[004]** `status_area` CHECK in (`colhida`,`reforma`,`planta`,`soca`) |
| `organizacao_id` | uuid | **[avulso]** |

### 1.4 `defensivos`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid **PK** | |
| `nome_comercial` | text NOT NULL | |
| `principio_ativo` | text NOT NULL | |
| `classe` | text NOT NULL | **CHECK** (16 classes: herbicida, fungicida, inseticida, acaricida, adjuvante, espalhante_adesivo, fertilizante, fertilizante_foliar, adubo_foliar, nematicida, inoculante, maturador, regulador_crescimento, ativador_crescimento, fungicida_herbicida, outro) |
| `unidade` | text NOT NULL | **CHECK** in (`L`,`kg`) |
| `estoque_minimo` | numeric(10,3) NOT NULL | default 0 |
| `empresa`, `local_armazenamento`, `fornecedor_padrao`, `observacoes` | | `local_armazenamento` CHECK in (quartinho, container, quartinho_container, outro) |
| `carencia_dias`, `reentrada_horas`, `classe_toxicologica` | int/text | **[avulso]** bula (fix_defensivos_colunas.sql) |
| `organizacao_id` | uuid | **[avulso]** |

> Observação: a migration `001` também aceita a classe `biologico` no código TypeScript (enum), mas o **CHECK do banco não inclui `biologico`** — divergência a confirmar antes de usar essa classe.

### 1.5 `lotes` — entrada de estoque por NF
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid **PK** | |
| `defensivo_id` | uuid NOT NULL | FK → `defensivos(id)` |
| `numero_nf`, `fornecedor` | text | |
| `data_compra` | date | |
| `quantidade_comprada` | numeric(10,3) NOT NULL | |
| `quantidade_atual` | numeric(10,3) NOT NULL | **CHECK** `>= 0` (`lote_qtd_positiva`) |
| `preco_unitario` | numeric(12,4) | |
| `valor_total` | numeric(12,2) | |
| `data_fabricacao`, `data_vencimento` | date | FEFO usa `data_vencimento` |
| `lote_fabricante`, `observacoes` | text | |
| `created_at`, `created_by` | | FK `created_by` → profiles |
| `cultura_id` | uuid | **[avulso]** FK → `culturas` (opcional) |
| `organizacao_id` | uuid | **[avulso]** |

### 1.6 `aplicacoes`
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid **PK** | |
| `data` | date NOT NULL | default `current_date` |
| `fazenda_id` | uuid NOT NULL | FK → `fazendas(id)` |
| `talhao_id` | uuid NOT NULL | FK → `talhoes(id)` (talhão "principal"; múltiplos via junção) |
| `area_aplicada_ha` | numeric(10,2) | |
| `praga_alvo`, `condicoes_climaticas`, `observacoes` | text | |
| `responsavel_id` | uuid | FK → `profiles(id)` |
| `status` | text NOT NULL | **CHECK** in (`em_andamento`,`encerrada`) · default `em_andamento` |
| `created_at` | timestamptz | |
| `vazao_l_ha` | numeric(8,1) | **[avulso]** add_vazao_aplicacoes.sql |
| `cultura_id` | uuid NOT NULL | **[avulso]** FK → `culturas` |
| `operador`, `equipamento`, `frota`, `tipo_aplicacao` | text | **[avulso]** fase1B |
| `temperatura`, `umidade`, `velocidade_vento` | numeric | **[avulso]** |
| `hora_inicio`, `hora_fim` | text | **[avulso]** (texto, não `time`) |
| `organizacao_id` | uuid | **[avulso]** |

### 1.7 `aplicacao_itens` — produtos usados (dispara a baixa)
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid **PK** | |
| `aplicacao_id` | uuid NOT NULL | FK → `aplicacoes(id)` **ON DELETE CASCADE** |
| `defensivo_id` | uuid NOT NULL | FK → `defensivos(id)` |
| `lote_id` | uuid | originalmente NOT NULL; **[avulso]** tornado nullable (limpar_lotes_duplicados.sql) |
| `dose_por_hectare` | numeric(10,4) | |
| `quantidade_usada` | numeric(10,3) NOT NULL | |
| `quantidade_sobrou` | numeric(10,3) NOT NULL | default 0 |
| `calda_total_l` | numeric(10,2) | |

### 1.8 `aplicacao_talhoes` — junção N:N **[avulso]**
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid **PK** | |
| `aplicacao_id` | uuid NOT NULL | FK → `aplicacoes(id)` **ON DELETE CASCADE** |
| `talhao_id` | uuid NOT NULL | FK → `talhoes(id)` (sem cascade) |
| `area_ha` | numeric(10,2) | |
| — | | **UNIQUE(aplicacao_id, talhao_id)** |

### 1.9 `movimentacoes` — extrato/auditoria de estoque
| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid **PK** | |
| `defensivo_id` | uuid NOT NULL | FK → `defensivos(id)` |
| `lote_id` | uuid | FK → `lotes(id)` |
| `tipo` | text NOT NULL | **CHECK** in (`entrada`,`saida_aplicacao`,`devolucao_sobra`,`ajuste`,`descarte`) |
| `quantidade` | numeric(10,3) NOT NULL | |
| `data_hora` | timestamptz NOT NULL | default `now()` |
| `aplicacao_id` | uuid | FK → `aplicacoes(id)` |
| `usuario_id` | uuid | FK → `profiles(id)` |
| `observacoes` | text | |

### 1.10 Tabelas de cultura/safra **[avulso — Fase 1A]**
- **`culturas`**: `id` PK, `organizacao_id`, `nome`, `ativo`, `criado_em`. (Cana, Soja, Milho, Mandioca)
- **`safras`**: `id` PK, `organizacao_id`, `nome`, `data_inicio`, `data_fim`, `atual`, `criado_em`.
- **`ciclos`**: `id` PK, `organizacao_id`, `talhao_id` FK **CASCADE**, `safra_id` FK, `cultura_id` FK, `data_plantio`, `variedade`, `numero_corte`, `status_colheita`, `observacoes`. → **cultura pertence ao par talhão×safra**.

### 1.11 Tabelas de inventário **[avulso]**
- **`inventario_fisico`**: cabeçalho da contagem. `id` PK, `organizacao_id`, `aplicado` (bool), `aplicado_em`.
- **`inventario_itens`**: itens contados. `inventario_id`, `defensivo_id`, `diferenca`.
  > O `CREATE TABLE` de `inventario_fisico`/`inventario_itens` não foi localizado nas migrations nem nos SQLs avulsos analisados — confirmar no banco.

### 1.12 `organizacoes` — base multiempresa **[avulso — Fase 0]**
`id` PK, `nome`, `ativo`, `criado_em`. Quase todas as tabelas ganharam `organizacao_id` apontando para ela.

---

## 2. Índices (migration `001`)

| Índice | Coluna(s) |
|---|---|
| `idx_talhoes_fazenda` | `talhoes(fazenda_id)` |
| `idx_talhoes_status` | `talhoes(status_colheita)` |
| `idx_lotes_defensivo` | `lotes(defensivo_id)` |
| `idx_lotes_vencimento` | `lotes(data_vencimento)` |
| `idx_aplicacoes_fazenda` | `aplicacoes(fazenda_id)` |
| `idx_aplicacoes_status` | `aplicacoes(status)` |
| `idx_aplicacoes_responsavel` | `aplicacoes(responsavel_id)` |
| `idx_movim_defensivo` | `movimentacoes(defensivo_id)` |
| `idx_movim_lote` | `movimentacoes(lote_id)` |
| `idx_movim_aplicacao` | `movimentacoes(aplicacao_id)` |
| `idx_defensivos_classe` | `defensivos(classe)` |

Índices **[avulso]** adicionados depois: `idx_*_org` (organizacao_id em todas), `idx_aplicacoes_cultura`, `idx_lotes_cultura`, `idx_culturas_org`, `idx_safras_org`, `idx_ciclos_org/talhao/safra`.

---

## 3. Views

### `lotes_field_view` (migration `002`)
View com `security_invoker = true` que expõe lotes **sem colunas financeiras** (`preco_unitario`, `valor_total`) para o papel `field`. Usada pelo app mobile.

```sql
create view public.lotes_field_view with (security_invoker = true) as
  select id, defensivo_id, data_compra, quantidade_comprada,
         quantidade_atual, data_fabricacao, data_vencimento,
         lote_fabricante, observacoes, created_at
  from public.lotes;
```

---

## 4. Functions / RPCs

| Função | Origem | Tipo | Descrição |
|---|---|---|---|
| `current_user_role()` | 002 | sql · SECURITY DEFINER | Retorna o `role` do usuário logado (`auth.uid()`). Base de toda a RLS. |
| `handle_new_user()` | 001 | trigger | Cria `profiles` ao inserir em `auth.users`. |
| `estoque_atual(p_defensivo_id?)` | 003 | RPC | Soma `quantidade_atual` por defensivo; devolve `em_alerta` (≤ mínimo) e `tem_vencido`. |
| `lotes_por_vencimento(p_defensivo_id, p_dias_alerta=90)` | 003 | RPC | Lotes com saldo ordenados por vencimento (FEFO) + status. |
| `encerrar_aplicacao(id, praga, clima, obs, itens jsonb)` | 003 | RPC | **Atômica**: grava sobras, devolve ao lote, registra `devolucao_sobra`, marca `encerrada`. Valida permissão. |
| `alertas_ativos()` | 003 | RPC | 3 tipos: `lote_vencido` (crítico), `vencimento_proximo` (≤90d), `estoque_baixo` (≤ mínimo). |
| `aplicar_inventario(p_inventario_id)` | [avulso] | RPC | Ajusta lotes conforme contagem; registra `ajuste`; idempotente; só admin/viewer. |
| `current_org()` | [avulso] | sql · SECURITY DEFINER | Retorna `organizacao_id` do usuário. Base do `org_guard`. |
| `fn_set_org()` | [avulso] | trigger | Carimba `organizacao_id` em cada INSERT. |
| `fn_decrement_lote_aplicacao()` | [avulso] | trigger | **Baixa de estoque** (líquido = usado − sobra; FEFO se sem lote) + movimentação. |
| `fn_restore_lote_aplicacao()` | [avulso] | trigger | Devolve ao lote ao excluir item + movimentação. |

---

## 5. Triggers

| Trigger | Tabela | Evento | Função |
|---|---|---|---|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` |
| `trg_decrement_lote` | `aplicacao_itens` | AFTER INSERT | `fn_decrement_lote_aplicacao()` **[avulso]** |
| `trg_restore_lote` | `aplicacao_itens` | AFTER DELETE | `fn_restore_lote_aplicacao()` **[avulso]** |
| `trg_set_org` | fazendas, talhoes, defensivos, lotes, aplicacoes, movimentacoes, inventario_fisico, culturas, safras, ciclos | BEFORE INSERT | `fn_set_org()` **[avulso]** |

> **Ponto crítico:** os gatilhos de baixa/restauração de estoque **não estão versionados** em `supabase/migrations/`; vivem apenas nos SQLs avulsos do Desktop e no banco. É a regra de negócio mais importante do sistema.

---

## 6. Policies (RLS) — resumo

Todas as tabelas-núcleo têm RLS habilitada (migration `002`). Padrão geral por papel:

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | próprio ou admin/viewer | admin | próprio ou admin | admin |
| `fazendas` | admin/viewer/field | admin *(depois: +viewer/field [avulso])* | admin *(depois: +viewer/field)* | admin |
| `talhoes` | admin/viewer/field | admin *(depois: +viewer/field)* | admin *(depois: +viewer/field)* | admin |
| `defensivos` | admin/viewer/field | admin *(depois: +viewer)* | admin *(+viewer)* | admin *(+viewer)* |
| `lotes` | admin/viewer **e** field (via política própria) | admin *(+viewer)* | admin *(+viewer)* | admin |
| `aplicacoes` | admin/viewer **ou** field(responsável) | admin/field | admin **ou** field(responsável, em_andamento) *(depois +field qualquer)* | admin *(depois +viewer, +field dono)* |
| `aplicacao_itens` | admin/viewer **ou** dono da aplicação | admin **ou** field(dono, em_andamento) *(depois +field dono qualquer status)* | admin *(depois +field dono)* | admin *(depois +field dono)* |
| `movimentacoes` | admin/viewer **ou** field(próprio) | admin/field | admin | admin |
| `culturas`/`safras`/`ciclos` | admin/viewer/field | admin/viewer | admin/viewer | admin/viewer |

Detalhes completos e evolução das policies em `08-Seguranca.md`.

**Restritiva multiempresa `org_guard` [avulso]:** política `AS RESTRICTIVE` em `culturas`/`safras`/`ciclos` que exige `organizacao_id = current_org()`. Confirmar no banco se foi aplicada às tabelas-núcleo.

---

## 7. Constraints (resumo)

- **PK:** `uuid` em todas as tabelas (default `uuid_generate_v4()`), exceto `profiles.id` (= `auth.users.id`).
- **FK com CASCADE:** `talhoes.fazenda_id`, `aplicacao_itens.aplicacao_id`, `aplicacao_talhoes.aplicacao_id`, `ciclos.talhao_id`, `profiles.id`.
- **FK sem CASCADE:** demais (ex.: `aplicacao_talhoes.talhao_id`, `lotes.defensivo_id`).
- **CHECK de domínio:** papéis, classes de defensivo, unidades, status de aplicação/colheita, tipos de movimentação, `lote_qtd_positiva (>= 0)`.
- **UNIQUE:** `aplicacao_talhoes(aplicacao_id, talhao_id)`.

Ver o diagrama de relacionamentos em `03-DER.md`.

---

<sub>← [01 — Arquitetura](01-Arquitetura.md) · [⌂ MASTER](MASTER.md) · [03 — DER →](03-DER.md)</sub>
