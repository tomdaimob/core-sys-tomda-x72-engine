import { useState, useCallback, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  RefreshCw
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/orcamento-calculos';
import { useRevestimentoIA, AmbienteMedidas, ExtractionResult } from '@/hooks/useRevestimentoIA';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// Types
export type TipoAmbiente = 'cozinha' | 'banheiro';
export type TipoMaterial = 'ceramica' | 'porcelanato';
export type TipoAltura = 'inteira' | 'meia';

export interface AmbienteRevestimento {
  id: string;
  tipo: TipoAmbiente;
  nome: string;
  incluir: boolean;
  perimetroM: number;
  tipoAltura: TipoAltura;
  alturaInteiraM: number;
  alturaMeiaM: number;
  descontarAberturas: boolean;
  areaAberturasM2: number;
  tipoMaterial: TipoMaterial;
  perdaPercentual: number;
  // Flag to indicate if data came from AI
  fromAI?: boolean;
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
  // New: quantity breakdown for PDF
  argamassaQtd: number;
  rejunteQtd: number;
}

export interface PrecosRevestimento {
  ceramicaM2: number;
  porcelanatoM2: number;
  argamassaM2: number;
  rejunteM2: number;
  maoObraM2: number;
}

// Default values
const createDefaultAmbiente = (tipo: TipoAmbiente, index = 1): AmbienteRevestimento => ({
  id: `${tipo}-${Date.now()}-${index}`,
  tipo,
  nome: tipo === 'cozinha' ? 'Cozinha' : `Banheiro ${index}`,
  incluir: tipo === 'banheiro',
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
  id: `${medidas.tipo}-ai-${Date.now()}-${index}`,
  tipo: medidas.tipo,
  nome: medidas.nome,
  incluir: true, // Auto-include AI-extracted rooms
  perimetroM: medidas.perimetro_m,
  tipoAltura: 'inteira',
  alturaInteiraM: medidas.altura_total_m,
  alturaMeiaM: medidas.altura_meia_parede_m,
  descontarAberturas: medidas.area_aberturas_total_m2 > 0,
  areaAberturasM2: medidas.area_aberturas_total_m2,
  tipoMaterial: 'ceramica',
  perdaPercentual: 10,
  fromAI: true,
});

export const DEFAULT_REVESTIMENTO: RevestimentoInput = {
  ambientes: [
    createDefaultAmbiente('cozinha'),
    createDefaultAmbiente('banheiro', 1),
  ],
  incluirArgamassa: true,
  incluirRejunte: true,
  incluirMaoObra: true,
};

// Constants for coverage calculation
const ARGAMASSA_COBERTURA_M2 = 20; // 1 unit covers 20 m²
const REJUNTE_COBERTURA_M2 = 8;    // 1 unit covers 8 m²

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
      
      const precoMaterial = amb.tipoMaterial === 'ceramica' ? precos.ceramicaM2 : precos.porcelanatoM2;
      const custoMaterial = areaComPerdaM2 * precoMaterial;
      
      // Calculate quantities based on coverage rate
      const argamassaQtd = Math.ceil(areaComPerdaM2 / ARGAMASSA_COBERTURA_M2);
      const rejunteQtd = Math.ceil(areaComPerdaM2 / REJUNTE_COBERTURA_M2);
      
      // Calculate costs: precos.argamassaM2 is price per unit, not per m²
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
  
  // Total quantities for PDF
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
}

export function RevestimentoForm({
  revestimento,
  onRevestimentoChange,
  precos,
  resultado,
  orcamentoId,
}: RevestimentoFormProps) {
  const { isAdmin } = useAuth();
  const { extracao, extracting, extractFromPdf, hasExtracao, clearExtracao } = useRevestimentoIA(orcamentoId);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Check if ambientes came from AI
  const hasAIData = useMemo(() => 
    revestimento.ambientes.some(a => a.fromAI), 
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
      // Convert AI extraction to form data
      const novosAmbientes = result.ambientes.map((medidas, idx) => 
        createAmbienteFromAI(medidas, idx)
      );
      
      onRevestimentoChange({
        ...revestimento,
        ambientes: novosAmbientes,
      });
      
      setFile(null);
    }
  };

  const handleClearAIData = () => {
    clearExtracao();
    onRevestimentoChange({
      ...revestimento,
      ambientes: [
        createDefaultAmbiente('cozinha'),
        createDefaultAmbiente('banheiro', 1),
      ],
    });
  };
  
  const updateAmbiente = (id: string, updates: Partial<AmbienteRevestimento>) => {
    // Vendedor can only update certain fields
    if (!isAdmin) {
      const allowedFields = ['incluir', 'tipoAltura', 'tipoMaterial'] as const;
      const filteredUpdates: Partial<AmbienteRevestimento> = {};
      
      for (const key of allowedFields) {
        if (key in updates) {
          (filteredUpdates as Record<string, unknown>)[key] = updates[key];
        }
      }
      
      const newAmbientes = revestimento.ambientes.map(amb =>
        amb.id === id ? { ...amb, ...filteredUpdates } : amb
      );
      onRevestimentoChange({ ...revestimento, ambientes: newAmbientes });
      return;
    }
    
    const newAmbientes = revestimento.ambientes.map(amb =>
      amb.id === id ? { ...amb, ...updates } : amb
    );
    onRevestimentoChange({ ...revestimento, ambientes: newAmbientes });
  };
  
  const addBanheiro = () => {
    if (!isAdmin) return;
    const banheiroCount = revestimento.ambientes.filter(a => a.tipo === 'banheiro').length;
    const newBanheiro = createDefaultAmbiente('banheiro', banheiroCount + 1);
    onRevestimentoChange({
      ...revestimento,
      ambientes: [...revestimento.ambientes, newBanheiro],
    });
  };
  
  const removeAmbiente = (id: string) => {
    if (!isAdmin) return;
    const ambiente = revestimento.ambientes.find(a => a.id === id);
    if (ambiente?.tipo === 'cozinha') return;
    if (ambiente?.tipo === 'banheiro') {
      const banheiroCount = revestimento.ambientes.filter(a => a.tipo === 'banheiro').length;
      if (banheiroCount <= 1) return;
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
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Revestimento (Cozinha e Banheiros)</h2>
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
                  A IA irá extrair automaticamente as medidas de cozinha e banheiros
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
                  Analisando planta com IA...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Importar Medidas do PDF
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
              <p className="font-medium text-green-700">Medidas extraídas do PDF</p>
              <p className="text-sm text-green-600/80">
                {revestimento.ambientes.length} ambiente(s) identificado(s)
              </p>
            </div>
          </div>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAIData}
              className="border-green-500/30 text-green-700 hover:bg-green-500/10"
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Reimportar
            </Button>
          )}
        </div>
      )}
      
      {/* Ambiente Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {revestimento.ambientes.map((ambiente) => {
          const Icon = getAmbienteIcon(ambiente.tipo);
          const resultadoAmb = getResultadoAmbiente(ambiente.id);
          const canRemove = isAdmin && ambiente.tipo === 'banheiro' && 
            revestimento.ambientes.filter(a => a.tipo === 'banheiro').length > 1;
          
          return (
            <Card 
              key={ambiente.id} 
              className={cn(
                'transition-all',
                ambiente.incluir ? 'border-primary/50 bg-primary/5' : 'opacity-60',
                ambiente.fromAI && 'ring-1 ring-green-500/30'
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
                        {ambiente.fromAI && (
                          <Badge variant="outline" className="text-xs bg-green-500/10 text-green-700 border-green-500/30">
                            IA
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
                    {canRemove && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeAmbiente(ambiente.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
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
                  {/* Perímetro - Read-only for vendedor if from AI */}
                  <div className="input-group">
                    <Label htmlFor={`perimetro-${ambiente.id}`} className="input-label">
                      Perímetro do Ambiente (m)
                      {ambiente.fromAI && !isAdmin && (
                        <Badge variant="outline" className="ml-2 text-xs">Detectado</Badge>
                      )}
                    </Label>
                    <Input
                      id={`perimetro-${ambiente.id}`}
                      type="number"
                      step="0.1"
                      value={ambiente.perimetroM || ''}
                      onChange={(e) => updateAmbiente(ambiente.id, { 
                        perimetroM: parseFloat(e.target.value) || 0 
                      })}
                      placeholder="Ex: 10"
                      disabled={!isAdmin && ambiente.fromAI}
                      className={cn(!isAdmin && ambiente.fromAI && 'bg-muted')}
                    />
                  </div>
                  
                  {/* Altura do Revestimento - selectable by all */}
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
                    
                    {/* Editable heights - Admin only */}
                    {isAdmin && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="input-group">
                          <Label htmlFor={`altura-inteira-${ambiente.id}`} className="text-xs text-muted-foreground">
                            Altura inteira (m)
                          </Label>
                          <Input
                            id={`altura-inteira-${ambiente.id}`}
                            type="number"
                            step="0.1"
                            value={ambiente.alturaInteiraM || ''}
                            onChange={(e) => updateAmbiente(ambiente.id, { 
                              alturaInteiraM: parseFloat(e.target.value) || 0 
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
                            value={ambiente.alturaMeiaM || ''}
                            onChange={(e) => updateAmbiente(ambiente.id, { 
                              alturaMeiaM: parseFloat(e.target.value) || 0 
                            })}
                            className="h-8"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Aberturas - Read-only display for vendedor if from AI */}
                  <div className="space-y-2">
                    {ambiente.fromAI && ambiente.areaAberturasM2 > 0 ? (
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <span className="text-sm">Aberturas descontadas</span>
                        <Badge variant="secondary">{formatNumber(ambiente.areaAberturasM2, 2)} m²</Badge>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <Switch
                            id={`aberturas-${ambiente.id}`}
                            checked={ambiente.descontarAberturas}
                            onCheckedChange={(checked) => updateAmbiente(ambiente.id, { 
                              descontarAberturas: checked 
                            })}
                            disabled={!isAdmin && ambiente.fromAI}
                          />
                          <Label htmlFor={`aberturas-${ambiente.id}`} className="text-sm">
                            Descontar aberturas (portas/janelas)
                          </Label>
                        </div>
                        {ambiente.descontarAberturas && isAdmin && (
                          <div className="input-group pl-8">
                            <Label htmlFor={`area-aberturas-${ambiente.id}`} className="text-xs text-muted-foreground">
                              Área de aberturas (m²)
                            </Label>
                            <Input
                              id={`area-aberturas-${ambiente.id}`}
                              type="number"
                              step="0.1"
                              value={ambiente.areaAberturasM2 || ''}
                              onChange={(e) => updateAmbiente(ambiente.id, { 
                                areaAberturasM2: parseFloat(e.target.value) || 0 
                              })}
                              className="h-8"
                              placeholder="Ex: 2.5"
                            />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  
                  {/* Tipo de Material - Editable by all */}
                  <div className="input-group">
                    <Label htmlFor={`material-${ambiente.id}`} className="input-label">
                      Tipo de Material
                    </Label>
                    <select
                      id={`material-${ambiente.id}`}
                      value={ambiente.tipoMaterial}
                      onChange={(e) => updateAmbiente(ambiente.id, { 
                        tipoMaterial: e.target.value as TipoMaterial 
                      })}
                      className="input-field"
                    >
                      <option value="ceramica">Cerâmica ({formatCurrency(precos.ceramicaM2)}/m²)</option>
                      <option value="porcelanato">Porcelanato ({formatCurrency(precos.porcelanatoM2)}/m²)</option>
                    </select>
                  </div>
                  
                  {/* Perdas - Admin only */}
                  {isAdmin && (
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
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Add Banheiro Button - Admin only */}
      {isAdmin && (
        <Button variant="outline" onClick={addBanheiro} className="w-full">
          <Plus className="w-4 h-4 mr-1" />
          Adicionar Banheiro
        </Button>
      )}
      
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
