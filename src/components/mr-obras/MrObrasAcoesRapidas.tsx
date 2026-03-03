import { Calculator, FileText, Upload, Pencil, Plus, Building2, BarChart3, RefreshCw, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface MrObrasAcoesRapidasProps {
  orcamentoId: string | null;
  hasPavimentos: boolean;
  onAction: (actionId: string) => void;
}

interface AcaoRapida {
  id: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  requiresOrcamento?: boolean;
  category: string;
}

const ACOES: AcaoRapida[] = [
  // Cálculos
  { id: 'recalcular_tudo', label: 'Recalcular tudo', icon: <Calculator className="h-4 w-4" />, category: 'Cálculos', requiresOrcamento: true },
  { id: 'calcular_predio', label: 'Calcular tudo (prédio)', icon: <Building2 className="h-4 w-4" />, category: 'Cálculos', requiresOrcamento: true },

  // Importação
  { id: 'reimportar_pdf', label: 'Reimportar PDF ativo', icon: <Upload className="h-4 w-4" />, category: 'Importação', requiresOrcamento: true },
  { id: 'modo_manual', label: 'Trocar para modo manual', icon: <Pencil className="h-4 w-4" />, category: 'Importação', requiresOrcamento: true },

  // Pavimentos / Laje
  { id: 'adicionar_pavimento', label: 'Adicionar pavimento', icon: <Plus className="h-4 w-4" />, category: 'Estrutura', requiresOrcamento: true },
  { id: 'adicionar_laje', label: 'Adicionar laje igual', icon: <Plus className="h-4 w-4" />, category: 'Estrutura', requiresOrcamento: true },

  // Relatórios
  { id: 'gerar_proposta', label: 'Gerar Proposta (cliente)', icon: <FileText className="h-4 w-4" />, category: 'Relatórios', requiresOrcamento: true },
  { id: 'gerar_relatorio_admin', label: 'Gerar Relatório Detalhado', icon: <BarChart3 className="h-4 w-4" />, category: 'Relatórios', adminOnly: true, requiresOrcamento: true },

  // Admin
  { id: 'atualizar_cub', label: 'Atualizar CUB-PA', icon: <RefreshCw className="h-4 w-4" />, category: 'Administração', adminOnly: true },
  { id: 'ver_anexos', label: 'Ver anexos do orçamento', icon: <FolderOpen className="h-4 w-4" />, category: 'Administração', adminOnly: true, requiresOrcamento: true },
];

export function MrObrasAcoesRapidas({ orcamentoId, hasPavimentos, onAction }: MrObrasAcoesRapidasProps) {
  const { isAdmin } = useAuth();

  const acoesVisiveis = ACOES.filter(a => {
    if (a.adminOnly && !isAdmin) return false;
    if (a.id === 'calcular_predio' && !hasPavimentos) return false;
    return true;
  });

  const categories = [...new Set(acoesVisiveis.map(a => a.category))];

  return (
    <ScrollArea className="h-full p-3">
      <div className="space-y-4">
        {!orcamentoId && (
          <div className="text-sm text-muted-foreground text-center py-4">
            Abra um orçamento para habilitar as ações rápidas.
          </div>
        )}

        {categories.map((cat) => (
          <div key={cat}>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{cat}</h4>
            <div className="space-y-1">
              {acoesVisiveis
                .filter(a => a.category === cat)
                .map((acao) => (
                  <Button
                    key={acao.id}
                    variant="ghost"
                    className="w-full justify-start text-sm h-9"
                    disabled={acao.requiresOrcamento && !orcamentoId}
                    onClick={() => onAction(acao.id)}
                  >
                    {acao.icon}
                    <span className="ml-2">{acao.label}</span>
                  </Button>
                ))}
            </div>
            <Separator className="mt-3" />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
