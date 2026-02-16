import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';
import { Margens, DEFAULT_MARGENS, InputParedes } from '@/lib/orcamento-types';
import { BaldrameInput, DEFAULT_BALDRAME_INPUT } from '@/lib/baldrame-types';
import { SapataInput, DEFAULT_SAPATA_INPUT } from '@/lib/sapata-types';

// Re-export types for convenience
export type ParedesInput = InputParedes;

// Local interface definitions that match the component interfaces
export interface LajeInput {
  tipo: 'AUTO' | 'PISO_2_ANDAR' | 'FORRO';
  laje_enabled: boolean;
  areaM2: number;
  espessuraM: number;
  concretoItemId: string;
  temSegundoAndar: boolean;
}

export interface RebocoInput {
  aplicarInterno: boolean;
  aplicarExterno: boolean;
  perdaPercentual: number;
  espessuraMedia: number;
}

export interface AcabamentosInput {
  areaPiso: number;
  tipoPiso: 'ceramico' | 'porcelanato' | 'ceramico_premium' | 'porcelanato_premium';
  areaPintura: number;
  demaosPintura: number;
  tipoTinta: 'fosca' | 'semi_brilho';
  usarAreaRadier: boolean;
  usarAreaReboco: boolean;
}

// Re-export RevestimentoInput from the component
export type { RevestimentoInput } from '@/components/orcamento/RevestimentoForm';
import { 
  RevestimentoInput, 
  DEFAULT_REVESTIMENTO 
} from '@/components/orcamento/RevestimentoForm';

// Import PortasPortoes types
import { 
  PortasPortoesInput, 
  DEFAULT_PORTAS_PORTOES 
} from '@/components/orcamento/PortasPortoesForm';

// Types
export interface ProjetoData {
  cliente: string;
  codigo: string;
  projeto: string;
  areaTotal: number;
  peDireito: number;
  perimetroExterno: number;
  paredesInternas: number;
  aberturas: number;
  // Client data fields
  clienteTipo: 'PF' | 'PJ';
  clienteDocumento: string;
  clienteResponsavel: string;
}

export interface RadierData {
  areaM2: number;
  espessuraCm: number;
  tipoFibra: 'aco' | 'pp';
}

export interface OrcamentoInputs {
  projeto: ProjetoData;
  paredes: ParedesInput;
  radier: RadierData;
  baldrame: BaldrameInput;
  sapata: SapataInput;
  laje: LajeInput;
  reboco: RebocoInput;
  acabamentos: AcabamentosInput;
  revestimento: RevestimentoInput;
  portasPortoes: PortasPortoesInput;
  margens: Margens;
  currentStep: number;
}

export interface ResultadosData {
  paredes: any;
  radier: any;
  baldrame?: any;
  sapata?: any;
  laje: any;
  reboco: any;
  acabamentos: any;
  revestimento: any;
  portasPortoes?: any;
  consolidado: any;
}

interface UseOrcamentoDataOptions {
  userId: string | undefined;
  orcamentoIdFromUrl?: string | null;
  debounceMs?: number;
}

// Helper functions
const formatSupabaseError = (error: any): string => {
  if (!error) return 'Erro desconhecido';
  const parts: string[] = [];
  if (error.message) parts.push(error.message);
  if (error.details) parts.push(`Detalhes: ${error.details}`);
  if (error.hint) parts.push(`Dica: ${error.hint}`);
  if (error.code) parts.push(`Código: ${error.code}`);
  return parts.length > 0 ? parts.join(' | ') : JSON.stringify(error);
};

const logSupabaseError = (context: string, error: any) => {
  console.error(`[OrcamentoData:${context}]`, {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
    fullError: error,
  });
};

const sanitizePayload = (obj: any): any => {
  if (obj === null || obj === undefined) return null;
  if (typeof obj === 'number') return isNaN(obj) ? 0 : obj;
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'boolean') return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizePayload(item));
  }
  
  if (typeof obj === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        result[key] = sanitizePayload(value);
      }
    }
    return result;
  }
  
  return obj;
};

// Default values
export const DEFAULT_PROJETO: ProjetoData = {
  cliente: '',
  codigo: `ORC-${Date.now()}`,
  projeto: '',
  areaTotal: 0,
  peDireito: 2.80,
  perimetroExterno: 0,
  paredesInternas: 0,
  aberturas: 0,
  clienteTipo: 'PF',
  clienteDocumento: '',
  clienteResponsavel: '',
};

export const DEFAULT_PAREDES: ParedesInput = {
  areaExternaM2: 0,
  areaInternaM2: 0,
  tipoFormaExterna: 'ICF 18',
  tipoFormaInterna: 'ICF 12',
  modoAvancado: false,
  segmentos: [],
};

export const DEFAULT_RADIER: RadierData = {
  areaM2: 0,
  espessuraCm: 10,
  tipoFibra: 'aco',
};

export const DEFAULT_LAJE: LajeInput = {
  tipo: 'AUTO',
  laje_enabled: true,
  areaM2: 0,
  espessuraM: 0,
  concretoItemId: '',
  temSegundoAndar: false,
};

export const DEFAULT_REBOCO: RebocoInput = {
  aplicarInterno: true,
  aplicarExterno: true,
  perdaPercentual: 10,
  espessuraMedia: 3,
};

export const DEFAULT_ACABAMENTOS: AcabamentosInput = {
  areaPiso: 0,
  tipoPiso: 'ceramico',
  areaPintura: 0,
  demaosPintura: 2,
  tipoTinta: 'fosca',
  usarAreaRadier: true,
  usarAreaReboco: true,
};

export function useOrcamentoData({ 
  userId, 
  orcamentoIdFromUrl, 
  debounceMs = 1200 
}: UseOrcamentoDataOptions) {
  const { toast } = useToast();
  
  // State
  const [orcamentoId, setOrcamentoId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isNewOrcamento, setIsNewOrcamento] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  
  // Data state
  const [projeto, setProjeto] = useState<ProjetoData>(DEFAULT_PROJETO);
  const [paredes, setParedes] = useState<ParedesInput>(DEFAULT_PAREDES);
  const [radier, setRadier] = useState<RadierData>(DEFAULT_RADIER);
  const [baldrame, setBaldrame] = useState<BaldrameInput>(DEFAULT_BALDRAME_INPUT);
  const [sapata, setSapata] = useState<SapataInput>(DEFAULT_SAPATA_INPUT);
  const [laje, setLaje] = useState<LajeInput>(DEFAULT_LAJE);
  const [reboco, setReboco] = useState<RebocoInput>(DEFAULT_REBOCO);
  const [acabamentos, setAcabamentos] = useState<AcabamentosInput>(DEFAULT_ACABAMENTOS);
  const [revestimento, setRevestimento] = useState<RevestimentoInput>(DEFAULT_REVESTIMENTO);
  const [portasPortoes, setPortasPortoes] = useState<PortasPortoesInput>(DEFAULT_PORTAS_PORTOES);
  const [margens, setMargens] = useState<Margens>(DEFAULT_MARGENS);
  const [currentStep, setCurrentStep] = useState(0);
  const [resultados, setResultados] = useState<ResultadosData | null>(null);
  
  // Refs
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDirtyRef = useRef(false);
  const initialLoadRef = useRef(false);

  // Get all inputs as a single object
  const getInputs = useCallback((): OrcamentoInputs => ({
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
  }), [projeto, paredes, radier, baldrame, sapata, laje, reboco, acabamentos, revestimento, portasPortoes, margens, currentStep]);

  // Load orcamento by ID
  const loadOrcamentoById = useCallback(async (id: string) => {
    if (!userId) return false;
    
    console.log('[OrcamentoData] Loading orcamento by ID:', id);
    setIsLoading(true);
    
    try {
      // 1. Load orcamento base data
      const { data: orcamento, error: orcError } = await supabase
        .from('orcamentos')
        .select('*')
        .eq('id', id)
        .single();

      if (orcError) {
        logSupabaseError('LoadOrcamento', orcError);
        toast({
          title: 'Erro ao carregar orçamento',
          description: formatSupabaseError(orcError),
          variant: 'destructive',
        });
        return false;
      }

      if (!orcamento) {
        toast({
          title: 'Orçamento não encontrado',
          description: 'O orçamento solicitado não existe.',
          variant: 'destructive',
        });
        return false;
      }

      console.log('[OrcamentoData] Orcamento loaded:', orcamento.codigo);
      setOrcamentoId(orcamento.id);

      // 2. Load inputs (saved form data)
      const { data: inputs, error: inputsError } = await supabase
        .from('orcamento_inputs')
        .select('dados')
        .eq('orcamento_id', id)
        .eq('etapa', 'rascunho')
        .maybeSingle();

      if (inputsError) {
        logSupabaseError('LoadInputs', inputsError);
      }

      // 3. Load resultados (calculated values)
      const { data: resultadosData, error: resultadosError } = await supabase
        .from('orcamento_resultados')
        .select('*')
        .eq('orcamento_id', id)
        .maybeSingle();

      if (resultadosError) {
        logSupabaseError('LoadResultados', resultadosError);
      }

      // 4. Hydrate state with loaded data
      if (inputs?.dados) {
        const dados = inputs.dados as unknown as OrcamentoInputs;
        console.log('[OrcamentoData] Hydrating inputs:', Object.keys(dados));
        
        if (dados.projeto) {
          setProjeto({
            ...DEFAULT_PROJETO,
            ...dados.projeto,
          });
        }
        if (dados.paredes) {
          setParedes({
            ...DEFAULT_PAREDES,
            ...dados.paredes,
          });
        }
        if (dados.radier) {
          setRadier({
            ...DEFAULT_RADIER,
            ...dados.radier,
          });
        }
        if (dados.baldrame) {
          setBaldrame({
            ...DEFAULT_BALDRAME_INPUT,
            ...dados.baldrame,
          });
        }
        if ((dados as any).sapata) {
          setSapata({
            ...DEFAULT_SAPATA_INPUT,
            ...(dados as any).sapata,
          });
        }
        if (dados.laje) {
          setLaje({
            ...DEFAULT_LAJE,
            ...dados.laje,
          });
        }
        if (dados.reboco) {
          setReboco({
            ...DEFAULT_REBOCO,
            ...dados.reboco,
          });
        }
        if (dados.acabamentos) {
          setAcabamentos({
            ...DEFAULT_ACABAMENTOS,
            ...dados.acabamentos,
          });
        }
        if (dados.revestimento) {
          setRevestimento({
            ...DEFAULT_REVESTIMENTO,
            ...dados.revestimento,
          });
        }
        if (dados.portasPortoes) {
          setPortasPortoes({
            ...DEFAULT_PORTAS_PORTOES,
            ...dados.portasPortoes,
          });
        }
        if (dados.margens) {
          setMargens({
            ...DEFAULT_MARGENS,
            ...dados.margens,
          });
        }
        if (dados.currentStep !== undefined) {
          setCurrentStep(dados.currentStep);
        }
        
        setDataLoaded(true);
      } else {
        // No inputs saved - show warning
        console.warn('[OrcamentoData] No inputs found for orcamento', id);
        // Still set basic data from orcamento
        setProjeto(prev => ({
          ...prev,
          cliente: orcamento.cliente || '',
          codigo: orcamento.codigo || prev.codigo,
          projeto: orcamento.projeto || '',
          areaTotal: orcamento.area_total_m2 || 0,
          clienteTipo: (orcamento.cliente_tipo as 'PF' | 'PJ') || 'PF',
          clienteDocumento: orcamento.cliente_documento || '',
          clienteResponsavel: orcamento.cliente_responsavel || '',
        }));
      }

      if (resultadosData) {
        console.log('[OrcamentoData] Resultados loaded');
        setResultados({
          paredes: resultadosData.paredes,
          radier: resultadosData.radier,
          baldrame: (resultadosData as any).baldrame || null,
          laje: resultadosData.laje,
          reboco: resultadosData.reboco,
          acabamentos: resultadosData.acabamentos,
          revestimento: (resultadosData as any).revestimento || null,
          portasPortoes: (resultadosData as any).portasPortoes || null,
          consolidado: resultadosData.consolidado,
        });
      }

      setIsNewOrcamento(false);
      setIsLoading(false);
      return true;
    } catch (error: any) {
      logSupabaseError('LoadOrcamentoById-Catch', error);
      toast({
        title: 'Erro ao carregar',
        description: formatSupabaseError(error),
        variant: 'destructive',
      });
      setIsLoading(false);
      return false;
    }
  }, [userId, toast]);

  // Load draft (for new orcamento)
  const loadDraft = useCallback(async () => {
    if (!userId) return false;
    
    console.log('[OrcamentoData] Looking for existing draft...');
    
    try {
      const { data: draft, error } = await supabase
        .from('orcamentos')
        .select('id, codigo, updated_at')
        .eq('user_id', userId)
        .eq('status', 'rascunho')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        logSupabaseError('LoadDraft', error);
        return false;
      }

      if (draft) {
        console.log('[OrcamentoData] Found draft:', draft.codigo);
        return await loadOrcamentoById(draft.id);
      }
      
      return false;
    } catch (error) {
      logSupabaseError('LoadDraft-Catch', error);
      return false;
    }
  }, [userId, loadOrcamentoById]);

  // Initialize: load by URL id or find draft
  useEffect(() => {
    if (!userId || initialLoadRef.current) return;
    
    const initialize = async () => {
      initialLoadRef.current = true;
      setIsLoading(true);
      
      if (orcamentoIdFromUrl) {
        // Loading existing orcamento
        const loaded = await loadOrcamentoById(orcamentoIdFromUrl);
        if (loaded) {
          toast({
            title: 'Orçamento carregado',
            description: 'Dados restaurados com sucesso.',
          });
        }
      } else {
        // New orcamento - check for existing draft
        const hasDraft = await loadDraft();
        if (hasDraft) {
          toast({
            title: 'Rascunho restaurado',
            description: 'Continuando de onde você parou.',
          });
        } else {
          setIsNewOrcamento(true);
          setIsLoading(false);
        }
      }
    };
    
    initialize();
  }, [userId, orcamentoIdFromUrl, loadOrcamentoById, loadDraft, toast]);

  // Save all data
  const saveAll = useCallback(async (resultadosCalc?: ResultadosData) => {
    if (!userId) {
      console.warn('[OrcamentoData] Cannot save: no userId');
      return;
    }
    
    if (!projeto.cliente) {
      console.log('[OrcamentoData] Skipping save: no cliente');
      return;
    }

    if (isPaused) {
      console.log('[OrcamentoData] Skipping save: paused');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const sanitizedInputs = sanitizePayload(getInputs());
      const areaTotal = projeto.areaTotal || radier.areaM2 || null;

      console.log('[OrcamentoData] Saving...', { orcamentoId, cliente: projeto.cliente });

      let currentOrcamentoId = orcamentoId;

      // 1. Upsert orcamentos
      if (currentOrcamentoId) {
        // Update existing
        const { error: updateError } = await supabase
          .from('orcamentos')
          .update({
            cliente: projeto.cliente,
            projeto: projeto.projeto || null,
            area_total_m2: areaTotal,
            cliente_tipo: projeto.clienteTipo,
            cliente_documento: projeto.clienteDocumento ? projeto.clienteDocumento.replace(/\D/g, '') : null,
            cliente_responsavel: projeto.clienteResponsavel || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', currentOrcamentoId);

        if (updateError) {
          throw updateError;
        }
      } else {
        // Create new
        const { data: newOrc, error: insertError } = await supabase
          .from('orcamentos')
          .insert({
            user_id: userId,
            codigo: projeto.codigo || `ORC-${Date.now()}`,
            cliente: projeto.cliente,
            projeto: projeto.projeto || null,
            status: 'rascunho',
            area_total_m2: areaTotal,
            cliente_tipo: projeto.clienteTipo,
            cliente_documento: projeto.clienteDocumento ? projeto.clienteDocumento.replace(/\D/g, '') : null,
            cliente_responsavel: projeto.clienteResponsavel || null,
          })
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        currentOrcamentoId = newOrc.id;
        setOrcamentoId(newOrc.id);
        console.log('[OrcamentoData] Created new orcamento:', newOrc.id);
      }

      // 2. Upsert orcamento_inputs
      const { error: inputsError } = await supabase
        .from('orcamento_inputs')
        .upsert({
          orcamento_id: currentOrcamentoId,
          etapa: 'rascunho',
          dados: sanitizedInputs as unknown as Json,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'orcamento_id,etapa',
        });

      if (inputsError) {
        throw inputsError;
      }

      // 3. Upsert orcamento_resultados (if provided)
      if (resultadosCalc) {
        const sanitizedResultados = sanitizePayload(resultadosCalc);
        
        const { error: resultadosError } = await supabase
          .from('orcamento_resultados')
          .upsert({
            orcamento_id: currentOrcamentoId,
            paredes: sanitizedResultados.paredes as unknown as Json,
            radier: sanitizedResultados.radier as unknown as Json,
            laje: sanitizedResultados.laje as unknown as Json,
            reboco: sanitizedResultados.reboco as unknown as Json,
            acabamentos: sanitizedResultados.acabamentos as unknown as Json,
            consolidado: sanitizedResultados.consolidado as unknown as Json,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'orcamento_id',
          });

        if (resultadosError) {
          throw resultadosError;
        }
      }

      setLastSaved(new Date());
      setSaveError(null);
      isDirtyRef.current = false;
      console.log('[OrcamentoData] Save complete');
    } catch (error: any) {
      logSupabaseError('SaveAll', error);
      const errorMsg = formatSupabaseError(error);
      setSaveError(errorMsg);
      
      // Pause autosave for 10 seconds
      setIsPaused(true);
      pauseTimeoutRef.current = setTimeout(() => {
        setIsPaused(false);
        setSaveError(null);
      }, 10000);
      
      toast({
        title: 'Erro ao salvar',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [userId, projeto, radier.areaM2, orcamentoId, isPaused, getInputs, toast]);

  // Debounced auto-save trigger
  useEffect(() => {
    if (!userId || !projeto.cliente || isPaused || isLoading) return;

    isDirtyRef.current = true;
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      if (isDirtyRef.current) {
        saveAll();
      }
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [projeto, paredes, radier, laje, reboco, acabamentos, revestimento, margens, currentStep, userId, isPaused, isLoading, debounceMs, saveAll]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    };
  }, []);

  // Manual retry
  const retrySave = useCallback(() => {
    setIsPaused(false);
    setSaveError(null);
    isDirtyRef.current = true;
  }, []);

  // Finalize (change status from rascunho)
  const finalizeDraft = useCallback(async (valorTotal: number, status = 'em_andamento') => {
    if (!orcamentoId) return null;

    try {
      const { data, error } = await supabase
        .from('orcamentos')
        .update({
          status,
          valor_total: valorTotal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orcamentoId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logSupabaseError('FinalizeDraft', error);
      throw error;
    }
  }, [orcamentoId]);

  // Discard draft
  const discardDraft = useCallback(async () => {
    if (!orcamentoId) return;

    try {
      // Delete inputs first
      await supabase
        .from('orcamento_inputs')
        .delete()
        .eq('orcamento_id', orcamentoId);

      // Delete resultados
      await supabase
        .from('orcamento_resultados')
        .delete()
        .eq('orcamento_id', orcamentoId);

      // Delete orcamento
      await supabase
        .from('orcamentos')
        .delete()
        .eq('id', orcamentoId);

      // Reset state
      setOrcamentoId(null);
      setProjeto({ ...DEFAULT_PROJETO, codigo: `ORC-${Date.now()}` });
      setParedes(DEFAULT_PAREDES);
      setRadier(DEFAULT_RADIER);
      setBaldrame(DEFAULT_BALDRAME_INPUT);
      setSapata(DEFAULT_SAPATA_INPUT);
      setLaje(DEFAULT_LAJE);
      setReboco(DEFAULT_REBOCO);
      setAcabamentos(DEFAULT_ACABAMENTOS);
      setRevestimento(DEFAULT_REVESTIMENTO);
      setPortasPortoes(DEFAULT_PORTAS_PORTOES);
      setMargens(DEFAULT_MARGENS);
      setCurrentStep(0);
      setResultados(null);
      setLastSaved(null);
      setSaveError(null);
      setIsNewOrcamento(true);
    } catch (error) {
      logSupabaseError('DiscardDraft', error);
    }
  }, [orcamentoId]);

  // Manual save with resultados
  const saveWithResultados = useCallback((resultadosCalc: ResultadosData) => {
    saveAll(resultadosCalc);
  }, [saveAll]);

  return {
    // IDs
    orcamentoId,
    isNewOrcamento,
    
    // Loading/saving state
    isLoading,
    isSaving,
    lastSaved,
    saveError,
    isPaused,
    dataLoaded,
    
    // Data
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
    resultados,
    
    // Setters
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
    
    // Actions
    saveAll,
    saveWithResultados,
    retrySave,
    finalizeDraft,
    discardDraft,
  };
}
