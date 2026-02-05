-- Add modo_medidas and manual_lock fields to orcamento_inputs.dados (JSON column)
-- These will be stored as part of the dados JSONB field, so no schema change needed for that

-- However, we need to ensure the storage bucket exists and has proper policies for images
-- Also ensure arquivos table can handle PROJETO_IMG type

-- 1. Ensure bucket 'projetos' exists (if not already)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'projetos', 
  'projetos', 
  false,
  26214400, -- 25MB limit
  ARRAY['application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg'],
  file_size_limit = 26214400;

-- 2. Update storage policies to allow image uploads (same rules as PDF)
-- Drop and recreate to ensure clean state
DROP POLICY IF EXISTS "projetos_upload_owner_or_admin" ON storage.objects;
DROP POLICY IF EXISTS "projetos_delete_owner_or_admin" ON storage.objects;
DROP POLICY IF EXISTS "projetos_download_admin_only" ON storage.objects;

-- Allow upload for authenticated users who own the orcamento or are admin
CREATE POLICY "projetos_upload_owner_or_admin" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'projetos'
  AND (
    -- Admin can upload
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
    OR
    -- Owner can upload to their orcamento folder
    EXISTS (
      SELECT 1 FROM public.orcamentos o
      WHERE o.user_id = auth.uid()
      AND (storage.foldername(name))[1] = o.id::text
    )
  )
);

-- Allow delete for owners or admins (for rollback)
CREATE POLICY "projetos_delete_owner_or_admin" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'projetos'
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND p.is_admin = true
    )
    OR
    EXISTS (
      SELECT 1 FROM public.orcamentos o
      WHERE o.user_id = auth.uid()
      AND (storage.foldername(name))[1] = o.id::text
    )
  )
);

-- Only admin can download
CREATE POLICY "projetos_download_admin_only" ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'projetos'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.is_admin = true
  )
);

-- 3. Add group_id column to arquivos for grouping image uploads together
ALTER TABLE public.arquivos 
ADD COLUMN IF NOT EXISTS group_id uuid DEFAULT NULL;

-- 4. Create or replace the trigger function for handling new uploads
-- This handles both PDF and IMG types, deactivating old ones of the same type
CREATE OR REPLACE FUNCTION public.arquivos_handle_new_upload()
RETURNS TRIGGER AS $$
DECLARE
  current_max_version int;
BEGIN
  -- Get current max version for this orcamento and tipo
  SELECT COALESCE(MAX(version), 0) INTO current_max_version
  FROM public.arquivos
  WHERE orcamento_id = NEW.orcamento_id
  AND tipo = NEW.tipo;
  
  -- Set version for new record
  NEW.version := current_max_version + 1;
  NEW.ativo := true;
  
  -- Deactivate all previous files of the same type for this orcamento
  UPDATE public.arquivos
  SET ativo = false
  WHERE orcamento_id = NEW.orcamento_id
  AND tipo = NEW.tipo
  AND id != NEW.id
  AND ativo = true;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger
DROP TRIGGER IF EXISTS arquivos_before_insert_projeto ON public.arquivos;
CREATE TRIGGER arquivos_before_insert_projeto
  BEFORE INSERT ON public.arquivos
  FOR EACH ROW
  EXECUTE FUNCTION public.arquivos_handle_new_upload();