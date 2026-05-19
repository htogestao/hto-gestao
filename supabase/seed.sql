-- =============================================
-- Seed — Dados reais do cliente
-- Usuários de exemplo: admin / viewer / field
-- Fazendas: importadas do Inventario MV
-- Defensivos: estoque físico real
-- =============================================

-- ─── USUÁRIOS (criar via Supabase Auth + inserir profiles manualmente) ───
-- Execute no Dashboard Supabase > Authentication > Users: criar os 3 emails
-- Depois atualize as roles abaixo com os UUIDs gerados.
-- Exemplo para seed local (Supabase CLI):

-- Analista admin
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'analista@agro.com',
  crypt('Agro@2025!', gen_salt('bf')),
  now(),
  '{"nome":"Ana Analista","role":"admin"}'
) on conflict (id) do nothing;

-- Patrão viewer
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values (
  'aaaaaaaa-0000-0000-0000-000000000002',
  'patrao@agro.com',
  crypt('Agro@2025!', gen_salt('bf')),
  now(),
  '{"nome":"João Patrão","role":"viewer"}'
) on conflict (id) do nothing;

-- Operador de campo
insert into auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
values (
  'aaaaaaaa-0000-0000-0000-000000000003',
  'campo@agro.com',
  crypt('Agro@2025!', gen_salt('bf')),
  now(),
  '{"nome":"Carlos Campo","role":"field"}'
) on conflict (id) do nothing;

update public.profiles set role = 'admin'  where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.profiles set role = 'viewer' where id = 'aaaaaaaa-0000-0000-0000-000000000002';
update public.profiles set role = 'field'  where id = 'aaaaaaaa-0000-0000-0000-000000000003';

-- ─── FAZENDAS (do Inventario MV — PSL polo) ──────────────────────────────
insert into public.fazendas (id, nome, polo, unidade_industrial, fornecedor_principal, created_by) values
  ('f1000000-0000-0000-0000-000000000001', 'FAZENDA RECANTO PRIMAVERA',  'PSL', 'USL', 'MARCIO VERRUNES', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('f1000000-0000-0000-0000-000000000002', 'FAZENDA QUINHAO D9',          'PSL', 'USL', null,              'aaaaaaaa-0000-0000-0000-000000000001'),
  ('f1000000-0000-0000-0000-000000000003', 'FAZENDA GUANABARA',           'PSL', 'USL', null,              'aaaaaaaa-0000-0000-0000-000000000001'),
  ('f1000000-0000-0000-0000-000000000004', 'FAZENDA MIRONGA',             'PSL', 'USL', null,              'aaaaaaaa-0000-0000-0000-000000000001'),
  ('f1000000-0000-0000-0000-000000000005', 'FAZENDA MODERNA',             'PSL', 'USL', null,              'aaaaaaaa-0000-0000-0000-000000000001'),
  ('f1000000-0000-0000-0000-000000000006', 'FAZENDA NOVA DALLAS',         'PSL', 'USL', null,              'aaaaaaaa-0000-0000-0000-000000000001'),
  ('f1000000-0000-0000-0000-000000000007', 'FAZENDA BARACOA',             'PSL', 'USL', null,              'aaaaaaaa-0000-0000-0000-000000000001'),
  ('f1000000-0000-0000-0000-000000000008', 'FAZENDA CABECEIRA LIMPA',     'PSL', 'USL', null,              'aaaaaaaa-0000-0000-0000-000000000001'),
  ('f1000000-0000-0000-0000-000000000009', 'FAZENDA DUAS IRMAS',          'PSL', 'USL', null,              'aaaaaaaa-0000-0000-0000-000000000001'),
  ('f1000000-0000-0000-0000-000000000010', 'FAZENDA KAMANGA',             'PSL', 'USL', null,              'aaaaaaaa-0000-0000-0000-000000000001'),
  ('f1000000-0000-0000-0000-000000000011', 'FAZENDA POP',                 'PSL', 'USL', null,              'aaaaaaaa-0000-0000-0000-000000000001'),
  ('f1000000-0000-0000-0000-000000000012', 'FAZENDA REMANSO',             'PSL', 'USL', null,              'aaaaaaaa-0000-0000-0000-000000000001'),
  ('f1000000-0000-0000-0000-000000000013', 'FAZENDA SANTA HELENA',        'PSL', 'USL', null,              'aaaaaaaa-0000-0000-0000-000000000001'),
  ('f1000000-0000-0000-0000-000000000014', 'FAZENDA SANTA LUZIA',         'PSL', 'USL', null,              'aaaaaaaa-0000-0000-0000-000000000001'),
  ('f1000000-0000-0000-0000-000000000015', 'FAZENDA SANTANNA',            'PSL', 'USL', null,              'aaaaaaaa-0000-0000-0000-000000000001'),
  ('f1000000-0000-0000-0000-000000000016', 'ESTANCIA PRIMAVERA',          'PSL', 'USL', null,              'aaaaaaaa-0000-0000-0000-000000000001'),
  ('f1000000-0000-0000-0000-000000000017', 'FAZ RIO GRANDE/MODERNA',      'PSL', 'USL', null,              'aaaaaaaa-0000-0000-0000-000000000001'),
  ('f1000000-0000-0000-0000-000000000018', 'MEU REINO ENCANTADO',         'PSL', 'USL', null,              'aaaaaaaa-0000-0000-0000-000000000001'),
  ('f1000000-0000-0000-0000-000000000019', 'SITIO IMAOS MACARIO',         'PSL', 'USL', null,              'aaaaaaaa-0000-0000-0000-000000000001')
on conflict (id) do nothing;

-- ─── TALHÕES (amostra — Fazenda Recanto Primavera) ────────────────────────
insert into public.talhoes (
  fazenda_id, nome, cultura_atual, area_ha, setor, numero_talhao,
  variedade, numero_corte, sistema_colheita, status_colheita
) values
  ('f1000000-0000-0000-0000-000000000001', 'Talhão 1', 'Cana', 5.06,  1, 1, 'CTC4', 3, 'mecanizada', 'a_colher'),
  ('f1000000-0000-0000-0000-000000000001', 'Talhão 2', 'Cana', 31.29, 1, 2, 'CTC4', 3, 'mecanizada', 'a_colher'),
  ('f1000000-0000-0000-0000-000000000003', 'Talhão 1', 'Cana', 35.98, 1, 1, 'CTC4', 2, 'mecanizada', 'a_colher'),
  ('f1000000-0000-0000-0000-000000000003', 'Talhão 2', 'Cana', 21.25, 1, 2, 'CTC4', 2, 'mecanizada', 'a_colher'),
  ('f1000000-0000-0000-0000-000000000003', 'Talhão 3', 'Cana', 34.89, 1, 3, 'CTC4', 2, 'mecanizada', 'a_colher'),
  ('f1000000-0000-0000-0000-000000000003', 'Talhão 4', 'Cana', 32.21, 1, 4, 'CTC4', 2, 'mecanizada', 'a_colher')
on conflict do nothing;

-- ─── DEFENSIVOS (estoque físico real — PDF de estoque) ───────────────────
insert into public.defensivos (id, nome_comercial, principio_ativo, classe, unidade, empresa, local_armazenamento, estoque_minimo) values
  ('d0000000-0000-0000-0000-000000000001','AGRUS START',       'ADJUVANTE MULTIFUNCIONAL',                    'adjuvante',            'L',  'AGRO-START',     'quartinho',          0),
  ('d0000000-0000-0000-0000-000000000002','AKTUS',             'CIPROCONAZOL, DIFENOCONAZOL E BENZOVINDIFLUPIR','fungicida_herbicida', 'L',  'MAX CROP',       'container',          20),
  ('d0000000-0000-0000-0000-000000000003','ALADE',             'CIPROCONAZOL, DIFENOCONAZOL E BENZOVINDIFLUPIR','fungicida',          'L',  'SYNGENTA',       'container',          10),
  ('d0000000-0000-0000-0000-000000000004','ALGE TECHS',        'POTASSIO E ENXOFRE',                          'fertilizante',         'L',  'ALGE AGRO',      'container',          0),
  ('d0000000-0000-0000-0000-000000000005','ALION',             'INDAZIFLAM',                                  'herbicida',            'L',  'BAYER',          'quartinho',          2),
  ('d0000000-0000-0000-0000-000000000006','ALTACOR',           'CLORANTRANILIPROLE',                          'inseticida',           'kg', 'FMC',            'quartinho',          2),
  ('d0000000-0000-0000-0000-000000000007','AMETRINA ALTA 500', 'AMETRINA',                                    'herbicida',            'kg', 'RAINBOW',        null,                 5),
  ('d0000000-0000-0000-0000-000000000008','APROACH POWER',     'PICOXISTROBINA, CIPROCONAZOLE',               'fungicida',            'L',  'DUPONT',         'quartinho',          50),
  ('d0000000-0000-0000-0000-000000000009','ARREIO',            'FLUROXIPIR-MEPTILICO, PICLORAM',              'herbicida',            'L',  'ADAMA BRASIL',   'quartinho',          10),
  ('d0000000-0000-0000-0000-000000000010','BIOZYME TF',        'SULFATO FERROSO, SOLUCAO DE NITRATO DE ZINCO','fertilizante_foliar',  'L',  'UPL',            'quartinho_container', 0),
  ('d0000000-0000-0000-0000-000000000011','BORO MEGA',         'ADUBO FOLIAR',                                'adubo_foliar',         'L',  'INDIGO BRASIL',  'container',          20),
  ('d0000000-0000-0000-0000-000000000012','BROKER 750 WG',     'HEXAZINONA',                                  'herbicida',            'kg', 'ALBAUGH',        'container',          5),
  ('d0000000-0000-0000-0000-000000000013','BUTIRON',           'TEBUTIUTOM',                                  'herbicida',            'L',  'ADAMA BRASIL',   'quartinho_container', 10),
  ('d0000000-0000-0000-0000-000000000014','CERTANO',           'BACILLUS VELEZENSIS',                         'fungicida',            'L',  'SYNGENTA',       'container',          10),
  ('d0000000-0000-0000-0000-000000000015','CLASSIC',           'CLORIMUROM-ETILICO',                          'herbicida',            'L',  'DUPONT',         'container',          2),
  ('d0000000-0000-0000-0000-000000000016','COACT',             'DICLOSULAM',                                  'herbicida',            'kg', 'CORTEVA',        'quartinho_container', 10),
  ('d0000000-0000-0000-0000-000000000017','COMPASS',           'AMETRINA',                                    'herbicida',            'L',  'ALBAUGH',        'quartinho',          50),
  ('d0000000-0000-0000-0000-000000000018','CONECT TOP OIL',    'OLEO EMULSIONAVEL + ESPALHANTE ADESIVO',      'espalhante_adesivo',   'L',  'CONECT CROP',    'quartinho',          30),
  ('d0000000-0000-0000-0000-000000000019','CURBIX 20 SC',      'ETIPROLE',                                    'inseticida',           'L',  'BAYER',          'quartinho',          2),
  ('d0000000-0000-0000-0000-000000000020','GALOPEIRO',         '2,4-D',                                       'herbicida',            'L',  'ALBAUGH',        'container',          20),
  ('d0000000-0000-0000-0000-000000000021','GRANARY',           'IMIDACLOPRIDO',                               'inseticida',           'L',  'ALBAUGH',        'quartinho',          5),
  ('d0000000-0000-0000-0000-000000000022','HEXARON WG',        'COMBINACAO DE HEXAZINONA E DIUROM',           'herbicida',            'kg', 'ADAMA BRASIL',   'quartinho',          10),
  ('d0000000-0000-0000-0000-000000000023','LOYER',             'GLUFOSINATO DE AMONIA',                       'herbicida',            'L',  'TECNOMYL',       'container',          20),
  ('d0000000-0000-0000-0000-000000000024','MATCH EC',          'LUFENURON',                                   'inseticida',           'L',  'SYNGENTA',       'container',          5),
  ('d0000000-0000-0000-0000-000000000025','METRIBUZIM',        'METRIBUZIM',                                  'herbicida',            'L',  'AGRO IMPOT',     'quartinho',          50),
  ('d0000000-0000-0000-0000-000000000026','MIRATO',            '2,4-D',                                       'herbicida',            'L',  'SYNGENTA',       'container',          30),
  ('d0000000-0000-0000-0000-000000000027','NONGRASS',          'TEBUTIUTOM',                                  'herbicida',            'L',  'ALBAUGH',        'quartinho',          20),
  ('d0000000-0000-0000-0000-000000000028','REPHON 800 WG',     'FIPRONIL',                                    'inseticida',           'kg', 'ALBAUGH',        'container',          10),
  ('d0000000-0000-0000-0000-000000000029','RITMO',             'PIROXASULFONA E AMICARBAZONA',                'herbicida',            'L',  'IHARA',          'container',          30),
  ('d0000000-0000-0000-0000-000000000030','TOPIK 240 EC',      'CLODINAFOPE - PROPARGIL',                     'herbicida',            'L',  'ADAMA BRASIL',   'container',          5),
  ('d0000000-0000-0000-0000-000000000031','VALLEX',            'PIRIPROXIFEM',                                'inseticida',           'L',  'TECNOMYL',       'container',          10),
  ('d0000000-0000-0000-0000-000000000032','ZAPP',              'GLIFOSATO',                                   'herbicida',            'L',  'SYNGENTA',       'quartinho_container', 50),
  ('d0000000-0000-0000-0000-000000000033','ZARTAN',            'METSULFUROM-METILICO',                        'herbicida',            'kg', 'UPL',            'container',          2),
  ('d0000000-0000-0000-0000-000000000034','UNIZEB GLORY',      'AZOXISTROBINA E MANCOZEBE',                   'fungicida',            'kg', 'UPL',            'quartinho',          2),
  ('d0000000-0000-0000-0000-000000000035','PODERUS',           'AZOXISTROBINA E CIPROCONAZOL',                'fungicida',            'L',  'OURO FINO',      'container',          10),
  ('d0000000-0000-0000-0000-000000000036','OSBAR',             'FLUMIOXAZINA - IMAZETAPIR',                   'herbicida',            'kg', 'CROPCHEM',       'quartinho',          20),
  ('d0000000-0000-0000-0000-000000000037','OSBAR DUO',         'FLUMIOXAZINA E IMAZETAPIR SC',                'herbicida',            'L',  'CROPCHEM',       'quartinho_container', 5),
  ('d0000000-0000-0000-0000-000000000038','QUARTZO',           'BACTERIAS BACILLUS SUBTILIS',                 'nematicida',           'kg', 'FMC',            'container',          2),
  ('d0000000-0000-0000-0000-000000000039','HEAT',              'SAFLUFENACIL',                                'herbicida',            'kg', 'BASF',           'container',          1),
  ('d0000000-0000-0000-0000-000000000040','SPHERE MAX',        'CIPROCONAZOL',                                'fungicida',            'L',  'BAYER',          'quartinho',          1)
on conflict (id) do nothing;

-- ─── LOTES (estoque inicial — sem NF, entrada de inventário) ─────────────
-- Estoque real do PDF, criado como lote único por produto sem NF
insert into public.lotes (defensivo_id, numero_nf, quantidade_comprada, quantidade_atual, observacoes, created_by) values
  ('d0000000-0000-0000-0000-000000000001', null, 90.6,  90.6,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000002', null, 75.0,  75.0,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000003', null, 22.0,  22.0,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000005', null, 3.9,   3.9,   'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000006', null, 7.6,   7.6,   'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000007', null, 20.0,  20.0,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  -- APROACH POWER — estoque alto: 1340 L
  ('d0000000-0000-0000-0000-000000000008', null, 1340.0,1340.0,'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000009', null, 28.0,  28.0,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000010', null, 67.0,  67.0,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000011', null, 240.0, 240.0, 'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000012', null, 20.0,  20.0,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000013', null, 29.2,  29.2,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000014', null, 70.0,  70.0,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000015', null, 8.5,   8.5,   'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000016', null, 65.8,  65.8,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000017', null, 332.0, 332.0, 'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000018', null, 380.0, 380.0, 'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000019', null, 8.0,   8.0,   'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000020', null, 200.0, 200.0, 'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000021', null, 22.0,  22.0,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000022', null, 65.0,  65.0,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000023', null, 108.0, 108.0, 'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000024', null, 35.0,  35.0,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000025', null, 424.0, 424.0, 'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000026', null, 194.0, 194.0, 'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000027', null, 190.0, 190.0, 'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000028', null, 75.0,  75.0,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000029', null, 159.0, 159.0, 'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  -- TOPIK 240 EC: 47 total, 12 vencidos → lote ok=35, lote vencido=12
  ('d0000000-0000-0000-0000-000000000030', null, 35.0,  35.0,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000030', null, 12.0,  12.0,  'VENCIDO desde 2023',         'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000031', null, 75.0,  75.0,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000032', null, 180.0, 180.0, 'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000033', null, 10.0,  10.0,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000034', null, 10.0,  10.0,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000035', null, 46.0,  46.0,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000036', null, 160.0, 160.0, 'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000037', null, 12.3,  12.3,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000038', null, 19.5,  19.5,  'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000039', null, 2.8,   2.8,   'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001'),
  ('d0000000-0000-0000-0000-000000000040', null, 1.5,   1.5,   'Estoque inicial importado',  'aaaaaaaa-0000-0000-0000-000000000001')
on conflict do nothing;

-- Marcar lote vencido do TOPIK com data passada
update public.lotes
set data_vencimento = '2023-12-31'
where defensivo_id = 'd0000000-0000-0000-0000-000000000030'
  and observacoes = 'VENCIDO desde 2023';

-- Movimentações de entrada para cada lote (rastreabilidade)
insert into public.movimentacoes (defensivo_id, lote_id, tipo, quantidade, usuario_id, observacoes)
select
  l.defensivo_id,
  l.id,
  'entrada',
  l.quantidade_comprada,
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Carga inicial de estoque — importado da planilha física'
from public.lotes l;
