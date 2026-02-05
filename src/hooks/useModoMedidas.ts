import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export type ModoMedidas = 'IMPORTACAO' | 'MANUAL';

export interface MedidasManuais {
  altura_paredes_m: number;
  perimetro_externo_m: number;
  perimetro_interno_m: number;
  aberturas_externas_m2: number;
  aberturas_internas_m2: number;
  // Campos alternativos (somente admin)
  usar_areas_diretas: boolean;
  area_revestimento_total_m2: number;
  area_reboco_interno_m2: number;
  area_reboco_externo_m2: number;
}

export interface ModoMedidasState {
  modo_medidas: ModoMedidas;
  manual_lock: boolean;
  medidas_manuais: MedidasManuais;
}

export const DEFAULT_MEDIDAS_MANUAIS: MedidasManuais = {
  altura_paredes_m: 2.70,
  perimetro_externo_m: 0,
  perimetro_interno_m: 0,
  aberturas_externas_m2: 0,
  aberturas_internas_m2: 0,
  usar_areas_diretas: false,
  area_revestimento_total_m2: 0,
  area_reboco_interno_m2: 0,
  area_reboco_externo_m2: 0,
};

export const DEFAULT_MODO_STATE: ModoMedidasState = {
  modo_medidas: 'IMPORTACAO',
  manual_lock: false,
  medidas_manuais: DEFAULT_MEDIDAS_MANUAIS,
};

export function useModoMedidas(orcamentoId: string | null | undefined) {
  const { toast } = useToast();
  const [state, setState] = useState<ModoMedidasState>(DEFAULT_MODO_STATE);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load state from orcamento_inputs
  const loadState = useCallback(async () => {
    if (!orcamentoId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orcamento_inputs')
        .select('dados')
        .eq('orcamento_id', orcamentoId)
        .eq('etapa', 'modo_medidas')
        .maybeSingle();

      if (error) throw error;

      if (data?.dados) {
        const loaded = data.dados as unknown as ModoMedidasState;
        setState({
          modo_medidas: loaded.modo_medidas || 'IMPORTACAO',
          manual_lock: loaded.manual_lock || false,
          medidas_manuais: {
            ...DEFAULT_MEDIDAS_MANUAIS,
            ...loaded.medidas_manuais,
          },
        });
      }
    } catch (error) {
      console.error('Error loading modo medidas:', error);
    } finally {
      setLoading(false);
    }
  }, [orcamentoId]);

  // Save state to orcamento_inputs
  const saveState = useCallback(async (newState: ModoMedidasState) => {
    if (!orcamentoId) return;

    setSaving(true);
    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from('orcamento_inputs')
        .select('id')
        .eq('orcamento_id', orcamentoId)
        .eq('etapa', 'modo_medidas')
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('orcamento_inputs')
          .update({
            dados: newState as unknown as Json,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from('orcamento_inputs')
          .insert([{
            orcamento_id: orcamentoId,
            etapa: 'modo_medidas',
            dados: newState as unknown as Json,
          }]);

        if (error) throw error;
      }
    } catch (error) {
      console.error('Error saving modo medidas:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o modo de medidas.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }, [orcamentoId, toast]);

  // Update mode
  const setModo = useCallback((modo: ModoMedidas) => {
    const newState = { ...state, modo_medidas: modo };
    setState(newState);
    saveState(newState);
  }, [state, saveState]);

  // Update manual lock
  const setManualLock = useCallback((locked: boolean) => {
    const newState = { ...state, manual_lock: locked };
    setState(newState);
    saveState(newState);
  }, [state, saveState]);

  // Update manual measurements
  const setMedidasManuais = useCallback((medidas: Partial<MedidasManuais>) => {
    const newState = {
      ...state,
      medidas_manuais: { ...state.medidas_manuais, ...medidas },
    };
    setState(newState);
    saveState(newState);
  }, [state, saveState]);

  // Check if import should be blocked
  const isImportBlocked = state.modo_medidas === 'MANUAL' && state.manual_lock;

  // Check if manual measurements are valid for advancement
  const isMedidasManuaisValido = useCallback(() => {
    const { medidas_manuais, modo_medidas } = state;
    
    if (modo_medidas !== 'MANUAL') return true;
    
    // Altura must be between 2.2 and 4.0
    if (medidas_manuais.altura_paredes_m < 2.2 || medidas_manuais.altura_paredes_m > 4.0) {
      return false;
    }
    
    // Perímetro externo must be > 0
    if (medidas_manuais.perimetro_externo_m <= 0) {
      return false;
    }
    
    return true;
  }, [state]);

  // Load on mount
  useEffect(() => {
    loadState();
  }, [loadState]);

  return {
    state,
    loading,
    saving,
    setModo,
    setManualLock,
    setMedidasManuais,
    isImportBlocked,
    isMedidasManuaisValido,
    reloadState: loadState,
  };
}
