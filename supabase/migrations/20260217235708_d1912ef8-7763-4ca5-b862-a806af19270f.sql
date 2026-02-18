
-- Add medidas_extraidas and medidas_confirmadas columns to orcamento_pavimentos
ALTER TABLE public.orcamento_pavimentos 
  ADD COLUMN IF NOT EXISTS medidas_extraidas jsonb NULL,
  ADD COLUMN IF NOT EXISTS medidas_confirmadas jsonb NULL;

-- Update status check: allow AGUARDANDO_CONFIRMACAO
-- (no check constraint exists, status is just text, so no change needed)

-- Add propagation columns to orcamento_resultados
ALTER TABLE public.orcamento_resultados
  ADD COLUMN IF NOT EXISTS paredes_total_area_m2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reboco_total_area_interno_m2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reboco_total_area_externo_m2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revestimento_total_area_m2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS laje_total_area_m2 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS laje_total_volume_m3 numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fundacao_total numeric DEFAULT 0;
