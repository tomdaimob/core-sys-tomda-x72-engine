import { useState, useCallback, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  Trash2, 
  Home, 
  Bath, 
  ChefHat, 
  Upload, 
  FileText, 
  X, 
  Loader2, 
  Sparkles, 
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Copy,
  Calculator,
  AlertTriangle,
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/orcamento-calculos';
import { useRevestimentoIA, AmbienteMedidas, ExtractionResult } from '@/hooks/useRevestimentoIA';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Types
export type TipoAmbiente = 'cozinha' | 'banheiro';
export type TipoMaterial = 'ceramica' | 'ceramica_premium' | 'porcelanato' | 'porcelanato_premium';
export type TipoAltura = 'inteira' | 'meia';
export type ModoMedidas = 'ia' | 'manual';

export interface AmbienteRevestimento {
  id: string;
  tipo: TipoAmbiente;
  nome: string;
  incluir: boolean;
  modo: ModoMedidas;
  perimetroM: number;
  tipoAltura: TipoAltura;
  alturaInteiraM: number;
  alturaMeiaM: number;
  descontarAberturas: boolean;
  areaAberturasM2: number;
  tipoMaterial: TipoMaterial;
  perdaPercentual: number;
  // Metadata
  fromAI?: boolean;
  duplicatedFromId?: string;
  iaConfianca?: number;
}

export interface RevestimentoInput {
  ambientes: AmbienteRevestimento[];
  incluirArgamassa: boolean;
  incluirRejunte: boolean;
  incluirMaoObra: boolean;
}

export interface ResultadoAmbiente {
  id: string;
  nome: string;
  tipo: TipoAmbiente;
  areaBrutaM2: number;
  areaLiquidaM2: number;
  areaComPerdaM2: number;
  tipoMaterial: TipoMaterial;
  custoMaterial: number;
  custoArgamassa: number;
  custoRejunte: number;
  custoMaoObra: number;
  custoTotal: number;
}

export interface ResultadoRevestimento {
  ambientes: ResultadoAmbiente[];
  areaTotalM2: number;
  custoMaterial: number;
  custoArgamassa: number;
  custoRejunte: number;
  custoMaoObra: number;
  custoTotal: number;
  precoPorM2: number;
  argamassaQtd: number;
  rejunteQtd: number;
}

export interface PrecosRevestimento {
  ceramicaM2: number;
  ceramicaPremiumM2: number;
  porcelanatoM2: number;
  porcelanatoPremiumM2: number;
  argamassaM2: number;
  rejunteM2: number;
  maoObraM2: number;
}

// Default values
const generateAmbienteId = () => `amb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const createDefaultAmbiente = (tipo: TipoAmbiente, index = 1): AmbienteRevestimento => ({
  id: generateAmbienteId(),
  tipo,
  nome: tipo === 'cozinha' ? `Cozinha ${index}` : `Banheiro ${index}`,
  incluir: true,
  modo: 'manual',
  perimetroM: 0,
  tipoAltura: 'inteira',
  alturaInteiraM: 2.70,
  alturaMeiaM: 1.20,
  descontarAberturas: false,
  areaAberturasM2: 0,
  tipoMaterial: 'ceramica',
  perdaPercentual: 10,
  fromAI: false,
});

// Create ambiente from AI extraction
const createAmbienteFromAI = (medidas: AmbienteMedidas, index: number): AmbienteRevestimento => ({
  id: generateAmbienteId(),
  tipo: medidas.tipo,
  nome: medidas.nome,
  incluir: true,
  modo: 'ia',
  perimetroM: medidas.perimetro_m,
  tipoAltura: 'inteira',
  alturaInteiraM: medidas.altura_total_m,
  alturaMeiaM: medidas.altura_meia_parede_m,
  descontarAberturas: medidas.area_aberturas_total_m2 > 0,
  areaAberturasM2: medidas.area_aberturas_total_m2,
  tipoMaterial: 'ceramica',
  perdaPercentual: 10,
  fromAI: true,
  iaConfianca: medidas.confianca,
});

export const DEFAULT_REVESTIMENTO: RevestimentoInput = {
  ambientes: [
    { ...createDefaultAmbiente('cozinha', 1), nome: 'Cozinha 1' },
    { ...createDefaultAmbiente('banheiro', 1), nome: 'Banheiro 1' },
  ],
  incluirArgamassa: true,
  incluirRejunte: true,
  incluirMaoObra: true,
};

// Constants for coverage calculation
const ARGAMASSA_COBERTURA_M2 = 20;
const REJUNTE_COBERTURA_M2 = 8;

// Get material price
const getMaterialPrice = (material: TipoMaterial, precos: PrecosRevestimento): number => {
  switch (material) {
    case 'ceramica': return precos.ceramicaM2;
    case 'ceramica_premium': return precos.ceramicaPremiumM2 || 75;
    case 'porcelanato': return precos.porcelanatoM2;
    case 'porcelanato_premium': return precos.porcelanatoPremiumM2 || 130;
    default: return precos.ceramicaM2;
  }
};

// Calculate function
export function calcularRevestimentoResultado(
  input: RevestimentoInput,
  precos: PrecosRevestimento
): ResultadoRevestimento {
  const ambientesResultado: ResultadoAmbiente[] = input.ambientes
    .filter(amb => amb.incluir)
    .map(amb => {
      const altura = amb.tipoAltura === 'inteira' ? amb.alturaInteiraM : amb.alturaMeiaM;
      const areaBrutaM2 = amb.perimetroM * altura;
      const areaLiquidaM2 = Math.max(areaBrutaM2 - (amb.descontarAberturas ? amb.areaAberturasM2 : 0), 0);
      const areaComPerdaM2 = areaLiquidaM2 * (1 + amb.perdaPercentual / 100);
      
      const precoMaterial = getMaterialPrice(amb.tipoMaterial, precos);
      const custoMaterial = areaComPerdaM2 * precoMaterial;
      
      const argamassaQtd = Math.ceil(areaComPerdaM2 / ARGAMASSA_COBERTURA_M2);
      const rejunteQtd = Math.ceil(areaComPerdaM2 / REJUNTE_COBERTURA_M2);
      
      const custoArgamassa = input.incluirArgamassa ? argamassaQtd * precos.argamassaM2 * ARGAMASSA_COBERTURA_M2 : 0;
      const custoRejunte = input.incluirRejunte ? rejunteQtd * precos.rejunteM2 * REJUNTE_COBERTURA_M2 : 0;
      const custoMaoObra = input.incluirMaoObra ? areaComPerdaM2 * precos.maoObraM2 : 0;
      const custoTotal = custoMaterial + custoArgamassa + custoRejunte + custoMaoObra;
      
      return {
        id: amb.id,
        nome: amb.nome,
        tipo: amb.tipo,
        areaBrutaM2,
        areaLiquidaM2,
        areaComPerdaM2,
        tipoMaterial: amb.tipoMaterial,
        custoMaterial,
        custoArgamassa,
        custoRejunte,
        custoMaoObra,
        custoTotal,
      };
    });
  
  const areaTotalM2 = ambientesResultado.reduce((sum, a) => sum + a.areaComPerdaM2, 0);
  const custoMaterial = ambientesResultado.reduce((sum, a) => sum + a.custoMaterial, 0);
  const custoArgamassa = ambientesResultado.reduce((sum, a) => sum + a.custoArgamassa, 0);
  const custoRejunte = ambientesResultado.reduce((sum, a) => sum + a.custoRejunte, 0);
  const custoMaoObra = ambientesResultado.reduce((sum, a) => sum + a.custoMaoObra, 0);
  const custoTotal = custoMaterial + custoArgamassa + custoRejunte + custoMaoObra;
  const precoPorM2 = areaTotalM2 > 0 ? custoTotal / areaTotalM2 : 0;
  
  const argamassaQtd = input.incluirArgamassa ? Math.ceil(areaTotalM2 / ARGAMASSA_COBERTURA_M2) : 0;
  const rejunteQtd = input.incluirRejunte ? Math.ceil(areaTotalM2 / REJUNTE_COBERTURA_M2) : 0;
  
  return {
    ambientes: ambientesResultado,
    areaTotalM2,
    custoMaterial,
    custoArgamassa,
    custoRejunte,
    custoMaoObra,
    custoTotal,
    precoPorM2,
    argamassaQtd,
    rejunteQtd,
  };
}

interface RevestimentoFormProps {
  revestimento: RevestimentoInput;
  onRevestimentoChange: (revestimento: RevestimentoInput) => void;
  precos: PrecosRevestimento;
  resultado: ResultadoRevestimento;
  orcamentoId?: string | null;
  onCalculate?: () => void;
}

export function RevestimentoForm({
  revestimento,
  onRevestimentoChange,
  precos,
  resultado,
  orcamentoId,
  onCalculate,
}: RevestimentoFormProps) {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const { 
    extracao, 
    extracting, 
    extractFromPdf, 
    reimportFromActiveArquivo,
    hasExtracao, 
    clearExtracao,
    arquivoAtivo,
    hasArquivoAtivo,
  } = useRevestimentoIA(orcamentoId);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [showUploadNew, setShowUploadNew] = useState(false);

  // Check if any ambientes came from AI
  const hasAIData = useMemo(() => 
    revestimento.ambientes.some(a => a.fromAI || a.modo === 'ia'), 
    [revestimento.ambientes]
  );

  // Count ambientes by type
  const cozinhaCount = useMemo(() => 
    revestimento.ambientes.filter(a => a.tipo === 'cozinha').length, 
    [revestimento.ambientes]
  );
  const banheiroCount = useMemo(() => 
    revestimento.ambientes.filter(a => a.tipo === 'banheiro').length, 
    [revestimento.ambientes]
  );
  
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
    if (result && result.ambientes.length > 0) {
      // Only update IA-mode ambientes, keep manual ones
      const manualAmbientes = revestimento.ambientes.filter(a => a.modo === 'manual');
      const novosAmbientes = result.ambientes.map((medidas, idx) => 
        createAmbienteFromAI(medidas, idx)
      );
      
      onRevestimentoChange({
        ...revestimento,
        ambientes: [...manualAmbientes, ...novosAmbientes],
      });
      
      setFile(null);
      setShowUploadNew(false);
    }
  };

  const handleReimportFromPdf = async () => {
    const result = await reimportFromActiveArquivo();
    if (result && result.ambientes.length > 0) {
      // Only update IA-mode ambientes, keep manual ones intact
      const manualAmbientes = revestimento.ambientes.filter(a => a.modo === 'manual');
      const novosAmbientes = result.ambientes.map((medidas, idx) => 
        createAmbienteFromAI(medidas, idx)
      );
      
      onRevestimentoChange({
        ...revestimento,
        ambientes: [...manualAmbientes, ...novosAmbientes],
      });

      toast({
        title: 'Reimportação concluída',
        description: 'Ambientes manuais não foram alterados.',
      });
    }
  };

  const handleClearAIData = () => {
    clearExtracao();
    setShowUploadNew(false);
    // Keep manual ambientes, remove AI ones
    const manualAmbientes = revestimento.ambientes.filter(a => a.modo === 'manual');
    if (manualAmbientes.length === 0) {
      onRevestimentoChange({
        ...revestimento,
        ambientes: [
          createDefaultAmbiente('cozinha', 1),
          createDefaultAmbiente('banheiro', 1),
        ],
      });
    } else {
      onRevestimentoChange({ ...revestimento, ambientes: manualAmbientes });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  const updateAmbiente = (id: string, updates: Partial<AmbienteRevestimento>) => {
    const newAmbientes = revestimento.ambientes.map(amb =>
      amb.id === id ? { ...amb, ...updates } : amb
    );
    onRevestimentoChange({ ...revestimento, ambientes: newAmbientes });
  };

  const switchToManualMode = (id: string) => {
    updateAmbiente(id, { modo: 'manual', fromAI: false });
    toast({
      title: 'Modo manual ativado',
      description: 'Você pode editar as medidas livremente.',
    });
  };
  
  const addAmbiente = (tipo: TipoAmbiente) => {
    const count = tipo === 'cozinha' ? cozinhaCount : banheiroCount;
    const newAmbiente = createDefaultAmbiente(tipo, count + 1);
    onRevestimentoChange({
      ...revestimento,
      ambientes: [...revestimento.ambientes, newAmbiente],
    });
  };

  const duplicateAmbiente = (id: string) => {
    const original = revestimento.ambientes.find(a => a.id === id);
    if (!original) return;

    // Count existing of the same type
    const countOfType = revestimento.ambientes.filter(a => a.tipo === original.tipo).length;
    const newName = original.tipo === 'cozinha' 
      ? `Cozinha ${countOfType + 1}`
      : `Banheiro ${countOfType + 1}`;

    // Deep copy with new id
    const duplicated: AmbienteRevestimento = {
      ...original,
      id: generateAmbienteId(),
      nome: newName,
      modo: 'manual', // Duplicates always start as manual
      fromAI: false,
      duplicatedFromId: original.id,
      // Ensure numeric values are copied as numbers
      perimetroM: parseFloat(String(original.perimetroM)) || 0,
      alturaInteiraM: parseFloat(String(original.alturaInteiraM)) || 2.70,
      alturaMeiaM: parseFloat(String(original.alturaMeiaM)) || 1.20,
      areaAberturasM2: parseFloat(String(original.areaAberturasM2)) || 0,
      perdaPercentual: parseFloat(String(original.perdaPercentual)) || 10,
    };

    onRevestimentoChange({
      ...revestimento,
      ambientes: [...revestimento.ambientes, duplicated],
    });

    toast({
      title: 'Ambiente duplicado',
      description: `${newName} criado com as mesmas configurações.`,
    });
  };
  
  const removeAmbiente = (id: string) => {
    const ambiente = revestimento.ambientes.find(a => a.id === id);
    if (!ambiente) return;
    
    // Can't remove last ambiente of any type
    const countOfType = revestimento.ambientes.filter(a => a.tipo === ambiente.tipo).length;
    if (countOfType <= 1) {
      toast({
        title: 'Não é possível remover',
        description: `Deve haver pelo menos um ${ambiente.tipo === 'cozinha' ? 'cozinha' : 'banheiro'}.`,
        variant: 'destructive',
      });
      return;
    }

    onRevestimentoChange({
      ...revestimento,
      ambientes: revestimento.ambientes.filter(a => a.id !== id),
    });
  };
  
  const getAmbienteIcon = (tipo: TipoAmbiente) => {
    return tipo === 'cozinha' ? ChefHat : Bath;
  };
  
  const getResultadoAmbiente = (id: string) => {
    return resultado.ambientes.find(a => a.id === id);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Validate ambientes for calculation
  const validateForCalculation = (): boolean => {
    const enabledAmbientes = revestimento.ambientes.filter(a => a.incluir);
    
    for (const amb of enabledAmbientes) {
      if (amb.modo === 'manual' && amb.perimetroM <= 0) {
        toast({
          title: 'Validação',
          description: `${amb.nome}: Perímetro deve ser maior que 0.`,
          variant: 'destructive',
        });
        return false;
      }
    }
    
    return true;
  };

  const handleCalculate = () => {
    if (!validateForCalculation()) return;
    
    if (onCalculate) {
      onCalculate();
    }
    
    toast({
      title: 'Revestimento calculado',
      description: 'Áreas e custos atualizados com sucesso.',
    });
  };

  const getMaterialLabel = (material: TipoMaterial): string => {
    switch (material) {
      case 'ceramica': return `Cerâmica (${formatCurrency(precos.ceramicaM2)}/m²)`;
      case 'ceramica_premium': return `Cerâmica Premium (${formatCurrency(precos.ceramicaPremiumM2 || 75)}/m²)`;
      case 'porcelanato': return `Porcelanato (${formatCurrency(precos.porcelanatoM2)}/m²)`;
      case 'porcelanato_premium': return `Porcelanato Premium (${formatCurrency(precos.porcelanatoPremiumM2 || 130)}/m²)`;
      default: return 'Cerâmica';
    }
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Revestimento (Cozinha e Banheiros)</h2>
        {hasAIData && (
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="w-3 h-3" />
            Com dados do PDF
          </Badge>
        )}
      </div>

      {/* PDF Upload Section */}
      <div className="space-y-4">
        {/* AI Data Indicator with Update/Reimport Options */}
        {hasArquivoAtivo && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Arquivo PDF ativo</p>
                  {arquivoAtivo && (
                    <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">Arquivo (v{arquivoAtivo.version}):</span>
                        <span>{arquivoAtivo.nome}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">Upload:</span>
                        <span>{formatDate(arquivoAtivo.created_at)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={handleReimportFromPdf}
                disabled={extracting}
                className="gap-2"
              >
                {extracting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Reimportar Medidas do PDF
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUploadNew(!showUploadNew)}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Atualizar Projeto (PDF)
              </Button>

              {hasAIData && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAIData}
                  className="gap-2 text-muted-foreground hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                  Limpar Dados IA
                </Button>
              )}
            </div>

            {/* Info about manual protection */}
            <div className="flex items-start gap-2 text-xs text-muted-foreground mt-3 bg-muted/50 rounded p-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>Reimportar do PDF atualiza apenas ambientes em modo IA. Ambientes manuais não serão alterados.</p>
            </div>
          </div>
        )}

        {/* Upload new PDF section */}
        {(!hasArquivoAtivo || showUploadNew) && (
          <div className="space-y-3 p-4 border border-dashed border-primary/30 rounded-lg bg-muted/30">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={cn(
                'relative border-2 border-dashed rounded-xl p-6 text-center transition-all duration-200',
                dragActive 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border hover:border-primary/50',
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
                <div className="space-y-2">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">
                    Arraste o PDF ou clique para selecionar (opcional)
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  <FileText className="w-6 h-6 text-primary" />
                  <span className="text-sm font-medium truncate max-w-[200px]">
                    {file.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({formatFileSize(file.size)})
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.preventDefault();
                      setFile(null);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {file && (
              <div className="flex gap-2">
                <Button
                  onClick={handleExtractFromPdf}
                  disabled={extracting || !orcamentoId}
                  className="flex-1 gap-2"
                >
                  {extracting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Importar Medidas do PDF
                    </>
                  )}
                </Button>
                {showUploadNew && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setFile(null);
                      setShowUploadNew(false);
                    }}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            )}

            {!orcamentoId && (
              <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>Salve o orçamento antes de importar medidas do PDF.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Ambiente Buttons */}
      <div className="flex gap-2">
        <Button variant="outline" onClick={() => addAmbiente('banheiro')} className="gap-2">
          <Plus className="w-4 h-4" />
          <Bath className="w-4 h-4" />
          Adicionar Banheiro
        </Button>
        <Button variant="outline" onClick={() => addAmbiente('cozinha')} className="gap-2">
          <Plus className="w-4 h-4" />
          <ChefHat className="w-4 h-4" />
          Adicionar Cozinha
        </Button>
      </div>
      
      {/* Ambiente Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {revestimento.ambientes.map((ambiente) => {
          const Icon = getAmbienteIcon(ambiente.tipo);
          const resultadoAmb = getResultadoAmbiente(ambiente.id);
          const isManual = ambiente.modo === 'manual';
          
          return (
            <Card 
              key={ambiente.id} 
              className={cn(
                'transition-all',
                ambiente.incluir ? 'border-primary/50 bg-primary/5' : 'opacity-60',
                !isManual && 'ring-1 ring-green-500/30'
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      ambiente.tipo === 'cozinha' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {ambiente.nome}
                        <Badge 
                          variant="outline" 
                          className={cn(
                            'text-xs',
                            isManual 
                              ? 'bg-blue-500/10 text-blue-700 border-blue-500/30'
                              : 'bg-green-500/10 text-green-700 border-green-500/30'
                          )}
                        >
                          {isManual ? 'Manual' : 'IA'}
                        </Badge>
                        {ambiente.duplicatedFromId && (
                          <Badge variant="outline" className="text-xs">
                            Duplicado
                          </Badge>
                        )}
                      </CardTitle>
                      {ambiente.incluir && resultadoAmb && (
                        <div className="flex gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {formatNumber(resultadoAmb.areaComPerdaM2, 1)} m²
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {formatCurrency(resultadoAmb.custoTotal)}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Duplicate button */}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => duplicateAmbiente(ambiente.id)}
                      title="Duplicar ambiente"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    {/* Delete button */}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeAmbiente(ambiente.id)}
                      title="Excluir ambiente"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    {/* Include switch */}
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`incluir-${ambiente.id}`} className="text-sm text-muted-foreground">
                        Incluir
                      </Label>
                      <Switch
                        id={`incluir-${ambiente.id}`}
                        checked={ambiente.incluir}
                        onCheckedChange={(checked) => updateAmbiente(ambiente.id, { incluir: checked })}
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              {ambiente.incluir && (
                <CardContent className="space-y-4">
                  {/* Mode selector */}
                  {!isManual && ambiente.fromAI && (
                    <div className="flex items-start gap-2 text-xs bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-600" />
                      <div className="flex-1">
                        <p className="text-amber-700">
                          Medidas detectadas automaticamente (confiança: {Math.round((ambiente.iaConfianca || 0.8) * 100)}%)
                        </p>
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs text-amber-700 underline"
                          onClick={() => switchToManualMode(ambiente.id)}
                        >
                          Alternar para modo manual e editar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Perímetro */}
                  <div className="input-group">
                    <Label htmlFor={`perimetro-${ambiente.id}`} className="input-label">
                      Perímetro do Ambiente (m) *
                    </Label>
                    <Input
                      id={`perimetro-${ambiente.id}`}
                      type="number"
                      step="0.1"
                      min="0"
                      value={ambiente.perimetroM || ''}
                      onChange={(e) => updateAmbiente(ambiente.id, { 
                        perimetroM: parseFloat(e.target.value) || 0,
                        modo: 'manual',
                        fromAI: false,
                      })}
                      placeholder="Ex: 10"
                      className={cn(!isManual && 'bg-muted')}
                    />
                  </div>
                  
                  {/* Altura do Revestimento */}
                  <div className="space-y-2">
                    <Label className="input-label">Altura do Revestimento</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updateAmbiente(ambiente.id, { tipoAltura: 'inteira' })}
                        className={cn(
                          'p-3 rounded-lg border text-sm transition-all',
                          ambiente.tipoAltura === 'inteira' 
                            ? 'border-primary bg-primary/10 text-primary' 
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        <div className="font-medium">Parede Inteira</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {ambiente.alturaInteiraM}m
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateAmbiente(ambiente.id, { tipoAltura: 'meia' })}
                        className={cn(
                          'p-3 rounded-lg border text-sm transition-all',
                          ambiente.tipoAltura === 'meia' 
                            ? 'border-primary bg-primary/10 text-primary' 
                            : 'border-border hover:border-primary/50'
                        )}
                      >
                        <div className="font-medium">Meia Parede</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {ambiente.alturaMeiaM}m
                        </div>
                      </button>
                    </div>
                    
                    {/* Editable heights - Manual mode or admin */}
                    {(isManual || isAdmin) && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="input-group">
                          <Label htmlFor={`altura-inteira-${ambiente.id}`} className="text-xs text-muted-foreground">
                            Altura inteira (m)
                          </Label>
                          <Input
                            id={`altura-inteira-${ambiente.id}`}
                            type="number"
                            step="0.1"
                            min="2"
                            max="4"
                            value={ambiente.alturaInteiraM || ''}
                            onChange={(e) => updateAmbiente(ambiente.id, { 
                              alturaInteiraM: parseFloat(e.target.value) || 2.70 
                            })}
                            className="h-8"
                          />
                        </div>
                        <div className="input-group">
                          <Label htmlFor={`altura-meia-${ambiente.id}`} className="text-xs text-muted-foreground">
                            Altura meia (m)
                          </Label>
                          <Input
                            id={`altura-meia-${ambiente.id}`}
                            type="number"
                            step="0.1"
                            min="0.5"
                            max="2"
                            value={ambiente.alturaMeiaM || ''}
                            onChange={(e) => updateAmbiente(ambiente.id, { 
                              alturaMeiaM: parseFloat(e.target.value) || 1.20 
                            })}
                            className="h-8"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Aberturas */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`aberturas-${ambiente.id}`}
                        checked={ambiente.descontarAberturas}
                        onCheckedChange={(checked) => updateAmbiente(ambiente.id, { 
                          descontarAberturas: checked 
                        })}
                      />
                      <Label htmlFor={`aberturas-${ambiente.id}`} className="text-sm">
                        Descontar aberturas (portas/janelas)
                      </Label>
                    </div>
                    {ambiente.descontarAberturas && (
                      <div className="input-group pl-8">
                        <Label htmlFor={`area-aberturas-${ambiente.id}`} className="text-xs text-muted-foreground">
                          Área de aberturas (m²)
                        </Label>
                        <Input
                          id={`area-aberturas-${ambiente.id}`}
                          type="number"
                          step="0.1"
                          min="0"
                          value={ambiente.areaAberturasM2 || ''}
                          onChange={(e) => updateAmbiente(ambiente.id, { 
                            areaAberturasM2: parseFloat(e.target.value) || 0 
                          })}
                          className="h-8"
                          placeholder="Ex: 2.5"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Tipo de Material */}
                  <div className="input-group">
                    <Label htmlFor={`material-${ambiente.id}`} className="input-label">
                      Tipo de Material
                    </Label>
                    <Select
                      value={ambiente.tipoMaterial}
                      onValueChange={(value: TipoMaterial) => updateAmbiente(ambiente.id, { 
                        tipoMaterial: value 
                      })}
                    >
                      <SelectTrigger id={`material-${ambiente.id}`}>
                        <SelectValue placeholder="Selecione o material" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ceramica">
                          Cerâmica ({formatCurrency(precos.ceramicaM2)}/m²)
                        </SelectItem>
                        <SelectItem value="ceramica_premium">
                          Cerâmica Premium ({formatCurrency(precos.ceramicaPremiumM2 || 75)}/m²)
                        </SelectItem>
                        <SelectItem value="porcelanato">
                          Porcelanato ({formatCurrency(precos.porcelanatoM2)}/m²)
                        </SelectItem>
                        <SelectItem value="porcelanato_premium">
                          Porcelanato Premium ({formatCurrency(precos.porcelanatoPremiumM2 || 130)}/m²)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Perdas */}
                  <div className="input-group">
                    <Label htmlFor={`perdas-${ambiente.id}`} className="input-label">
                      Perdas/Quebras (%)
                    </Label>
                    <Input
                      id={`perdas-${ambiente.id}`}
                      type="number"
                      min={5}
                      max={15}
                      value={ambiente.perdaPercentual || ''}
                      onChange={(e) => {
                        const val = Math.min(15, Math.max(5, parseFloat(e.target.value) || 10));
                        updateAmbiente(ambiente.id, { perdaPercentual: val });
                      }}
                      placeholder="10"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Entre 5% e 15%</p>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
      
      {/* Global Options */}
      <div className="bg-accent/30 rounded-xl p-4 border border-accent">
        <h3 className="font-medium mb-3">Itens Incluídos no Custo</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <div>
              <Label className="text-sm">Argamassa ACIII</Label>
              <p className="text-xs text-muted-foreground">{formatCurrency(precos.argamassaM2)}/m²</p>
            </div>
            <Switch
              checked={revestimento.incluirArgamassa}
              onCheckedChange={(checked) => onRevestimentoChange({ 
                ...revestimento, 
                incluirArgamassa: checked 
              })}
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <div>
              <Label className="text-sm">Rejunte</Label>
              <p className="text-xs text-muted-foreground">{formatCurrency(precos.rejunteM2)}/m²</p>
            </div>
            <Switch
              checked={revestimento.incluirRejunte}
              onCheckedChange={(checked) => onRevestimentoChange({ 
                ...revestimento, 
                incluirRejunte: checked 
              })}
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <div>
              <Label className="text-sm">Mão de Obra</Label>
              <p className="text-xs text-muted-foreground">{formatCurrency(precos.maoObraM2)}/m²</p>
            </div>
            <Switch
              checked={revestimento.incluirMaoObra}
              onCheckedChange={(checked) => onRevestimentoChange({ 
                ...revestimento, 
                incluirMaoObra: checked 
              })}
            />
          </div>
        </div>
      </div>

      {/* Calculate Button */}
      <Button 
        onClick={handleCalculate}
        className="w-full gap-2"
        size="lg"
      >
        <Calculator className="w-5 h-5" />
        Calcular Revestimento
      </Button>
      
      {/* Summary Card */}
      {resultado.areaTotalM2 > 0 && (
        <div className="bg-primary/10 rounded-xl p-6 border border-primary/20">
          <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
            <Home className="w-5 h-5 text-primary" />
            Resumo do Revestimento
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-background/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-primary">
                {formatNumber(resultado.areaTotalM2, 1)} m²
              </div>
              <div className="text-sm text-muted-foreground">Área Total</div>
            </div>
            <div className="bg-background/50 rounded-lg p-3">
              <div className="text-lg font-semibold">
                {formatCurrency(resultado.custoMaterial)}
              </div>
              <div className="text-sm text-muted-foreground">Material</div>
            </div>
            <div className="bg-background/50 rounded-lg p-3">
              <div className="text-lg font-semibold">
                {formatCurrency(resultado.custoMaoObra)}
              </div>
              <div className="text-sm text-muted-foreground">Mão de Obra</div>
            </div>
            <div className="bg-background/50 rounded-lg p-3">
              <div className="text-lg font-semibold">
                {formatCurrency(resultado.precoPorM2)}/m²
              </div>
              <div className="text-sm text-muted-foreground">Preço Médio</div>
            </div>
          </div>
          
          <div className="border-t border-primary/20 pt-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Custo Total Revestimento:</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(resultado.custoTotal)}
              </span>
            </div>
          </div>
          
          {/* Detail breakdown by ambiente */}
          <div className="mt-4 pt-4 border-t border-primary/10">
            <p className="text-xs text-muted-foreground mb-2">Detalhamento por ambiente:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {resultado.ambientes.map((amb) => (
                <div key={amb.id} className="flex justify-between text-sm p-2 bg-background/50 rounded">
                  <span>{amb.nome}</span>
                  <span className="font-medium">
                    {formatNumber(amb.areaComPerdaM2, 1)} m² — {formatCurrency(amb.custoTotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
