import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ApprovalMessage {
  id: string;
  orcamento_id: string;
  request_id: string | null;
  sender_user_id: string;
  sender_role: 'VENDEDOR' | 'GESTOR';
  message: string;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
}

export interface ApprovalRequest {
  id: string;
  orcamento_id: string;
  status: 'PENDENTE' | 'APROVADA' | 'NEGADA';
  requested_by: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrcamentoApprovalInfo {
  needs_approval: boolean;
  approval_status: 'PENDENTE' | 'APROVADA' | 'NEGADA' | null;
  margin_percent: number | null;
}

const MARGIN_THRESHOLD = 15;

export function useApprovalSystem(orcamentoId?: string) {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ApprovalMessage[]>([]);
  const [currentRequest, setCurrentRequest] = useState<ApprovalRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Check if margin requires approval
  const checkNeedsApproval = (marginPercent: number): boolean => {
    return marginPercent < MARGIN_THRESHOLD;
  };

  // Load messages for an orcamento
  const loadMessages = useCallback(async () => {
    if (!orcamentoId) return;

    try {
      const { data, error } = await supabase
        .from('approval_messages')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Type assertion since DB types aren't updated yet
      setMessages((data || []) as unknown as ApprovalMessage[]);
    } catch (error: any) {
      console.error('Error loading messages:', error);
    }
  }, [orcamentoId]);

  // Load current approval request
  const loadCurrentRequest = useCallback(async () => {
    if (!orcamentoId) return;

    try {
      const { data, error } = await supabase
        .from('approval_requests')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      setCurrentRequest(data as unknown as ApprovalRequest | null);
    } catch (error: any) {
      console.error('Error loading request:', error);
    }
  }, [orcamentoId]);

  // Count unread messages
  const loadUnreadCount = useCallback(async () => {
    if (!orcamentoId || !user) return;

    try {
      const roleToCheck = isAdmin ? 'VENDEDOR' : 'GESTOR';
      const { count, error } = await supabase
        .from('approval_messages')
        .select('*', { count: 'exact', head: true })
        .eq('orcamento_id', orcamentoId)
        .eq('sender_role', roleToCheck)
        .eq('is_read', false);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error: any) {
      console.error('Error counting unread:', error);
    }
  }, [orcamentoId, user, isAdmin]);

  // Send message
  const sendMessage = async (message: string): Promise<boolean> => {
    if (!orcamentoId || !user || !message.trim()) return false;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('approval_messages')
        .insert({
          orcamento_id: orcamentoId,
          request_id: currentRequest?.id || null,
          sender_user_id: user.id,
          sender_role: isAdmin ? 'GESTOR' : 'VENDEDOR',
          message: message.trim(),
        });

      if (error) throw error;

      await loadMessages();
      toast({ title: 'Mensagem enviada!' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao enviar mensagem', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Request approval (vendedor)
  const requestApproval = async (message: string, marginPercent: number): Promise<boolean> => {
    if (!orcamentoId || !user) return false;

    setLoading(true);
    try {
      // Create approval request
      const { data: request, error: requestError } = await supabase
        .from('approval_requests')
        .insert({
          orcamento_id: orcamentoId,
          requested_by: user.id,
          status: 'PENDENTE',
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Update orcamento status
      const { error: updateError } = await supabase
        .from('orcamentos')
        .update({
          needs_approval: true,
          approval_status: 'PENDENTE',
          margin_percent: marginPercent,
        })
        .eq('id', orcamentoId);

      if (updateError) throw updateError;

      // Send initial message
      if (message.trim()) {
        const { error: msgError } = await supabase
          .from('approval_messages')
          .insert({
            orcamento_id: orcamentoId,
            request_id: (request as any).id,
            sender_user_id: user.id,
            sender_role: 'VENDEDOR',
            message: message.trim(),
          });

        if (msgError) throw msgError;
      }

      await loadCurrentRequest();
      await loadMessages();
      
      toast({ title: 'Solicitação enviada!', description: 'Aguardando aprovação do gestor.' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao solicitar aprovação', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Approve request (gestor)
  const approveRequest = async (message?: string): Promise<boolean> => {
    if (!orcamentoId || !user || !currentRequest) return false;

    setLoading(true);
    try {
      // Update request
      const { error: requestError } = await supabase
        .from('approval_requests')
        .update({
          status: 'APROVADA',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', currentRequest.id);

      if (requestError) throw requestError;

      // Update orcamento
      const { error: updateError } = await supabase
        .from('orcamentos')
        .update({
          needs_approval: false,
          approval_status: 'APROVADA',
        })
        .eq('id', orcamentoId);

      if (updateError) throw updateError;

      // Send automatic message
      const autoMessage = '✅ Aprovado pelo Gestor' + (message ? `: ${message}` : '');
      await supabase
        .from('approval_messages')
        .insert({
          orcamento_id: orcamentoId,
          request_id: currentRequest.id,
          sender_user_id: user.id,
          sender_role: 'GESTOR',
          message: autoMessage,
        });

      await loadCurrentRequest();
      await loadMessages();

      toast({ title: 'Orçamento aprovado!', description: 'O vendedor foi notificado.' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao aprovar', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Deny request (gestor)
  const denyRequest = async (message?: string): Promise<boolean> => {
    if (!orcamentoId || !user || !currentRequest) return false;

    setLoading(true);
    try {
      // Update request
      const { error: requestError } = await supabase
        .from('approval_requests')
        .update({
          status: 'NEGADA',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', currentRequest.id);

      if (requestError) throw requestError;

      // Update orcamento
      const { error: updateError } = await supabase
        .from('orcamentos')
        .update({
          needs_approval: true,
          approval_status: 'NEGADA',
        })
        .eq('id', orcamentoId);

      if (updateError) throw updateError;

      // Send automatic message
      const autoMessage = '⛔ Negado pelo Gestor' + (message ? `: ${message}` : '');
      await supabase
        .from('approval_messages')
        .insert({
          orcamento_id: orcamentoId,
          request_id: currentRequest.id,
          sender_user_id: user.id,
          sender_role: 'GESTOR',
          message: autoMessage,
        });

      await loadCurrentRequest();
      await loadMessages();

      toast({ title: 'Orçamento negado', description: 'O vendedor foi notificado.' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao negar', description: error.message, variant: 'destructive' });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Mark messages as read
  const markMessagesAsRead = async () => {
    if (!orcamentoId || !user) return;

    try {
      const roleToMark = isAdmin ? 'VENDEDOR' : 'GESTOR';
      await supabase
        .from('approval_messages')
        .update({ is_read: true })
        .eq('orcamento_id', orcamentoId)
        .eq('sender_role', roleToMark)
        .eq('is_read', false);

      setUnreadCount(0);
    } catch (error: any) {
      console.error('Error marking as read:', error);
    }
  };

  // Load data on mount
  useEffect(() => {
    if (orcamentoId) {
      loadMessages();
      loadCurrentRequest();
      loadUnreadCount();
    }
  }, [orcamentoId, loadMessages, loadCurrentRequest, loadUnreadCount]);

  return {
    messages,
    currentRequest,
    loading,
    unreadCount,
    isAdmin,
    checkNeedsApproval,
    sendMessage,
    requestApproval,
    approveRequest,
    denyRequest,
    markMessagesAsRead,
    refreshData: () => {
      loadMessages();
      loadCurrentRequest();
      loadUnreadCount();
    },
  };
}

// Hook for getting pending approvals count (for badges in list)
export function usePendingApprovalsCount() {
  const { isAdmin } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;

    const loadCounts = async () => {
      try {
        // Count pending approvals
        const { count: pending, error: pendingError } = await supabase
          .from('orcamentos')
          .select('*', { count: 'exact', head: true })
          .eq('approval_status', 'PENDENTE');

        if (!pendingError) {
          setPendingCount(pending || 0);
        }

        // Count unread messages from vendedores
        const { count: unread, error: unreadError } = await supabase
          .from('approval_messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_role', 'VENDEDOR')
          .eq('is_read', false);

        if (!unreadError) {
          setUnreadMessagesCount(unread || 0);
        }
      } catch (error) {
        console.error('Error loading counts:', error);
      }
    };

    loadCounts();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadCounts, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  return { pendingCount, unreadMessagesCount };
}
