
-- Create sapata_configuracoes table (admin-managed coefficients)
CREATE TABLE public.sapata_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_nome text NOT NULL,
  coef_aco_kg_por_m3 numeric NOT NULL DEFAULT 90,
  coef_aco_min numeric NOT NULL DEFAULT 60,
  coef_aco_max numeric NOT NULL DEFAULT 140,
  perda_concreto_percent numeric NOT NULL DEFAULT 5,
  perda_aco_percent numeric NOT NULL DEFAULT 3,
  ativo boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid NULL
);

-- Enable RLS
ALTER TABLE public.sapata_configuracoes ENABLE ROW LEVEL SECURITY;

-- RLS: anyone can read, only admin can modify
CREATE POLICY "Anyone can view sapata_configuracoes"
  ON public.sapata_configuracoes FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify sapata_configuracoes"
  ON public.sapata_configuracoes FOR ALL
  USING (is_admin(auth.uid()));

-- Insert default profile
INSERT INTO public.sapata_configuracoes (perfil_nome, coef_aco_kg_por_m3, coef_aco_min, coef_aco_max, perda_concreto_percent, perda_aco_percent)
VALUES ('Padrão', 90, 60, 140, 5, 3);

-- Insert "Mão de Obra - Sapata" into price_catalog if not exists
INSERT INTO public.price_catalog (categoria, nome, preco, unidade, ativo)
SELECT 'Mão de Obra', 'Mão de Obra - Sapata', 900.00, 'm³', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.price_catalog WHERE nome = 'Mão de Obra - Sapata'
);
