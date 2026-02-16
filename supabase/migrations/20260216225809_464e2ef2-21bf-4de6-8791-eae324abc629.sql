
-- Create orcamento_pavimentos table
CREATE TABLE public.orcamento_pavimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ordem int NOT NULL DEFAULT 1,
  multiplicador int NOT NULL DEFAULT 1,
  pdf_arquivo_id uuid NULL REFERENCES public.arquivos(id),
  imagens_group_id uuid NULL,
  last_extracao_id uuid NULL,
  status text NOT NULL DEFAULT 'PENDENTE',
  medidas_json jsonb NULL,
  overrides_json jsonb NULL,
  includes_fundacao boolean NOT NULL DEFAULT true,
  includes_laje boolean NOT NULL DEFAULT true,
  includes_reboco boolean NOT NULL DEFAULT true,
  includes_revestimento boolean NOT NULL DEFAULT true,
  includes_portas boolean NOT NULL DEFAULT true,
  includes_portoes boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add pavimento_id to ia_extracoes (nullable for backwards compat)
ALTER TABLE public.ia_extracoes ADD COLUMN pavimento_id uuid NULL REFERENCES public.orcamento_pavimentos(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.orcamento_pavimentos ENABLE ROW LEVEL SECURITY;

-- RLS: vendedor can CRUD own
CREATE POLICY "pavimentos_select_owner" ON public.orcamento_pavimentos
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamento_pavimentos.orcamento_id AND o.user_id = auth.uid())
);

CREATE POLICY "pavimentos_insert_owner" ON public.orcamento_pavimentos
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamento_pavimentos.orcamento_id AND o.user_id = auth.uid())
);

CREATE POLICY "pavimentos_update_owner" ON public.orcamento_pavimentos
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamento_pavimentos.orcamento_id AND o.user_id = auth.uid())
);

CREATE POLICY "pavimentos_delete_owner" ON public.orcamento_pavimentos
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.id = orcamento_pavimentos.orcamento_id AND o.user_id = auth.uid())
);

-- RLS: admin can do everything
CREATE POLICY "pavimentos_admin_all" ON public.orcamento_pavimentos
FOR ALL USING (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_orcamento_pavimentos_updated_at
  BEFORE UPDATE ON public.orcamento_pavimentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_pavimentos_orcamento_id ON public.orcamento_pavimentos(orcamento_id);
