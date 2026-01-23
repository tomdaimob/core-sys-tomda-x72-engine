import { useState, useCallback, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  DoorOpen,
  Warehouse,
  Upload,
  FileText,
  X,
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ChevronDown,
  Lock
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/orcamento-calculos';
import { usePortasPortoesIA, PortasPortoesExtractionResult } from '@/hooks/usePortasPortoesIA';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// Types
export type TipoMaterialPorta = 'MADEIRA' | 'ALUMINIO';
export type TipoMaterialPortao = 'FERRO' | 'ALUMINIO';

export interface PortasPortoesInput {
  areaPortasM2: number;
  areaPortoesM2: number;
  materialPorta: TipoMaterialPorta;
  materialPortao: TipoMaterialPortao;
  // Flag to indicate if data came from AI
  fromAI?: boolean;
  // Individual items for detail display
  portasItems?: Array<{ label: string; width_m: number; height_m: number; area_m2: number }>;
  portoesItems?: Array<{ label: string; width_m: number; height_m: number; area_m2: number }>;
}

export interface ResultadoPortasPortoes {
  areaPortasM2: number;
  areaPortoesM2: number;
  materialPorta: TipoMaterialPorta;
  materialPortao: TipoMaterialPortao;
  precoPortaM2: number;
  precoPortaoM2: number;
  custoPortas: number;
  custoPortoes: number;
  custoTotal: number;
}

export interface PrecosPortasPortoes {
  portaMadeiraM2: number;
  portaAluminioM2: number;
  portaoFerroM2: number;
  portaoAluminioM2: number;
}

// Default values
export const DEFAULT_PORTAS_PORTOES: PortasPortoesInput = {
  areaPortasM2: 0,
  areaPortoesM2: 0,
  materialPorta: 'MADEIRA',
  materialPortao: 'FERRO',
  fromAI: false,
};

// Calculate function
export function calcularPortasPortoesResultado(
  input: PortasPortoesInput,
  precos: PrecosPortasPortoes
): ResultadoPortasPortoes {
  const precoPortaM2 = input.materialPorta === 'MADEIRA' 
    ? precos.portaMadeiraM2 
    : precos.portaAluminioM2;
  
  const precoPortaoM2 = input.materialPortao === 'FERRO' 
    ? precos.portaoFerroM2 
    : precos.portaoAluminioM2;
  
  const custoPortas = input.areaPortasM2 * precoPortaM2;
  const custoPortoes = input.areaPortoesM2 * precoPortaoM2;
  const custoTotal = custoPortas + custoPortoes;
  
  return {
    areaPortasM2: input.areaPortasM2,
    areaPortoesM2: input.areaPortoesM2,
    materialPorta: input.materialPorta,
    materialPortao: input.materialPortao,
    precoPortaM2,
    precoPortaoM2,
    custoPortas,
    custoPortoes,
    custoTotal,
  };
}

interface PortasPortoesFormProps {
  portasPortoes: PortasPortoesInput;
  onPortasPortoesChange: (data: PortasPortoesInput) => void;
  precos: PrecosPortasPortoes;
  resultado: ResultadoPortasPortoes;
  orcamentoId?: string | null;
  tipoProposta: 'parede_cinza' | 'obra_completa';
}

export function PortasPortoesForm({
  portasPortoes,
  onPortasPortoesChange,
  precos,
  resultado,
  orcamentoId,
  tipoProposta,
}: PortasPortoesFormProps) {
  const { isAdmin } = useAuth();
  const { extractedData, extracting, extractFromPdf, hasExtracao, clearExtracao } = usePortasPortoesIA(orcamentoId);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [portasOpen, setPortasOpen] = useState(false);
  const [portoesOpen, setPortoesOpen] = useState(false);

  // Auto-populate from extraction when available
  useEffect(() => {
    if (extractedData && !portasPortoes.fromAI) {
      onPortasPortoesChange({
        ...portasPortoes,
        areaPortasM2: extractedData.doors.area_total_m2,
        areaPortoesM2: extractedData.gates.area_total_m2,
        portasItems: extractedData.doors.items,
        portoesItems: extractedData.gates.items,
        fromAI: true,
      });
    }
  }, [extractedData]);

  // Check if disabled (parede cinza)
  const isDisabled = tipoProposta === 'parede_cinza';

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files?.[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile);
      }
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleExtractFromPdf = async () => {
    if (!file) return;
    
    const result = await extractFromPdf(file);
    if (result) {
      onPortasPortoesChange({
        ...portasPortoes,
        areaPortasM2: result.doors.area_total_m2,
        areaPortoesM2: result.gates.area_total_m2,
        portasItems: result.doors.items,
        portoesItems: result.gates.items,
        fromAI: true,
      });
      
      setFile(null);
    }
  };

  const handleClearData = () => {
    clearExtracao();
    onPortasPortoesChange(DEFAULT_PORTAS_PORTOES);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const hasAIData = portasPortoes.fromAI;

  // Render disabled state for parede cinza
  if (isDisabled) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Portas e Portões</h2>
        </div>
        
        <div className="flex items-center gap-4 p-8 bg-muted/50 rounded-xl border border-dashed text-center justify-center">
          <Lock className="w-8 h-8 text-muted-foreground" />
          <div>
            <p className="font-medium text-muted-foreground">Disponível apenas na modalidade Obra Completa</p>
            <p className="text-sm text-muted-foreground mt-1">
              Altere o tipo de proposta para "Obra Completa" para habilitar esta etapa.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Portas e Portões</h2>
        {hasAIData && (
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="w-3 h-3" />
            Medidas do PDF
          </Badge>
        )}
      </div>

      {/* PDF Upload Section - Only show if no AI data */}
      {!hasAIData && (
        <div className="space-y-4">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={cn(
              'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200',
              dragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50 hover:bg-muted/30',
              file && 'border-primary/30 bg-primary/5'
            )}
          >
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={extracting}
            />
            
            {!file ? (
              <div className="space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <p className="text-foreground font-medium">
                    Arraste a planta PDF aqui
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    ou clique para selecionar
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  A IA irá identificar automaticamente portas e portões do projeto
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-red-100 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-foreground truncate max-w-[200px]">
                      {file.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.preventDefault();
                    setFile(null);
                  }}
                  disabled={extracting}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            )}
          </div>

          {/* Extract Button */}
          {file && (
            <Button
              onClick={handleExtractFromPdf}
              disabled={extracting || !orcamentoId}
              className="w-full gap-2"
            >
              {extracting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Identificando portas e portões...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Importar do PDF
                </>
              )}
            </Button>
          )}

          {!orcamentoId && (
            <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>Salve o orçamento antes de importar medidas do PDF.</p>
            </div>
          )}
        </div>
      )}

      {/* AI Data Indicator and Reset */}
      {hasAIData && (
        <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <div>
              <p className="font-medium text-green-700">Dados extraídos do PDF</p>
              <p className="text-sm text-green-600/80">
                {portasPortoes.portasItems?.length || 0} porta(s) e {portasPortoes.portoesItems?.length || 0} portão(ões)
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearData}
              className="border-green-500/30 text-green-700 hover:bg-green-500/10"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Reimportar
            </Button>
          )}
        </div>
      )}

      {/* Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD A: PORTAS */}
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                <DoorOpen className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">Portas</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Área total: <span className="font-semibold text-foreground">{formatNumber(portasPortoes.areaPortasM2, 2)} m²</span>
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Items detail (collapsible) */}
            {portasPortoes.portasItems && portasPortoes.portasItems.length > 0 && (
              <Collapsible open={portasOpen} onOpenChange={setPortasOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="text-xs text-muted-foreground">
                      {portasPortoes.portasItems.length} porta(s) detectada(s)
                    </span>
                    <ChevronDown className={cn(
                      "w-4 h-4 transition-transform",
                      portasOpen && "rotate-180"
                    )} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="text-xs space-y-1 bg-white/50 rounded-lg p-3">
                    {portasPortoes.portasItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{item.label}</span>
                        <span className="text-muted-foreground">
                          {formatNumber(item.width_m, 2)}m × {formatNumber(item.height_m, 2)}m = {formatNumber(item.area_m2, 2)} m²
                        </span>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Material Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Material</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onPortasPortoesChange({ ...portasPortoes, materialPorta: 'MADEIRA' })}
                  className={cn(
                    'p-3 rounded-lg border-2 text-left transition-all',
                    portasPortoes.materialPorta === 'MADEIRA'
                      ? 'border-blue-500 bg-blue-100'
                      : 'border-gray-200 hover:border-blue-300'
                  )}
                >
                  <p className="font-medium text-sm">Madeira</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(precos.portaMadeiraM2)}/m²</p>
                </button>
                <button
                  type="button"
                  onClick={() => onPortasPortoesChange({ ...portasPortoes, materialPorta: 'ALUMINIO' })}
                  className={cn(
                    'p-3 rounded-lg border-2 text-left transition-all',
                    portasPortoes.materialPorta === 'ALUMINIO'
                      ? 'border-blue-500 bg-blue-100'
                      : 'border-gray-200 hover:border-blue-300'
                  )}
                >
                  <p className="font-medium text-sm">Alumínio</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(precos.portaAluminioM2)}/m²</p>
                </button>
              </div>
            </div>

            {/* Admin manual edit */}
            {isAdmin && (
              <div className="pt-2 border-t">
                <Label className="text-xs text-muted-foreground">Área (m²) - Edição Admin</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={portasPortoes.areaPortasM2 || ''}
                  onChange={(e) => onPortasPortoesChange({ 
                    ...portasPortoes, 
                    areaPortasM2: parseFloat(e.target.value) || 0 
                  })}
                  className="mt-1"
                />
              </div>
            )}

            {/* Cost */}
            <div className="pt-3 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Custo Total Portas:</span>
                <span className="text-lg font-bold text-blue-700">{formatCurrency(resultado.custoPortas)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CARD B: PORTÕES */}
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <Warehouse className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <CardTitle className="text-base">Portões</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Área total: <span className="font-semibold text-foreground">{formatNumber(portasPortoes.areaPortoesM2, 2)} m²</span>
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Items detail (collapsible) */}
            {portasPortoes.portoesItems && portasPortoes.portoesItems.length > 0 && (
              <Collapsible open={portoesOpen} onOpenChange={setPortoesOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="text-xs text-muted-foreground">
                      {portasPortoes.portoesItems.length} portão(ões) detectado(s)
                    </span>
                    <ChevronDown className={cn(
                      "w-4 h-4 transition-transform",
                      portoesOpen && "rotate-180"
                    )} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="text-xs space-y-1 bg-white/50 rounded-lg p-3">
                    {portasPortoes.portoesItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{item.label}</span>
                        <span className="text-muted-foreground">
                          {formatNumber(item.width_m, 2)}m × {formatNumber(item.height_m, 2)}m = {formatNumber(item.area_m2, 2)} m²
                        </span>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Material Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Material</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onPortasPortoesChange({ ...portasPortoes, materialPortao: 'FERRO' })}
                  className={cn(
                    'p-3 rounded-lg border-2 text-left transition-all',
                    portasPortoes.materialPortao === 'FERRO'
                      ? 'border-amber-500 bg-amber-100'
                      : 'border-gray-200 hover:border-amber-300'
                  )}
                >
                  <p className="font-medium text-sm">Ferro</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(precos.portaoFerroM2)}/m²</p>
                </button>
                <button
                  type="button"
                  onClick={() => onPortasPortoesChange({ ...portasPortoes, materialPortao: 'ALUMINIO' })}
                  className={cn(
                    'p-3 rounded-lg border-2 text-left transition-all',
                    portasPortoes.materialPortao === 'ALUMINIO'
                      ? 'border-amber-500 bg-amber-100'
                      : 'border-gray-200 hover:border-amber-300'
                  )}
                >
                  <p className="font-medium text-sm">Alumínio</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(precos.portaoAluminioM2)}/m²</p>
                </button>
              </div>
            </div>

            {/* Admin manual edit */}
            {isAdmin && (
              <div className="pt-2 border-t">
                <Label className="text-xs text-muted-foreground">Área (m²) - Edição Admin</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={portasPortoes.areaPortoesM2 || ''}
                  onChange={(e) => onPortasPortoesChange({ 
                    ...portasPortoes, 
                    areaPortoesM2: parseFloat(e.target.value) || 0 
                  })}
                  className="mt-1"
                />
              </div>
            )}

            {/* Cost */}
            <div className="pt-3 border-t">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Custo Total Portões:</span>
                <span className="text-lg font-bold text-amber-700">{formatCurrency(resultado.custoPortoes)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Total Portas</p>
              <p className="text-xl font-bold text-blue-600">{formatCurrency(resultado.custoPortas)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Portões</p>
              <p className="text-xl font-bold text-amber-600">{formatCurrency(resultado.custoPortoes)}</p>
            </div>
            <div className="border-l pl-4">
              <p className="text-sm text-muted-foreground">Total Portas/Portões</p>
              <p className="text-2xl font-bold text-primary">{formatCurrency(resultado.custoTotal)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
