import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export type DiscountStatus = 'DISPENSADO' | 'PENDENTE' | 'APROVADO' | 'NEGADO';

export interface DiscountInfo {
  descontoPercent: number;
  discountStatus: DiscountStatus;
  discountRequestedAt: string | null;
  discountDecidedAt: string | null;
  discountRequestedBy: string | null;
  discountDecidedBy: string | null;
}

export interface DiscountMessage {
  id: string;
  orcamento_id: string;
  sender_user_id: string;
  sender_role: 'VENDEDOR' | 'GESTOR';
  message: string;
  message_type: 'GENERAL' | 'DISCOUNT_REQUEST' | 'DISCOUNT_DECISION';
  is_read: boolean;
  created_at: string;
}

// Thresholds for discount approval
const DISCOUNT_AUTO_APPROVE_LIMIT = 5; // Up to 5% is auto-approved
const DISCOUNT_HIGH_EXCEPTION_LIMIT = 11; // 11%+ is high exception

export function useDiscountSystem(orcamentoId?: string | null) {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [discountInfo, setDiscountInfo] = useState<DiscountInfo | null>(null);
  const [discountMessages, setDiscountMessages] = useState<DiscountMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // Determine discount level (for UI colors)
  const getDiscountLevel = (percent: number): 'green' | 'yellow' | 'red' => {
    if (percent <= DISCOUNT_AUTO_APPROVE_LIMIT) return 'green';
    if (percent < DISCOUNT_HIGH_EXCEPTION_LIMIT) return 'yellow';
    return 'red';
  };

  // Check if discount requires approval
  const needsApproval = (percent: number): boolean => {
    return percent > DISCOUNT_AUTO_APPROVE_LIMIT;
  };

  // Check if discount is high exception
  const isHighException = (percent: number): boolean => {
    return percent >= DISCOUNT_HIGH_EXCEPTION_LIMIT;
  };

  // Load discount info from orcamento
  const loadDiscountInfo = useCallback(async () => {
    if (!orcamentoId) return;

    try {
      const { data, error } = await supabase
        .from('orcamentos')
        .select('desconto_percent, discount_status, discount_requested_at, discount_decided_at, discount_requested_by, discount_decided_by')
        .eq('id', orcamentoId)
        .single();

      if (error) throw error;

      setDiscountInfo({
        descontoPercent: data.desconto_percent || 0,
        discountStatus: (data.discount_status as DiscountStatus) || 'DISPENSADO',
        discountRequestedAt: data.discount_requested_at,
        discountDecidedAt: data.discount_decided_at,
        discountRequestedBy: data.discount_requested_by,
        discountDecidedBy: data.discount_decided_by,
      });
    } catch (error: any) {
      console.error('[useDiscountSystem] Error loading discount info:', error);
    }
  }, [orcamentoId]);

  // Load discount-related messages
  const loadDiscountMessages = useCallback(async () => {
    if (!orcamentoId) return;

    try {
      const { data, error } = await supabase
        .from('approval_messages')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .in('message_type', ['DISCOUNT_REQUEST', 'DISCOUNT_DECISION', 'GENERAL'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      setDiscountMessages((data || []) as unknown as DiscountMessage[]);
    } catch (error: any) {
      console.error('[useDiscountSystem] Error loading messages:', error);
    }
  }, [orcamentoId]);

  // Request discount approval (vendedor)
  const requestDiscountApproval = async (
    descontoPercent: number,
    motivo: string
  ): Promise<boolean> => {
    if (!orcamentoId || !user) {
      toast({
        title: 'Erro',
        description: 'Orçamento não encontrado. Salve primeiro.',
        variant: 'destructive',
      });
      return false;
    }

    if (!motivo.trim() || motivo.trim().length < 10) {
      toast({
        title: 'Motivo obrigatório',
        description: 'Informe o motivo do desconto com pelo menos 10 caracteres.',
        variant: 'destructive',
      });
      return false;
    }

    setLoading(true);
    try {
      // Update orcamento with discount request
      const { error: updateError } = await supabase
        .from('orcamentos')
        .update({
          desconto_percent: descontoPercent,
          discount_status: 'PENDENTE',
          discount_requested_at: new Date().toISOString(),
          discount_requested_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orcamentoId);

      if (updateError) throw updateError;

      // Send message with discount request
      const messageContent = `📊 Solicitação de Desconto: ${descontoPercent.toFixed(1)}%\n\n${motivo}`;
      const { error: msgError } = await supabase
        .from('approval_messages')
        .insert({
          orcamento_id: orcamentoId,
          sender_user_id: user.id,
          sender_role: 'VENDEDOR',
          message: messageContent,
          message_type: 'DISCOUNT_REQUEST',
        });

      if (msgError) throw msgError;

      await loadDiscountInfo();
      await loadDiscountMessages();

      toast({
        title: 'Solicitação enviada!',
        description: 'Aguarde a aprovação do Gestor.',
      });
      return true;
    } catch (error: any) {
      console.error('[useDiscountSystem] Error requesting approval:', error);
      toast({
        title: 'Erro ao solicitar aprovação',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Approve discount (admin)
  const approveDiscount = async (resposta?: string): Promise<boolean> => {
    if (!orcamentoId || !user) return false;

    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('orcamentos')
        .update({
          discount_status: 'APROVADO',
          discount_decided_at: new Date().toISOString(),
          discount_decided_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orcamentoId);

      if (updateError) throw updateError;

      // Send approval message
      const messageContent = `✅ Desconto aprovado pelo Gestor${resposta ? `\n\n${resposta}` : ''}`;
      await supabase
        .from('approval_messages')
        .insert({
          orcamento_id: orcamentoId,
          sender_user_id: user.id,
          sender_role: 'GESTOR',
          message: messageContent,
          message_type: 'DISCOUNT_DECISION',
        });

      await loadDiscountInfo();
      await loadDiscountMessages();

      toast({
        title: 'Desconto aprovado!',
        description: 'O vendedor foi notificado.',
      });
      return true;
    } catch (error: any) {
      console.error('[useDiscountSystem] Error approving:', error);
      toast({
        title: 'Erro ao aprovar',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Deny discount (admin) - resets to 5%
  const denyDiscount = async (resposta?: string): Promise<boolean> => {
    if (!orcamentoId || !user) return false;

    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('orcamentos')
        .update({
          desconto_percent: 5, // Reset to max allowed without approval
          discount_status: 'NEGADO',
          discount_decided_at: new Date().toISOString(),
          discount_decided_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orcamentoId);

      if (updateError) throw updateError;

      // Send denial message
      const messageContent = `⛔ Desconto negado pelo Gestor. Valor reduzido para 5%.${resposta ? `\n\n${resposta}` : ''}`;
      await supabase
        .from('approval_messages')
        .insert({
          orcamento_id: orcamentoId,
          sender_user_id: user.id,
          sender_role: 'GESTOR',
          message: messageContent,
          message_type: 'DISCOUNT_DECISION',
        });

      await loadDiscountInfo();
      await loadDiscountMessages();

      toast({
        title: 'Desconto negado',
        description: 'Valor reduzido para 5%.',
      });
      return true;
    } catch (error: any) {
      console.error('[useDiscountSystem] Error denying:', error);
      toast({
        title: 'Erro ao negar',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Update discount locally (vendedor) - auto-approve if <= 5%
  const updateDiscount = async (newPercent: number): Promise<boolean> => {
    if (!orcamentoId) return false;

    // Determine new status based on percent
    const newStatus: DiscountStatus = newPercent <= DISCOUNT_AUTO_APPROVE_LIMIT 
      ? 'DISPENSADO' 
      : discountInfo?.discountStatus === 'APROVADO' && newPercent <= (discountInfo?.descontoPercent || 0)
        ? 'APROVADO' // Keep approved if reducing
        : 'DISPENSADO'; // Reset if changing

    try {
      const { error } = await supabase
        .from('orcamentos')
        .update({
          desconto_percent: newPercent,
          discount_status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orcamentoId);

      if (error) throw error;

      setDiscountInfo(prev => prev ? {
        ...prev,
        descontoPercent: newPercent,
        discountStatus: newStatus,
      } : null);

      return true;
    } catch (error: any) {
      console.error('[useDiscountSystem] Error updating discount:', error);
      return false;
    }
  };

  // Send general message
  const sendMessage = async (message: string): Promise<boolean> => {
    if (!orcamentoId || !user || !message.trim()) return false;

    try {
      const { error } = await supabase
        .from('approval_messages')
        .insert({
          orcamento_id: orcamentoId,
          sender_user_id: user.id,
          sender_role: isAdmin ? 'GESTOR' : 'VENDEDOR',
          message: message.trim(),
          message_type: 'GENERAL',
        });

      if (error) throw error;

      await loadDiscountMessages();
      toast({ title: 'Mensagem enviada!' });
      return true;
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar mensagem',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }
  };

  // Load data on mount
  useEffect(() => {
    setDiscountInfo(null);
    setDiscountMessages([]);

    if (orcamentoId) {
      loadDiscountInfo();
      loadDiscountMessages();
    }
  }, [orcamentoId, loadDiscountInfo, loadDiscountMessages]);

  return {
    discountInfo,
    discountMessages,
    loading,
    isAdmin,
    getDiscountLevel,
    needsApproval,
    isHighException,
    requestDiscountApproval,
    approveDiscount,
    denyDiscount,
    updateDiscount,
    sendMessage,
    refreshData: () => {
      loadDiscountInfo();
      loadDiscountMessages();
    },
  };
}
