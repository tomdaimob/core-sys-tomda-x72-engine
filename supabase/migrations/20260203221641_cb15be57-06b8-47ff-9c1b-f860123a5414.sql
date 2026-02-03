-- 1) Garantir colunas e defaults em public.arquivos
ALTER TABLE public.arquivos
  ADD COLUMN IF NOT EXISTS ativo boolean,
  ADD COLUMN IF NOT EXISTS version integer;

UPDATE public.arquivos SET ativo = true WHERE ativo IS NULL;
UPDATE public.arquivos SET version = 1 WHERE version IS NULL;

ALTER TABLE public.arquivos
  ALTER COLUMN ativo SET DEFAULT true,
  ALTER COLUMN ativo SET NOT NULL,
  ALTER COLUMN version SET DEFAULT 1,
  ALTER COLUMN version SET NOT NULL;

-- 2) Garantir trigger de versionamento/ativo (função já existe)
DROP TRIGGER IF EXISTS arquivos_before_insert_projeto_pdf ON public.arquivos;
CREATE TRIGGER arquivos_before_insert_projeto_pdf
BEFORE INSERT ON public.arquivos
FOR EACH ROW
EXECUTE FUNCTION public.arquivos_before_insert_projeto_pdf();

-- 3) Bucket 'projetos' (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('projetos', 'projetos', false)
ON CONFLICT (id) DO NOTHING;

-- 4) RLS policies em public.arquivos (corrigir INSERT/SELECT para owner e admin)
ALTER TABLE public.arquivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Vendedor can view own arquivos except projeto_pdf" ON public.arquivos;
DROP POLICY IF EXISTS "Admin can view all arquivos" ON public.arquivos;
DROP POLICY IF EXISTS "Users can insert arquivos for own orcamentos" ON public.arquivos;
DROP POLICY IF EXISTS "Admin can update arquivos" ON public.arquivos;
DROP POLICY IF EXISTS "Users can update own arquivos" ON public.arquivos;

CREATE POLICY "arquivos_select_admin"
ON public.arquivos
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "arquivos_select_owner"
ON public.arquivos
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orcamentos o
    WHERE o.id = arquivos.orcamento_id
      AND o.user_id = auth.uid()
  )
);

CREATE POLICY "arquivos_insert_admin_or_owner"
ON public.arquivos
FOR INSERT
TO authenticated
WITH CHECK (
  uploaded_by = auth.uid()
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.orcamentos o
      WHERE o.id = arquivos.orcamento_id
        AND o.user_id = auth.uid()
    )
  )
);

CREATE POLICY "arquivos_update_admin_or_owner"
ON public.arquivos
FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.orcamentos o
    WHERE o.id = arquivos.orcamento_id
      AND o.user_id = auth.uid()
  )
)
WITH CHECK (
  public.is_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.orcamentos o
    WHERE o.id = arquivos.orcamento_id
      AND o.user_id = auth.uid()
  )
);

-- 5) Storage policies (bucket privado):
-- - upload/delete: owner do orçamento ou admin
-- - leitura/listagem: somente admin

DROP POLICY IF EXISTS "projetos_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "projetos_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "projetos_admin_read" ON storage.objects;

CREATE POLICY "projetos_owner_insert"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'projetos'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.orcamentos o
      WHERE o.id::text = split_part(name, '/', 1)
        AND o.user_id = auth.uid()
    )
  )
);

CREATE POLICY "projetos_owner_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'projetos'
  AND (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.orcamentos o
      WHERE o.id::text = split_part(name, '/', 1)
        AND o.user_id = auth.uid()
    )
  )
);

CREATE POLICY "projetos_admin_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'projetos'
  AND public.is_admin(auth.uid())
);
