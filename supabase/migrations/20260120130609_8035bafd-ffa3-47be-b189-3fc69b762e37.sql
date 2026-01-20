-- Enable RLS (idempotent)
ALTER TABLE public.orcamento_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_resultados ENABLE ROW LEVEL SECURITY;

-- ORCAMENTO_INPUTS: SELECT
DROP POLICY IF EXISTS "inputs_select_admin_or_owner" ON public.orcamento_inputs;
CREATE POLICY "inputs_select_admin_or_owner"
ON public.orcamento_inputs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_admin = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.orcamentos o
    WHERE o.id = orcamento_inputs.orcamento_id
      AND o.user_id = auth.uid()
  )
);

-- ORCAMENTO_INPUTS: INSERT
DROP POLICY IF EXISTS "inputs_insert_admin_or_owner" ON public.orcamento_inputs;
CREATE POLICY "inputs_insert_admin_or_owner"
ON public.orcamento_inputs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_admin = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.orcamentos o
    WHERE o.id = orcamento_inputs.orcamento_id
      AND o.user_id = auth.uid()
  )
);

-- ORCAMENTO_INPUTS: UPDATE
DROP POLICY IF EXISTS "inputs_update_admin_or_owner" ON public.orcamento_inputs;
CREATE POLICY "inputs_update_admin_or_owner"
ON public.orcamento_inputs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_admin = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.orcamentos o
    WHERE o.id = orcamento_inputs.orcamento_id
      AND o.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_admin = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.orcamentos o
    WHERE o.id = orcamento_inputs.orcamento_id
      AND o.user_id = auth.uid()
  )
);

-- ORCAMENTO_RESULTADOS: SELECT
DROP POLICY IF EXISTS "resultados_select_admin_or_owner" ON public.orcamento_resultados;
CREATE POLICY "resultados_select_admin_or_owner"
ON public.orcamento_resultados
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_admin = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.orcamentos o
    WHERE o.id = orcamento_resultados.orcamento_id
      AND o.user_id = auth.uid()
  )
);

-- ORCAMENTO_RESULTADOS: INSERT
DROP POLICY IF EXISTS "resultados_insert_admin_or_owner" ON public.orcamento_resultados;
CREATE POLICY "resultados_insert_admin_or_owner"
ON public.orcamento_resultados
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_admin = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.orcamentos o
    WHERE o.id = orcamento_resultados.orcamento_id
      AND o.user_id = auth.uid()
  )
);

-- ORCAMENTO_RESULTADOS: UPDATE
DROP POLICY IF EXISTS "resultados_update_admin_or_owner" ON public.orcamento_resultados;
CREATE POLICY "resultados_update_admin_or_owner"
ON public.orcamento_resultados
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_admin = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.orcamentos o
    WHERE o.id = orcamento_resultados.orcamento_id
      AND o.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.is_admin = true
  )
  OR EXISTS (
    SELECT 1
    FROM public.orcamentos o
    WHERE o.id = orcamento_resultados.orcamento_id
      AND o.user_id = auth.uid()
  )
);