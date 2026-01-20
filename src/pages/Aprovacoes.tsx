import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { 
  ClipboardCheck, 
  MessageSquare, 
  Clock, 
  CheckCircle, 
  XCircle,
  User,
  Shield,
  Eye,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface PendingOrcamento {
  id: string;
  codigo: string;
  cliente: string;
  projeto: string | null;
  margin_percent: number | null;
  approval_status: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface ApprovalMessage {
  id: string;
  orcamento_id: string;
  sender_user_id: string;
  sender_role: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

interface ApprovalRequest {
  id: string;
  orcamento_id: string;
  status: string;
  requested_by: string;
  created_at: string;
}

export default function Aprovacoes() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  
  const [pendingOrcamentos, setPendingOrcamentos] = useState<PendingOrcamento[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [selectedOrcamento, setSelectedOrcamento] = useState<PendingOrcamento | null>(null);
  const [messages, setMessages] = useState<ApprovalMessage[]>([]);
  const [currentRequest, setCurrentRequest] = useState<ApprovalRequest | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Load pending orcamentos
  const loadPendingOrcamentos = async () => {
    try {
      const { data, error } = await supabase
        .from('orcamentos')
        .select('id, codigo, cliente, projeto, margin_percent, approval_status, created_at, updated_at, user_id')
        .eq('approval_status', 'PENDENTE')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setPendingOrcamentos(data || []);
      setPendingCount(data?.length || 0);
    } catch (error: any) {
      console.error('Error loading pending:', error);
      toast({ title: 'Erro ao carregar pendências', variant: 'destructive' });
    }
  };

  // Load unread messages count
  const loadUnreadCount = async () => {
    try {
      const { count, error } = await supabase
        .from('approval_messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_role', 'VENDEDOR')
        .eq('is_read', false);

      if (error) throw error;
      setUnreadMessagesCount(count || 0);
    } catch (error: any) {
      console.error('Error loading unread count:', error);
    }
  };

  // Load messages for selected orcamento
  const loadMessages = async (orcamentoId: string) => {
    try {
      const { data, error } = await supabase
        .from('approval_messages')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as ApprovalMessage[]);

      // Mark messages as read
      await supabase
        .from('approval_messages')
        .update({ is_read: true })
        .eq('orcamento_id', orcamentoId)
        .eq('sender_role', 'VENDEDOR')
        .eq('is_read', false);

      loadUnreadCount();
    } catch (error: any) {
      console.error('Error loading messages:', error);
    }
  };

  // Load current request
  const loadCurrentRequest = async (orcamentoId: string) => {
    try {
      const { data, error } = await supabase
        .from('approval_requests')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setCurrentRequest(data as ApprovalRequest | null);
    } catch (error: any) {
      console.error('Error loading request:', error);
    }
  };

  // Handle analyze click
  const handleAnalisar = async (orc: PendingOrcamento) => {
    setSelectedOrcamento(orc);
    setMessages([]);
    setCurrentRequest(null);
    setResponseMessage('');
    await Promise.all([
      loadMessages(orc.id),
      loadCurrentRequest(orc.id),
    ]);
  };

  // Handle approve
  const handleAprovar = async () => {
    if (!selectedOrcamento || !currentRequest || !user) return;

    setActionLoading(true);
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
        .eq('id', selectedOrcamento.id);

      if (updateError) throw updateError;

      // Send automatic message
      const autoMessage = '✅ Aprovado pelo Gestor' + (responseMessage.trim() ? `: ${responseMessage.trim()}` : '');
      await supabase
        .from('approval_messages')
        .insert({
          orcamento_id: selectedOrcamento.id,
          request_id: currentRequest.id,
          sender_user_id: user.id,
          sender_role: 'GESTOR',
          message: autoMessage,
        });

      toast({ title: 'Orçamento aprovado!', description: 'O vendedor foi notificado.' });
      setSelectedOrcamento(null);
      loadPendingOrcamentos();
      loadUnreadCount();
    } catch (error: any) {
      console.error('Error approving:', error);
      toast({ title: 'Erro ao aprovar', description: error.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle deny
  const handleNegar = async () => {
    if (!selectedOrcamento || !currentRequest || !user) return;

    setActionLoading(true);
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
        .eq('id', selectedOrcamento.id);

      if (updateError) throw updateError;

      // Send automatic message
      const autoMessage = '⛔ Negado pelo Gestor' + (responseMessage.trim() ? `: ${responseMessage.trim()}` : '');
      await supabase
        .from('approval_messages')
        .insert({
          orcamento_id: selectedOrcamento.id,
          request_id: currentRequest.id,
          sender_user_id: user.id,
          sender_role: 'GESTOR',
          message: autoMessage,
        });

      toast({ title: 'Orçamento negado', description: 'O vendedor foi notificado.' });
      setSelectedOrcamento(null);
      loadPendingOrcamentos();
      loadUnreadCount();
    } catch (error: any) {
      console.error('Error denying:', error);
      toast({ title: 'Erro ao negar', description: error.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  // Send message only
  const handleEnviarMensagem = async () => {
    if (!selectedOrcamento || !user || !responseMessage.trim()) return;

    setActionLoading(true);
    try {
      await supabase
        .from('approval_messages')
        .insert({
          orcamento_id: selectedOrcamento.id,
          request_id: currentRequest?.id || null,
          sender_user_id: user.id,
          sender_role: 'GESTOR',
          message: responseMessage.trim(),
        });

      setResponseMessage('');
      await loadMessages(selectedOrcamento.id);
      toast({ title: 'Mensagem enviada!' });
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({ title: 'Erro ao enviar mensagem', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (isAdmin) {
      setLoading(true);
      Promise.all([loadPendingOrcamentos(), loadUnreadCount()])
        .finally(() => setLoading(false));

      // Refresh every 30 seconds
      const interval = setInterval(() => {
        loadPendingOrcamentos();
        loadUnreadCount();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isAdmin]);

  const getMarginColor = (margin: number | null) => {
    if (margin === null) return 'text-muted-foreground';
    if (margin >= 15) return 'text-green-600';
    if (margin >= 10) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDate = (dateStr: string) => {
    return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <ClipboardCheck className="w-7 h-7 text-primary" />
              Aprovações
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie solicitações de aprovação de orçamentos com margem baixa
            </p>
          </div>
        </div>

        {/* Counters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">aguardando sua decisão</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Novas Mensagens</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{unreadMessagesCount}</div>
              <p className="text-xs text-muted-foreground">mensagens não lidas de vendedores</p>
            </CardContent>
          </Card>
        </div>

        {/* Pending List */}
        <Card>
          <CardHeader>
            <CardTitle>Solicitações Pendentes</CardTitle>
            <CardDescription>
              Orçamentos aguardando aprovação por terem margem inferior a 15%
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : pendingOrcamentos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
                <p className="font-medium">Nenhuma solicitação pendente</p>
                <p className="text-sm">Todas as aprovações estão em dia!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingOrcamentos.map((orc) => (
                  <div
                    key={orc.id}
                    className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono font-semibold text-primary">{orc.codigo}</span>
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Pendente
                        </Badge>
                      </div>
                      <p className="text-sm font-medium truncate">{orc.cliente}</p>
                      {orc.projeto && (
                        <p className="text-xs text-muted-foreground truncate">{orc.projeto}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Atualizado: {formatDate(orc.updated_at)}</span>
                        <span className={`font-semibold ${getMarginColor(orc.margin_percent)}`}>
                          Margem: {orc.margin_percent?.toFixed(1) ?? 'N/A'}%
                        </span>
                      </div>
                    </div>
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => handleAnalisar(orc)}
                      className="ml-4 shrink-0"
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Analisar
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Modal */}
        <Dialog open={!!selectedOrcamento} onOpenChange={(open) => !open && setSelectedOrcamento(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-primary" />
                Analisar Solicitação
              </DialogTitle>
              <DialogDescription>
                {selectedOrcamento?.codigo} - {selectedOrcamento?.cliente}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg mb-4">
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selectedOrcamento?.cliente}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Projeto</p>
                  <p className="font-medium">{selectedOrcamento?.projeto || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Margem Total</p>
                  <p className={`font-bold ${getMarginColor(selectedOrcamento?.margin_percent ?? null)}`}>
                    {selectedOrcamento?.margin_percent?.toFixed(2) ?? 'N/A'}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="font-medium">
                    {selectedOrcamento && formatDate(selectedOrcamento.updated_at)}
                  </p>
                </div>
              </div>

              <Separator className="mb-4" />

              {/* Messages Thread */}
              <div className="flex-1 min-h-0">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Histórico de Mensagens
                </h4>
                <ScrollArea className="h-48 border rounded-lg p-3 bg-background">
                  {messages.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Nenhuma mensagem ainda
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-lg ${
                            msg.sender_role === 'GESTOR'
                              ? 'bg-primary/10 ml-4'
                              : 'bg-muted mr-4'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {msg.sender_role === 'GESTOR' ? (
                              <Badge variant="default" className="text-xs gap-1">
                                <Shield className="w-3 h-3" />
                                Gestor
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <User className="w-3 h-3" />
                                Vendedor
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDate(msg.created_at)}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>

              <Separator className="my-4" />

              {/* Response Area */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Resposta do Gestor (opcional)</label>
                  <Textarea
                    placeholder="Escreva uma mensagem para o vendedor..."
                    value={responseMessage}
                    onChange={(e) => setResponseMessage(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleEnviarMensagem}
                    disabled={actionLoading || !responseMessage.trim()}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Enviar Mensagem
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleNegar}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4 mr-2" />
                    )}
                    Negar
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleAprovar}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Aprovar
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
