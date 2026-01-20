import { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Send, 
  MessageSquare,
  AlertTriangle,
  Shield,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useApprovalSystem, ApprovalMessage } from '@/hooks/useApprovalSystem';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ApprovalSectionProps {
  orcamentoId?: string;
  marginPercent: number;
  onApprovalStatusChange?: (status: 'PENDENTE' | 'APROVADA' | 'NEGADA' | null) => void;
}

export function ApprovalSection({ 
  orcamentoId, 
  marginPercent,
  onApprovalStatusChange 
}: ApprovalSectionProps) {
  const { user, isAdmin } = useAuth();
  const {
    messages,
    currentRequest,
    loading,
    unreadCount,
    checkNeedsApproval,
    sendMessage,
    requestApproval,
    approveRequest,
    denyRequest,
    markMessagesAsRead,
    refreshData,
  } = useApprovalSystem(orcamentoId);

  const [messageText, setMessageText] = useState('');
  const [gestorResponse, setGestorResponse] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const needsApproval = checkNeedsApproval(marginPercent);
  const status = currentRequest?.status || null;
  const canRequestApproval = !isAdmin && needsApproval && status !== 'PENDENTE' && status !== 'APROVADA';
  const canRespond = isAdmin && status === 'PENDENTE';

  // Mark messages as read when component mounts
  useEffect(() => {
    if (orcamentoId && unreadCount > 0) {
      markMessagesAsRead();
    }
  }, [orcamentoId, unreadCount]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Notify parent of status changes
  useEffect(() => {
    onApprovalStatusChange?.(status);
  }, [status, onApprovalStatusChange]);

  const handleRequestApproval = async () => {
    if (!messageText.trim()) return;
    const success = await requestApproval(messageText, marginPercent);
    if (success) {
      setMessageText('');
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    const success = await sendMessage(messageText);
    if (success) {
      setMessageText('');
    }
  };

  const handleApprove = async () => {
    await approveRequest(gestorResponse || undefined);
    setGestorResponse('');
  };

  const handleDeny = async () => {
    await denyRequest(gestorResponse || undefined);
    setGestorResponse('');
  };

  const handleGestorSendMessage = async () => {
    if (!gestorResponse.trim()) return;
    const success = await sendMessage(gestorResponse);
    if (success) {
      setGestorResponse('');
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'PENDENTE':
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30 text-lg px-4 py-2">
            <Clock className="w-5 h-5 mr-2" />
            PENDENTE
          </Badge>
        );
      case 'APROVADA':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30 text-lg px-4 py-2">
            <CheckCircle2 className="w-5 h-5 mr-2" />
            APROVADA
          </Badge>
        );
      case 'NEGADA':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30 text-lg px-4 py-2">
            <XCircle className="w-5 h-5 mr-2" />
            NEGADA
          </Badge>
        );
      default:
        return null;
    }
  };

  const renderMessage = (msg: ApprovalMessage) => {
    const isGestor = msg.sender_role === 'GESTOR';
    const isOwn = msg.sender_user_id === user?.id;
    
    return (
      <div
        key={msg.id}
        className={`flex ${isGestor ? 'justify-start' : 'justify-end'} mb-3`}
      >
        <div
          className={`max-w-[80%] rounded-2xl px-4 py-3 ${
            isGestor
              ? 'bg-accent text-foreground rounded-bl-md'
              : 'bg-primary text-primary-foreground rounded-br-md'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium ${isGestor ? 'text-muted-foreground' : 'text-primary-foreground/80'}`}>
              {isGestor ? '🛡️ Gestor' : '👤 Vendedor'}
            </span>
            <span className={`text-xs ${isGestor ? 'text-muted-foreground' : 'text-primary-foreground/60'}`}>
              {format(new Date(msg.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
        </div>
      </div>
    );
  };

  // Don't show if no orcamento yet
  if (!orcamentoId && !needsApproval) {
    return null;
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-accent/50 px-6 py-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Aprovação do Gestor</h3>
          </div>
          {getStatusBadge()}
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Margin Warning Banner */}
        {needsApproval && !status && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-700">Proposta necessita de aprovação do Gestor</p>
              <p className="text-sm text-yellow-600/80 mt-1">
                A margem total ({marginPercent.toFixed(1)}%) está abaixo do mínimo de 15%.
                Solicite aprovação do gestor para prosseguir.
              </p>
            </div>
          </div>
        )}

        {status === 'NEGADA' && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-700">Proposta negada pelo Gestor</p>
              <p className="text-sm text-red-600/80 mt-1">
                Revise as margens e valores conforme as orientações abaixo.
              </p>
            </div>
          </div>
        )}

        {status === 'APROVADA' && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-700">Proposta aprovada!</p>
              <p className="text-sm text-green-600/80 mt-1">
                Você pode gerar a Proposta Final agora.
              </p>
            </div>
          </div>
        )}

        {/* Messages Thread */}
        {messages.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="w-4 h-4" />
              <span>Histórico de mensagens</span>
            </div>
            <ScrollArea className="h-[200px] border border-border rounded-lg p-4 bg-muted/20">
              {messages.map(renderMessage)}
              <div ref={messagesEndRef} />
            </ScrollArea>
          </div>
        )}

        <Separator />

        {/* Vendedor: Request Approval or Send Message */}
        {!isAdmin && (
          <div className="space-y-4">
            {canRequestApproval && (
              <>
                <Textarea
                  placeholder="Explique o motivo da margem baixa e o que foi negociado..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="min-h-[100px]"
                />
                <Button
                  onClick={handleRequestApproval}
                  disabled={loading || !messageText.trim()}
                  className="w-full"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Solicitar Aprovação
                </Button>
              </>
            )}

            {status === 'PENDENTE' && (
              <div className="text-center text-muted-foreground py-4">
                <Clock className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
                <p>Aguardando resposta do Gestor...</p>
              </div>
            )}

            {(status === 'NEGADA' || status === 'PENDENTE') && messages.length > 0 && (
              <div className="space-y-3">
                <Textarea
                  placeholder="Adicionar mensagem..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="min-h-[80px]"
                />
                <Button
                  variant="outline"
                  onClick={handleSendMessage}
                  disabled={loading || !messageText.trim()}
                  className="w-full"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 mr-2" />
                  )}
                  Enviar Mensagem
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Gestor: Respond, Approve, or Deny */}
        {isAdmin && status === 'PENDENTE' && (
          <div className="space-y-4">
            <Textarea
              placeholder="Informe sua decisão e orientações..."
              value={gestorResponse}
              onChange={(e) => setGestorResponse(e.target.value)}
              className="min-h-[100px]"
            />
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleGestorSendMessage}
                disabled={loading || !gestorResponse.trim()}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Enviar Resposta
              </Button>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="destructive"
                onClick={handleDeny}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                Negar
              </Button>
              <Button
                onClick={handleApprove}
                disabled={loading}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                Aprovar
              </Button>
            </div>
          </div>
        )}

        {/* Gestor viewing approved/denied */}
        {isAdmin && (status === 'APROVADA' || status === 'NEGADA') && (
          <div className="text-center text-muted-foreground py-2">
            <p className="text-sm">
              {status === 'APROVADA' ? '✅ Você aprovou esta proposta' : '⛔ Você negou esta proposta'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
