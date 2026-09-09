// =====================================================================
// Dump lógico do banco de produção via Supabase Management API.
// Não precisa de senha do banco, pg_dump nem Docker — só do token pessoal
// (SUPABASE_ACCESS_TOKEN) com acesso ao projeto.
//
// USO:  node backup/dump.mjs <pasta_saida>
// Gera:
//   01_schema.sql   extensões, tabelas, PK/UNIQUE/CHECK, funções, views, índices
//   02_data.sql     dados de todas as tabelas de public (json_populate_recordset)
//   02b_auth.sql    auth.users + auth.identities (logins; senhas já vêm criptografadas)
//   03_post.sql     FKs, triggers, RLS + policies, grants (se os papéis existirem)
//   04_verify.sql   contagem + checksum por tabela (pra conferir uma restauração)
//   manifest.json   mesmo conteúdo, calculado na ORIGEM
// Restauração: ver docs/10-Backup-e-Restauracao.md. SOMENTE LEITURA na origem.
// =====================================================================
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const REF   = process.env.SUPABASE_PROJECT_REF || 'dhdcpghzhyzeghqgggps'
const TOKEN = (process.env.SUPABASE_ACCESS_TOKEN || '').trim()
const OUT   = process.argv[2] || `backup_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}`
const CHUNK = 1000
const DELIM = '$hto_json$'
if (!TOKEN) { console.error('ERRO: SUPABASE_ACCESS_TOKEN ausente.'); process.exit(1) }

const API = `https://api.supabase.com/v1/projects/${REF}/database/query`
async function q(sql) {
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    const r = await fetch(API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: sql, read_only: true }),
    })
    const t = await r.text()
    if (r.ok) return t ? JSON.parse(t) : []
    if (tentativa === 3 || r.status < 500) throw new Error(`HTTP ${r.status}: ${t.slice(0, 300)}`)
    await new Promise(res => setTimeout(res, 2000 * tentativa))
  }
}
const ident = s => `"${s.replace(/"/g, '""')}"`
const lit   = s => `'${String(s).replace(/'/g, "''")}'`

mkdirSync(OUT, { recursive: true })
const started = new Date()

// ── 1. Metadados do schema ─────────────────────────────────────────
const tables = await q(`
  select c.relname, c.relrowsecurity,
    (select json_agg(json_build_object('name', a.attname, 'type', format_type(a.atttypid, a.atttypmod),
        'notnull', a.attnotnull, 'default', pg_get_expr(d.adbin, d.adrelid), 'generated', a.attgenerated = 's') order by a.attnum)
     from pg_attribute a left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
     where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped) as cols
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' order by 1`)

const constraints = await q(`
  select conrelid::regclass::text as tabela, conname, contype, pg_get_constraintdef(oid) as def,
    (select json_agg(a.attname order by k.ord) from unnest(conkey) with ordinality k(attnum, ord)
       join pg_attribute a on a.attrelid = conrelid and a.attnum = k.attnum) as cols
  from pg_constraint where connamespace = 'public'::regnamespace order by conrelid::regclass::text, conname`)

const indexes = await q(`
  select tablename, indexname, indexdef from pg_indexes
  where schemaname = 'public'
    and indexname not in (select conname from pg_constraint where connamespace = 'public'::regnamespace)
  order by 1, 2`)

const functions = await q(`
  select p.proname, pg_get_functiondef(p.oid) as ddl, pg_get_function_identity_arguments(p.oid) as args,
    has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f' order by 1`)

const views = await q(`
  select c.relname, array_to_json(c.reloptions) as reloptions, pg_get_viewdef(c.oid, true) as def,
    (select json_agg(distinct s.relname) from pg_depend d
       join pg_rewrite r on r.oid = d.objid join pg_class s on s.oid = d.refobjid
     where r.ev_class = c.oid and s.relkind = 'v' and s.oid <> c.oid) as deps,
    has_table_privilege('anon', c.oid, 'SELECT') as anon_select
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'v' order by 1`)

const triggers = await q(`
  select n.nspname as schema, c.relname as tabela, t.tgname, pg_get_triggerdef(t.oid) as ddl
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal and n.nspname in ('public', 'auth') order by 1, 2, 3`)

const policies = await q(`
  select tablename, policyname, permissive, array_to_json(roles) as roles, cmd, qual, with_check
  from pg_policies where schemaname = 'public' order by tablename, policyname`)

const version = (await q(`select version() as v`))[0].v

// ── 2. 01_schema.sql ───────────────────────────────────────────────
let s = `-- HtoGestão · schema · gerado ${started.toISOString()} · ${version}\n`
s += `set check_function_bodies = off;\nset client_min_messages = warning;\n\n`
for (const t of tables) {
  s += `create table public.${ident(t.relname)} (\n`
  // coluna gerada (ex.: inventario_itens.diferenca) vem de pg_attrdef como se fosse default
  s += t.cols.map(c => `  ${ident(c.name)} ${c.type}${c.notnull ? ' not null' : ''}${c.generated ? ' generated always as (' + c.default + ') stored' : c.default ? ' default ' + c.default : ''}`).join(',\n')
  s += `\n);\n`
}
s += `\n-- chaves primárias, unique e check (FKs ficam no 03_post.sql, depois dos dados)\n`
for (const c of constraints.filter(c => c.contype === 'p')) s += `alter table public.${ident(c.tabela)} add constraint ${ident(c.conname)} ${c.def};\n`
for (const c of constraints.filter(c => c.contype === 'u')) s += `alter table public.${ident(c.tabela)} add constraint ${ident(c.conname)} ${c.def};\n`
for (const c of constraints.filter(c => c.contype === 'c')) s += `alter table public.${ident(c.tabela)} add constraint ${ident(c.conname)} ${c.def};\n`
s += `\n-- funções\n`
for (const f of functions) s += `${f.ddl};\n\n`
s += `-- views (em ordem de dependência)\n`
const done = new Set(); const pend = [...views]
while (pend.length) {
  const i = pend.findIndex(v => (v.deps || []).every(d => done.has(d)))
  if (i < 0) throw new Error('ciclo de dependência entre views')
  const v = pend.splice(i, 1)[0]
  const opts = v.reloptions ? ` with (${v.reloptions.join(', ')})` : ''
  s += `create view public.${ident(v.relname)}${opts} as\n${v.def}\n\n`
  done.add(v.relname)
}
s += `-- índices\n`
for (const i of indexes) s += `${i.indexdef};\n`
writeFileSync(join(OUT, '01_schema.sql'), s)

// ── 3. 02_data.sql + manifest ──────────────────────────────────────
const pk = {}
for (const c of constraints.filter(c => c.contype === 'p')) pk[c.tabela] = c.cols
let d = `-- HtoGestão · dados · gerado ${started.toISOString()}\nset client_min_messages = warning;\n\n`
const manifest = { gerado_em: started.toISOString(), projeto: REF, versao_pg: version, tabelas: {} }
let verify = ''
for (const t of tables) {
  const order = (pk[t.relname] || [t.cols[0].name]).map(ident).join(', ')
  // lista explícita de colunas: colunas geradas não aceitam INSERT
  const colList = t.cols.filter(c => !c.generated).map(c => ident(c.name)).join(', ')
  const stats = (await q(`select count(*)::int as n, md5(coalesce(string_agg(md5(t::text), '' order by t::text), '')) as h from public.${ident(t.relname)} t`))[0]
  manifest.tabelas[t.relname] = { linhas: stats.n, checksum: stats.h }
  verify += `${verify ? 'union all\n' : ''}select '${t.relname}' as tabela, count(*)::int as n, md5(coalesce(string_agg(md5(t::text), '' order by t::text), '')) as h from public.${ident(t.relname)} t\n`
  d += `-- ${t.relname}: ${stats.n} linhas\n`
  for (let off = 0; off < stats.n; off += CHUNK) {
    const rows = (await q(`select coalesce(json_agg(t), '[]'::json) as j from (select * from public.${ident(t.relname)} order by ${order} limit ${CHUNK} offset ${off}) t`))[0].j
    const json = JSON.stringify(rows)
    if (json.includes(DELIM)) throw new Error(`dado contém o delimitador ${DELIM} em ${t.relname}`)
    d += `insert into public.${ident(t.relname)} (${colList}) select ${colList} from json_populate_recordset(null::public.${ident(t.relname)}, ${DELIM}${json}${DELIM}::json);\n`
  }
  d += '\n'
  process.stdout.write(`  ${t.relname.padEnd(26)} ${String(stats.n).padStart(6)} linhas\n`)
}
writeFileSync(join(OUT, '02_data.sql'), d)
writeFileSync(join(OUT, '04_verify.sql'), verify + 'order by 1;\n')

// ── 4. 02b_auth.sql (usuários) ─────────────────────────────────────
// Lista explícita de colunas: no Supabase real, auth.users tem colunas NOT NULL
// com default (is_anonymous etc.) e auth.identities.email é gerada — um
// `insert ... select *` quebraria. Com a lista, o que não vem no JSON usa o default.
const USER_COLS = ['id', 'instance_id', 'aud', 'role', 'email', 'encrypted_password', 'email_confirmed_at', 'invited_at',
  'confirmation_sent_at', 'recovery_sent_at', 'last_sign_in_at', 'raw_app_meta_data', 'raw_user_meta_data',
  'is_super_admin', 'created_at', 'updated_at', 'phone', 'is_sso_user', 'deleted_at']
const IDENT_COLS = ['id', 'provider_id', 'user_id', 'identity_data', 'provider', 'last_sign_in_at', 'created_at', 'updated_at']
const users = (await q(`select coalesce(json_agg(u order by u.created_at), '[]'::json) as j from (
  select ${USER_COLS.join(', ')} from auth.users) u`))[0].j
const identities = (await q(`select coalesce(json_agg(i order by i.created_at), '[]'::json) as j from (
  select ${IDENT_COLS.join(', ')} from auth.identities) i`))[0].j
let a = `-- HtoGestão · auth.users/identities · ${users.length} usuários\n`
a += `insert into auth.users (${USER_COLS.join(', ')}) select ${USER_COLS.join(', ')} from json_populate_recordset(null::auth.users, ${DELIM}${JSON.stringify(users)}${DELIM}::json) on conflict (id) do nothing;\n`
a += `insert into auth.identities (${IDENT_COLS.join(', ')}) select ${IDENT_COLS.join(', ')} from json_populate_recordset(null::auth.identities, ${DELIM}${JSON.stringify(identities)}${DELIM}::json) on conflict do nothing;\n`
writeFileSync(join(OUT, '02b_auth.sql'), a)
manifest.auth_users = users.length

// ── 5. 03_post.sql ────────────────────────────────────────────────
let p = `-- HtoGestão · pós-dados · FKs, triggers, RLS, policies, grants\nset client_min_messages = warning;\n\n`
for (const c of constraints.filter(c => c.contype === 'f')) p += `alter table public.${ident(c.tabela)} add constraint ${ident(c.conname)} ${c.def};\n`
p += `\n-- triggers\n`
for (const t of triggers) p += `${t.ddl};\n`
p += `\n-- RLS\n`
for (const t of tables.filter(t => t.relrowsecurity)) p += `alter table public.${ident(t.relname)} enable row level security;\n`
for (const po of policies) {
  const roles = (po.roles || ['public']).map(r => r === 'public' ? 'public' : ident(r)).join(', ')
  p += `create policy ${ident(po.policyname)} on public.${ident(po.tablename)} as ${po.permissive === 'PERMISSIVE' ? 'permissive' : 'restrictive'} for ${po.cmd.toLowerCase()} to ${roles}`
  if (po.qual) p += `\n  using (${po.qual})`
  if (po.with_check) p += `\n  with check (${po.with_check})`
  p += ';\n'
}
p += `\n-- grants padrão do Supabase (só se os papéis existirem — num Postgres comum são ignorados)\n`
p += `do $$ begin\n  if exists (select 1 from pg_roles where rolname = 'authenticated') then\n`
p += `    grant usage on schema public to anon, authenticated, service_role;\n`
p += `    grant all on all tables in schema public to anon, authenticated, service_role;\n`
p += `    grant execute on all functions in schema public to anon, authenticated, service_role;\n`
for (const f of functions.filter(f => !f.anon_exec)) p += `    revoke execute on function public.${ident(f.proname)}(${f.args}) from anon, public;\n`
for (const v of views.filter(v => !v.anon_select)) p += `    revoke all on public.${ident(v.relname)} from anon, public;\n`
p += `  end if;\nend $$;\n`
writeFileSync(join(OUT, '03_post.sql'), p)
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))

const total = Object.values(manifest.tabelas).reduce((s, t) => s + t.linhas, 0)
console.log(`\nOK: ${tables.length} tabelas, ${total} linhas, ${functions.length} funções, ${views.length} views, ${policies.length} policies, ${users.length} usuários → ${OUT}/ (${Math.round((Date.now() - started) / 1000)}s)`)
