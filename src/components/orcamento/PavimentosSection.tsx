import { useState, useRef } from 'react';
import { Plus, Copy, Trash2, Upload, Loader2, CheckCircle2, XCircle, Clock, Building2, ChevronDown, ChevronUp, Calculator, ArrowDownToLine, Star, Pencil, Eye } from 'lucide-react';
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
import { ConfirmarMedidasModal, MedidasConfirmadas } from './ConfirmarMedidasModal';

interface PavimentosSectionProps {
  pavimentos: Pavimento[];
  autoImport: boolean;
  onAutoImportChange: (v: boolean) => void;
  pavimentoTipo: Pavimento | undefined;
  pendingConfirmation: string | null;
  onSetPendingConfirmation: (id: string | null) => void;
  onAdd: (nome: string, tipo?: 'NORMAL' | 'TIPO') => Promise<any>;
  onUpdate: (id: string, updates: Partial<Pavimento>) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onDuplicate: (id: string) => Promise<any>;
  onExtract: (id: string, file: File) => Promise<boolean>;
  onConfirmMedidas: (id: string, medidas: MedidasConfirmadas) => Promise<any>;
  onOpenManualEntry: (id: string) => void;
  onCopyFromTipo: (id: string) => Promise<boolean>;
  onCalculateAll: () => Promise<{ results: any[]; totalGeralPredio: number; pendentes: string[] }>;
  disabled?: boolean;
}

const STATUS_CONFIG = {
  PENDENTE: { label: 'Pendente', icon: Clock, variant: 'secondary' as const, color: '' },
  PROCESSANDO: { label: 'Processando...', icon: Loader2, variant: 'default' as const, color: '' },
  AGUARDANDO_CONFIRMACAO: { label: 'Aguardando confirmação', icon: Eye, variant: 'default' as const, color: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  SUCESSO: { label: 'Confirmado', icon: CheckCircle2, variant: 'default' as const, color: 'bg-green-500/10 text-green-700 border-green-500/20' },
  ERRO: { label: 'Erro', icon: XCircle, variant: 'destructive' as const, color: '' },
};

const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const formatNumber = (v: number, d = 2) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

export function PavimentosSection({
  pavimentos,
  autoImport,
  onAutoImportChange,
  pavimentoTipo,
  pendingConfirmation,
  onSetPendingConfirmation,
  onAdd,
  onUpdate,
  onRemove,
  onDuplicate,
  onExtract,
  onConfirmMedidas,
  onOpenManualEntry,
  onCopyFromTipo,
  onCalculateAll,
  disabled,
}: PavimentosSectionProps) {
  const [newName, setNewName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [buildingResults, setBuildingResults] = useState<any[] | null>(null);
  const [buildingTotal, setBuildingTotal] = useState(0);
  const [showPendingAlert, setShowPendingAlert] = useState(false);
  const [pendingNames, setPendingNames] = useState<string[]>([]);
  const [calculatingAll, setCalculatingAll] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const pendingPav = pendingConfirmation ? pavimentos.find(p => p.id === pendingConfirmation) : null;

  const handleAdd = async (tipo: 'NORMAL' | 'TIPO' = 'NORMAL') => {
    const defaultName = tipo === 'TIPO' 
      ? 'Pavimento Tipo' 
      : `Pavimento ${pavimentos.length + 1}`;
    const name = newName.trim() || defaultName;
    await onAdd(name, tipo);
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

  const handleCalculateAll = async () => {
    setCalculatingAll(true);
    try {
      const { results, totalGeralPredio, pendentes } = await onCalculateAll();
      if (pendentes.length > 0) {
        setPendingNames(pendentes);
        setShowPendingAlert(true);
      }
      setBuildingResults(results);
      setBuildingTotal(totalGeralPredio);
    } finally {
      setCalculatingAll(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Pavimentos do Prédio</CardTitle>
        </div>
        <CardDescription>
          Gerencie pavimentos individuais. Cada um pode ter sua planta e multiplicador.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Top controls */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <Label className="text-sm">Nome do pavimento</Label>
            <Input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={`Pavimento ${pavimentos.length + 1}`}
              disabled={disabled}
            />
          </div>
          <Button onClick={() => handleAdd('NORMAL')} disabled={disabled} size="sm" className="gap-1">
            <Plus className="w-4 h-4" />
            Adicionar
          </Button>
          <Button onClick={() => handleAdd('TIPO')} disabled={disabled} size="sm" variant="outline" className="gap-1">
            <Star className="w-4 h-4" />
            Pavimento Tipo
          </Button>
        </div>

        {/* Toggle + Calculate all */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-2">
            <Switch checked={autoImport} onCheckedChange={onAutoImportChange} />
            <span className="text-sm">Auto-importar ao enviar</span>
          </div>
          {pavimentos.length > 0 && (
            <Button onClick={handleCalculateAll} disabled={disabled || calculatingAll} size="sm" className="gap-1">
              {calculatingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
              Calcular tudo (Prédio)
            </Button>
          )}
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
          const isTipo = pav.tipo === 'TIPO';
          const canCopyFromTipo = !isTipo && pavimentoTipo && (pav.status === 'ERRO' || pav.status === 'PENDENTE');
          const medidas = pav.medidas_confirmadas || pav.medidas_json;
          const resultado = pav.resultado_paredes;

          return (
            <Collapsible key={pav.id} open={isExpanded} onOpenChange={() => toggleExpand(pav.id)}>
              <div className={`border rounded-lg overflow-hidden ${isTipo ? 'border-primary/40 bg-primary/5' : ''}`}>
                {/* Header */}
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{pav.nome}</span>
                      {isTipo && (
                        <Badge className="text-xs bg-primary/20 text-primary border-primary/30">
                          <Star className="w-3 h-3 mr-1" />TIPO
                        </Badge>
                      )}
                      {pav.multiplicador > 1 && <Badge variant="outline" className="text-xs">×{pav.multiplicador}</Badge>}
                      <Badge variant={statusCfg.variant} className={`text-xs gap-1 ${statusCfg.color}`}>
                        <StatusIcon className={`w-3 h-3 ${pav.status === 'PROCESSANDO' ? 'animate-spin' : ''}`} />
                        {statusCfg.label}
                      </Badge>
                      {resultado && (
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(resultado.custo_paredes)}
                          {pav.multiplicador > 1 && ` × ${pav.multiplicador}`}
                        </span>
                      )}
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
                        <Input value={pav.nome} onChange={e => onUpdate(pav.id, { nome: e.target.value })} disabled={disabled} />
                      </div>
                      <div>
                        <Label className="text-xs">Multiplicador (repetições)</Label>
                        <Input
                          type="number" min={1} max={50} value={pav.multiplicador}
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

                    {/* Flags */}
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
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        className="hidden"
                        ref={el => { fileInputRefs.current[pav.id] = el; }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(pav.id, file);
                          e.target.value = '';
                        }}
                      />
                      <Button
                        variant="outline" size="sm" className="gap-1"
                        onClick={() => fileInputRefs.current[pav.id]?.click()}
                        disabled={disabled || pav.status === 'PROCESSANDO'}
                      >
                        <Upload className="w-4 h-4" />
                        {pav.pdf_arquivo_id ? 'Reimportar PDF' : 'Enviar PDF/Imagem'}
                      </Button>

                      {pav.status === 'AGUARDANDO_CONFIRMACAO' && (
                        <Button
                          variant="outline" size="sm" className="gap-1 border-amber-500/40 text-amber-700 hover:bg-amber-50"
                          onClick={() => onSetPendingConfirmation(pav.id)}
                        >
                          <Pencil className="w-4 h-4" />
                          Confirmar Medidas
                        </Button>
                      )}

                      {(pav.status === 'ERRO' || pav.status === 'PENDENTE') && (
                        <Button
                          variant="outline" size="sm" className="gap-1"
                          onClick={() => onOpenManualEntry(pav.id)}
                        >
                          <Pencil className="w-4 h-4" />
                          Preencher manual
                        </Button>
                      )}

                      {canCopyFromTipo && (
                        <Button
                          variant="outline" size="sm"
                          className="gap-1 border-primary/40 text-primary hover:bg-primary/10"
                          onClick={() => onCopyFromTipo(pav.id)}
                          disabled={disabled}
                        >
                          <ArrowDownToLine className="w-4 h-4" />
                          Usar medidas do Tipo
                        </Button>
                      )}
                    </div>

                    {/* Measurement summary */}
                    {medidas && pav.status === 'SUCESSO' && (
                      <div className="bg-muted/40 rounded-lg p-3 space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Medidas Confirmadas</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Perímetro ext.:</span>{' '}
                            <span className="font-medium">{formatNumber(medidas.perimetro_externo_m || 0)} m</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Paredes int.:</span>{' '}
                            <span className="font-medium">{formatNumber(medidas.paredes_internas_m || 0)} m</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Altura:</span>{' '}
                            <span className="font-medium">{formatNumber(medidas.altura_paredes_m || medidas.pe_direito_m || 2.7)} m</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Aberturas:</span>{' '}
                            <span className="font-medium">{formatNumber(medidas.aberturas_m2 || 0)} m²</span>
                          </div>
                        </div>
                        {resultado && (
                          <div className="pt-2 border-t border-muted-foreground/10">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Área líquida paredes:</span>
                              <span className="font-medium">{formatNumber(resultado.area_liquida_m2)} m²</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Custo paredes (unitário):</span>
                              <span className="font-medium">{formatCurrency(resultado.custo_paredes)}</span>
                            </div>
                            {pav.multiplicador > 1 && (
                              <div className="flex justify-between text-sm font-semibold text-primary">
                                <span>Total (×{pav.multiplicador}):</span>
                                <span>{formatCurrency(resultado.custo_paredes * pav.multiplicador)}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => onDuplicate(pav.id)} disabled={disabled}>
                        <Copy className="w-4 h-4" />Duplicar
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="gap-1 text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(pav.id)} disabled={disabled}
                      >
                        <Trash2 className="w-4 h-4" />Remover
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}

        {/* Building total table */}
        {buildingResults && buildingResults.length > 0 && (
          <div className="bg-primary/5 rounded-lg p-4 border border-primary/20 space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4 text-primary" />
              Resumo do Prédio
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="pb-2">Pavimento</th>
                    <th className="pb-2">Tipo</th>
                    <th className="pb-2 text-center">Mult</th>
                    <th className="pb-2 text-right">Área Paredes</th>
                    <th className="pb-2 text-right">Total Unit.</th>
                    <th className="pb-2 text-right">Total Final</th>
                  </tr>
                </thead>
                <tbody>
                  {buildingResults.map(r => (
                    <tr key={r.pavimento_id} className="border-b border-muted/30">
                      <td className="py-2">{r.nome}</td>
                      <td className="py-2">
                        {r.tipo === 'TIPO' ? (
                          <Badge className="text-xs bg-primary/20 text-primary border-primary/30">TIPO</Badge>
                        ) : <span className="text-muted-foreground text-xs">Normal</span>}
                      </td>
                      <td className="py-2 text-center">{r.multiplicador}×</td>
                      <td className="py-2 text-right">
                        {r.paredes ? `${formatNumber(r.paredes.area_liquida_m2)} m²` : '—'}
                      </td>
                      <td className="py-2 text-right">
                        {r.status === 'OK' ? formatCurrency(r.total_unitario) : (
                          <span className="text-destructive text-xs">{r.status}</span>
                        )}
                      </td>
                      <td className="py-2 text-right font-medium">
                        {r.status === 'OK' ? formatCurrency(r.total_final) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold text-primary">
                    <td colSpan={5} className="pt-3 text-right">TOTAL PRÉDIO:</td>
                    <td className="pt-3 text-right">{formatCurrency(buildingTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {pendingPav && (
          <ConfirmarMedidasModal
            open={!!pendingConfirmation}
            onOpenChange={(open) => { if (!open) onSetPendingConfirmation(null); }}
            pavimentoNome={pendingPav.nome}
            medidasExtraidas={pendingPav.medidas_extraidas || pendingPav.medidas_json}
            confianca={pendingPav.medidas_extraidas?.confianca || pendingPav.medidas_json?.confianca}
            observacoes={pendingPav.medidas_extraidas?.observacoes || pendingPav.medidas_json?.observacoes}
            onConfirm={(medidas) => onConfirmMedidas(pendingPav.id, medidas)}
            onCancel={() => onSetPendingConfirmation(null)}
          />
        )}

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

        {/* Pending floors alert */}
        <AlertDialog open={showPendingAlert} onOpenChange={setShowPendingAlert}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Pavimentos sem medidas</AlertDialogTitle>
              <AlertDialogDescription>
                Os seguintes pavimentos não têm medidas confirmadas e serão ignorados:{' '}
                <strong>{pendingNames.join(', ')}</strong>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => setShowPendingAlert(false)}>Calcular válidos</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
