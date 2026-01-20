import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

interface DraftData {
  projeto: any;
  paredes: any;
  radier: any;
  laje: any; // Changed from lajes array to single laje object
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

export function useAutoSaveDraft({ userId, draftData, debounceMs = 2000 }: UseAutoSaveDraftOptions) {
  const [orcamentoId, setOrcamentoId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const { toast } = useToast();
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // Load existing draft on mount
  useEffect(() => {
    if (!userId || isInitializedRef.current) return;

    const loadDraft = async () => {
      try {
        // Check for existing draft
        const { data: existingDraft, error } = await supabase
          .from('orcamentos')
          .select('id, codigo, updated_at')
          .eq('user_id', userId)
          .eq('status', 'rascunho')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;

        if (existingDraft) {
          setOrcamentoId(existingDraft.id);
        }
        
        isInitializedRef.current = true;
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    };

    loadDraft();
  }, [userId]);

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

    setIsSaving(true);
    try {
      // Prepare inputs data - ensure all values are properly typed
      const inputsData = {
        projeto: draftData.projeto,
        paredes: draftData.paredes,
        radier: draftData.radier,
        laje: draftData.laje,
        reboco: draftData.reboco,
        acabamentos: draftData.acabamentos,
        margens: draftData.margens,
        currentStep: draftData.currentStep,
      };

      // Sanitize numeric values - convert strings with "R$" or commas to numbers
      const sanitizeNumeric = (value: any): number | null => {
        if (value === null || value === undefined || value === '') return null;
        if (typeof value === 'number') return isNaN(value) ? null : value;
        if (typeof value === 'string') {
          const cleaned = value.replace(/[R$\s,]/g, '').replace(',', '.');
          const num = parseFloat(cleaned);
          return isNaN(num) ? null : num;
        }
        return null;
      };

      const areaTotal = sanitizeNumeric(draftData.projeto.areaTotal) || sanitizeNumeric(draftData.radier.areaM2) || null;

      if (import.meta.env.DEV) {
        console.log('[AutoSave] Saving draft:', { 
          userId, 
          orcamentoId, 
          cliente: draftData.projeto.cliente,
          areaTotal
        });
      }

      if (orcamentoId) {
        // Update existing draft
        const { error: updateError } = await supabase
          .from('orcamentos')
          .update({
            cliente: draftData.projeto.cliente,
            projeto: draftData.projeto.projeto || null,
            area_total_m2: areaTotal,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orcamentoId);

        if (updateError) {
          console.error('[AutoSave] Update error:', updateError);
          toast({
            title: 'Erro ao salvar rascunho',
            description: updateError.message || 'Verifique sua conexão.',
            variant: 'destructive',
          });
          return;
        }

        // Update or insert inputs
        const { error: inputsError } = await supabase
          .from('orcamento_inputs')
          .upsert({
            orcamento_id: orcamentoId,
            etapa: 'rascunho',
            dados: inputsData as unknown as Json,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'orcamento_id,etapa',
          });

        if (inputsError) {
          console.error('[AutoSave] Inputs upsert error:', inputsError);
          toast({
            title: 'Erro ao salvar dados',
            description: inputsError.message || 'Verifique sua conexão.',
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
          console.log('[AutoSave] Insert payload:', insertPayload);
        }

        const { data: newOrcamento, error: createError } = await supabase
          .from('orcamentos')
          .insert(insertPayload)
          .select()
          .single();

        if (createError) {
          console.error('[AutoSave] Create error:', createError);
          toast({
            title: 'Erro ao criar rascunho',
            description: createError.message || 'Verifique sua conexão.',
            variant: 'destructive',
          });
          return;
        }

        setOrcamentoId(newOrcamento.id);

        // Save inputs
        const { error: inputsError } = await supabase
          .from('orcamento_inputs')
          .insert({
            orcamento_id: newOrcamento.id,
            etapa: 'rascunho',
            dados: inputsData as unknown as Json,
          });

        if (inputsError) {
          console.error('[AutoSave] Inputs insert error:', inputsError);
          toast({
            title: 'Erro ao salvar dados',
            description: inputsError.message || 'Verifique sua conexão.',
            variant: 'destructive',
          });
          return;
        }
      }

      setLastSaved(new Date());
    } catch (error: any) {
      console.error('[AutoSave] Unexpected error:', error);
      toast({
        title: 'Erro inesperado',
        description: error?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [userId, draftData, orcamentoId, toast]);

  // Debounced save on data change
  useEffect(() => {
    if (!userId || !draftData.projeto.cliente) return;

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
  }, [draftData, saveDraft, debounceMs, userId]);

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

      if (draftError || !draft) return null;

      const { data: inputs, error: inputsError } = await supabase
        .from('orcamento_inputs')
        .select('dados')
        .eq('orcamento_id', draft.id)
        .eq('etapa', 'rascunho')
        .maybeSingle();

      if (inputsError || !inputs) return null;

      setOrcamentoId(draft.id);
      return inputs.dados as unknown as DraftData;
    } catch (error) {
      console.error('Error loading draft data:', error);
      return null;
    }
  }, [userId]);

  // Finalize draft (change status from rascunho to em_andamento)
  const finalizeDraft = useCallback(async (valorTotal: number) => {
    if (!orcamentoId) return null;

    try {
      const { data, error } = await supabase
        .from('orcamentos')
        .update({
          status: 'em_andamento',
          valor_total: valorTotal,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orcamentoId)
        .select()
        .single();

      if (error) throw error;
      
      return data;
    } catch (error) {
      console.error('Error finalizing draft:', error);
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

      // Delete orcamento
      await supabase
        .from('orcamentos')
        .delete()
        .eq('id', orcamentoId);

      setOrcamentoId(null);
      setLastSaved(null);
    } catch (error) {
      console.error('Error discarding draft:', error);
    }
  }, [orcamentoId]);

  return {
    orcamentoId,
    isSaving,
    lastSaved,
    saveDraft,
    loadDraftData,
    finalizeDraft,
    discardDraft,
  };
}
