# 10 — Backup e Restauração

> Passo a passo para emergência. Escrito para ser seguido sem lembrar de nada. Criado em 2026-09-08 (tarefa C3 da auditoria).

## Onde estão os backups

Todo dia às 03:00 (Brasília) o GitHub Actions roda o workflow **"Backup do banco"** (`.github/workflows/backup-banco.yml`). Cada execução:

1. faz um dump lógico da produção pela Management API (sem senha do banco);
2. **restaura o dump num Postgres limpo** e confere contagem e checksum de cada tabela contra a origem — se não bater, o run fica vermelho;
3. criptografa e guarda o arquivo como *artifact* por **90 dias**.

Para pegar um backup: GitHub → repositório `htogestao/hto-gestao` → aba **Actions** → workflow **Backup do banco** → clicar no run do dia → seção **Artifacts** → baixar `hto-gestao-backup-AAAA-MM-DD_HHMM`. O zip baixado contém um único arquivo `.tar.gz.enc`.

Se um run falhar, o GitHub manda e-mail para o dono da conta. Um run vermelho é para ser olhado no mesmo dia.

**Uma vez por mês:** baixar o backup mais recente e guardar em `C:\Users\User\Backups\hto-gestao\` (e numa segunda cópia fora do PC). O GitHub apaga artifacts com mais de 90 dias.

## Segredos envolvidos

| Segredo | Onde vive | Para que serve |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | GitHub → Settings → Secrets → Actions | token pessoal da Supabase usado pelo dump |
| `BACKUP_PASSPHRASE` | GitHub Secrets **e** Cofre de Credenciais do Windows (`HtoGestao-Backup`) **e** gerenciador de senhas do Henrique | senha que abre o arquivo `.enc`. **Sem ela o backup é inútil.** |

Se o token da Supabase for trocado, atualizar o secret no GitHub. Se a passphrase for trocada, os backups antigos continuam abrindo só com a antiga.

**Histórico de rotação da passphrase**

| Data | Motivo | Efeito |
|---|---|---|
| 2026-09-09 01:17 UTC | primeira passphrase exposta em texto plano fora do ambiente seguro | secret rotacionado; o único backup cifrado com a antiga (run #2, 01:13) foi apagado; a partir do run #3 (01:18) tudo abre só com a nova |

Quando rotacionar: gerar 36 bytes aleatórios em base64 (`openssl rand -base64 36`), atualizar o secret `BACKUP_PASSPHRASE`, rodar o workflow à mão, baixar o artifact e abrir com a nova (o passo "Descriptografar" acima). Backups anteriores ficam ilegíveis se a antiga for perdida; com retenção de 90 dias isso é aceitável, mas apague-os se a antiga foi exposta.

## Descriptografar um backup (Windows, Git Bash)

```bash
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -in hto-gestao-backup-2026-09-08_0600.tar.gz.enc -out backup.tar.gz
tar xzf backup.tar.gz
```

Vai pedir a passphrase. Resultado: pasta com `01_schema.sql`, `02_data.sql`, `02b_auth.sql`, `03_post.sql`, `04_verify.sql` e `manifest.json` (contagem e checksum de cada tabela na origem, no momento do dump).

## Restaurar num projeto Supabase novo (cenário de emergência)

Use quando o projeto de produção foi perdido ou corrompido e não dá para recuperar nele mesmo.

1. **Criar o projeto** em supabase.com (mesma conta `htoengenhariaintegrada@gmail.com`, região `us-west-2`). Anotar a senha do banco definida na criação.
2. **Abrir o SQL Editor** do projeto novo e rodar, nesta ordem, colando o conteúdo de cada arquivo:
   1. `01_schema.sql`
   2. `02_data.sql`
   3. `02b_auth.sql` (recria os logins; as senhas já vêm criptografadas e continuam valendo)
   4. `03_post.sql`
   Se preferir linha de comando (precisa do `psql`): `psql "<connection string do projeto novo>" -v ON_ERROR_STOP=1 -f 01_schema.sql` e assim por diante. **Não rodar `backup/restore-prelude.sql` num Supabase** — ele é só para Postgres comum.
3. **Conferir:** rodar `04_verify.sql` no SQL Editor e comparar linha a linha com `manifest.json` (mesma contagem e mesmo checksum por tabela).
4. **Reapontar os apps:** no Vercel, trocar `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` pelos do projeto novo e fazer redeploy; no mobile, `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY`.
5. **Refazer o que não está no backup** (lista abaixo).
6. **Atualizar** `SUPABASE_PROJECT_REF` no workflow (ou a env `SUPABASE_PROJECT_REF`) e gerar um novo token para o secret, senão o backup continua apontando para o projeto antigo.

## O que NÃO está no backup

- Configuração de Auth do painel: `disable_signup` (deve ficar **ligado**), URL do site, redirect URLs, templates de e-mail.
- Secrets da Edge Function (`SB_SECRET_KEY`) e o deploy da função `import-inventario` (`supabase functions deploy`).
- Variáveis de ambiente do Vercel.
- Arquivos em Storage (hoje não há).
- Sessões abertas (todo mundo faz login de novo).

## Testar a restauração fora de emergência

O workflow já faz isso todo dia (passos 2 e 3). Para um teste manual com inspeção dos dados, num PC com Docker:

```bash
docker run --rm -d --name hto-restore -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:17
URL=postgresql://postgres:postgres@localhost:5433/postgres
psql "$URL" -v ON_ERROR_STOP=1 -f backup/restore-prelude.sql
psql "$URL" -v ON_ERROR_STOP=1 -f 01_schema.sql -f 02_data.sql -f 02b_auth.sql -f 03_post.sql
psql "$URL" -At -F, -f 04_verify.sql > restored.csv
node backup/compare.mjs manifest.json restored.csv
```

## Rodar o dump à mão (sem GitHub)

```bash
SUPABASE_ACCESS_TOKEN=sbp_... node backup/dump.mjs C:/Users/User/Backups/hto-gestao/backup_manual
```

Só leitura na produção. Leva menos de um minuto.

---

<sub>← [09 — Roadmap](09-Roadmap.md) · [⌂ MASTER](MASTER.md)</sub>
