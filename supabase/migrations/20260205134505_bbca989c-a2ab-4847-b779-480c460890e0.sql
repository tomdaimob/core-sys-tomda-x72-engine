-- Add Mão de Obra - Viga Baldrame to price_catalog if it doesn't exist
INSERT INTO public.price_catalog (nome, categoria, unidade, preco, ativo)
SELECT 'Mão de Obra - Viga Baldrame', 'Mão de Obra', 'm³', 850.00, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.price_catalog WHERE nome = 'Mão de Obra - Viga Baldrame'
);

-- Create baldrame_configuracoes table for admin-editable coefficients
CREATE TABLE IF NOT EXISTS public.baldrame_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil_nome text NOT NULL UNIQUE,
  largura_cm numeric NOT NULL DEFAULT 20,
  altura_cm numeric NOT NULL DEFAULT 30,
  coef_aco_kg_por_m numeric NOT NULL DEFAULT 12,
  coef_aco_min numeric NOT NULL DEFAULT 8,
  coef_aco_max numeric NOT NULL DEFAULT 16,
  perda_concreto_percent numeric NOT NULL DEFAULT 5,
  perda_aco_percent numeric NOT NULL DEFAULT 3,
  ativo boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.baldrame_configuracoes ENABLE ROW LEVEL SECURITY;

-- Everyone can read configurations
CREATE POLICY "Anyone can view baldrame_configuracoes"
ON public.baldrame_configuracoes
FOR SELECT
USING (true);

-- Only admins can modify configurations
CREATE POLICY "Only admins can modify baldrame_configuracoes"
ON public.baldrame_configuracoes
FOR ALL
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- Insert default profiles
INSERT INTO public.baldrame_configuracoes (perfil_nome, largura_cm, altura_cm, coef_aco_kg_por_m, coef_aco_min, coef_aco_max)
VALUES 
  ('15 x 30 cm', 15, 30, 8, 6, 10),
  ('20 x 30 cm', 20, 30, 12, 8, 14),
  ('20 x 40 cm', 20, 40, 16, 12, 18)
ON CONFLICT (perfil_nome) DO NOTHING;