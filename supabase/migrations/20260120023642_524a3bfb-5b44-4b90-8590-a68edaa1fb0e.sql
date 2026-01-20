-- Create approval_requests table
CREATE TABLE public.approval_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'APROVADA', 'NEGADA')),
  requested_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create approval_messages table
CREATE TABLE public.approval_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.approval_requests(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('VENDEDOR', 'GESTOR')),
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add needs_approval and approval fields to orcamentos
ALTER TABLE public.orcamentos
ADD COLUMN IF NOT EXISTS needs_approval BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS approval_status TEXT CHECK (approval_status IN ('PENDENTE', 'APROVADA', 'NEGADA')),
ADD COLUMN IF NOT EXISTS margin_percent NUMERIC;

-- Enable RLS
ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_messages ENABLE ROW LEVEL SECURITY;

-- RLS for approval_requests
-- Vendedor can view requests for their own orcamentos
CREATE POLICY "Vendedor can view own approval requests"
ON public.approval_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orcamentos
    WHERE orcamentos.id = approval_requests.orcamento_id
    AND orcamentos.user_id = auth.uid()
  )
);

-- Vendedor can create requests for their own orcamentos
CREATE POLICY "Vendedor can create approval requests"
ON public.approval_requests
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orcamentos
    WHERE orcamentos.id = orcamento_id
    AND orcamentos.user_id = auth.uid()
  )
  AND requested_by = auth.uid()
);

-- Admin can view all approval requests
CREATE POLICY "Admin can view all approval requests"
ON public.approval_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Admin can update any approval request (approve/deny)
CREATE POLICY "Admin can update approval requests"
ON public.approval_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- RLS for approval_messages
-- Vendedor can view messages for their own orcamentos
CREATE POLICY "Vendedor can view own messages"
ON public.approval_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM orcamentos
    WHERE orcamentos.id = approval_messages.orcamento_id
    AND orcamentos.user_id = auth.uid()
  )
);

-- Vendedor can create messages for their own orcamentos
CREATE POLICY "Vendedor can create messages"
ON public.approval_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM orcamentos
    WHERE orcamentos.id = orcamento_id
    AND orcamentos.user_id = auth.uid()
  )
  AND sender_user_id = auth.uid()
  AND sender_role = 'VENDEDOR'
);

-- Vendedor can update (mark as read) messages from GESTOR
CREATE POLICY "Vendedor can mark gestor messages as read"
ON public.approval_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM orcamentos
    WHERE orcamentos.id = approval_messages.orcamento_id
    AND orcamentos.user_id = auth.uid()
  )
  AND sender_role = 'GESTOR'
);

-- Admin can view all messages
CREATE POLICY "Admin can view all messages"
ON public.approval_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Admin can create messages (as GESTOR)
CREATE POLICY "Admin can create messages"
ON public.approval_messages
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.is_admin = true
  )
  AND sender_user_id = auth.uid()
  AND sender_role = 'GESTOR'
);

-- Admin can update (mark as read) messages from VENDEDOR
CREATE POLICY "Admin can mark vendedor messages as read"
ON public.approval_messages
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.is_admin = true
  )
  AND sender_role = 'VENDEDOR'
);

-- Update orcamentos RLS to allow admin to update any orcamento (for approval status)
CREATE POLICY "Admin can update any orcamento"
ON public.orcamentos
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.is_admin = true
  )
);

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION public.update_approval_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_approval_requests_updated_at
BEFORE UPDATE ON public.approval_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_approval_request_updated_at();

-- Create indexes for performance
CREATE INDEX idx_approval_requests_orcamento_id ON public.approval_requests(orcamento_id);
CREATE INDEX idx_approval_requests_status ON public.approval_requests(status);
CREATE INDEX idx_approval_messages_orcamento_id ON public.approval_messages(orcamento_id);
CREATE INDEX idx_approval_messages_is_read ON public.approval_messages(is_read);
CREATE INDEX idx_orcamentos_approval_status ON public.orcamentos(approval_status);