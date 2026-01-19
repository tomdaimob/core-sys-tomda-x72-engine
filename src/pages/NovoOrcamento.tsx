import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  DollarSign, 
  Layers, 
  Square, 
  Grid3X3, 
  PaintBucket, 
  Sparkles, 
  Percent, 
  FileText,
  Save,
  Upload,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_MARGENS, Margens } from '@/lib/orcamento-types';
import { usePriceCatalog } from '@/hooks/usePriceCatalog';
import { 
  calcularParedes, 
  calcularRadier, 
  calcularLaje,
  consolidarOrcamento,
  formatCurrency,
  formatNumber
} from '@/lib/orcamento-calculos';
import { PdfUpload } from '@/components/orcamento/PdfUpload';
import { ReviewExtraction } from '@/components/orcamento/ReviewExtraction';
import { LajeForm, LajeItem, calcularLajeResultado } from '@/components/orcamento/LajeForm';
import { RebocoForm, RebocoInput, calcularRebocoResultado } from '@/components/orcamento/RebocoForm';
import { Link } from 'react-router-dom';

interface ExtractedData {
  area_total_m2: number;
  pe_direito_m: number;
  perimetro_externo_m: number;
  paredes_internas_m: number;
  aberturas_m2: number;
  confianca: number;
  observacoes: string;
}

const steps = [
  { id: 'projeto', label: 'Projeto', icon: DollarSign },
  { id: 'paredes', label: 'Paredes', icon: Layers },
  { id: 'radier', label: 'Radier', icon: Square },
  { id: 'laje', label: 'Laje', icon: Grid3X3 },
  { id: 'reboco', label: 'Reboco', icon: PaintBucket },
  { id: 'acabamentos', label: 'Acabamentos', icon: Sparkles },
  { id: 'margens', label: 'Margens', icon: Percent },
  { id: 'relatorio', label: 'Relatório', icon: FileText },
];

export default function NovoOrcamento() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [showReview, setShowReview] = useState(false);

  // Fetch prices from global catalog
  const { items: catalogItems, isLoading: loadingPrecos, mapCatalogToPrecos } = usePriceCatalog();
  const precos = mapCatalogToPrecos();

  // Form state
  const [projeto, setProjeto] = useState({
    cliente: '',
    codigo: `ORC-${Date.now()}`,
    projeto: '',
    areaTotal: 0,
    peDireito: 2.80,
    perimetroExterno: 0,
    paredesInternas: 0,
    aberturas: 0,
  });

  const [margens, setMargens] = useState<Margens>(DEFAULT_MARGENS);

  const [paredes, setParedes] = useState({
    areaLiquidaM2: 0,
    tipoForma: '18' as '18' | '12',
  });

  const [radier, setRadier] = useState({
    areaM2: 0,
    espessuraCm: 10,
    tipoFibra: 'aco' as 'aco' | 'pp',
  });

  const [lajes, setLajes] = useState<LajeItem[]>([
    { id: 'laje-1', nome: 'Laje principal', areaM2: 0, espessuraM: 0.12 }
  ]);

  const [reboco, setReboco] = useState<RebocoInput>({
    areaInternaM2: 0,
    areaExternaM2: 0,
  });

  // Handle extracted data from AI
  const handleDataExtracted = (data: ExtractedData) => {
    setExtractedData(data);
    setShowReview(true);
  };

  const handleConfirmExtraction = (data: ExtractedData) => {
    // Calculate area líquida de paredes
    const areaParedes = (data.perimetro_externo_m + data.paredes_internas_m) * data.pe_direito_m - data.aberturas_m2;
    
    // Update project data
    setProjeto({
      ...projeto,
      areaTotal: data.area_total_m2,
      peDireito: data.pe_direito_m,
      perimetroExterno: data.perimetro_externo_m,
      paredesInternas: data.paredes_internas_m,
      aberturas: data.aberturas_m2,
    });
    
    // Update paredes
    setParedes({
      ...paredes,
      areaLiquidaM2: areaParedes,
    });
    
    // Update radier with area
    setRadier({
      ...radier,
      areaM2: data.area_total_m2,
    });
    
    setShowReview(false);
    toast({
      title: 'Dados aplicados!',
      description: 'Os campos foram preenchidos automaticamente.',
    });
  };

  // Calculate results
  const resultadoParedes = paredes.areaLiquidaM2 > 0 
    ? calcularParedes({ ...paredes, espessuraCm: paredes.tipoForma === '18' ? 18 : 12 }, precos)
    : null;

  const resultadoRadier = radier.areaM2 > 0 
    ? calcularRadier(radier, precos)
    : null;

  // Calculate laje using new component function
  const resultadoLajeCalc = calcularLajeResultado(lajes, precos);
  
  // Map to the expected format for consolidado
  const resultadoLaje = resultadoLajeCalc.areaTotalM2 > 0 ? {
    linhas: lajes.filter(l => l.areaM2 > 0).map(l => ({
      descricao: l.nome,
      areaM2: l.areaM2,
      volumeM3: l.areaM2 * l.espessuraM,
      custoConcreto: l.areaM2 * l.espessuraM * precos.concretoM3,
      custoMaoObra: l.areaM2 * precos.maoObraLaje,
      custoTotal: (l.areaM2 * l.espessuraM * precos.concretoM3) + (l.areaM2 * precos.maoObraLaje),
    })),
    areaTotalM2: resultadoLajeCalc.areaTotalM2,
    volumeTotalM3: resultadoLajeCalc.volumeTotalM3,
    custoTotal: resultadoLajeCalc.custoTotal,
    precoPorM2: resultadoLajeCalc.areaTotalM2 > 0 ? resultadoLajeCalc.custoTotal / resultadoLajeCalc.areaTotalM2 : 0,
  } : null;

  // Calculate reboco
  const resultadoRebocoCalc = calcularRebocoResultado(reboco, precos);
  const resultadoReboco = resultadoRebocoCalc.areaTotal > 0 ? resultadoRebocoCalc : null;

  const consolidado = consolidarOrcamento(
    { 
      paredes: resultadoParedes || undefined, 
      radier: resultadoRadier || undefined, 
      laje: resultadoLaje || undefined,
      reboco: resultadoReboco || undefined,
    },
    margens,
    projeto.areaTotal || radier.areaM2
  );

  const salvarOrcamento = async () => {
    if (!projeto.cliente) {
      toast({ title: 'Preencha o nome do cliente', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('orcamentos')
        .insert({
          user_id: user?.id,
          codigo: projeto.codigo,
          cliente: projeto.cliente,
          projeto: projeto.projeto,
          status: 'em_andamento',
          area_total_m2: projeto.areaTotal || radier.areaM2,
          valor_total: consolidado.totalVenda,
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: 'Orçamento salvo com sucesso!' });
      navigate('/orcamentos');
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const nextStep = () => setCurrentStep(Math.min(steps.length - 1, currentStep + 1));
  const prevStep = () => setCurrentStep(Math.max(0, currentStep - 1));

  return (
    <MainLayout>
      <div className="animate-fade-in max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" onClick={() => navigate('/orcamentos')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Novo Orçamento ICF</h1>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2">
          {steps.map((step, index) => (
            <button
              key={step.id}
              onClick={() => setCurrentStep(index)}
              className={`wizard-step whitespace-nowrap ${
                index < currentStep ? 'completed' : index === currentStep ? 'active' : 'pending'
              }`}
            >
              {index < currentStep ? <Check className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="card-elevated p-6 mb-6">
{currentStep === 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Dados do Projeto e Preços</h2>
              </div>
              
              {/* PDF Upload Section */}
              <div className="bg-accent/30 rounded-xl p-6 border border-accent">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Upload className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Upload de Planta (PDF)</h3>
                    <p className="text-sm text-muted-foreground">Extraia dados automaticamente com IA</p>
                  </div>
                </div>
                <PdfUpload onDataExtracted={handleDataExtracted} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="input-group">
                  <Label className="input-label">Cliente *</Label>
                  <Input value={projeto.cliente} onChange={(e) => setProjeto({...projeto, cliente: e.target.value})} placeholder="Nome do cliente" />
                </div>
                <div className="input-group">
                  <Label className="input-label">Código</Label>
                  <Input value={projeto.codigo} onChange={(e) => setProjeto({...projeto, codigo: e.target.value})} />
                </div>
                <div className="input-group">
                  <Label className="input-label">Área Total (m²)</Label>
                  <Input type="number" value={projeto.areaTotal || ''} onChange={(e) => setProjeto({...projeto, areaTotal: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="input-group">
                  <Label className="input-label">Pé-Direito (m)</Label>
                  <Input type="number" step="0.1" value={projeto.peDireito || ''} onChange={(e) => setProjeto({...projeto, peDireito: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              
              {/* Global Prices Info */}
              <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-md font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-primary" />
                    Preços do Catálogo Global
                  </h3>
                  <Link to="/precos">
                    <Button variant="ghost" size="sm" className="text-primary">
                      <ExternalLink className="w-4 h-4 mr-1" />
                      Gerenciar Preços
                    </Button>
                  </Link>
                </div>
                {loadingPrecos ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Carregando preços...
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="flex justify-between p-2 bg-background rounded-lg">
                      <span className="text-muted-foreground">Forma ICF 18cm:</span>
                      <span className="font-medium">{formatCurrency(precos.formaIcf18)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-background rounded-lg">
                      <span className="text-muted-foreground">Forma ICF 12cm:</span>
                      <span className="font-medium">{formatCurrency(precos.formaIcf12)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-background rounded-lg">
                      <span className="text-muted-foreground">Concreto/m³:</span>
                      <span className="font-medium">{formatCurrency(precos.concretoM3)}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-background rounded-lg">
                      <span className="text-muted-foreground">M.O. Parede/m²:</span>
                      <span className="font-medium">{formatCurrency(precos.maoObraParede)}</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">
                  Os preços são carregados automaticamente do catálogo da empresa.
                </p>
              </div>
            </div>
          )}

          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Paredes ICF</h2>
              <p className="text-muted-foreground text-sm">Cada forma ICF = 0,5 m² (1,25 × 0,40)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="input-group">
                  <Label className="input-label">Área Líquida (m²)</Label>
                  <Input type="number" value={paredes.areaLiquidaM2 || ''} onChange={(e) => setParedes({...paredes, areaLiquidaM2: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="input-group">
                  <Label className="input-label">Tipo de Forma</Label>
                  <select value={paredes.tipoForma} onChange={(e) => setParedes({...paredes, tipoForma: e.target.value as '18' | '12'})} className="input-field">
                    <option value="18">18 cm</option>
                    <option value="12">12 cm</option>
                  </select>
                </div>
              </div>
              {resultadoParedes && (
                <div className="bg-accent/50 rounded-lg p-4 mt-4">
                  <h3 className="font-medium mb-2">Resultado Paredes</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Formas: {resultadoParedes.quantidadeFormas} un</div>
                    <div>Custo Total: {formatCurrency(resultadoParedes.custoTotal)}</div>
                    <div>Preço/m²: {formatCurrency(resultadoParedes.precoPorM2)}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Radier</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="input-group">
                  <Label className="input-label">Área (m²)</Label>
                  <Input type="number" value={radier.areaM2 || ''} onChange={(e) => setRadier({...radier, areaM2: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="input-group">
                  <Label className="input-label">Espessura (cm)</Label>
                  <Input type="number" value={radier.espessuraCm} onChange={(e) => setRadier({...radier, espessuraCm: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="input-group">
                  <Label className="input-label">Tipo Fibra</Label>
                  <select value={radier.tipoFibra} onChange={(e) => setRadier({...radier, tipoFibra: e.target.value as 'aco' | 'pp'})} className="input-field">
                    <option value="aco">Aço (25 kg/m³)</option>
                    <option value="pp">PP (5 kg/m³)</option>
                  </select>
                </div>
              </div>
              {resultadoRadier && (
                <div className="bg-accent/50 rounded-lg p-4 mt-4">
                  <h3 className="font-medium mb-2">Resultado Radier</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>Volume: {formatNumber(resultadoRadier.volumeM3)} m³</div>
                    <div>Custo Total: {formatCurrency(resultadoRadier.custoTotal)}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {currentStep === 6 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Margens e BDI</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="input-group">
                  <Label className="input-label">Lucro (%)</Label>
                  <Input type="number" value={margens.lucroPercent} onChange={(e) => setMargens({...margens, lucroPercent: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="input-group">
                  <Label className="input-label">BDI (%)</Label>
                  <Input type="number" value={margens.bdiPercent} onChange={(e) => setMargens({...margens, bdiPercent: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="input-group">
                  <Label className="input-label">Desconto (%)</Label>
                  <Input type="number" value={margens.descontoPercent} onChange={(e) => setMargens({...margens, descontoPercent: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
            </div>
          )}

          {currentStep === 7 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Relatório Consolidado</h2>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="kpi-card"><div className="kpi-value">{formatCurrency(consolidado.custoParedes)}</div><div className="kpi-label">Paredes</div></div>
                <div className="kpi-card"><div className="kpi-value">{formatCurrency(consolidado.custoRadier)}</div><div className="kpi-label">Radier</div></div>
                <div className="kpi-card"><div className="kpi-value">{formatCurrency(consolidado.custoLaje)}</div><div className="kpi-label">Laje</div></div>
                <div className="kpi-card"><div className="kpi-value">{formatCurrency(consolidado.custoReboco)}</div><div className="kpi-label">Reboco</div></div>
                <div className="kpi-card"><div className="kpi-value">{formatNumber(resultadoLajeCalc.volumeTotalM3, 2)} m³</div><div className="kpi-label">Volume Laje</div></div>
              </div>
              <div className="bg-primary/10 rounded-xl p-6 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="text-muted-foreground">Subtotal:</span> <span className="font-medium">{formatCurrency(consolidado.subtotal)}</span></div>
                  <div><span className="text-muted-foreground">Lucro:</span> <span className="font-medium">{formatCurrency(consolidado.lucro)}</span></div>
                  <div><span className="text-muted-foreground">BDI:</span> <span className="font-medium">{formatCurrency(consolidado.bdi)}</span></div>
                  <div><span className="text-muted-foreground">Desconto:</span> <span className="font-medium">-{formatCurrency(consolidado.desconto)}</span></div>
                </div>
                <div className="border-t border-primary/20 mt-4 pt-4 flex justify-between items-center">
                  <div className="text-xl font-bold text-primary">TOTAL: {formatCurrency(consolidado.totalVenda)}</div>
                  <div className="text-muted-foreground">{formatCurrency(consolidado.precoPorM2Global)}/m²</div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Laje */}
          {currentStep === 3 && (
            <LajeForm
              lajes={lajes}
              onLajesChange={setLajes}
              precos={precos}
              resultado={resultadoLajeCalc}
            />
          )}

          {/* Step 4: Reboco */}
          {currentStep === 4 && (
            <RebocoForm
              reboco={reboco}
              onRebocoChange={setReboco}
              precos={precos}
              resultado={resultadoRebocoCalc}
            />
          )}

          {/* Skip step 5 for brevity - show placeholder */}
          {currentStep === 5 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>Etapa {steps[currentStep].label} - Configure conforme necessário</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={prevStep} disabled={currentStep === 0}>
            <ArrowLeft className="w-4 h-4 mr-2" />Anterior
          </Button>
          {currentStep === steps.length - 1 ? (
            <Button onClick={salvarOrcamento} disabled={saving} className="btn-primary">
              <Save className="w-4 h-4 mr-2" />{saving ? 'Salvando...' : 'Salvar Orçamento'}
            </Button>
          ) : (
            <Button onClick={nextStep} className="btn-primary">
              Próximo<ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* Review Modal */}
      {showReview && extractedData && (
        <ReviewExtraction
          data={extractedData}
          onConfirm={handleConfirmExtraction}
          onCancel={() => setShowReview(false)}
        />
      )}
    </MainLayout>
  );
}
