import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Json } from '@/integrations/supabase/types';

interface DraftData {
  projeto: any;
  paredes: any;
  radier: any;
  lajes: any[];
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
    if (!userId || !draftData.projeto.cliente) return;

    setIsSaving(true);
    try {
      const inputsData = {
        projeto: draftData.projeto,
        paredes: draftData.paredes,
        radier: draftData.radier,
        lajes: draftData.lajes,
        reboco: draftData.reboco,
        acabamentos: draftData.acabamentos,
        margens: draftData.margens,
        currentStep: draftData.currentStep,
      };

      if (orcamentoId) {
        // Update existing draft
        const { error: updateError } = await supabase
          .from('orcamentos')
          .update({
            cliente: draftData.projeto.cliente,
            projeto: draftData.projeto.projeto,
            area_total_m2: draftData.projeto.areaTotal || draftData.radier.areaM2,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orcamentoId);

        if (updateError) throw updateError;

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

        if (inputsError) throw inputsError;
      } else {
        // Create new draft
        const { data: newOrcamento, error: createError } = await supabase
          .from('orcamentos')
          .insert({
            user_id: userId,
            codigo: draftData.projeto.codigo,
            cliente: draftData.projeto.cliente,
            projeto: draftData.projeto.projeto,
            status: 'rascunho',
            area_total_m2: draftData.projeto.areaTotal || draftData.radier.areaM2,
          })
          .select()
          .single();

        if (createError) throw createError;

        setOrcamentoId(newOrcamento.id);

        // Save inputs
        const { error: inputsError } = await supabase
          .from('orcamento_inputs')
          .insert({
            orcamento_id: newOrcamento.id,
            etapa: 'rascunho',
            dados: inputsData as unknown as Json,
          });

        if (inputsError) throw inputsError;
      }

      setLastSaved(new Date());
    } catch (error: any) {
      console.error('Error saving draft:', error);
    } finally {
      setIsSaving(false);
    }
  }, [userId, draftData, orcamentoId]);

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
