-- Step 1: Remove duplicates keeping only the most recent per orcamento_id
DELETE FROM public.approval_requests a
USING public.approval_requests b
WHERE a.orcamento_id = b.orcamento_id
  AND a.updated_at < b.updated_at;

-- If duplicates still exist (same updated_at), keep the one with higher id
DELETE FROM public.approval_requests a
USING public.approval_requests b
WHERE a.orcamento_id = b.orcamento_id
  AND a.updated_at = b.updated_at
  AND a.id < b.id;

-- Step 2: Add UNIQUE constraint to prevent future duplicates
ALTER TABLE public.approval_requests
DROP CONSTRAINT IF EXISTS approval_requests_unique_orcamento;

ALTER TABLE public.approval_requests
ADD CONSTRAINT approval_requests_unique_orcamento UNIQUE (orcamento_id);