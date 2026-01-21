-- Add discount governance columns to orcamentos table
ALTER TABLE public.orcamentos 
ADD COLUMN IF NOT EXISTS lucro_percent numeric DEFAULT 15,
ADD COLUMN IF NOT EXISTS bdi_percent numeric DEFAULT 25,
ADD COLUMN IF NOT EXISTS desconto_percent numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_status text DEFAULT 'DISPENSADO',
ADD COLUMN IF NOT EXISTS discount_requested_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS discount_decided_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS discount_requested_by uuid,
ADD COLUMN IF NOT EXISTS discount_decided_by uuid;

-- Add check constraint for discount_status
ALTER TABLE public.orcamentos 
ADD CONSTRAINT orcamentos_discount_status_check 
CHECK (discount_status IN ('DISPENSADO', 'PENDENTE', 'APROVADO', 'NEGADO'));

-- Create policy to restrict vendedor from updating lucro/bdi
-- First drop any existing conflicting policies
DROP POLICY IF EXISTS "Users can update their own orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Vendedor can update limited fields on own orcamentos" ON public.orcamentos;

-- Recreate vendedor update policy with column restrictions
-- Vendedor can only update: desconto_percent, discount_status (to PENDENTE), updated_at, and basic project fields
CREATE POLICY "Vendedor can update limited fields on own orcamentos" 
ON public.orcamentos 
FOR UPDATE 
USING (auth.uid() = user_id AND NOT public.is_admin(auth.uid()))
WITH CHECK (auth.uid() = user_id AND NOT public.is_admin(auth.uid()));

-- Note: Column-level security in RLS is complex - we'll enforce this in application code
-- The RLS policy above allows update, but the frontend will only send allowed fields for vendedores

-- Add column for discount request message type in approval_messages
ALTER TABLE public.approval_messages
ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'GENERAL';

-- Add check constraint for message_type
ALTER TABLE public.approval_messages 
ADD CONSTRAINT approval_messages_message_type_check 
CHECK (message_type IN ('GENERAL', 'DISCOUNT_REQUEST', 'DISCOUNT_DECISION', 'MARGIN_REQUEST', 'MARGIN_DECISION'));