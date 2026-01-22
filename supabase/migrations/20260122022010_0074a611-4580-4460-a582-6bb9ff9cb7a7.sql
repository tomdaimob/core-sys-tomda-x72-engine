-- Tabela para configurações globais (Lucro/BDI padrão)
CREATE TABLE public.configuracoes_globais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave TEXT NOT NULL UNIQUE,
  valor JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

-- Enable RLS
ALTER TABLE public.configuracoes_globais ENABLE ROW LEVEL SECURITY;

-- RLS policies - todos podem ver, só admin pode editar
CREATE POLICY "Authenticated users can view configuracoes_globais"
  ON public.configuracoes_globais
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Only admins can update configuracoes_globais"
  ON public.configuracoes_globais
  FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can insert configuracoes_globais"
  ON public.configuracoes_globais
  FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_configuracoes_globais_updated_at
  BEFORE UPDATE ON public.configuracoes_globais
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configuração padrão de margens
INSERT INTO public.configuracoes_globais (chave, valor)
VALUES ('margens_padrao', '{"lucroPercent": 15, "bdiPercent": 10}');