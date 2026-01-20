import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  ExternalLink,
  Download,
  CloudOff,
  Cloud,
  Loader2,
  AlertTriangle,
  Lock
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
import { LajeForm, LajeInput, calcularLajeResultado } from '@/components/orcamento/LajeForm';
import { RebocoForm, RebocoInput, calcularRebocoResultado } from '@/components/orcamento/RebocoForm';
import { AcabamentosForm, AcabamentosInput, calcularAcabamentosResultado } from '@/components/orcamento/AcabamentosForm';
import { ParedesForm, ParedesInput, calcularParedesResultado } from '@/components/orcamento/ParedesForm';
import { ApprovalSection } from '@/components/orcamento/ApprovalSection';
import { ClienteForm, type ClienteFormData } from '@/components/orcamento/ClienteForm';
import { Link } from 'react-router-dom';
import { exportarOrcamentoPDF } from '@/lib/pdf-export';
import { exportarPropostaComercialPDF, TipoProposta } from '@/lib/pdf-proposta-comercial';
import { useOrcamentoData } from '@/hooks/useOrcamentoData';
import { validateClienteData, formatDocument, onlyDigits } from '@/lib/document-validation';

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
  const { id: orcamentoIdFromUrl } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [tipoProposta, setTipoProposta] = useState<TipoProposta>('parede_cinza');
  const [approvalStatus, setApprovalStatus] = useState<'PENDENTE' | 'APROVADA' | 'NEGADA' | null>(null);
  const [clienteValido, setClienteValido] = useState(false);
  const [showClienteErrors, setShowClienteErrors] = useState(false);

  // Fetch prices from global catalog
  const { 
    items: catalogItems, 
    isLoading: loadingPrecos, 
    mapCatalogToPrecos, 
    getIcflexPrice, 
    getRebocoMaoObraPrice,
    getConcretoOptions,
    getMaoObraLajePrice,
    getAcabamentosPrecos
  } = usePriceCatalog();
  const precos = mapCatalogToPrecos();
  const precoIcflexM2 = getIcflexPrice();
  const precoMaoObraRebocoM2 = getRebocoMaoObraPrice();
  const concretoOptions = getConcretoOptions();
  const precoMaoObraLajeM2 = getMaoObraLajePrice();
  const precosAcabamentos = getAcabamentosPrecos();

  // Use centralized orcamento data hook
  const {
    orcamentoId,
    isLoading: isLoadingOrcamento,
    isSaving: isAutoSaving,
    lastSaved,
    saveError,
    isPaused,
    dataLoaded,
    projeto,
    paredes,
    radier,
    laje,
    reboco,
    acabamentos,
    margens,
    currentStep,
    setProjeto,
    setParedes,
    setRadier,
    setLaje,
    setReboco,
    setAcabamentos,
    setMargens,
    setCurrentStep,
    saveWithResultados,
    retrySave,
    finalizeDraft,
    discardDraft,
  } = useOrcamentoData({
    userId: user?.id,
    orcamentoIdFromUrl: orcamentoIdFromUrl || null,
    debounceMs: 1500,
  });

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
    
    // Update paredes with extracted data
    setParedes({
      ...paredes,
      areaExternaM2: areaParedes * 0.7, // Estimate: 70% external
      areaInternaM2: areaParedes * 0.3, // Estimate: 30% internal
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

  // Calculate results using new ParedesForm function
  const resultadoParedesCalc = calcularParedesResultado(paredes, precos);
  const resultadoParedes = resultadoParedesCalc.areaLiquidaTotal > 0 
    ? resultadoParedesCalc
    : null;

  const resultadoRadier = radier.areaM2 > 0 
    ? calcularRadier(radier, precos)
    : null;

  // Calculate laje using new component function with FCK selection
  const resultadoLajeCalc = calcularLajeResultado(laje, concretoOptions, precoMaoObraLajeM2, projeto.areaTotal || radier.areaM2);
  
  // Map to the expected format for consolidado
  const resultadoLaje = resultadoLajeCalc.areaTotalM2 > 0 ? {
    linhas: [{
      descricao: resultadoLajeCalc.tipoNome,
      areaM2: resultadoLajeCalc.areaTotalM2,
      volumeM3: resultadoLajeCalc.volumeTotalM3,
      custoConcreto: resultadoLajeCalc.custoConcreto,
      custoMaoObra: resultadoLajeCalc.custoMaoObra,
      custoTotal: resultadoLajeCalc.custoTotal,
    }],
    areaTotalM2: resultadoLajeCalc.areaTotalM2,
    volumeTotalM3: resultadoLajeCalc.volumeTotalM3,
    custoTotal: resultadoLajeCalc.custoTotal,
    precoPorM2: resultadoLajeCalc.areaTotalM2 > 0 ? resultadoLajeCalc.custoTotal / resultadoLajeCalc.areaTotalM2 : 0,
    // New fields for PDF export
    tipo: resultadoLajeCalc.tipo,
    tipoNome: resultadoLajeCalc.tipoNome,
    concretoNome: resultadoLajeCalc.concretoNome,
    espessuraM: resultadoLajeCalc.espessuraM,
    custoConcreto: resultadoLajeCalc.custoConcreto,
    custoMaoObra: resultadoLajeCalc.custoMaoObra,
  } : null;

  // Calculate reboco - using paredes result
  const resultadoRebocoCalc = calcularRebocoResultado(reboco, resultadoParedesCalc, precoIcflexM2, precoMaoObraRebocoM2);
  const resultadoReboco = resultadoRebocoCalc.areaTotal > 0 ? resultadoRebocoCalc : null;

  // Calculate acabamentos with automatic area from Radier and Reboco
  const resultadoAcabamentosCalc = calcularAcabamentosResultado(
    acabamentos, 
    precosAcabamentos,
    resultadoRadier,
    resultadoRebocoCalc
  );
  const resultadoAcabamentos = resultadoAcabamentosCalc.custoTotal > 0 ? resultadoAcabamentosCalc : null;

  const consolidado = consolidarOrcamento(
    { 
      paredes: resultadoParedes || undefined, 
      radier: resultadoRadier || undefined, 
      laje: resultadoLaje || undefined,
      reboco: resultadoReboco || undefined,
      acabamentos: resultadoAcabamentos || undefined,
    },
    margens,
    projeto.areaTotal || radier.areaM2
  );

  // Save resultados whenever calculations change (debounced via the hook)
  useEffect(() => {
    if (!isLoadingOrcamento && projeto.cliente && consolidado.subtotal > 0) {
      saveWithResultados({
        paredes: resultadoParedes,
        radier: resultadoRadier,
        laje: resultadoLaje,
        reboco: resultadoReboco,
        acabamentos: resultadoAcabamentos,
        consolidado,
      });
    }
  }, [consolidado.subtotal]);

  const salvarOrcamento = async () => {
    if (!projeto.cliente) {
      toast({ title: 'Preencha o nome do cliente', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // Try to finalize existing draft first
      const finalized = await finalizeDraft(consolidado.totalVenda);
      
      if (finalized) {
        toast({ title: 'Orçamento salvo com sucesso!' });
        navigate('/orcamentos');
        return;
      }

      // Fallback: create new if no draft exists
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

  const handleDiscardDraft = async () => {
    await discardDraft();
    toast({ title: 'Rascunho descartado', description: 'Iniciando novo orçamento.' });
  };

  const handleNextStep = () => {
    // Block advancing from step 0 if client data is invalid
    if (currentStep === 0) {
      if (!clienteValido) {
        setShowClienteErrors(true);
        toast({
          title: 'Preencha os dados do cliente',
          description: 'É necessário preencher os dados do cliente corretamente para continuar.',
          variant: 'destructive',
        });
        return;
      }
    }
    setCurrentStep(Math.min(steps.length - 1, currentStep + 1));
  };
  
  const prevStep = () => setCurrentStep(Math.max(0, currentStep - 1));
  
  // Handle cliente form data changes
  const handleClienteFormChange = useCallback((data: ClienteFormData) => {
    setProjeto(prev => ({
      ...prev,
      cliente: data.clienteNome,
      clienteTipo: data.clienteTipo,
      clienteDocumento: data.clienteDocumento,
      clienteResponsavel: data.clienteResponsavel,
    }));
  }, [setProjeto]);

  // Prepare cliente form data from projeto
  const clienteFormData: ClienteFormData = {
    clienteTipo: projeto.clienteTipo || 'PF',
    clienteNome: projeto.cliente,
    clienteDocumento: projeto.clienteDocumento 
      ? formatDocument(projeto.clienteDocumento, projeto.clienteTipo || 'PF')
      : '',
    clienteResponsavel: projeto.clienteResponsavel || '',
  };

  // Show loading while data is being loaded
  if (isLoadingOrcamento) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando orçamento...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="animate-fade-in max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" onClick={() => navigate('/orcamentos')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            
            {/* Auto-save status */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {isPaused && saveError ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                  <span className="text-destructive max-w-[200px] truncate" title={saveError}>
                    Erro ao salvar
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={retrySave}
                    className="text-primary"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Tentar novamente
                  </Button>
                </>
              ) : isAutoSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : lastSaved ? (
                <>
                  <Cloud className="w-4 h-4 text-primary" />
                  <span>Salvo às {lastSaved.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                </>
              ) : projeto.cliente ? (
                <>
                  <CloudOff className="w-4 h-4" />
                  <span>Não salvo</span>
                </>
              ) : null}
              
              {lastSaved && !isPaused && !orcamentoIdFromUrl && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleDiscardDraft}
                  className="text-destructive hover:text-destructive"
                >
                  Descartar rascunho
                </Button>
              )}
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            {orcamentoIdFromUrl ? `Orçamento ${projeto.codigo}` : 'Novo Orçamento ICF'}
          </h1>
          {orcamentoIdFromUrl && projeto.cliente && (
            <p className="text-muted-foreground mt-1">Cliente: {projeto.cliente}</p>
          )}
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
                <h2 className="text-lg font-semibold">Dados do Cliente e Projeto</h2>
              </div>
              
              {/* Client Data Section */}
              <div className="bg-accent/30 rounded-xl p-6 border border-accent">
                <h3 className="font-medium text-foreground mb-4">Dados do Cliente *</h3>
                <ClienteForm
                  data={clienteFormData}
                  onChange={handleClienteFormChange}
                  onValidationChange={setClienteValido}
                  showErrors={showClienteErrors}
                />
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

              {/* Project fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="input-group">
                  <Label htmlFor="codigo" className="input-label">Código do Orçamento</Label>
                  <Input id="codigo" name="codigo" value={projeto.codigo} onChange={(e) => setProjeto({...projeto, codigo: e.target.value})} />
                </div>
                <div className="input-group">
                  <Label htmlFor="area_total" className="input-label">Área Total (m²)</Label>
                  <Input id="area_total" name="area_total" type="number" value={projeto.areaTotal || ''} onChange={(e) => setProjeto({...projeto, areaTotal: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="input-group">
                  <Label htmlFor="pe_direito" className="input-label">Pé-Direito (m)</Label>
                  <Input id="pe_direito" name="pe_direito" type="number" step="0.1" value={projeto.peDireito || ''} onChange={(e) => setProjeto({...projeto, peDireito: parseFloat(e.target.value) || 0})} />
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
            <ParedesForm
              paredes={paredes}
              onParedesChange={setParedes}
              precos={precos}
              resultado={resultadoParedesCalc}
            />
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Radier</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="input-group">
                  <Label htmlFor="radier_area" className="input-label">Área (m²)</Label>
                  <Input id="radier_area" name="radier_area" type="number" value={radier.areaM2 || ''} onChange={(e) => setRadier({...radier, areaM2: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="input-group">
                  <Label htmlFor="radier_espessura" className="input-label">Espessura (cm)</Label>
                  <Input id="radier_espessura" name="radier_espessura" type="number" value={radier.espessuraCm} onChange={(e) => setRadier({...radier, espessuraCm: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="input-group">
                  <Label htmlFor="radier_tipo_fibra" className="input-label">Tipo Fibra</Label>
                  <select id="radier_tipo_fibra" name="radier_tipo_fibra" value={radier.tipoFibra} onChange={(e) => setRadier({...radier, tipoFibra: e.target.value as 'aco' | 'pp'})} className="input-field">
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
                  <Label htmlFor="lucro_percent" className="input-label">Lucro (%)</Label>
                  <Input id="lucro_percent" name="lucro_percent" type="number" value={margens.lucroPercent} onChange={(e) => setMargens({...margens, lucroPercent: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="input-group">
                  <Label htmlFor="bdi_percent" className="input-label">BDI (%)</Label>
                  <Input id="bdi_percent" name="bdi_percent" type="number" value={margens.bdiPercent} onChange={(e) => setMargens({...margens, bdiPercent: parseFloat(e.target.value) || 0})} />
                </div>
                <div className="input-group">
                  <Label htmlFor="desconto_percent" className="input-label">Desconto (%)</Label>
                  <Input id="desconto_percent" name="desconto_percent" type="number" value={margens.descontoPercent} onChange={(e) => setMargens({...margens, descontoPercent: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              
              {/* Margem Total Display */}
              {consolidado.subtotal > 0 && (
                <div className={`rounded-lg p-4 flex items-center gap-3 ${
                  (margens.lucroPercent + margens.bdiPercent - margens.descontoPercent) < 15 
                    ? 'bg-amber-500/10 border border-amber-500/30' 
                    : 'bg-primary/10 border border-primary/30'
                }`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    (margens.lucroPercent + margens.bdiPercent - margens.descontoPercent) < 15 
                      ? 'bg-amber-500/20' 
                      : 'bg-primary/20'
                  }`}>
                    <Percent className={`w-5 h-5 ${
                      (margens.lucroPercent + margens.bdiPercent - margens.descontoPercent) < 15 
                        ? 'text-amber-600' 
                        : 'text-primary'
                    }`} />
                  </div>
                  <div>
                    <p className="font-medium">Margem Total: {(margens.lucroPercent + margens.bdiPercent - margens.descontoPercent).toFixed(1)}%</p>
                    {(margens.lucroPercent + margens.bdiPercent - margens.descontoPercent) < 15 && (
                      <p className="text-sm text-amber-600">
                        <AlertTriangle className="w-3 h-3 inline mr-1" />
                        Margem abaixo de 15% requer aprovação do Gestor
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Approval Section */}
              {(margens.lucroPercent + margens.bdiPercent - margens.descontoPercent) < 15 && (
                <ApprovalSection 
                  orcamentoId={orcamentoId}
                  orcamentoCodigo={projeto.codigo}
                  marginPercent={margens.lucroPercent + margens.bdiPercent - margens.descontoPercent}
                  onApprovalStatusChange={setApprovalStatus}
                />
              )}
            </div>
          )}

          {currentStep === 7 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="text-lg font-semibold">Relatório Consolidado</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Relatório Detalhado - apenas admin */}
                  {isAdmin && (
                    <Button 
                      variant="outline" 
                      onClick={() => exportarOrcamentoPDF({
                        projeto,
                        consolidado,
                        resultadoParedes,
                        resultadoRadier,
                        resultadoLaje: resultadoLajeCalc,
                        resultadoReboco: resultadoRebocoCalc,
                        resultadoAcabamentos: resultadoAcabamentosCalc,
                        margens,
                      })}
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Relatório Detalhado (Admin)
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Proposta Comercial Section - Vendedor UI */}
              {(() => {
                const marginTotal = margens.lucroPercent + margens.bdiPercent - margens.descontoPercent;
                const needsApproval = marginTotal < 15;
                const canGenerateProposta = isAdmin || !needsApproval || approvalStatus === 'APROVADA';
                
                return (
                  <div className="bg-accent/30 rounded-xl p-5 border border-accent">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-foreground">Proposta Comercial (PDF)</h3>
                        <p className="text-sm text-muted-foreground">
                          {isAdmin ? 'Gere a proposta para o cliente' : 'Documento para apresentar ao cliente'}
                        </p>
                      </div>
                    </div>
                    
                    {canGenerateProposta ? (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        <div className="flex-1 w-full sm:w-auto">
                          <Label htmlFor="tipo_proposta" className="text-sm text-muted-foreground mb-1 block">
                            Tipo de proposta
                          </Label>
                          <select 
                            id="tipo_proposta" 
                            name="tipo_proposta"
                            value={tipoProposta}
                            onChange={(e) => setTipoProposta(e.target.value as TipoProposta)}
                            className="input-field w-full sm:w-[240px]"
                          >
                            <option value="parede_cinza">Parede Cinza (sem acabamentos)</option>
                            <option value="obra_completa">Obra Completa (com acabamentos)</option>
                          </select>
                        </div>
                        
                        <Button 
                          variant="default"
                          onClick={async () => {
                            // Get vendor name from profile
                            let nomeVendedor = '-';
                            if (user?.id) {
                              const { data: profile } = await supabase
                                .from('profiles')
                                .select('full_name')
                                .eq('user_id', user.id)
                                .single();
                              nomeVendedor = profile?.full_name || user?.email || '-';
                            }
                            
                            await exportarPropostaComercialPDF({
                              cliente: projeto.cliente,
                              codigo: projeto.codigo,
                              projeto: projeto.projeto,
                              areaTotal: projeto.areaTotal || radier.areaM2,
                              valorTotal: consolidado.totalVenda,
                              valorPorM2: consolidado.precoPorM2Global,
                              nomeVendedor,
                              dataGeracao: new Date(),
                              tipoProposta,
                            });
                          }}
                          className="flex items-center gap-2 btn-primary sm:mt-5"
                        >
                          <FileText className="w-4 h-4" />
                          Gerar Proposta Comercial (PDF)
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <Lock className="w-5 h-5 text-amber-600" />
                        <div>
                          <p className="font-medium text-amber-700">Proposta necessita de aprovação do Gestor</p>
                          <p className="text-sm text-amber-600">
                            {approvalStatus === 'PENDENTE' 
                              ? 'Sua solicitação está sendo analisada.' 
                              : approvalStatus === 'NEGADA'
                                ? 'Solicitação negada. Revise a margem e solicite novamente.'
                                : 'Margem abaixo de 15%. Solicite aprovação na aba Margens.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="kpi-card"><div className="kpi-value">{formatCurrency(consolidado.custoParedes)}</div><div className="kpi-label">Paredes</div></div>
                <div className="kpi-card"><div className="kpi-value">{formatCurrency(consolidado.custoRadier)}</div><div className="kpi-label">Radier</div></div>
                <div className="kpi-card"><div className="kpi-value">{formatCurrency(consolidado.custoLaje)}</div><div className="kpi-label">Laje</div></div>
                <div className="kpi-card"><div className="kpi-value">{formatCurrency(consolidado.custoReboco)}</div><div className="kpi-label">Reboco</div></div>
                <div className="kpi-card"><div className="kpi-value">{formatCurrency(consolidado.custoAcabamentos)}</div><div className="kpi-label">Acabamentos</div></div>
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
              laje={laje}
              onLajeChange={setLaje}
              concretoOptions={concretoOptions}
              precoMaoObraLajeM2={precoMaoObraLajeM2}
              areaProjetoM2={projeto.areaTotal || radier.areaM2}
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
              resultadoParedes={resultadoParedesCalc}
              precoIcflexM2={precoIcflexM2}
              precoMaoObraRebocoM2={precoMaoObraRebocoM2}
            />
          )}

          {/* Step 5: Acabamentos */}
          {currentStep === 5 && (
            <AcabamentosForm
              acabamentos={acabamentos}
              onAcabamentosChange={setAcabamentos}
              precos={precos}
              precosAcabamentos={precosAcabamentos}
              resultado={resultadoAcabamentosCalc}
              resultadoRadier={resultadoRadier}
              resultadoReboco={resultadoRebocoCalc}
            />
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button variant="outline" onClick={prevStep} disabled={currentStep === 0}>
            <ArrowLeft className="w-4 h-4 mr-2" />Anterior
          </Button>
          {currentStep === steps.length - 1 ? (
            <>
              {/* Check if needs approval and is not approved */}
              {(() => {
                const marginTotal = margens.lucroPercent + margens.bdiPercent - margens.descontoPercent;
                const needsApproval = marginTotal < 15;
                const canFinalize = !needsApproval || approvalStatus === 'APROVADA' || isAdmin;
                
                if (!canFinalize) {
                  return (
                    <div className="flex items-center gap-3">
                      {/* Preview interno sempre disponível */}
                      <Button 
                        variant="outline" 
                        onClick={() => exportarOrcamentoPDF({
                          projeto,
                          consolidado,
                          resultadoParedes,
                          resultadoRadier,
                          resultadoLaje: resultadoLajeCalc,
                          resultadoReboco: resultadoRebocoCalc,
                          resultadoAcabamentos: resultadoAcabamentosCalc,
                          margens,
                        })}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Prévia (Interna)
                      </Button>
                      <Button disabled className="opacity-50">
                        <Lock className="w-4 h-4 mr-2" />
                        {approvalStatus === 'PENDENTE' ? 'Aguardando Aprovação' : 
                         approvalStatus === 'NEGADA' ? 'Proposta Negada' : 'Requer Aprovação'}
                      </Button>
                    </div>
                  );
                }
                
                return (
                  <Button onClick={salvarOrcamento} disabled={saving} className="btn-primary">
                    <Save className="w-4 h-4 mr-2" />{saving ? 'Salvando...' : 'Salvar Orçamento'}
                  </Button>
                );
              })()}
            </>
          ) : (
            <Button onClick={handleNextStep} className="btn-primary">
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
