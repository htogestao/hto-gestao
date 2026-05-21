-- Adiciona campos de canavial na tabela talhoes
ALTER TABLE public.talhoes
  ADD COLUMN IF NOT EXISTS num_cortes    integer,
  ADD COLUMN IF NOT EXISTS status_area   text CHECK (status_area IN ('colhida','reforma','planta','soca'));
