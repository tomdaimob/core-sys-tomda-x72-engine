INSERT INTO public.price_catalog (categoria, nome, unidade, preco, ativo)
VALUES 
  ('esquadrias', 'Janela de Alumínio', 'm2', 800.00, true),
  ('esquadrias', 'Janela de Vidro Temperado', 'm2', 1200.00, true)
ON CONFLICT DO NOTHING;