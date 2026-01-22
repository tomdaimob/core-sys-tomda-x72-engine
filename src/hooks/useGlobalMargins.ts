import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MargensGlobais {
  lucroPercent: number;
  bdiPercent: number;
}

const DEFAULT_MARGENS: MargensGlobais = {
  lucroPercent: 15,
  bdiPercent: 10,
};

export function useGlobalMargins() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch global margins
  const { data: margens, isLoading } = useQuery({
    queryKey: ['global-margins'],
    queryFn: async (): Promise<MargensGlobais> => {
      const { data, error } = await supabase
        .from('configuracoes_globais')
        .select('valor')
        .eq('chave', 'margens_padrao')
        .maybeSingle();

      if (error) {
        console.error('Error fetching global margins:', error);
        return DEFAULT_MARGENS;
      }

      if (!data) {
        return DEFAULT_MARGENS;
      }

      // Parse the JSONB value safely
      const valor = data.valor as unknown as MargensGlobais | null;
      return {
        lucroPercent: valor?.lucroPercent ?? DEFAULT_MARGENS.lucroPercent,
        bdiPercent: valor?.bdiPercent ?? DEFAULT_MARGENS.bdiPercent,
      };
    },
  });

  // Update global margins mutation (admin only)
  const updateMarginsMutation = useMutation({
    mutationFn: async (newMargens: MargensGlobais) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('configuracoes_globais')
        .update({
          valor: { lucroPercent: newMargens.lucroPercent, bdiPercent: newMargens.bdiPercent },
          updated_by: user.id,
        })
        .eq('chave', 'margens_padrao');

      if (error) {
        console.error('Error updating global margins:', error);
        throw new Error('Erro ao salvar margens globais');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['global-margins'] });
      toast({
        title: 'Margens atualizadas',
        description: 'As margens globais foram salvas e serão aplicadas a novos orçamentos.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    margens: margens ?? DEFAULT_MARGENS,
    isLoading,
    updateMargins: updateMarginsMutation.mutate,
    isUpdating: updateMarginsMutation.isPending,
  };
}
