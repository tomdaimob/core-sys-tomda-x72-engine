import { useState } from 'react';
import { HardHat, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useMrObrasContext } from '@/hooks/useMrObrasContext';
import { useAuth } from '@/contexts/AuthContext';
import { MrObrasChat } from './MrObrasChat';
import { MrObrasAcoesRapidas } from './MrObrasAcoesRapidas';
import { registrarAuditoria } from '@/lib/mr-obras-audit';
import { toast } from 'sonner';

interface MrObrasAssistenteProps {
  orcamentoId?: string | null;
}

export function MrObrasAssistente({ orcamentoId }: MrObrasAssistenteProps) {
  const [open, setOpen] = useState(false);
  const { user, isAdmin } = useAuth();
  const ctx = useMrObrasContext(orcamentoId || null);

  const handleAction = async (actionId: string, params?: Record<string, any>) => {
    if (!orcamentoId || !user) {
      toast.info('Abra um orçamento para executar ações.');
      return;
    }

    // Log audit
    await registrarAuditoria({
      orcamento_id: orcamentoId,
      user_id: user.id,
      user_role: isAdmin ? 'ADMIN' : 'VENDEDOR',
      action: actionId.toUpperCase(),
      message: `Ação executada via Mr. Obras: ${actionId}`,
    });

    switch (actionId) {
      case 'recalcular_tudo':
        toast.info('Para recalcular, use o botão "Salvar" no orçamento. Os cálculos são atualizados automaticamente.');
        break;
      case 'calcular_predio':
        toast.info('Para calcular o prédio completo, use o botão "Calcular tudo" na seção de Pavimentos.');
        break;
      case 'reimportar_pdf':
        toast.info('Para reimportar o PDF, acesse a aba "Projeto" e faça upload novamente.');
        break;
      case 'modo_manual':
        toast.info('Para trocar para modo manual, acesse a aba "Projeto" e selecione "Manual" no seletor de modo.');
        break;
      case 'adicionar_pavimento':
        toast.info('Para adicionar pavimento, acesse a aba "Paredes" e use o botão "Adicionar Pavimento".');
        break;
      case 'adicionar_laje':
        toast.info('Para adicionar laje, acesse a aba "Laje" e clique em "Adicionar Laje".');
        break;
      case 'gerar_proposta':
        toast.info('Para gerar a Proposta Comercial, acesse a aba "Relatórios" no orçamento.');
        break;
      case 'gerar_relatorio_admin':
        if (!isAdmin) {
          toast.error('Essa ação requer permissão do Gestor.');
          return;
        }
        toast.info('Para gerar o Relatório Detalhado, acesse a aba "Relatórios" no orçamento.');
        break;
      case 'atualizar_cub':
        if (!isAdmin) {
          toast.error('Essa ação requer permissão do Gestor.');
          return;
        }
        toast.info('Para atualizar o CUB-PA, acesse Configurações > Indicadores.');
        break;
      case 'ver_anexos':
        toast.info('Os anexos estão disponíveis na aba "Relatórios" do orçamento.');
        break;
      case 'solicitar_gestor':
        toast.info('Entre em contato com o Gestor para solicitar esta alteração.');
        break;
      default:
        toast.info(`Ação "${actionId}" será implementada em breve.`);
    }
  };

  return (
    <>
      {/* FAB Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-primary text-primary-foreground rounded-full px-5 py-3 shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
        >
          <HardHat className="h-5 w-5" />
          <span className="font-medium text-sm">Mr. Obras</span>
        </button>
      )}

      {/* Drawer Panel */}
      {open && (
        <div className="fixed bottom-0 right-0 z-50 w-full sm:w-[420px] h-[85vh] sm:h-[70vh] sm:bottom-4 sm:right-4 bg-background border rounded-t-xl sm:rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-2">
              <HardHat className="h-5 w-5 text-primary" />
              <span className="font-semibold text-sm">Mr. Obras Assistente</span>
            </div>
            <div className="flex items-center gap-2">
              {ctx.orcamento && (
                <Badge variant="outline" className="text-xs">
                  {ctx.orcamento.codigo}
                </Badge>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Context info */}
          {ctx.orcamento && (
            <div className="px-4 py-2 bg-muted/20 border-b text-xs text-muted-foreground">
              <span className="font-medium">{ctx.orcamento.cliente}</span>
              {ctx.pavimentos.length > 0 && (
                <span> • {ctx.pavimentos.length} pavimento(s)</span>
              )}
              <span> • {ctx.orcamento.status}</span>
            </div>
          )}

          {/* Tabs */}
          <Tabs defaultValue="chat" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-4 mt-2 grid grid-cols-2">
              <TabsTrigger value="chat" className="text-xs">💬 Chat</TabsTrigger>
              <TabsTrigger value="acoes" className="text-xs">⚡ Ações Rápidas</TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="flex-1 overflow-hidden mt-0">
              <MrObrasChat
                orcamentoId={orcamentoId || null}
                inputs={ctx.inputs}
                resultados={ctx.resultados}
                orcamento={ctx.orcamento}
                onAction={handleAction}
              />
            </TabsContent>

            <TabsContent value="acoes" className="flex-1 overflow-hidden mt-0">
              <MrObrasAcoesRapidas
                orcamentoId={orcamentoId || null}
                hasPavimentos={ctx.pavimentos.length > 0}
                onAction={handleAction}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </>
  );
}
