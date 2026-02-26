
-- Create indicadores_custo table for CUB-PA
CREATE TABLE public.indicadores_custo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uf text NOT NULL DEFAULT 'PA',
  cub_ref_mes_ano text,
  cub_valor_m2 numeric,
  cub_padrao text DEFAULT 'R8-N',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.indicadores_custo ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "indicadores_custo_select_all" ON public.indicadores_custo
  FOR SELECT TO authenticated USING (true);

-- Only admins can modify
CREATE POLICY "indicadores_custo_admin_modify" ON public.indicadores_custo
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
