
-- Create audit_log table for Mr. Obras Assistente
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_role text NOT NULL DEFAULT 'VENDEDOR',
  action text NOT NULL,
  entity text,
  before_json jsonb DEFAULT '{}'::jsonb,
  after_json jsonb DEFAULT '{}'::jsonb,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can see all audit logs
CREATE POLICY "audit_log_select_admin"
ON public.audit_log FOR SELECT
USING (is_admin(auth.uid()));

-- Users can see audit logs of their own orcamentos
CREATE POLICY "audit_log_select_owner"
ON public.audit_log FOR SELECT
USING (EXISTS (
  SELECT 1 FROM orcamentos o
  WHERE o.id = audit_log.orcamento_id AND o.user_id = auth.uid()
));

-- Any authenticated user can insert audit logs (for their own actions)
CREATE POLICY "audit_log_insert_authenticated"
ON public.audit_log FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_audit_log_orcamento_id ON public.audit_log(orcamento_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);
