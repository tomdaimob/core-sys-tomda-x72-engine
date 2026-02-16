
-- 1. Add 'tipo' column to orcamento_pavimentos
ALTER TABLE public.orcamento_pavimentos
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'NORMAL';

-- 2. Fix ia_extracoes status constraint: allow 'sucesso' as valid status
ALTER TABLE public.ia_extracoes DROP CONSTRAINT IF EXISTS ia_extracoes_status_check;
ALTER TABLE public.ia_extracoes ADD CONSTRAINT ia_extracoes_status_check
  CHECK (status = ANY (ARRAY['pendente','processando','concluido','sucesso','erro']));

-- 3. Add per-floor results and building total to orcamento_resultados
ALTER TABLE public.orcamento_resultados
  ADD COLUMN IF NOT EXISTS resultados_pavimentos_json jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS total_geral_predio numeric DEFAULT 0;
