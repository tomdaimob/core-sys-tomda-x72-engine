-- Add Revestimento items to price_catalog
INSERT INTO public.price_catalog (nome, categoria, preco, unidade, ativo)
VALUES 
  ('Revestimento Cerâmica', 'Revestimentos', 65.00, 'm²', true),
  ('Revestimento Porcelanato', 'Revestimentos', 120.00, 'm²', true),
  ('Argamassa ACIII', 'Revestimentos', 8.50, 'm²', true),
  ('Rejunte', 'Revestimentos', 4.50, 'm²', true),
  ('Mão de Obra Revestimento', 'Revestimentos', 55.00, 'm²', true)
ON CONFLICT DO NOTHING;

-- Add revestimento column to orcamento_resultados if not exists
ALTER TABLE public.orcamento_resultados 
ADD COLUMN IF NOT EXISTS revestimento jsonb DEFAULT '{}'::jsonb;