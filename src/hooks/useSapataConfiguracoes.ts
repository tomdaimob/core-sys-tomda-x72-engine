import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface SapataConfig {
  id: string;
  perfil_nome: string;
  coef_aco_kg_por_m3: number;
  coef_aco_min: number;
  coef_aco_max: number;
  perda_concreto_percent: number;
  perda_aco_percent: number;
  ativo: boolean;
}

export function useSapataConfiguracoes() {
  const query = useQuery({
    queryKey: ['sapata-configuracoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sapata_configuracoes' as any)
        .select('*')
        .eq('ativo', true)
        .order('perfil_nome', { ascending: true });

      if (error) throw error;
      return data as unknown as SapataConfig[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const getDefaultConfig = () => {
    return query.data?.[0];
  };

  return {
    configs: query.data || [],
    isLoading: query.isLoading,
    getDefaultConfig,
  };
}
