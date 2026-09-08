-- =============================================================
-- Estoque inicial AGRO MÁXIMO — 11 defensivos + lotes
-- =============================================================
-- Dados passados pelo produtor (2026-09-08). Sem preço/NF — lote
-- "Estoque inicial", mesmo padrão usado na planilha física da
-- Agrícola MV (08/06/2026). Ingredientes ativos/empresas cruzados
-- com catalogo_agrotoxicos_pr onde possível (KENNOX/PRECISO XK/
-- BELLUM 480 tinham linha ruidosa no catálogo — usado o ativo
-- informado pelo produtor nesses casos).
-- =============================================================

with novos_defensivos as (
  insert into public.defensivos
    (nome_comercial, principio_ativo, classe, unidade, empresa, classe_toxicologica, organizacao_id)
  values
    ('SELECT 240 EC',   'CLETODIM',                              'herbicida', 'L', 'UPL',        'I',      '12ac4bfc-5d14-47be-bb23-dfd00d525fc3'),
    ('PRECISO XK',      'GLIFOSATO',                             'herbicida', 'L', null,         null,     '12ac4bfc-5d14-47be-bb23-dfd00d525fc3'),
    ('YAMATO SC',       'PIROXASULFONA',                         'herbicida', 'L', 'IHARABRAS',  'Cat.5',  '12ac4bfc-5d14-47be-bb23-dfd00d525fc3'),
    ('OFF ROAD',        'GLUFOSINATO',                           'herbicida', 'L', 'OURO FINO',  'Cat.4',  '12ac4bfc-5d14-47be-bb23-dfd00d525fc3'),
    ('KENNOX',          'CLETODIM + HALOXIFOPE-P-METÍLICO',      'herbicida', 'L', 'UPL',        'Cat.5',  '12ac4bfc-5d14-47be-bb23-dfd00d525fc3'),
    ('KRAKEN',          'CLETODIM',                              'herbicida', 'L', 'CROPCHEM',   'Cat.5',  '12ac4bfc-5d14-47be-bb23-dfd00d525fc3'),
    ('BELLUM 480',      'MESOTRIONA',                            'herbicida', 'L', null,         null,     '12ac4bfc-5d14-47be-bb23-dfd00d525fc3'),
    ('IMAZETAPIR',      'IMAZETAPIR',                            'herbicida', 'L', null,         null,     '12ac4bfc-5d14-47be-bb23-dfd00d525fc3'),
    ('IHAROL GOLD',     'Óleo mineral',                          'adjuvante', 'L', null,         null,     '12ac4bfc-5d14-47be-bb23-dfd00d525fc3'),
    ('HELPER DESSEK',   'Adjuvante',                             'adjuvante', 'L', null,         null,     '12ac4bfc-5d14-47be-bb23-dfd00d525fc3'),
    ('TROVATI 360 CS',  'CLOMAZONA',                             'herbicida', 'L', 'FMC',        'Cat.5',  '12ac4bfc-5d14-47be-bb23-dfd00d525fc3')
  returning id, nome_comercial
),
quantidades (nome_comercial, qtd) as (
  values
    ('SELECT 240 EC',   190),
    ('PRECISO XK',      330),
    ('YAMATO SC',        10),
    ('OFF ROAD',         50),
    ('KENNOX',           40),
    ('KRAKEN',           10),
    ('BELLUM 480',        5),
    ('IMAZETAPIR',       30),
    ('IHAROL GOLD',      90),
    ('HELPER DESSEK',    15),
    ('TROVATI 360 CS',   90)
)
insert into public.lotes
  (defensivo_id, fornecedor, data_compra, quantidade_comprada, quantidade_atual, observacoes, organizacao_id, created_by)
select
  nd.id, 'Estoque inicial', current_date, q.qtd::numeric, q.qtd::numeric,
  'Estoque inicial informado pelo produtor (sem NF/preço)',
  '12ac4bfc-5d14-47be-bb23-dfd00d525fc3',
  'e203adf0-f9ed-40f7-9079-7784db5cf590'
from novos_defensivos nd
join quantidades q using (nome_comercial);
