import { useState, useRef } from 'react';
import { Plus, Copy, Trash2, Upload, Loader2, CheckCircle2, XCircle, Clock, Building2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Pavimento } from '@/hooks/usePavimentos';

interface PavimentosSectionProps {
  pavimentos: Pavimento[];
  onAdd: (nome: string) => Promise<any>;
  onUpdate: (id: string, updates: Partial<Pavimento>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<any>;
  onExtract: (id: string, file: File) => Promise<boolean>;
  disabled?: boolean;
}

const STATUS_CONFIG = {
  PENDENTE: { label: 'Pendente', icon: Clock, variant: 'secondary' as const },
  PROCESSANDO: { label: 'Processando...', icon: Loader2, variant: 'default' as const },
  SUCESSO: { label: 'Sucesso', icon: CheckCircle2, variant: 'default' as const },
  ERRO: { label: 'Erro', icon: XCircle, variant: 'destructive' as const },
};

export function PavimentosSection({
  pavimentos,
  onAdd,
  onUpdate,
  onRemove,
  onDuplicate,
  onExtract,
  disabled,
}: PavimentosSectionProps) {
  const [newName, setNewName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleAdd = async () => {
    const name = newName.trim() || `Pavimento ${pavimentos.length + 1}`;
    await onAdd(name);
    setNewName('');
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleFileUpload = async (pavId: string, file: File) => {
    await onExtract(pavId, file);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Pavimentos do Prédio</CardTitle>
        </div>
        <CardDescription>
          Adicione pavimentos para calcular separadamente. Cada pavimento pode ter sua própria planta e multiplicador.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label className="text-sm">Nome do pavimento</Label>
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={`Pavimento ${pavimentos.length + 1}`}
              disabled={disabled}
            />
          </div>
          <Button onClick={handleAdd} disabled={disabled} size="sm" className="gap-1">
            <Plus className="w-4 h-4" />
            Adicionar
          </Button>
        </div>

        {/* List */}
        {pavimentos.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm border border-dashed rounded-lg">
            Nenhum pavimento adicionado. Para orçamentos de casa simples, não é necessário adicionar pavimentos.
          </div>
        )}

        {pavimentos.map(pav => {
          const statusCfg = STATUS_CONFIG[pav.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.PENDENTE;
          const StatusIcon = statusCfg.icon;
          const isExpanded = expandedIds.has(pav.id);

          return (
            <Collapsible key={pav.id} open={isExpanded} onOpenChange={() => toggleExpand(pav.id)}>
              <div className="border rounded-lg overflow-hidden">
                {/* Header */}
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{pav.nome}</span>
                      {pav.multiplicador > 1 && (
                        <Badge variant="outline" className="text-xs">
                          ×{pav.multiplicador}
                        </Badge>
                      )}
                      <Badge variant={statusCfg.variant} className="text-xs gap-1">
                        <StatusIcon className={`w-3 h-3 ${pav.status === 'PROCESSANDO' ? 'animate-spin' : ''}`} />
                        {statusCfg.label}
                      </Badge>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </CollapsibleTrigger>

                {/* Content */}
                <CollapsibleContent>
                  <div className="p-4 pt-0 space-y-4 border-t">
                    {/* Nome + Multiplicador */}
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <Label className="text-xs">Nome</Label>
                        <Input
                          value={pav.nome}
                          onChange={e => onUpdate(pav.id, { nome: e.target.value })}
                          disabled={disabled}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Multiplicador (repetições)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          value={pav.multiplicador}
                          onChange={e => onUpdate(pav.id, { multiplicador: Math.max(1, Math.min(50, parseInt(e.target.value) || 1)) })}
                          disabled={disabled}
                        />
                        {pav.multiplicador > 1 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Este pavimento será considerado {pav.multiplicador} vezes no total.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Flags de inclusão */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { key: 'includes_fundacao', label: 'Fundação' },
                        { key: 'includes_laje', label: 'Laje' },
                        { key: 'includes_reboco', label: 'Reboco' },
                        { key: 'includes_revestimento', label: 'Revestimento' },
                        { key: 'includes_portas', label: 'Portas' },
                        { key: 'includes_portoes', label: 'Portões' },
                      ].map(flag => (
                        <div key={flag.key} className="flex items-center gap-2">
                          <Switch
                            checked={(pav as any)[flag.key] ?? true}
                            onCheckedChange={checked => onUpdate(pav.id, { [flag.key]: checked } as any)}
                            disabled={disabled}
                          />
                          <span className="text-sm">{flag.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Upload */}
                    <div>
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        ref={el => { fileInputRefs.current[pav.id] = el; }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(pav.id, file);
                          e.target.value = '';
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => fileInputRefs.current[pav.id]?.click()}
                        disabled={disabled || pav.status === 'PROCESSANDO'}
                      >
                        <Upload className="w-4 h-4" />
                        {pav.pdf_arquivo_id ? 'Reimportar PDF' : 'Enviar PDF'}
                      </Button>
                      {pav.medidas_json && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Área: {pav.medidas_json.area_total_m2}m² | Confiança: {pav.medidas_json.confianca}%
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1"
                        onClick={() => onDuplicate(pav.id)}
                        disabled={disabled}
                      >
                        <Copy className="w-4 h-4" />
                        Duplicar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(pav.id)}
                        disabled={disabled}
                      >
                        <Trash2 className="w-4 h-4" />
                        Remover
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}

        {/* Delete confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover pavimento?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso removerá o pavimento e suas medidas extraídas. Os cálculos serão atualizados.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => { if (deleteId) { onRemove(deleteId); setDeleteId(null); } }}>
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
