# AgroGestão — Sistema de Gestão Agrícola

Monorepo com painel web (Next.js 14) + app mobile (React Native/Expo) + Supabase.

---

## Estrutura

```
agro-system/
├── packages/
│   ├── shared/          # Tipos TypeScript + utils compartilhados
│   ├── web/             # Painel web (Next.js 14 + Tailwind)
│   └── mobile/          # App campo (Expo + React Native)
├── supabase/
│   ├── migrations/      # 001_tables, 002_rls, 003_functions
│   ├── functions/       # Edge Functions (import-inventario)
│   └── seed.sql         # Dados iniciais (19 fazendas + 40 defensivos reais)
└── README.md
```

---

## 1. Configurar Supabase (do zero)

### 1.1 Criar projeto
1. Acesse [supabase.com](https://supabase.com) → New Project
2. Anote a **URL** e a **Anon Key** (Settings → API)

### 1.2 Rodar as migrations
No dashboard Supabase → **SQL Editor**, execute em ordem:

```sql
-- Cole e execute cada arquivo:
-- 1. supabase/migrations/001_tables.sql
-- 2. supabase/migrations/002_rls.sql
-- 3. supabase/migrations/003_functions.sql
-- 4. supabase/seed.sql   ← dados iniciais
```

### 1.3 Criar usuários no Supabase Auth
O seed cria os auth.users automaticamente se executado. Caso precise criar manualmente:
- Dashboard → Authentication → Users → **Add user**
- Use os e-mails: `analista@agro.com`, `patrao@agro.com`, `campo@agro.com`
- Senha padrão: `Agro@2025!` (altere após o primeiro login)

---

## 2. Variáveis de Ambiente

### Web (`packages/web/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

### Mobile (`packages/mobile/.env`)
```env
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

---

## 3. Rodar em desenvolvimento

### Instalar dependências
```bash
# Na raiz do projeto (requer pnpm)
npm install -g pnpm
pnpm install
```

### Painel Web
```bash
cd packages/web
pnpm dev
# Abre em http://localhost:3000
```

### App Mobile
```bash
cd packages/mobile
pnpm start
# Escaneie o QR code com o Expo Go (Android/iOS)
```

---

## 4. Deploy

### Web — Vercel (grátis)
```bash
# Na raiz do projeto
npx vercel --cwd packages/web

# Defina as variáveis de ambiente no painel Vercel:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Mobile — EAS Build (APK Android)
```bash
cd packages/mobile
npm install -g eas-cli
eas login
eas build --platform android --profile preview
# Gera APK para instalar diretamente no celular (sem Play Store)
```

### Edge Function (import-inventario)
```bash
# Requer Supabase CLI
npm install -g supabase
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy import-inventario
```

---

## 5. Importar planilhas

### Inventário MV (Fazendas + Talhões)
- Painel Web → **Importar Excel** → aba **Inventário MV (SIG)**
- Suba o arquivo `Inventario MV 29-05-25 (2).xlsx` **sem nenhuma modificação**
- O sistema lê automaticamente as 54 colunas do formato SIG exportado
- Resultado: fazendas e talhões criados/atualizados automaticamente

### Estoque de Defensivos
- Painel Web → **Importar Excel** → aba **Defensivos / Estoque**
- Formato: `NOME_PRODUTO | LOCAL_ARMAZENAMENTO | EMPRESA | PRINCIPIO_ATIVO | CLASSIFICACAO | UNIDADE | ESTOQUE_ATUAL | ESTOQUE_MINIMO | OBSERVACAO`
- Observação `"120 VENCIDO"` → sistema cria lote ok (restante) + lote vencido (120) automaticamente
- Baixe o modelo na tela de importação

### Compras / NFs (quando disponíveis)
- Painel Web → **Importar Excel** → aba **Compras / NFs**
- Formato: `NOME_PRODUTO | NUMERO_NF | FORNECEDOR | DATA_COMPRA | QUANTIDADE | PRECO_UNITARIO | ...`
- Valida NFs duplicadas antes de confirmar

---

## 6. Perfis de acesso

| Funcionalidade | Analista/Supervisor (`admin`) | Patrão/Produtor (`viewer`) | Campo (`field`) |
|---|---|---|---|
| Painel web | ✅ Completo | ✅ Somente leitura | ❌ Apenas mobile |
| App mobile | ✅ | ✅ Leitura | ✅ Operação |
| Ver fazendas/talhões | ✅ | ✅ | ✅ |
| Ver defensivos (nome, princípio ativo) | ✅ | ✅ | ✅ |
| Ver preços / NFs / valores | ✅ | ✅ | ❌ |
| Criar/editar fazendas, defensivos | ✅ | ❌ | ❌ |
| Registrar aplicação | ✅ | ❌ | ✅ (própria) |
| Encerrar aplicação | ✅ | ❌ | ✅ (própria) |
| Exportar Excel/PDF | ✅ | ✅ | ❌ |
| Importar Excel | ✅ | ❌ | ❌ |
| Gerenciar usuários | ✅ | ❌ | ❌ |

---

## 7. Classificações de defensivos suportadas

`herbicida` · `fungicida` · `inseticida` · `acaricida` · `adjuvante` · `espalhante_adesivo` · `fertilizante` · `fertilizante_foliar` · `adubo_foliar` · `nematicida` · `inoculante` · `maturador` · `regulador_crescimento` · `ativador_crescimento` · `fungicida_herbicida` · `outro`

---

## 8. Dados pré-carregados (seed)

- **19 fazendas** reais: Fazenda Recanto Primavera, Fazenda Guanabara, Fazenda Baracoa, Fazenda Mironga...
- **40 defensivos** da planilha física real: APROACH POWER (1340 L), COMPASS (332 L), METRIBUZIM (424 L), ZAPP (180 L), MIRATO (194 L)...
- **Lotes** com estoques reais, incluindo lote vencido TOPIK 240 EC (12 L, vencido 2023) para teste de alertas
- **3 usuários de teste**: analista@agro.com / patrao@agro.com / campo@agro.com (senha: `Agro@2025!`)
