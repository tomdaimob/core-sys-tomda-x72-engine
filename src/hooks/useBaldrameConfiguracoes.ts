import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface BaldrameConfig {
  id: string;
  perfil_nome: string;
  largura_cm: number;
  altura_cm: number;
  coef_aco_kg_por_m: number;
  coef_aco_min: number;
  coef_aco_max: number;
  perda_concreto_percent: number;
  perda_aco_percent: number;
  ativo: boolean;
}

export function useBaldrameConfiguracoes() {
  const query = useQuery({
    queryKey: ['baldrame-configuracoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('baldrame_configuracoes')
        .select('*')
        .eq('ativo', true)
        .order('largura_cm', { ascending: true });

      if (error) throw error;
      return data as BaldrameConfig[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const getConfigByPerfil = (perfilNome: string) => {
    return query.data?.find((c) => c.perfil_nome === perfilNome);
  };

  const getDefaultConfig = () => {
    return query.data?.[1] || query.data?.[0]; // Default to 20x30 or first
  };

  return {
    configs: query.data || [],
    isLoading: query.isLoading,
    getConfigByPerfil,
    getDefaultConfig,
  };
}
