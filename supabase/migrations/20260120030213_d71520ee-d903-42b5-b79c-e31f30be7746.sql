-- Drop old constraint and add new one that includes 'rascunho'
ALTER TABLE public.orcamento_inputs 
DROP CONSTRAINT IF EXISTS orcamento_inputs_etapa_check;

ALTER TABLE public.orcamento_inputs 
ADD CONSTRAINT orcamento_inputs_etapa_check 
CHECK (etapa = ANY (ARRAY['precos'::text, 'paredes'::text, 'radier'::text, 'laje'::text, 'reboco'::text, 'acabamentos'::text, 'margens'::text, 'rascunho'::text]));