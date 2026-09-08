-- =====================================================================
-- Prelúdio para restaurar o dump num Postgres COMUM (não Supabase):
-- cria o mínimo do schema `auth` que o schema do HtoGestão referencia
-- (auth.users, auth.identities, auth.uid()) e as extensões.
-- Num projeto Supabase NOVO isso já existe — NÃO rodar este arquivo lá.
-- =====================================================================
set client_min_messages = warning;
alter database postgres set timezone to 'UTC';
set timezone to 'UTC';

create schema if not exists extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
alter database postgres set search_path to public, extensions;
set search_path to public, extensions;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  instance_id uuid,
  aud text,
  role text,
  email text,
  encrypted_password text,
  email_confirmed_at timestamptz,
  invited_at timestamptz,
  confirmation_sent_at timestamptz,
  recovery_sent_at timestamptz,
  last_sign_in_at timestamptz,
  raw_app_meta_data jsonb,
  raw_user_meta_data jsonb,
  is_super_admin boolean,
  created_at timestamptz,
  updated_at timestamptz,
  phone text,
  is_sso_user boolean,
  deleted_at timestamptz
);

create table if not exists auth.identities (
  id uuid primary key,
  provider_id text,
  user_id uuid,
  identity_data jsonb,
  provider text,
  last_sign_in_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
);

-- Mesma semântica do Supabase: lê o `sub` do JWT em request.jwt.claims.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(coalesce(
    current_setting('request.jwt.claim.sub', true),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  ), '')::uuid
$$;
