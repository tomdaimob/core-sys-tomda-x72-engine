-- Create profiles table for user info and roles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  company TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orcamentos (budgets) table
CREATE TABLE public.orcamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  cliente TEXT NOT NULL,
  projeto TEXT,
  status TEXT DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'em_andamento', 'concluido', 'arquivado')),
  area_total_m2 NUMERIC(12,2),
  valor_total NUMERIC(12,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create orcamento_inputs (budget inputs JSON)
CREATE TABLE public.orcamento_inputs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  etapa TEXT NOT NULL CHECK (etapa IN ('precos', 'paredes', 'radier', 'laje', 'reboco', 'acabamentos', 'margens')),
  dados JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(orcamento_id, etapa)
);

-- Create orcamento_resultados (budget results)
CREATE TABLE public.orcamento_resultados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id UUID NOT NULL UNIQUE REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  paredes JSONB DEFAULT '{}',
  radier JSONB DEFAULT '{}',
  laje JSONB DEFAULT '{}',
  reboco JSONB DEFAULT '{}',
  acabamentos JSONB DEFAULT '{}',
  consolidado JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create arquivos (files) table for PDF uploads
CREATE TABLE public.arquivos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  tamanho_bytes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ia_extracoes (AI extractions from PDFs)
CREATE TABLE public.ia_extracoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  arquivo_id UUID NOT NULL REFERENCES public.arquivos(id) ON DELETE CASCADE,
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  area_total_m2 NUMERIC(12,2),
  pe_direito_m NUMERIC(6,2),
  perimetro_externo_m NUMERIC(12,2),
  paredes_internas_m NUMERIC(12,2),
  aberturas_m2 NUMERIC(12,2),
  confianca NUMERIC(5,2),
  observacoes TEXT,
  dados_brutos JSONB,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'processando', 'concluido', 'erro')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_resultados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arquivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ia_extracoes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Orcamentos policies (users see their own, admins see all)
CREATE POLICY "Users can view their own orcamentos"
  ON public.orcamentos FOR SELECT
  USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Users can create their own orcamentos"
  ON public.orcamentos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orcamentos"
  ON public.orcamentos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own orcamentos"
  ON public.orcamentos FOR DELETE
  USING (auth.uid() = user_id);

-- Orcamento_inputs policies
CREATE POLICY "Users can view inputs of their orcamentos"
  ON public.orcamento_inputs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orcamentos 
      WHERE id = orcamento_id AND (user_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true))
    )
  );

CREATE POLICY "Users can manage inputs of their orcamentos"
  ON public.orcamento_inputs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.orcamentos WHERE id = orcamento_id AND user_id = auth.uid())
  );

-- Orcamento_resultados policies
CREATE POLICY "Users can view results of their orcamentos"
  ON public.orcamento_resultados FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orcamentos 
      WHERE id = orcamento_id AND (user_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true))
    )
  );

CREATE POLICY "Users can manage results of their orcamentos"
  ON public.orcamento_resultados FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.orcamentos WHERE id = orcamento_id AND user_id = auth.uid())
  );

-- Arquivos policies
CREATE POLICY "Users can view files of their orcamentos"
  ON public.arquivos FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.orcamentos WHERE id = orcamento_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can manage files of their orcamentos"
  ON public.arquivos FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.orcamentos WHERE id = orcamento_id AND user_id = auth.uid())
  );

-- IA extracoes policies
CREATE POLICY "Users can view extractions of their orcamentos"
  ON public.ia_extracoes FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.orcamentos WHERE id = orcamento_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can manage extractions of their orcamentos"
  ON public.ia_extracoes FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.orcamentos WHERE id = orcamento_id AND user_id = auth.uid())
  );

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orcamentos_updated_at
  BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orcamento_inputs_updated_at
  BEFORE UPDATE ON public.orcamento_inputs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orcamento_resultados_updated_at
  BEFORE UPDATE ON public.orcamento_resultados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('plantas', 'plantas', false);

-- Storage policies
CREATE POLICY "Users can upload to plantas bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'plantas' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own plants"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'plantas' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own plants"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'plantas' AND auth.uid()::text = (storage.foldername(name))[1]);