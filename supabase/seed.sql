-- =============================================================
-- Seed — usuários de teste (analista / patrão / operador de campo)
-- =============================================================
-- ⚠️ NUNCA commitar senha em texto plano aqui (histórico do git já
-- foi limpo uma vez por causa disso — ver docs/09-Roadmap.md).
--
-- Antes de rodar: troque CHANGE_ME_BEFORE_RUNNING abaixo por uma
-- senha real (gerada na hora, não reaproveitada de outro lugar) e
-- NÃO commite o arquivo com a senha preenchida. Depois de rodar,
-- reverta esta troca (git checkout -- supabase/seed.sql) antes de
-- dar commit em qualquer outra coisa.
-- =============================================================

-- Analista admin
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'analista@agro.com',
  crypt('CHANGE_ME_BEFORE_RUNNING', gen_salt('bf')),
  now(),
  '{"nome":"Ana Analista","role":"admin"}'
) on conflict (id) do nothing;

-- Patrão viewer
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values (
  'aaaaaaaa-0000-0000-0000-000000000002',
  'patrao@agro.com',
  crypt('CHANGE_ME_BEFORE_RUNNING', gen_salt('bf')),
  now(),
  '{"nome":"João Patrão","role":"viewer"}'
) on conflict (id) do nothing;

-- Operador de campo
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values (
  'aaaaaaaa-0000-0000-0000-000000000003',
  'campo@agro.com',
  crypt('CHANGE_ME_BEFORE_RUNNING', gen_salt('bf')),
  now(),
  '{"nome":"Carlos Campo","role":"field"}'
) on conflict (id) do nothing;

update public.profiles set role = 'admin'  where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.profiles set role = 'viewer' where id = 'aaaaaaaa-0000-0000-0000-000000000002';
update public.profiles set role = 'field'  where id = 'aaaaaaaa-0000-0000-0000-000000000003';

-- Fazendas, talhões e defensivos de exemplo: não recriados aqui —
-- a versão antiga misturava dado de exemplo com dado real do
-- cliente. Ver docs/09-Roadmap.md / CONTRIBUTING.md sobre processo
-- de SQL versionado para carga de dados de organização.
