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
  const [orcamentoApprovalInfo, setOrcamentoApprovalInfo] = useState<OrcamentoApprovalInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Check if margin requires approval
  const checkNeedsApproval = (marginPercent: number): boolean => {
    return marginPercent < MARGIN_THRESHOLD;
  };

  // Load approval info from orcamentos (source of truth)
  const loadOrcamentoApprovalInfo = useCallback(async () => {
    if (!orcamentoId) return;

    try {
      const { data, error } = await supabase
        .from('orcamentos')
        .select('needs_approval, approval_status, margin_percent')
        .eq('id', orcamentoId)
        .single();

      if (error) throw error;
      
      setOrcamentoApprovalInfo(data as OrcamentoApprovalInfo);
    } catch (error: any) {
      console.error('[useApprovalSystem] Error loading orcamento approval info:', error);
    }
  }, [orcamentoId]);

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
      
      // Validate that all messages belong to current orcamento
      const validMessages = (data || []).filter(msg => msg.orcamento_id === orcamentoId);
      if (validMessages.length !== (data || []).length) {
        console.error('[useApprovalSystem] Data leak detected: messages from other orcamentos');
      }
      
      setMessages(validMessages as unknown as ApprovalMessage[]);
    } catch (error: any) {
      console.error('Error loading messages:', error);
    }
  }, [orcamentoId]);

  // Load current approval request (now using .single() since we have unique constraint)
  const loadCurrentRequest = useCallback(async () => {
    if (!orcamentoId) return;

    try {
      const { data, error } = await supabase
        .from('approval_requests')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .maybeSingle();

      if (error) throw error;
      
      // Validate that request belongs to current orcamento
      if (data && data.orcamento_id !== orcamentoId) {
        console.error('[useApprovalSystem] Data leak detected: request from different orcamento');
        setCurrentRequest(null);
        return;
      }
      
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

  // Request approval (vendedor) - using UPSERT
  const requestApproval = async (message: string, marginPercent: number): Promise<boolean> => {
    console.log('[useApprovalSystem] requestApproval called', { orcamentoId, userId: user?.id, message: message.substring(0, 30), marginPercent });
    
    if (!orcamentoId) {
      console.error('[useApprovalSystem] requestApproval failed: no orcamentoId');
      toast({ title: 'Erro', description: 'Orçamento não encontrado. Salve primeiro.', variant: 'destructive' });
      return false;
    }
    
    if (!user) {
      console.error('[useApprovalSystem] requestApproval failed: no user');
      toast({ title: 'Erro', description: 'Usuário não autenticado.', variant: 'destructive' });
      return false;
    }

    setLoading(true);
    try {
      // Update orcamento status FIRST (source of truth)
      console.log('[useApprovalSystem] Updating orcamento status...');
      const { error: updateError } = await supabase
        .from('orcamentos')
        .update({
          needs_approval: true,
          approval_status: 'PENDENTE',
          margin_percent: marginPercent,
        })
        .eq('id', orcamentoId);

      if (updateError) {
        console.error('[useApprovalSystem] Error updating orcamento:', updateError);
        throw updateError;
      }
      console.log('[useApprovalSystem] orcamento updated successfully');

      // UPSERT approval request (onConflict: orcamento_id)
      console.log('[useApprovalSystem] Upserting approval_request...');
      const { data: request, error: requestError } = await supabase
        .from('approval_requests')
        .upsert({
          orcamento_id: orcamentoId,
          requested_by: user.id,
          status: 'PENDENTE',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'orcamento_id' })
        .select()
        .single();

      if (requestError) {
        console.error('[useApprovalSystem] Error upserting approval_request:', requestError);
        throw requestError;
      }
      console.log('[useApprovalSystem] approval_request upserted:', request);

      // Send initial message
      if (message.trim()) {
        console.log('[useApprovalSystem] Inserting approval_message...');
        const { error: msgError } = await supabase
          .from('approval_messages')
          .insert({
            orcamento_id: orcamentoId,
            request_id: (request as any).id,
            sender_user_id: user.id,
            sender_role: 'VENDEDOR',
            message: message.trim(),
          });

        if (msgError) {
          console.error('[useApprovalSystem] Error inserting message:', msgError);
          throw msgError;
        }
        console.log('[useApprovalSystem] approval_message inserted successfully');
      }

      await loadOrcamentoApprovalInfo();
      await loadCurrentRequest();
      await loadMessages();
      
      toast({ title: 'Solicitação enviada ao Gestor!', description: 'Aguardando aprovação.' });
      return true;
    } catch (error: any) {
      console.error('[useApprovalSystem] requestApproval error:', error);
      toast({ 
        title: 'Erro ao solicitar aprovação', 
        description: error?.message || 'Erro desconhecido',
        variant: 'destructive' 
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Approve request (gestor) - using UPSERT
  const approveRequest = async (message?: string): Promise<boolean> => {
    if (!orcamentoId || !user) return false;

    setLoading(true);
    try {
      // Update orcamento FIRST (source of truth)
      const { error: updateError } = await supabase
        .from('orcamentos')
        .update({
          needs_approval: false,
          approval_status: 'APROVADA',
        })
        .eq('id', orcamentoId);

      if (updateError) throw updateError;

      // UPSERT approval request
      const { data: upsertedRequest, error: requestError } = await supabase
        .from('approval_requests')
        .upsert({
          orcamento_id: orcamentoId,
          status: 'APROVADA',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          requested_by: currentRequest?.requested_by || user.id,
        }, { onConflict: 'orcamento_id' })
        .select()
        .single();

      if (requestError) throw requestError;

      // Send automatic message
      const autoMessage = '✅ Aprovado pelo Gestor' + (message ? `: ${message}` : '');
      await supabase
        .from('approval_messages')
        .insert({
          orcamento_id: orcamentoId,
          request_id: upsertedRequest?.id || currentRequest?.id,
          sender_user_id: user.id,
          sender_role: 'GESTOR',
          message: autoMessage,
        });

      await loadOrcamentoApprovalInfo();
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

  // Deny request (gestor) - using UPSERT
  const denyRequest = async (message?: string): Promise<boolean> => {
    if (!orcamentoId || !user) return false;

    setLoading(true);
    try {
      // Update orcamento FIRST (source of truth)
      const { error: updateError } = await supabase
        .from('orcamentos')
        .update({
          needs_approval: true,
          approval_status: 'NEGADA',
        })
        .eq('id', orcamentoId);

      if (updateError) throw updateError;

      // UPSERT approval request
      const { data: upsertedRequest, error: requestError } = await supabase
        .from('approval_requests')
        .upsert({
          orcamento_id: orcamentoId,
          status: 'NEGADA',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          requested_by: currentRequest?.requested_by || user.id,
        }, { onConflict: 'orcamento_id' })
        .select()
        .single();

      if (requestError) throw requestError;

      // Send automatic message
      const autoMessage = '⛔ Negado pelo Gestor' + (message ? `: ${message}` : '');
      await supabase
        .from('approval_messages')
        .insert({
          orcamento_id: orcamentoId,
          request_id: upsertedRequest?.id || currentRequest?.id,
          sender_user_id: user.id,
          sender_role: 'GESTOR',
          message: autoMessage,
        });

      await loadOrcamentoApprovalInfo();
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

  // Load data on mount and when orcamentoId changes
  useEffect(() => {
    // Reset state when orcamentoId changes to prevent data leakage
    setMessages([]);
    setCurrentRequest(null);
    setOrcamentoApprovalInfo(null);
    setUnreadCount(0);

    if (orcamentoId) {
      loadOrcamentoApprovalInfo();
      loadMessages();
      loadCurrentRequest();
      loadUnreadCount();
    }
  }, [orcamentoId, loadOrcamentoApprovalInfo, loadMessages, loadCurrentRequest, loadUnreadCount]);

  // Derive status from source of truth (orcamentos table)
  const approvalStatus = orcamentoApprovalInfo?.approval_status || null;

  return {
    messages,
    currentRequest,
    orcamentoApprovalInfo,
    approvalStatus,
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
      loadOrcamentoApprovalInfo();
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
