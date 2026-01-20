-- Add ICFLEX item to price_catalog if not exists
INSERT INTO public.price_catalog (id, categoria, nome, preco, unidade, ativo)
VALUES 
  (gen_random_uuid(), 'Reboco', 'ICFLEX Reboco', 45.00, 'm²', true)
ON CONFLICT DO NOTHING;