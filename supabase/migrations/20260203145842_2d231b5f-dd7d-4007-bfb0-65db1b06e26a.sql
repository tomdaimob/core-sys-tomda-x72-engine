-- Add new columns to arquivos table
ALTER TABLE public.arquivos 
ADD COLUMN IF NOT EXISTS mime_type text DEFAULT 'application/pdf',
ADD COLUMN IF NOT EXISTS uploaded_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS ativo boolean DEFAULT true;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_arquivos_orcamento_tipo_ativo 
ON public.arquivos(orcamento_id, tipo, ativo);

-- Create private storage bucket for project PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('projetos', 'projetos', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies on arquivos to recreate them properly
DROP POLICY IF EXISTS "Users can manage files of their orcamentos" ON public.arquivos;
DROP POLICY IF EXISTS "Users can view files of their orcamentos" ON public.arquivos;

-- RLS: Admin can view all arquivos
CREATE POLICY "Admin can view all arquivos"
ON public.arquivos
FOR SELECT
USING (is_admin(auth.uid()));

-- RLS: Vendedor can view own arquivos (except PROJETO_PDF type)
CREATE POLICY "Vendedor can view own arquivos except projeto_pdf"
ON public.arquivos
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orcamentos o
    WHERE o.id = arquivos.orcamento_id
    AND o.user_id = auth.uid()
  )
  AND tipo != 'PROJETO_PDF'
);

-- RLS: Users can insert arquivos for their orcamentos
CREATE POLICY "Users can insert arquivos for own orcamentos"
ON public.arquivos
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orcamentos o
    WHERE o.id = arquivos.orcamento_id
    AND o.user_id = auth.uid()
  )
  AND (uploaded_by = auth.uid() OR uploaded_by IS NULL)
);

-- RLS: Admin can update arquivos
CREATE POLICY "Admin can update arquivos"
ON public.arquivos
FOR UPDATE
USING (is_admin(auth.uid()));

-- RLS: Users can update own arquivos (for deactivating old ones)
CREATE POLICY "Users can update own arquivos"
ON public.arquivos
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM orcamentos o
    WHERE o.id = arquivos.orcamento_id
    AND o.user_id = auth.uid()
  )
);

-- Storage policies for projetos bucket
CREATE POLICY "Users can upload to projetos bucket"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'projetos'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Admin can view projetos bucket"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'projetos'
  AND is_admin(auth.uid())
);

CREATE POLICY "Users can view own projetos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'projetos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM orcamentos WHERE user_id = auth.uid()
  )
);