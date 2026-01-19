-- Create price_catalog table for global pricing
CREATE TABLE public.price_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria TEXT NOT NULL,
  nome TEXT NOT NULL,
  unidade TEXT NOT NULL,
  preco NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.price_catalog ENABLE ROW LEVEL SECURITY;

-- Everyone can read prices
CREATE POLICY "Todos podem visualizar preços"
ON public.price_catalog
FOR SELECT
USING (true);

-- Only admins can modify prices
CREATE POLICY "Apenas admins podem modificar preços"
ON public.price_catalog
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Trigger to update updated_at
CREATE TRIGGER update_price_catalog_updated_at
BEFORE UPDATE ON public.price_catalog
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial price data
INSERT INTO public.price_catalog (categoria, nome, unidade, preco) VALUES
-- ICF/Formas
('ICF/Formas', 'Forma ICF 18cm', 'un', 85.00),
('ICF/Formas', 'Forma ICF 12cm', 'un', 72.00),

-- Concreto
('Concreto', 'Concreto Usinado FCK 25', 'm³', 450.00),
('Concreto', 'Concreto Usinado FCK 30', 'm³', 480.00),
('Concreto', 'Concreto Usinado FCK 35', 'm³', 520.00),

-- Aço/Fibra
('Aço/Fibra', 'Ferragem / Aço CA-50', 'kg', 8.50),
('Aço/Fibra', 'Fibra de Aço', 'kg', 12.00),
('Aço/Fibra', 'Fibra de Polipropileno', 'kg', 28.00),
('Aço/Fibra', 'Tela Soldada Q92', 'm²', 18.00),
('Aço/Fibra', 'Tela Soldada Q138', 'm²', 24.00),

-- Materiais
('Materiais', 'Argamassa Saco 50kg', 'saco', 32.00),
('Materiais', 'Cimento CP-II 50kg', 'saco', 38.00),
('Materiais', 'Areia Média', 'm³', 120.00),
('Materiais', 'Brita 1', 'm³', 140.00),
('Materiais', 'Impermeabilizante', 'kg', 25.00),

-- Acabamentos
('Acabamentos', 'Piso Cerâmico', 'm²', 45.00),
('Acabamentos', 'Porcelanato Piso', 'm²', 85.00),
('Acabamentos', 'Porcelanato Parede', 'm²', 75.00),
('Acabamentos', 'Tinta Látex Galão 18L', 'un', 180.00),
('Acabamentos', 'Massa Corrida Galão', 'un', 65.00),
('Acabamentos', 'Gesso Liso', 'm²', 35.00),

-- Mão de Obra
('Mão de Obra', 'Montagem Parede ICF', 'm²', 45.00),
('Mão de Obra', 'Execução Radier', 'm²', 35.00),
('Mão de Obra', 'Execução Laje', 'm²', 55.00),
('Mão de Obra', 'Reboco Interno/Externo', 'm²', 28.00),
('Mão de Obra', 'Assentamento Piso', 'm²', 35.00),
('Mão de Obra', 'Pintura (Aplicação)', 'm²', 18.00),
('Mão de Obra', 'Instalação Elétrica', 'ponto', 85.00),
('Mão de Obra', 'Instalação Hidráulica', 'ponto', 95.00);