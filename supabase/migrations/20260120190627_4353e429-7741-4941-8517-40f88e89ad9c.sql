-- Add client data columns to orcamentos table
ALTER TABLE public.orcamentos
ADD COLUMN IF NOT EXISTS cliente_tipo text DEFAULT 'PF' CHECK (cliente_tipo IN ('PF', 'PJ')),
ADD COLUMN IF NOT EXISTS cliente_documento text,
ADD COLUMN IF NOT EXISTS cliente_responsavel text;