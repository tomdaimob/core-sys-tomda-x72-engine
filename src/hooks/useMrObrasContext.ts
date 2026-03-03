// Hook para carregar contexto completo do orçamento para o Mr. Obras
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MrObrasContextData {
  orcamento: any | null;
  inputs: Record<string, any>;
  resultados: any | null;
  pavimentos: any[];
  arquivos: any[];
  extracoes: any[];
  loading: boolean;
  error: string | null;
}

export function useMrObrasContext(orcamentoId: string | null) {
  const [data, setData] = useState<MrObrasContextData>({
    orcamento: null,
    inputs: {},
    resultados: null,
    pavimentos: [],
    arquivos: [],
    extracoes: [],
    loading: false,
    error: null,
  });

  const loadContext = useCallback(async () => {
    if (!orcamentoId) {
      setData(prev => ({ ...prev, loading: false, error: null }));
      return;
    }

    setData(prev => ({ ...prev, loading: true, error: null }));

    try {
      const [orcRes, inputsRes, resultRes, pavRes, arqRes, extRes] = await Promise.all([
        supabase.from('orcamentos').select('*').eq('id', orcamentoId).single(),
        supabase.from('orcamento_inputs').select('*').eq('orcamento_id', orcamentoId),
        supabase.from('orcamento_resultados').select('*').eq('orcamento_id', orcamentoId).single(),
        supabase.from('orcamento_pavimentos').select('*').eq('orcamento_id', orcamentoId).order('ordem'),
        supabase.from('arquivos').select('*').eq('orcamento_id', orcamentoId).eq('ativo', true),
        supabase.from('ia_extracoes').select('*').eq('orcamento_id', orcamentoId).order('created_at', { ascending: false }).limit(20),
      ]);

      const inputsMap: Record<string, any> = {};
      (inputsRes.data || []).forEach((inp: any) => {
        inputsMap[inp.etapa] = inp.dados;
      });

      setData({
        orcamento: orcRes.data,
        inputs: inputsMap,
        resultados: resultRes.data,
        pavimentos: pavRes.data || [],
        arquivos: arqRes.data || [],
        extracoes: extRes.data || [],
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setData(prev => ({ ...prev, loading: false, error: err.message }));
    }
  }, [orcamentoId]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  return { ...data, reloadContext: loadContext };
}
