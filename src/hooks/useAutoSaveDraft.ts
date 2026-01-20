import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

interface DraftData {
  projeto: any;
  paredes: any;
  radier: any;
  laje: any;
  reboco: any;
  acabamentos: any;
  margens: any;
  currentStep: number;
}

interface UseAutoSaveDraftOptions {
  userId: string | undefined;
  draftData: DraftData;
  debounceMs?: number;
}

// Helper to format Supabase errors with full details
const formatSupabaseError = (error: any): string => {
  if (!error) return 'Erro desconhecido';
  
  const parts: string[] = [];
  
  if (error.message) parts.push(error.message);
  if (error.details) parts.push(`Detalhes: ${error.details}`);
  if (error.hint) parts.push(`Dica: ${error.hint}`);
  if (error.code) parts.push(`Código: ${error.code}`);
  
  return parts.length > 0 ? parts.join(' | ') : JSON.stringify(error);
};

// Helper to log full error to console
const logSupabaseError = (context: string, error: any) => {
  console.error(`[${context}] Supabase Error:`, {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code,
    status: error?.status,
    statusText: error?.statusText,
    fullError: error,
  });
};

// Sanitize value to safe number (remove R$, handle NaN, etc)
const sanitizeToNumber = (value: any): number | null => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  if (typeof value === 'string') {
    // Remove R$, spaces, and handle comma as decimal separator
    const cleaned = value.replace(/[R$\s]/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }
  return null;
};

// Deep sanitize object: convert string numbers, replace NaN with 0, remove undefined
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

export function useAutoSaveDraft({ userId, draftData, debounceMs = 2000 }: UseAutoSaveDraftOptions) {
  const [orcamentoId, setOrcamentoId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const { toast } = useToast();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // Load existing draft on mount
  useEffect(() => {
    if (!userId || isInitializedRef.current) return;

    const loadDraft = async () => {
      try {
        const { data: existingDraft, error } = await supabase
          .from('orcamentos')
          .select('id, codigo, updated_at')
          .eq('user_id', userId)
          .eq('status', 'rascunho')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          logSupabaseError('LoadDraft', error);
          return;
        }

        if (existingDraft) {
          setOrcamentoId(existingDraft.id);
        }
        
        isInitializedRef.current = true;
      } catch (error) {
        logSupabaseError('LoadDraft-Catch', error);
      }
    };

    loadDraft();
  }, [userId]);

  // Clear pause after timeout
  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, []);

  // Pause autosave for 10 seconds after error
  const pauseAutoSave = useCallback(() => {
    setIsPaused(true);
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    pauseTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
      setSaveError(null);
    }, 10000);
  }, []);

  // Manual retry save
  const retrySave = useCallback(() => {
    setIsPaused(false);
    setSaveError(null);
    // Will trigger save on next effect cycle
  }, []);

  // Auto-save function
  const saveDraft = useCallback(async () => {
    // CRITICAL: Validate userId exists before any DB operation
    if (!userId) {
      if (import.meta.env.DEV) {
        console.warn('[AutoSave] Skipping save: userId is undefined');
      }
      return;
    }
    
    if (!draftData.projeto.cliente) {
      if (import.meta.env.DEV) {
        console.log('[AutoSave] Skipping save: cliente is empty');
      }
      return;
    }

    // Don't save if paused due to previous error
    if (isPaused) {
      if (import.meta.env.DEV) {
        console.log('[AutoSave] Skipping save: paused due to previous error');
      }
      return;
    }

    setIsSaving(true);
    setSaveError(null);
    
    try {
      // Sanitize all input data before saving
      const sanitizedInputs = sanitizePayload({
        projeto: draftData.projeto,
        paredes: draftData.paredes,
        radier: draftData.radier,
        laje: draftData.laje,
        reboco: draftData.reboco,
        acabamentos: draftData.acabamentos,
        margens: draftData.margens,
        currentStep: draftData.currentStep,
      });

      const areaTotal = sanitizeToNumber(draftData.projeto.areaTotal) || 
                        sanitizeToNumber(draftData.radier?.areaM2) || 
                        null;

      if (import.meta.env.DEV) {
        console.log('[AutoSave] Saving draft:', { 
          userId, 
          orcamentoId, 
          cliente: draftData.projeto.cliente,
          areaTotal,
          sanitizedInputs: JSON.stringify(sanitizedInputs).substring(0, 500) + '...'
        });
      }

      if (orcamentoId) {
        // Update existing draft - DO NOT change user_id on update
        const updatePayload = {
          cliente: draftData.projeto.cliente,
          projeto: draftData.projeto.projeto || null,
          area_total_m2: areaTotal,
          updated_at: new Date().toISOString(),
        };

        if (import.meta.env.DEV) {
          console.log('[AutoSave] Update payload (orcamentos):', updatePayload);
        }

        const { error: updateError } = await supabase
          .from('orcamentos')
          .update(updatePayload)
          .eq('id', orcamentoId);

        if (updateError) {
          logSupabaseError('Update-Orcamento', updateError);
          const errorMsg = formatSupabaseError(updateError);
          setSaveError(errorMsg);
          pauseAutoSave();
          toast({
            title: 'Erro ao salvar rascunho',
            description: errorMsg,
            variant: 'destructive',
          });
          return;
        }

        // Update or insert inputs
        const inputsPayload = {
          orcamento_id: orcamentoId,
          etapa: 'rascunho',
          dados: sanitizedInputs as unknown as Json,
          updated_at: new Date().toISOString(),
        };

        if (import.meta.env.DEV) {
          console.log('[AutoSave] Upsert payload (orcamento_inputs):', {
            ...inputsPayload,
            dados: 'JSON_DATA_OMITTED'
          });
        }

        const { error: inputsError } = await supabase
          .from('orcamento_inputs')
          .upsert(inputsPayload, {
            onConflict: 'orcamento_id,etapa',
          });

        if (inputsError) {
          logSupabaseError('Upsert-Inputs', inputsError);
          const errorMsg = formatSupabaseError(inputsError);
          setSaveError(errorMsg);
          pauseAutoSave();
          toast({
            title: 'Erro ao salvar dados',
            description: errorMsg,
            variant: 'destructive',
          });
          return;
        }
      } else {
        // Create new draft - ALWAYS include user_id
        const insertPayload = {
          user_id: userId, // CRITICAL: Must be set
          codigo: draftData.projeto.codigo || `ORC-${Date.now()}`,
          cliente: draftData.projeto.cliente,
          projeto: draftData.projeto.projeto || null,
          status: 'rascunho',
          area_total_m2: areaTotal,
        };

        if (import.meta.env.DEV) {
          console.log('[AutoSave] Insert payload (orcamentos):', insertPayload);
        }

        const { data: newOrcamento, error: createError } = await supabase
          .from('orcamentos')
          .insert(insertPayload)
          .select()
          .single();

        if (createError) {
          logSupabaseError('Insert-Orcamento', createError);
          const errorMsg = formatSupabaseError(createError);
          setSaveError(errorMsg);
          pauseAutoSave();
          toast({
            title: 'Erro ao criar rascunho',
            description: errorMsg,
            variant: 'destructive',
          });
          return;
        }

        setOrcamentoId(newOrcamento.id);

        // Save inputs
        const inputsInsertPayload = {
          orcamento_id: newOrcamento.id,
          etapa: 'rascunho',
          dados: sanitizedInputs as unknown as Json,
        };

        if (import.meta.env.DEV) {
          console.log('[AutoSave] Insert payload (orcamento_inputs):', {
            ...inputsInsertPayload,
            dados: 'JSON_DATA_OMITTED'
          });
        }

        const { error: inputsError } = await supabase
          .from('orcamento_inputs')
          .insert(inputsInsertPayload);

        if (inputsError) {
          logSupabaseError('Insert-Inputs', inputsError);
          const errorMsg = formatSupabaseError(inputsError);
          setSaveError(errorMsg);
          pauseAutoSave();
          toast({
            title: 'Erro ao salvar dados',
            description: errorMsg,
            variant: 'destructive',
          });
          return;
        }
      }

      setLastSaved(new Date());
      setSaveError(null);
    } catch (error: any) {
      logSupabaseError('Unexpected', error);
      const errorMsg = formatSupabaseError(error);
      setSaveError(errorMsg);
      pauseAutoSave();
      toast({
        title: 'Erro inesperado',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [userId, draftData, orcamentoId, toast, isPaused, pauseAutoSave]);

  // Debounced save on data change
  useEffect(() => {
    if (!userId || !draftData.projeto.cliente || isPaused) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveDraft();
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [draftData, saveDraft, debounceMs, userId, isPaused]);

  // Load draft data
  const loadDraftData = useCallback(async (): Promise<DraftData | null> => {
    if (!userId) return null;

    try {
      const { data: draft, error: draftError } = await supabase
        .from('orcamentos')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'rascunho')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (draftError) {
        logSupabaseError('LoadDraftData', draftError);
        return null;
      }
      
      if (!draft) return null;

      const { data: inputs, error: inputsError } = await supabase
        .from('orcamento_inputs')
        .select('dados')
        .eq('orcamento_id', draft.id)
        .eq('etapa', 'rascunho')
        .maybeSingle();

      if (inputsError) {
        logSupabaseError('LoadDraftInputs', inputsError);
        return null;
      }
      
      if (!inputs) return null;

      setOrcamentoId(draft.id);
      return inputs.dados as unknown as DraftData;
    } catch (error) {
      logSupabaseError('LoadDraftData-Catch', error);
      return null;
    }
  }, [userId]);

  // Finalize draft (change status from rascunho to em_andamento)
  const finalizeDraft = useCallback(async (valorTotal: number) => {
    if (!orcamentoId) return null;

    try {
      const sanitizedTotal = sanitizeToNumber(valorTotal) || 0;
      
      const { data, error } = await supabase
        .from('orcamentos')
        .update({
          status: 'em_andamento',
          valor_total: sanitizedTotal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orcamentoId)
        .select()
        .single();

      if (error) {
        logSupabaseError('FinalizeDraft', error);
        throw error;
      }
      
      return data;
    } catch (error) {
      logSupabaseError('FinalizeDraft-Catch', error);
      throw error;
    }
  }, [orcamentoId]);

  // Discard draft
  const discardDraft = useCallback(async () => {
    if (!orcamentoId) return;

    try {
      // Delete inputs first
      const { error: inputsDeleteError } = await supabase
        .from('orcamento_inputs')
        .delete()
        .eq('orcamento_id', orcamentoId);

      if (inputsDeleteError) {
        logSupabaseError('DiscardDraft-Inputs', inputsDeleteError);
      }

      // Delete orcamento
      const { error: orcamentoDeleteError } = await supabase
        .from('orcamentos')
        .delete()
        .eq('id', orcamentoId);

      if (orcamentoDeleteError) {
        logSupabaseError('DiscardDraft-Orcamento', orcamentoDeleteError);
      }

      setOrcamentoId(null);
      setLastSaved(null);
      setSaveError(null);
    } catch (error) {
      logSupabaseError('DiscardDraft-Catch', error);
    }
  }, [orcamentoId]);

  return {
    orcamentoId,
    isSaving,
    lastSaved,
    saveError,
    isPaused,
    saveDraft,
    retrySave,
    loadDraftData,
    finalizeDraft,
    discardDraft,
  };
}
