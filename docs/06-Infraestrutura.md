# 06 — Infraestrutura

> Variáveis de ambiente, integrações e componentes de infraestrutura. Somente leitura.

---

## 1. Monorepo

- Gerenciador: **pnpm workspaces** (`pnpm-workspace.yaml` → `packages/*`).
- Node: gerenciado localmente; `packageManager: pnpm@9.0.0` na raiz.
- Scripts na raiz (`package.json`):
  - `dev:web` → `pnpm --filter web dev`
  - `dev:mobile` → `pnpm --filter mobile start`
  - `build:web` → `pnpm --filter web build`
  - `build:shared` → `pnpm --filter shared build`
  - `type-check` → `pnpm --filter shared type-check && pnpm --filter web type-check`

**Dependência interna:** `web` e `mobile` dependem de `@agro/shared` (`workspace:*`). O `next.config.mjs` usa `transpilePackages: ['@agro/shared']`.

---

## 2. Variáveis de ambiente

### Web (`packages/web/.env.local`)
| Variável | Uso | Exposição |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase | Pública (vai ao navegador) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anônima Supabase | Pública (por design; segurança via RLS) |

> `NEXT_PUBLIC_*` são propositalmente públicas — o navegador precisa delas. A segurança **não** depende de escondê-las, e sim da RLS. No Vercel, defina-as no painel do projeto.

### Mobile (`packages/mobile/.env`)
| Variável | Uso |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Chave anônima Supabase |

### Edge Function (`import-inventario`) — ambiente do Supabase
| Variável | Uso | Sensibilidade |
|---|---|---|
| `SUPABASE_URL` | URL do projeto | — |
| `SUPABASE_SERVICE_ROLE_KEY` | **Chave de serviço** (ignora RLS) | **SECRETA** — nunca expor no cliente |

> A Edge Function usa a service role key para operar, mas **valida o papel admin** do chamador antes de qualquer escrita (defesa em profundidade).

---

## 3. Integração Supabase

- **Projeto:** hospedado no Supabase. Os identificadores concretos (project ref, URL, conta) **não são documentados aqui** por serem infraestrutura sensível e este repositório ser público — consulte-os no painel do Supabase ou nas variáveis de ambiente do Vercel.
- **Componentes usados:** PostgreSQL, Auth, Row Level Security, RPC (funções SQL/plpgsql), Edge Functions (Deno), Views.
- **Clientes:**
  - Web servidor: `@supabase/ssr` `createServerClient` com cookies (`src/lib/supabase/server.ts`).
  - Web navegador: `@supabase/ssr` `createBrowserClient` (`src/lib/supabase/client.ts`).
  - Middleware: `createServerClient` com cookies do request.
  - Mobile: `@supabase/supabase-js` com `AsyncStorage` (persistência de sessão).
- **Mudanças de schema:** aplicadas manualmente no SQL Editor (o schema-núcleo está em `supabase/migrations/001–004`; alterações posteriores são SQLs avulsos).

---

## 4. Integração GitHub

- Repositório: `htogestao/hto-gestao` (**público** — exigência do Vercel Hobby).
- Branch de produção: `main`.
- Cada `push` na `main` dispara o deploy automático no Vercel.
- `.gitignore` ignora `node_modules/`, `.next/`, `out/`, `dist/`, `*.tsbuildinfo`, `.env*.local`, `.expo/`, `.vercel`, temporários e logs.

---

## 5. Integração Vercel

- Plano: **Hobby**.
- Configuração em `packages/web/vercel.json`:
  ```json
  {
    "framework": "nextjs",
    "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
    "buildCommand": "cd ../.. && pnpm --filter web build",
    "outputDirectory": ".next"
  }
  ```
- `next.config.mjs`: `transpilePackages: ['@agro/shared']`, **`typescript.ignoreBuildErrors: true`**, **`eslint.ignoreDuringBuilds: true`**.
  > Consequência: erros de tipo/lint **não** quebram o build de produção (ver dívida técnica em `09-Roadmap.md`).
- Variáveis de ambiente: configuradas no painel do Vercel (não vêm do `.env.local` do repositório).

---

## 6. Edge Functions

| Função | Runtime | Autorização | O que faz |
|---|---|---|---|
| `import-inventario` | Deno (Supabase) | Exige Bearer token + papel `admin` | Recebe planilha SIG (multipart), faz upsert de `fazendas` e `talhoes`. Retorna contagem processada. |

Deploy: via Supabase CLI (`supabase functions deploy import-inventario`).

---

## 7. Mobile (Expo)

- Config: `app.json`, `eas.json`. Build de APK Android via **EAS** (`eas build --platform android --profile preview`).
- Offline: banco local **SQLite** (`expo-sqlite`, arquivo `agro_local.db`) com tabelas espelho (fazendas, talhoes, defensivos, lotes_field, aplicacoes, aplicacao_itens) + `sync_meta`.
- Estado: **Zustand** (`useStore`) guarda profile, fazendas, defensivos e status de sync.
- Sincronização: `pull` (servidor → SQLite) + `push` (pendências locais → servidor). Ver fluxo em `07-Deploy.md`.

---

## 8. Pontos únicos de falha (SPOF)

| Componente | Risco | Mitigação atual | Observação |
|---|---|---|---|
| **Projeto Supabase** | Se cair/for perdido, todo o sistema para | Backup manual (tela Exportar) | Sem backup automático; migrations param no `004` → banco não é 100% reproduzível pelo repo |
| **Gatilho de baixa de estoque** | Regra central não versionada | — | Vive só em SQL avulso + banco |
| **`current_user_role()` / RLS** | Toda a segurança depende disso | Versionado em `002_rls.sql` | Uma política errada afeta vários módulos |
| **Conta Vercel/GitHub** | Deploy depende de contas específicas | — | Repo público; 2FA na conta Vercel |
| **`service_role_key` (Edge)** | Se vazar, ignora toda a RLS | Guardada só no ambiente Supabase | Nunca deve ir ao cliente |
| **Type-check desligado no build** | Erros de tipo chegam à produção | — | `ignoreBuildErrors: true` |

---

<sub>← [05 — Regras de Negócio](05-Regras-de-Negocio.md) · [⌂ MASTER](MASTER.md) · [07 — Deploy →](07-Deploy.md)</sub>
