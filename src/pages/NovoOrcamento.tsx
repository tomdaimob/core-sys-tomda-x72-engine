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
  Bath,
  RefreshCw,
  ExternalLink,
  Download,
  CloudOff,
  Cloud,
  Loader2,
  AlertTriangle,
  Lock,
  DoorOpen,
  Building2,
  Paperclip
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
import { ProjetoUpload } from '@/components/orcamento/ProjetoUpload';
import { ReviewExtraction } from '@/components/orcamento/ReviewExtraction';
import { LajeForm, LajeInput, calcularLajeResultado } from '@/components/orcamento/LajeForm';
import { RebocoForm, RebocoInput, calcularRebocoResultado } from '@/components/orcamento/RebocoForm';
import { AcabamentosForm, AcabamentosInput, calcularAcabamentosResultado } from '@/components/orcamento/AcabamentosForm';
import { ParedesForm, ParedesInput, calcularParedesResultado } from '@/components/orcamento/ParedesForm';
import { RevestimentoForm, calcularRevestimentoResultado } from '@/components/orcamento/RevestimentoForm';
import { PortasPortoesForm, calcularPortasPortoesResultado, type PortasPortoesInput } from '@/components/orcamento/PortasPortoesForm';
import { RadierBaldrameForm } from '@/components/orcamento/RadierBaldrameForm';
import { ApprovalSection } from '@/components/orcamento/ApprovalSection';
import { ClienteForm, type ClienteFormData } from '@/components/orcamento/ClienteForm';
import { MargensForm } from '@/components/orcamento/MargensForm';
import { TipoPropostaSelector } from '@/components/orcamento/TipoPropostaSelector';
import { AdminPdfAttachments } from '@/components/orcamento/AdminPdfAttachments';
import { PavimentosSection } from '@/components/orcamento/PavimentosSection';
import { Link } from 'react-router-dom';
import { exportarOrcamentoPDF } from '@/lib/pdf-export';
import { exportarPropostaComercialPDF, TipoProposta } from '@/lib/pdf-proposta-comercial';
import { useOrcamentoData } from '@/hooks/useOrcamentoData';
import { validateClienteData, formatDocument, onlyDigits } from '@/lib/document-validation';
import { useDiscountSystem } from '@/hooks/useDiscountSystem';
import { calcularBaldrame, getBaldramePrecos } from '@/lib/baldrame-calculos';
import { BaldrameInput } from '@/lib/baldrame-types';
import { SapataInput, DEFAULT_SAPATA_INPUT } from '@/lib/sapata-types';
import { calcularSapata, getSapataPrecos } from '@/lib/sapata-calculos';
import { usePavimentos } from '@/hooks/usePavimentos';

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
  { id: 'fundacao', label: 'Fundação', icon: Square },
  { id: 'laje', label: 'Laje', icon: Grid3X3 },
  { id: 'reboco', label: 'Reboco', icon: PaintBucket },
  { id: 'acabamentos', label: 'Acabamentos', icon: Sparkles },
  { id: 'revestimento', label: 'Revestimento', icon: Bath },
  { id: 'portas_portoes', label: 'Portas/Portões', icon: DoorOpen },
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
  const [discountStatus, setDiscountStatus] = useState<'DISPENSADO' | 'PENDENTE' | 'APROVADO' | 'NEGADO'>('DISPENSADO');
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
    getAcabamentosPrecos,
    getRevestimentoPrecos,
    getPortasPortoesPrecos
  } = usePriceCatalog();
  const precos = mapCatalogToPrecos();
  const precoIcflexM2 = getIcflexPrice();
  const precoMaoObraRebocoM2 = getRebocoMaoObraPrice();
  const concretoOptions = getConcretoOptions();
  const precoMaoObraLajeM2 = getMaoObraLajePrice();
  const precosAcabamentos = getAcabamentosPrecos();
  const precosRevestimento = getRevestimentoPrecos();
  const precosPortasPortoes = getPortasPortoesPrecos();

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
    baldrame,
    sapata,
    laje,
    reboco,
    acabamentos,
    revestimento,
    portasPortoes,
    margens,
    currentStep,
    setProjeto,
    setParedes,
    setRadier,
    setBaldrame,
    setSapata,
    setLaje,
    setReboco,
    setAcabamentos,
    setRevestimento,
    setPortasPortoes,
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

  // Pavimentos (multi-floor) management
  const {
    pavimentos,
    loading: loadingPavimentos,
    isMultiPavimento,
    addPavimento,
    updatePavimento,
    removePavimento,
    duplicatePavimento,
    extractMedidasForPavimento,
  } = usePavimentos(orcamentoId);

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

  // Check if fundacao is enabled
  const fundacaoEnabled = baldrame.fundacao_enabled ?? true;

  const resultadoRadier = (fundacaoEnabled && (baldrame.fundacao_tipo === 'RADIER' || baldrame.fundacao_tipo === 'RADIER_BALDRAME') && radier.areaM2 > 0) 
    ? calcularRadier(radier, precos)
    : null;

  // Calculate baldrame (only when fundacao is enabled)
  const baldramePrecos = getBaldramePrecos(catalogItems, baldrame.baldrame_fck_selected);
  const resultadoBaldrame = (
    fundacaoEnabled &&
    (baldrame.fundacao_tipo === 'BALDRAME' || baldrame.fundacao_tipo === 'RADIER_BALDRAME') && 
    baldramePrecos && 
    baldrame.baldrame_externo_m > 0
  ) ? calcularBaldrame(baldrame, baldramePrecos) : null;

  // Calculate sapata (only when fundacao is enabled and type is SAPATA)
  const sapataPrecos = getSapataPrecos(catalogItems, sapata.fck_selected);
  const resultadoSapata = (
    fundacaoEnabled &&
    baldrame.fundacao_tipo === 'SAPATA' &&
    sapataPrecos &&
    sapata.tipos.some(t => t.quantidade > 0)
  ) ? calcularSapata(sapata, sapataPrecos) : null;

  // Check if laje is enabled
  const lajeEnabled = laje.laje_enabled ?? true;

  // Calculate laje using new component function with FCK selection (only when enabled)
  const resultadoLajeCalc = calcularLajeResultado(laje, concretoOptions, precoMaoObraLajeM2, projeto.areaTotal || radier.areaM2);
  
  // Map to the expected format for consolidado (only when enabled)
  const resultadoLaje = (lajeEnabled && resultadoLajeCalc.areaTotalM2 > 0) ? {
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

  // Calculate reboco - using paredes INPUT for accurate internal/external areas
  const resultadoRebocoCalc = calcularRebocoResultado(reboco, resultadoParedesCalc, precoIcflexM2, precoMaoObraRebocoM2, paredes);
  const resultadoReboco = resultadoRebocoCalc.areaTotal > 0 ? resultadoRebocoCalc : null;

  // Calculate acabamentos with automatic area from Radier and Reboco
  const resultadoAcabamentosCalc = calcularAcabamentosResultado(
    acabamentos, 
    precosAcabamentos,
    resultadoRadier,
    resultadoRebocoCalc
  );
  const resultadoAcabamentos = resultadoAcabamentosCalc.custoTotal > 0 ? resultadoAcabamentosCalc : null;

  // Calculate revestimento (kitchen/bathroom tiling)
  const resultadoRevestimentoCalc = calcularRevestimentoResultado(revestimento, precosRevestimento);
  const resultadoRevestimento = resultadoRevestimentoCalc.areaTotalM2 > 0 ? resultadoRevestimentoCalc : null;

  // Calculate portas/portoes
  const resultadoPortasPortoesCalc = calcularPortasPortoesResultado(portasPortoes, precosPortasPortoes);
  const resultadoPortasPortoes = (tipoProposta === 'obra_completa' && resultadoPortasPortoesCalc.custoTotal > 0) 
    ? resultadoPortasPortoesCalc 
    : null;

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

  // Calculate multi-pavimento multiplier for total
  const pavimentoMultiplier = isMultiPavimento
    ? pavimentos.reduce((sum, p) => sum + p.multiplicador, 0)
    : 1;

  // Add revestimento, baldrame and portas/portoes cost to consolidado - recalculate all derived values
  const custoRevest = resultadoRevestimento?.custoTotal || 0;
  const custoPortasPortoes = resultadoPortasPortoes?.custoTotal || 0;
  const custoBaldrame = resultadoBaldrame?.custo_total || 0;
  const custoSapata = resultadoSapata?.custo_total || 0;
  
  // When multi-pavimento, multiply base costs by total floor count
  const subtotalBase = consolidado.subtotal + custoRevest + custoPortasPortoes + custoBaldrame + custoSapata;
  const subtotalComExtras = isMultiPavimento ? subtotalBase * pavimentoMultiplier : subtotalBase;
  const lucroComExtras = subtotalComExtras * (margens.lucroPercent / 100);
  const bdiComExtras = subtotalComExtras * (margens.bdiPercent / 100);
  const totalBase = subtotalComExtras + lucroComExtras + bdiComExtras;
  const descontoComExtras = totalBase * (margens.descontoPercent / 100);
  const totalVendaComExtras = totalBase - descontoComExtras;
  const areaTotal = projeto.areaTotal || radier.areaM2 || 1;
  
  const consolidadoComRevestimento = {
    ...consolidado,
    custoRevestimento: custoRevest,
    custoPortasPortoes,
    custoBaldrame,
    custoSapata,
    subtotal: subtotalComExtras,
    lucro: lucroComExtras,
    bdi: bdiComExtras,
    desconto: descontoComExtras,
    totalVenda: totalVendaComExtras,
    precoPorM2Global: totalVendaComExtras / areaTotal,
    pavimentoMultiplier: isMultiPavimento ? pavimentoMultiplier : undefined,
  };

  // Save resultados whenever calculations change (debounced via the hook)
  useEffect(() => {
    if (!isLoadingOrcamento && projeto.cliente && consolidado.subtotal > 0) {
      saveWithResultados({
        paredes: resultadoParedes,
        radier: resultadoRadier,
        baldrame: resultadoBaldrame,
        sapata: resultadoSapata,
        laje: resultadoLaje,
        reboco: resultadoReboco,
        acabamentos: resultadoAcabamentos,
        revestimento: resultadoRevestimento,
        portasPortoes: resultadoPortasPortoes,
        consolidado: consolidadoComRevestimento,
      });
    }
  }, [consolidado.subtotal, resultadoRevestimento?.custoTotal, resultadoPortasPortoes?.custoTotal, resultadoBaldrame?.custo_total, resultadoSapata?.custo_total]);

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

              {/* Projeto Upload Section (PDF/Images + Manual Mode) */}
              <ProjetoUpload 
                onDataExtracted={handleDataExtracted} 
                orcamentoId={orcamentoId || undefined}
                isAdmin={isAdmin}
              />

              {/* Pavimentos (Multi-floor) Section */}
              {orcamentoId && (
                <PavimentosSection
                  pavimentos={pavimentos}
                  onAdd={async (nome) => addPavimento({ nome })}
                  onUpdate={updatePavimento}
                  onRemove={removePavimento}
                  onDuplicate={duplicatePavimento}
                  onExtract={extractMedidasForPavimento}
                  disabled={loadingPavimentos}
                />
              )}

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
            <RadierBaldrameForm
              radier={radier}
              onRadierChange={setRadier}
              precos={precos}
              resultadoRadier={resultadoRadier}
              baldrame={baldrame}
              onBaldrameChange={setBaldrame}
              perimetroExternoM={projeto.perimetroExterno || 0}
              catalogItems={catalogItems}
              resultadoBaldrame={resultadoBaldrame}
              sapata={sapata}
              onSapataChange={setSapata}
              resultadoSapata={resultadoSapata}
              isAdmin={isAdmin}
            />
          )}

          {/* Step 6: Revestimento */}
          {currentStep === 6 && (
            tipoProposta === 'obra_completa' ? (
              <RevestimentoForm
                revestimento={revestimento}
                onRevestimentoChange={setRevestimento}
                precos={precosRevestimento}
                resultado={resultadoRevestimentoCalc}
                orcamentoId={orcamentoId}
              />
            ) : (
              <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-muted-foreground/30">
                <Bath className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium text-muted-foreground">
                  Revestimento não incluído
                </p>
                <p className="text-sm text-muted-foreground/70 mt-2">
                  Disponível apenas na modalidade "Obra Completa"
                </p>
              </div>
            )
          )}

          {/* Step 7: Portas/Portões */}
          {currentStep === 7 && (
            tipoProposta === 'obra_completa' ? (
              <PortasPortoesForm
                portasPortoes={portasPortoes}
                onPortasPortoesChange={setPortasPortoes}
                precos={precosPortasPortoes}
                resultado={resultadoPortasPortoesCalc}
                orcamentoId={orcamentoId}
                tipoProposta={tipoProposta}
              />
            ) : (
              <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-muted-foreground/30">
                <DoorOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                <p className="text-lg font-medium text-muted-foreground">
                  Portas/Portões não incluídos
                </p>
                <p className="text-sm text-muted-foreground/70 mt-2">
                  Disponível apenas na modalidade "Obra Completa"
                </p>
              </div>
            )
          )}

          {/* Step 8: Margens */}
          {currentStep === 8 && (
            <MargensForm
              margens={margens}
              onMargensChange={setMargens}
              consolidado={consolidadoComRevestimento}
              orcamentoId={orcamentoId}
              orcamentoCodigo={projeto.codigo}
            />
          )}

          {currentStep === 9 && (
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
                        consolidado: consolidadoComRevestimento,
                        resultadoParedes,
                        resultadoRadier,
                        resultadoLaje: resultadoLajeCalc,
                        resultadoReboco: resultadoRebocoCalc,
                        resultadoAcabamentos: resultadoAcabamentosCalc,
                        resultadoRevestimento,
                        resultadoPortasPortoes,
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
                const needsMarginApproval = marginTotal < 15;
                const needsDiscountApproval = margens.descontoPercent > 7;
                
                // Check if can generate proposal:
                // - Admin can always generate
                // - Vendor needs: margin >= 15% OR margin approval, AND discount <= 5% OR discount approval
                const canGenerateProposta = isAdmin || 
                  ((!needsMarginApproval || approvalStatus === 'APROVADA') && 
                   (!needsDiscountApproval || discountStatus === 'APROVADO' || discountStatus === 'DISPENSADO'));
                
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
                          <p className="text-sm text-muted-foreground mb-1">
                            Tipo selecionado
                          </p>
                          <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
                            {tipoProposta === 'obra_completa' ? (
                              <>
                                <Building2 className="w-4 h-4 text-primary" />
                                <span className="font-medium text-primary">Obra Completa</span>
                              </>
                            ) : (
                              <>
                                <Building2 className="w-4 h-4 text-primary" />
                                <span className="font-medium text-primary">Parede Cinza</span>
                              </>
                            )}
                          </div>
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
                              valorTotal: consolidadoComRevestimento.totalVenda,
                              valorPorM2: consolidadoComRevestimento.precoPorM2Global,
                              nomeVendedor,
                              dataGeracao: new Date(),
                              tipoProposta,
                              clienteTipo: projeto.clienteTipo,
                              clienteDocumento: projeto.clienteDocumento,
                              clienteResponsavel: projeto.clienteResponsavel,
                            });
                          }}
                          className="flex items-center gap-2 btn-primary"
                        >
                          <FileText className="w-4 h-4" />
                          Gerar Proposta Comercial (PDF)
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <Lock className="w-5 h-5 text-destructive" />
                        <div>
                          <p className="font-medium text-destructive">Proposta necessita de aprovação do Gestor</p>
                          <p className="text-sm text-destructive/80">
                            {needsDiscountApproval && discountStatus === 'PENDENTE'
                              ? 'Aguardando aprovação do desconto solicitado.'
                              : needsDiscountApproval && discountStatus === 'NEGADO'
                                ? 'Desconto negado. Revise e solicite novamente.'
                                : needsMarginApproval && approvalStatus === 'PENDENTE' 
                                  ? 'Aguardando aprovação da margem.'
                                  : needsMarginApproval && approvalStatus === 'NEGADA'
                                    ? 'Margem negada. Revise e solicite novamente.'
                                    : needsDiscountApproval
                                      ? 'Desconto acima de 5% requer aprovação na aba Margens.'
                                      : 'Margem abaixo de 15%. Solicite aprovação na aba Margens.'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                <div className="kpi-card"><div className="kpi-value">{formatCurrency(consolidado.custoParedes)}</div><div className="kpi-label">Paredes</div></div>
                <div className="kpi-card"><div className="kpi-value">{formatCurrency(consolidado.custoRadier)}</div><div className="kpi-label">Radier</div></div>
                <div className="kpi-card"><div className="kpi-value">{formatCurrency(consolidado.custoLaje)}</div><div className="kpi-label">Laje</div></div>
                <div className="kpi-card"><div className="kpi-value">{formatCurrency(consolidado.custoReboco)}</div><div className="kpi-label">Reboco</div></div>
                <div className="kpi-card"><div className="kpi-value">{formatCurrency(resultadoRevestimento?.custoTotal || 0)}</div><div className="kpi-label">Revestimento</div></div>
                <div className="kpi-card"><div className="kpi-value">{formatCurrency(consolidado.custoAcabamentos)}</div><div className="kpi-label">Acabamentos</div></div>
                {tipoProposta === 'obra_completa' && (
                  <div className="kpi-card"><div className="kpi-value">{formatCurrency(resultadoPortasPortoes?.custoTotal || 0)}</div><div className="kpi-label">Portas/Portões</div></div>
                )}
                <div className="kpi-card"><div className="kpi-value">{formatNumber(resultadoLajeCalc.volumeTotalM3, 2)} m³</div><div className="kpi-label">Volume Laje</div></div>
              </div>
              {/* Dados do Cliente */}
              <div className="bg-accent/30 rounded-xl p-6 mt-4 border border-accent">
                <h3 className="font-medium text-foreground mb-3">Dados do Cliente</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">{projeto.clienteTipo === 'PJ' ? 'Razão Social:' : 'Cliente:'}</span>{' '}
                    <span className="font-medium">{projeto.cliente || '-'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{projeto.clienteTipo === 'PJ' ? 'CNPJ:' : 'CPF:'}</span>{' '}
                    <span className="font-medium font-mono">
                      {projeto.clienteDocumento ? formatDocument(projeto.clienteDocumento, projeto.clienteTipo || 'PF') : '-'}
                    </span>
                  </div>
                  {projeto.clienteTipo === 'PJ' && projeto.clienteResponsavel && (
                    <div className="md:col-span-2">
                      <span className="text-muted-foreground">Responsável:</span>{' '}
                      <span className="font-medium">{projeto.clienteResponsavel}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-primary/10 rounded-xl p-6 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><span className="text-muted-foreground">Subtotal:</span> <span className="font-medium">{formatCurrency(consolidadoComRevestimento.subtotal)}</span></div>
                  <div><span className="text-muted-foreground">Lucro:</span> <span className="font-medium">{formatCurrency(consolidadoComRevestimento.lucro)}</span></div>
                  <div><span className="text-muted-foreground">BDI:</span> <span className="font-medium">{formatCurrency(consolidadoComRevestimento.bdi)}</span></div>
                  <div><span className="text-muted-foreground">Desconto:</span> <span className="font-medium">-{formatCurrency(consolidadoComRevestimento.desconto)}</span></div>
                </div>
                <div className="border-t border-primary/20 mt-4 pt-4 flex justify-between items-center">
                  <div className="text-xl font-bold text-primary">TOTAL: {formatCurrency(consolidadoComRevestimento.totalVenda)}</div>
                  <div className="text-muted-foreground">{formatCurrency(consolidadoComRevestimento.precoPorM2Global)}/m²</div>
                </div>
              </div>

              {/* Admin Only: Anexos do Orçamento (PDF da Planta) */}
              {isAdmin && orcamentoId && (
                <div className="mt-8 border-t border-border pt-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                      <Paperclip className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium text-foreground">Anexos do Orçamento</h3>
                      <p className="text-sm text-muted-foreground">
                        PDFs de plantas enviados pelo vendedor para conferência da IA
                      </p>
                    </div>
                  </div>
                  <AdminPdfAttachments orcamentoId={orcamentoId} />
                </div>
              )}
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
            <div className="space-y-6">
              {/* Tipo de Proposta Selector - always at the top */}
              <TipoPropostaSelector
                tipoProposta={tipoProposta}
                onTipoPropostaChange={setTipoProposta}
              />
              
              {tipoProposta === 'obra_completa' ? (
                <AcabamentosForm
                  acabamentos={acabamentos}
                  onAcabamentosChange={setAcabamentos}
                  precos={precos}
                  precosAcabamentos={precosAcabamentos}
                  resultado={resultadoAcabamentosCalc}
                  resultadoRadier={resultadoRadier}
                  resultadoReboco={resultadoRebocoCalc}
                />
              ) : (
                <div className="text-center py-12 bg-muted/30 rounded-xl border border-dashed border-muted-foreground/30">
                  <Building2 className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-lg font-medium text-muted-foreground">
                    Acabamentos não incluídos
                  </p>
                  <p className="text-sm text-muted-foreground/70 mt-2">
                    Disponível apenas na modalidade "Obra Completa"
                  </p>
                </div>
              )}
            </div>
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
                          consolidado: consolidadoComRevestimento,
                          resultadoParedes,
                          resultadoRadier,
                          resultadoLaje: resultadoLajeCalc,
                          resultadoReboco: resultadoRebocoCalc,
                          resultadoAcabamentos: resultadoAcabamentosCalc,
                          resultadoRevestimento,
                          resultadoPortasPortoes,
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
