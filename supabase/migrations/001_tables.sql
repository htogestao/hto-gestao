-- =============================================
-- AgroGestão — Schema v1.0
-- =============================================

create extension if not exists "uuid-ossp";

-- ─── PROFILES ────────────────────────────────
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  nome       text not null,
  telefone   text,
  role       text not null check (role in ('admin','viewer','field')) default 'field',
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, nome, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'role','field')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── FAZENDAS ────────────────────────────────
create table public.fazendas (
  id                   uuid primary key default uuid_generate_v4(),
  nome                 text not null,
  municipio            text,
  uf                   char(2),
  area_total_ha        numeric(10,2),
  latitude             numeric(10,6),
  longitude            numeric(10,6),
  -- Campos extras para integração com SIG / planilhas de cana
  codigo_externo       text,            -- NUM do inventário SIG
  polo                 text,            -- ex: PSL
  fornecedor_principal text,            -- arrendatário/produtor
  vencimento_contrato  date,
  unidade_industrial   text,            -- ex: USL
  observacoes          text,
  created_at           timestamptz not null default now(),
  created_by           uuid references public.profiles(id)
);

-- ─── TALHÕES ─────────────────────────────────
create table public.talhoes (
  id                uuid primary key default uuid_generate_v4(),
  fazenda_id        uuid not null references public.fazendas(id) on delete cascade,
  nome              text not null,
  -- Campos genéricos
  cultura_atual     text,              -- "Cana", "Soja", "Milho", etc.
  area_ha           numeric(10,2),
  observacoes       text,
  -- Campos específicos cana (opcionais, null para outras culturas)
  codigo_sig        text,              -- CHAVESIG do inventário SIG
  numero_talhao     integer,
  setor             integer,
  bloco             integer,
  bloco_colheita    integer,
  variedade         text,              -- CTC4, RB92579, etc.
  numero_corte      integer,           -- 1, 2, 3...
  data_plantio      date,
  data_colheita_prev date,
  sistema_colheita  text check (
    sistema_colheita in ('mecanizada','manual','semimecanizada') or sistema_colheita is null
  ),
  status_colheita   text check (
    status_colheita in ('a_colher','colhendo','colhido','reforma','outro') or status_colheita is null
  ),
  tch_estimado      numeric(8,2),
  toneladas_estimadas numeric(10,2),
  ambiente          text,              -- C, Cn, etc.
  espacamento       text,              -- "1,5 Mts"
  dist_terra_km     numeric(8,1),
  dist_asfalto_km   numeric(8,1),
  unidade_industrial text,
  created_at        timestamptz not null default now()
);

-- ─── DEFENSIVOS ──────────────────────────────
create table public.defensivos (
  id                  uuid primary key default uuid_generate_v4(),
  nome_comercial      text not null,
  principio_ativo     text not null,
  classe              text not null check (classe in (
    'herbicida','fungicida','inseticida','acaricida',
    'adjuvante','espalhante_adesivo',
    'fertilizante','fertilizante_foliar','adubo_foliar',
    'nematicida','inoculante',
    'maturador','regulador_crescimento','ativador_crescimento',
    'fungicida_herbicida','outro'
  )),
  unidade             text not null check (unidade in ('L','kg')),
  estoque_minimo      numeric(10,3) not null default 0,
  empresa             text,            -- fabricante
  local_armazenamento text check (
    local_armazenamento in ('quartinho','container','quartinho_container','outro')
    or local_armazenamento is null
  ),
  fornecedor_padrao   text,
  observacoes         text,
  created_at          timestamptz not null default now()
);

-- ─── LOTES ───────────────────────────────────
create table public.lotes (
  id                  uuid primary key default uuid_generate_v4(),
  defensivo_id        uuid not null references public.defensivos(id),
  numero_nf           text,
  fornecedor          text,
  data_compra         date,
  quantidade_comprada numeric(10,3) not null,
  quantidade_atual    numeric(10,3) not null,
  preco_unitario      numeric(12,4),
  valor_total         numeric(12,2),
  data_fabricacao     date,
  data_vencimento     date,
  lote_fabricante     text,
  observacoes         text,
  created_at          timestamptz not null default now(),
  created_by          uuid references public.profiles(id),
  constraint lote_qtd_positiva check (quantidade_atual >= 0)
);

-- ─── APLICAÇÕES ──────────────────────────────
create table public.aplicacoes (
  id                   uuid primary key default uuid_generate_v4(),
  data                 date not null default current_date,
  fazenda_id           uuid not null references public.fazendas(id),
  talhao_id            uuid not null references public.talhoes(id),
  area_aplicada_ha     numeric(10,2),
  praga_alvo           text,
  condicoes_climaticas text,
  responsavel_id       uuid references public.profiles(id),
  status               text not null check (
    status in ('em_andamento','encerrada')
  ) default 'em_andamento',
  observacoes          text,
  created_at           timestamptz not null default now()
);

-- ─── APLICAÇÃO ITENS ─────────────────────────
create table public.aplicacao_itens (
  id                uuid primary key default uuid_generate_v4(),
  aplicacao_id      uuid not null references public.aplicacoes(id) on delete cascade,
  defensivo_id      uuid not null references public.defensivos(id),
  lote_id           uuid not null references public.lotes(id),
  dose_por_hectare  numeric(10,4),
  quantidade_usada  numeric(10,3) not null,
  quantidade_sobrou numeric(10,3) not null default 0,
  calda_total_l     numeric(10,2)
);

-- ─── MOVIMENTAÇÕES ───────────────────────────
create table public.movimentacoes (
  id           uuid primary key default uuid_generate_v4(),
  defensivo_id uuid not null references public.defensivos(id),
  lote_id      uuid references public.lotes(id),
  tipo         text not null check (tipo in (
    'entrada','saida_aplicacao','devolucao_sobra','ajuste','descarte'
  )),
  quantidade   numeric(10,3) not null,
  data_hora    timestamptz not null default now(),
  aplicacao_id uuid references public.aplicacoes(id),
  usuario_id   uuid references public.profiles(id),
  observacoes  text
);

-- ─── ÍNDICES ─────────────────────────────────
create index idx_talhoes_fazenda       on public.talhoes(fazenda_id);
create index idx_talhoes_status        on public.talhoes(status_colheita);
create index idx_lotes_defensivo       on public.lotes(defensivo_id);
create index idx_lotes_vencimento      on public.lotes(data_vencimento);
create index idx_aplicacoes_fazenda    on public.aplicacoes(fazenda_id);
create index idx_aplicacoes_status     on public.aplicacoes(status);
create index idx_aplicacoes_responsavel on public.aplicacoes(responsavel_id);
create index idx_movim_defensivo       on public.movimentacoes(defensivo_id);
create index idx_movim_lote            on public.movimentacoes(lote_id);
create index idx_movim_aplicacao       on public.movimentacoes(aplicacao_id);
create index idx_defensivos_classe     on public.defensivos(classe);
