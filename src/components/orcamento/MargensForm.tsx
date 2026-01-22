import { useState, useEffect, useRef } from 'react';
import { 
  Percent, 
  Lock, 
  Send, 
  CheckCircle2, 
  XCircle, 
  Clock,
  AlertTriangle,
  MessageSquare,
  Shield,
  Loader2
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useDiscountSystem, DiscountStatus } from '@/hooks/useDiscountSystem';
import { formatCurrency } from '@/lib/orcamento-calculos';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Margens {
  lucroPercent: number;
  bdiPercent: number;
  descontoPercent: number;
}

interface Consolidado {
  subtotal: number;
  lucro: number;
  bdi: number;
  desconto: number;
  totalVenda: number;
}

interface MargensFormProps {
  margens: Margens;
  onMargensChange: (margens: Margens) => void;
  consolidado: Consolidado;
  orcamentoId?: string | null;
  orcamentoCodigo?: string;
}

export function MargensForm({
  margens,
  onMargensChange,
  consolidado,
  orcamentoId,
  orcamentoCodigo,
}: MargensFormProps) {
  const { isAdmin } = useAuth();
  const {
    discountInfo,
    discountMessages,
    loading,
    getDiscountLevel,
    needsApproval,
    isHighException,
    requestDiscountApproval,
    approveDiscount,
    denyDiscount,
    sendMessage,
    refreshData,
  } = useDiscountSystem(orcamentoId);

  const [motivoDesconto, setMotivoDesconto] = useState('');
  const [gestorResposta, setGestorResposta] = useState('');
  const [localDesconto, setLocalDesconto] = useState(margens.descontoPercent);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync local desconto with margens
  useEffect(() => {
    setLocalDesconto(margens.descontoPercent);
  }, [margens.descontoPercent]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [discountMessages]);

  const discountLevel = getDiscountLevel(localDesconto);
  const requiresApproval = needsApproval(localDesconto);
  const highException = isHighException(localDesconto);
  const discountStatus = discountInfo?.discountStatus || 'DISPENSADO';

  // Check if can generate proposal based on discount status
  const canGenerateProposal = 
    !requiresApproval || 
    discountStatus === 'APROVADO' || 
    discountStatus === 'DISPENSADO' ||
    isAdmin;

  const handleDescontoChange = (value: number) => {
    const clampedValue = Math.max(0, Math.min(100, value));
    setLocalDesconto(clampedValue);
    onMargensChange({ ...margens, descontoPercent: clampedValue });
  };

  const handleRequestApproval = async () => {
    const success = await requestDiscountApproval(localDesconto, motivoDesconto);
    if (success) {
      setMotivoDesconto('');
    }
  };

  const handleApprove = async () => {
    await approveDiscount(gestorResposta || undefined);
    setGestorResposta('');
  };

  const handleDeny = async () => {
    const success = await denyDiscount(gestorResposta || undefined);
    if (success) {
      setGestorResposta('');
      // Update local state with reset value
      handleDescontoChange(5);
    }
  };

  const handleSendMessage = async () => {
    if (isAdmin) {
      await sendMessage(gestorResposta);
      setGestorResposta('');
    } else {
      await sendMessage(motivoDesconto);
      setMotivoDesconto('');
    }
  };

  const getDiscountStatusBadge = () => {
    switch (discountStatus) {
      case 'PENDENTE':
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Aguardando Aprovação
          </Badge>
        );
      case 'APROVADO':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Aprovado
          </Badge>
        );
      case 'NEGADO':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Negado
          </Badge>
        );
      case 'DISPENSADO':
      default:
        if (localDesconto > 0) {
          return (
            <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Liberado
            </Badge>
          );
        }
        return null;
    }
  };

  const getDiscountBorderColor = () => {
    switch (discountLevel) {
      case 'green': return 'border-green-500/30';
      case 'yellow': return 'border-yellow-500/30';
      case 'red': return 'border-red-500/30';
    }
  };

  const getDiscountBgColor = () => {
    switch (discountLevel) {
      case 'green': return 'bg-green-500/5';
      case 'yellow': return 'bg-yellow-500/5';
      case 'red': return 'bg-red-500/5';
    }
  };

  // Calculate margin total for the existing approval system
  const margemTotal = margens.lucroPercent + margens.bdiPercent - localDesconto;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">
        {isAdmin ? 'Margens e BDI' : 'Desconto Comercial'}
      </h2>

      {/* Lucro and BDI - ADMIN ONLY - completely hidden from vendors */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="input-group">
            <Label htmlFor="lucro_percent" className="input-label">
              Lucro (%)
            </Label>
            <Input
              id="lucro_percent"
              name="lucro_percent"
              type="number"
              min={0}
              max={100}
              value={margens.lucroPercent}
              onChange={(e) => onMargensChange({ ...margens, lucroPercent: parseFloat(e.target.value) || 0 })}
            />
            {consolidado.subtotal > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                = {formatCurrency(consolidado.lucro)}
              </p>
            )}
          </div>

          <div className="input-group">
            <Label htmlFor="bdi_percent" className="input-label">
              BDI (%)
            </Label>
            <Input
              id="bdi_percent"
              name="bdi_percent"
              type="number"
              min={0}
              max={100}
              value={margens.bdiPercent}
              onChange={(e) => onMargensChange({ ...margens, bdiPercent: parseFloat(e.target.value) || 0 })}
            />
            {consolidado.subtotal > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                = {formatCurrency(consolidado.bdi)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Desconto - Vendedor editable with approval flow */}
      <div className={`rounded-xl p-5 border ${getDiscountBorderColor()} ${getDiscountBgColor()}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              discountLevel === 'green' ? 'bg-green-500/20' :
              discountLevel === 'yellow' ? 'bg-yellow-500/20' : 'bg-red-500/20'
            }`}>
              <Percent className={`w-5 h-5 ${
                discountLevel === 'green' ? 'text-green-600' :
                discountLevel === 'yellow' ? 'text-yellow-600' : 'text-red-600'
              }`} />
            </div>
            <div>
              <h3 className="font-medium text-foreground">Desconto (%)</h3>
              <p className="text-sm text-muted-foreground">
                {!requiresApproval 
                  ? 'Liberado automaticamente' 
                  : highException 
                    ? 'Alta exceção - requer aprovação' 
                    : 'Requer aprovação do Gestor'}
              </p>
            </div>
          </div>
          {getDiscountStatusBadge()}
        </div>

        {/* Discount Input */}
        <div className="flex items-center gap-4 mb-4">
          <div className="flex-1">
            <Input
              id="desconto_percent"
              name="desconto_percent"
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={localDesconto}
              onChange={(e) => handleDescontoChange(parseFloat(e.target.value) || 0)}
              disabled={!isAdmin && discountStatus === 'PENDENTE'}
              className={`text-lg font-medium ${
                discountLevel === 'green' ? 'border-green-500/50 focus:border-green-500' :
                discountLevel === 'yellow' ? 'border-yellow-500/50 focus:border-yellow-500' : 
                'border-red-500/50 focus:border-red-500'
              }`}
            />
          </div>
          {consolidado.subtotal > 0 && (
            <div className="text-right">
              <p className="text-lg font-medium text-foreground">-{formatCurrency(consolidado.desconto)}</p>
              <p className="text-sm text-muted-foreground">abatimento</p>
            </div>
          )}
        </div>

        {/* Warning Messages */}
        {requiresApproval && discountStatus !== 'APROVADO' && (
          <div className={`rounded-lg p-3 mb-4 flex items-start gap-2 ${
            highException ? 'bg-red-500/10 border border-red-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'
          }`}>
            <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${
              highException ? 'text-red-600' : 'text-yellow-600'
            }`} />
            <p className={`text-sm ${highException ? 'text-red-700' : 'text-yellow-700'}`}>
              {highException 
                ? 'Desconto alto: somente com autorização do Gestor'
                : 'Desconto acima de 5% requer aprovação do Gestor'}
            </p>
          </div>
        )}

        {/* Vendedor: Request Approval */}
        {!isAdmin && requiresApproval && discountStatus !== 'APROVADO' && discountStatus !== 'PENDENTE' && (
          <div className="space-y-3">
            <Textarea
              id="motivo_desconto"
              name="motivo_desconto"
              placeholder="Informe o motivo do desconto (mínimo 10 caracteres)..."
              value={motivoDesconto}
              onChange={(e) => setMotivoDesconto(e.target.value)}
              className="min-h-[80px]"
            />
            <Button
              type="button"
              onClick={handleRequestApproval}
              disabled={loading || motivoDesconto.length < 10 || !orcamentoId}
              className="w-full"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Solicitar Aprovação do Desconto
            </Button>
          </div>
        )}

        {/* Vendedor: Waiting for approval */}
        {!isAdmin && discountStatus === 'PENDENTE' && (
          <div className="text-center py-4">
            <Clock className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
            <p className="text-muted-foreground">Aguardando resposta do Gestor...</p>
          </div>
        )}

        {/* Messages Thread */}
        {discountMessages.length > 0 && (
          <div className="mt-4 space-y-3">
            <Separator />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="w-4 h-4" />
              <span>Histórico de mensagens</span>
            </div>
            <ScrollArea className="h-[150px] border border-border rounded-lg p-3 bg-background/50">
              {discountMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_role === 'GESTOR' ? 'justify-start' : 'justify-end'} mb-2`}
                >
                  <div
                    className={`max-w-[80%] rounded-xl px-3 py-2 ${
                      msg.sender_role === 'GESTOR'
                        ? 'bg-accent text-foreground rounded-bl-sm'
                        : 'bg-primary text-primary-foreground rounded-br-sm'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-medium ${
                        msg.sender_role === 'GESTOR' ? 'text-muted-foreground' : 'text-primary-foreground/80'
                      }`}>
                        {msg.sender_role === 'GESTOR' ? '🛡️ Gestor' : '👤 Vendedor'}
                      </span>
                      <span className={`text-xs ${
                        msg.sender_role === 'GESTOR' ? 'text-muted-foreground' : 'text-primary-foreground/60'
                      }`}>
                        {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </ScrollArea>
          </div>
        )}

        {/* Admin: Respond to discount request */}
        {isAdmin && discountStatus === 'PENDENTE' && (
          <div className="mt-4 space-y-3">
            <Separator />
            <div className="bg-card border border-border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-primary" />
                <span className="font-medium">Resposta do Gestor</span>
              </div>
              <Textarea
                id="gestor_resposta"
                name="gestor_resposta"
                placeholder="Informe sua decisão e orientações..."
                value={gestorResposta}
                onChange={(e) => setGestorResposta(e.target.value)}
                className="min-h-[80px] mb-3"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSendMessage}
                  disabled={loading || !gestorResposta.trim()}
                  className="flex-1"
                >
                  <Send className="w-4 h-4 mr-2" />
                  Enviar Mensagem
                </Button>
              </div>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDeny}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                  Negar (volta p/ 5%)
                </Button>
                <Button
                  type="button"
                  onClick={handleApprove}
                  disabled={loading}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Aprovar Desconto
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Follow-up messages for vendedor */}
        {!isAdmin && (discountStatus === 'PENDENTE' || discountStatus === 'NEGADO') && discountMessages.length > 0 && (
          <div className="mt-3 space-y-2">
            <Textarea
              id="vendedor_followup"
              name="vendedor_followup"
              placeholder="Adicionar mensagem..."
              value={motivoDesconto}
              onChange={(e) => setMotivoDesconto(e.target.value)}
              className="min-h-[60px]"
            />
            <Button
              type="button"
              variant="outline"
              onClick={handleSendMessage}
              disabled={loading || !motivoDesconto.trim()}
              className="w-full"
            >
              <Send className="w-4 h-4 mr-2" />
              Enviar Mensagem
            </Button>
          </div>
        )}
      </div>

      {/* Summary - Margin Total - ADMIN ONLY for margin details */}
      {consolidado.subtotal > 0 && isAdmin && (
        <div className={`rounded-lg p-4 flex items-center gap-3 ${
          margemTotal < 15 
            ? 'bg-amber-500/10 border border-amber-500/30' 
            : 'bg-primary/10 border border-primary/30'
        }`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            margemTotal < 15 ? 'bg-amber-500/20' : 'bg-primary/20'
          }`}>
            <Percent className={`w-5 h-5 ${
              margemTotal < 15 ? 'text-amber-600' : 'text-primary'
            }`} />
          </div>
          <div className="flex-1">
            <p className="font-medium">Margem Total: {margemTotal.toFixed(1)}%</p>
            {margemTotal < 15 && (
              <p className="text-sm text-amber-600">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                Margem abaixo de 15% requer aprovação do Gestor
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-foreground">{formatCurrency(consolidado.totalVenda)}</p>
            <p className="text-sm text-muted-foreground">Total Final</p>
          </div>
        </div>
      )}

      {/* Vendor: Show only total without margin details */}
      {consolidado.subtotal > 0 && !isAdmin && (
        <div className="rounded-lg p-4 flex items-center gap-3 bg-primary/10 border border-primary/30">
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/20">
            <Percent className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">Valor do Orçamento</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-foreground">{formatCurrency(consolidado.totalVenda)}</p>
            <p className="text-sm text-muted-foreground">Total Final</p>
          </div>
        </div>
      )}

      {/* Proposal Generation Status */}
      {!canGenerateProposal && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 flex items-start gap-3">
          <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-700">Proposta necessita de aprovação</p>
            <p className="text-sm text-amber-600/80 mt-1">
              {discountStatus === 'PENDENTE'
                ? 'Aguardando aprovação do desconto pelo Gestor.'
                : 'O desconto solicitado requer aprovação para gerar a proposta comercial.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
