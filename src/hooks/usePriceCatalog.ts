import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Precos, DEFAULT_PRECOS } from '@/lib/orcamento-types';

export interface PriceCatalogItem {
  id: string;
  categoria: string;
  nome: string;
  unidade: string;
  preco: number;
  ativo: boolean;
  updated_at: string;
  updated_by?: string;
}

// Map price catalog items to the Precos interface used in calculations
export function mapCatalogToPrecos(items: PriceCatalogItem[]): Precos {
  const findPrice = (nome: string): number => {
    const item = items.find(i => i.nome.toLowerCase().includes(nome.toLowerCase()) && i.ativo);
    return item?.preco ?? 0;
  };

  return {
    formaIcf18: findPrice('Forma ICF 18') || DEFAULT_PRECOS.formaIcf18,
    formaIcf12: findPrice('Forma ICF 12') || DEFAULT_PRECOS.formaIcf12,
    concretoM3: findPrice('Concreto Usinado FCK 25') || DEFAULT_PRECOS.concretoM3,
    ferragemKg: findPrice('Ferragem') || DEFAULT_PRECOS.ferragemKg,
    maoObraParede: findPrice('Montagem Parede') || DEFAULT_PRECOS.maoObraParede,
    fibraAcoKg: findPrice('Fibra de Aço') || DEFAULT_PRECOS.fibraAcoKg,
    fibraPpKg: findPrice('Fibra de Polipropileno') || DEFAULT_PRECOS.fibraPpKg,
    maoObraRadier: findPrice('Execução Radier') || DEFAULT_PRECOS.maoObraRadier,
    maoObraLaje: findPrice('Execução Laje') || DEFAULT_PRECOS.maoObraLaje,
    argamassaSaco: findPrice('Argamassa') || DEFAULT_PRECOS.argamassaSaco,
    maoObraReboco: findPrice('Reboco') || DEFAULT_PRECOS.maoObraReboco,
    pisoCeramicoM2: findPrice('Piso Cerâmico') || DEFAULT_PRECOS.pisoCeramicoM2,
    porcelanatoPisoM2: findPrice('Porcelanato Piso') || DEFAULT_PRECOS.porcelanatoPisoM2,
    pinturaTinta: findPrice('Tinta Látex') || DEFAULT_PRECOS.pinturaTinta,
    maoObraPintura: findPrice('Pintura (Aplicação)') || DEFAULT_PRECOS.maoObraPintura,
  };
}

// Get specific ICFLEX price from catalog
export function getIcflexPrice(items: PriceCatalogItem[]): number {
  const item = items.find(i => 
    (i.nome.toLowerCase().includes('icflex') || 
     (i.nome.toLowerCase().includes('reboco') && i.categoria.toLowerCase() === 'reboco')) && 
    i.ativo
  );
  return item?.preco ?? 45.00; // Default ICFLEX price
}

// Get reboco labor price
export function getRebocoMaoObraPrice(items: PriceCatalogItem[]): number {
  const item = items.find(i => 
    i.nome.toLowerCase().includes('reboco') && 
    i.categoria.toLowerCase() === 'mão de obra' && 
    i.ativo
  );
  return item?.preco ?? 28.00; // Default reboco labor price
}

// Get all concrete options (FCK varieties)
export interface ConcretoOption {
  id: string;
  nome: string;
  preco: number;
  fck: string;
}

export function getConcretoOptions(items: PriceCatalogItem[]): ConcretoOption[] {
  const concretoItems = items.filter(i => 
    i.nome.toLowerCase().includes('concreto usinado fck') && i.ativo
  );
  
  // Sort by FCK number (25, 30, 35)
  concretoItems.sort((a, b) => {
    const fckA = parseInt(a.nome.match(/FCK\s*(\d+)/i)?.[1] || '0');
    const fckB = parseInt(b.nome.match(/FCK\s*(\d+)/i)?.[1] || '0');
    return fckA - fckB;
  });
  
  return concretoItems.map(item => {
    const fckMatch = item.nome.match(/FCK\s*(\d+)/i);
    const fck = fckMatch ? `FCK ${fckMatch[1]}` : 'FCK';
    return {
      id: item.id,
      nome: item.nome,
      preco: item.preco,
      fck,
    };
  });
}

// Get M.O. Laje price
export function getMaoObraLajePrice(items: PriceCatalogItem[]): number {
  const item = items.find(i => 
    (i.nome.toLowerCase().includes('execução laje') || 
     i.nome.toLowerCase().includes('mão de obra laje')) && 
    i.ativo
  );
  return item?.preco ?? 55.00; // Default from catalog
}

export function usePriceCatalog() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['price-catalog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_catalog')
        .select('*')
        .order('categoria', { ascending: true })
        .order('nome', { ascending: true });

      if (error) throw error;
      return data as PriceCatalogItem[];
    },
  });

  const updatePrice = useMutation({
    mutationFn: async ({ id, preco, unidade }: { id: string; preco: number; unidade?: string }) => {
      const { error } = await supabase
        .from('price_catalog')
        .update({ 
          preco, 
          ...(unidade && { unidade }),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-catalog'] });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao atualizar preço',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const bulkUpdatePrices = useMutation({
    mutationFn: async (updates: { id: string; preco: number; unidade?: string }[]) => {
      for (const update of updates) {
        const { error } = await supabase
          .from('price_catalog')
          .update({ 
            preco: update.preco, 
            ...(update.unidade && { unidade: update.unidade }),
            updated_at: new Date().toISOString(),
          })
          .eq('id', update.id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-catalog'] });
      toast({
        title: 'Preços atualizados',
        description: 'Todos os preços foram salvos com sucesso.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao salvar preços',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const restoreDefaults = useMutation({
    mutationFn: async () => {
      const defaultPrices: Record<string, number> = {
        'Forma ICF 18cm': 85.00,
        'Forma ICF 12cm': 72.00,
        'Concreto Usinado FCK 25': 450.00,
        'Concreto Usinado FCK 30': 480.00,
        'Concreto Usinado FCK 35': 520.00,
        'Ferragem / Aço CA-50': 8.50,
        'Fibra de Aço': 12.00,
        'Fibra de Polipropileno': 28.00,
        'Tela Soldada Q92': 18.00,
        'Tela Soldada Q138': 24.00,
        'Argamassa Saco 50kg': 32.00,
        'Cimento CP-II 50kg': 38.00,
        'Areia Média': 120.00,
        'Brita 1': 140.00,
        'Impermeabilizante': 25.00,
        'Piso Cerâmico': 45.00,
        'Porcelanato Piso': 85.00,
        'Porcelanato Parede': 75.00,
        'Tinta Látex Galão 18L': 180.00,
        'Massa Corrida Galão': 65.00,
        'Gesso Liso': 35.00,
        'Montagem Parede ICF': 45.00,
        'Execução Radier': 35.00,
        'Execução Laje': 55.00,
        'Reboco Interno/Externo': 28.00,
        'Assentamento Piso': 35.00,
        'Pintura (Aplicação)': 18.00,
        'Instalação Elétrica': 85.00,
        'Instalação Hidráulica': 95.00,
      };

      for (const item of items) {
        if (defaultPrices[item.nome] !== undefined) {
          const { error } = await supabase
            .from('price_catalog')
            .update({ 
              preco: defaultPrices[item.nome],
              updated_at: new Date().toISOString(),
            })
            .eq('id', item.id);

          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-catalog'] });
      toast({
        title: 'Preços restaurados',
        description: 'Todos os preços foram restaurados aos valores padrão.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Erro ao restaurar preços',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Get latest update info
  const lastUpdate = items.length > 0
    ? items.reduce((latest, item) => 
        new Date(item.updated_at) > new Date(latest.updated_at) ? item : latest
      )
    : null;

  // Group by category
  const categories = items.reduce((acc, item) => {
    if (!acc[item.categoria]) {
      acc[item.categoria] = [];
    }
    acc[item.categoria].push(item);
    return acc;
  }, {} as Record<string, PriceCatalogItem[]>);

  return {
    items,
    categories,
    isLoading,
    error,
    lastUpdate,
    updatePrice,
    bulkUpdatePrices,
    restoreDefaults,
    mapCatalogToPrecos: () => mapCatalogToPrecos(items),
    getIcflexPrice: () => getIcflexPrice(items),
    getRebocoMaoObraPrice: () => getRebocoMaoObraPrice(items),
    getConcretoOptions: () => getConcretoOptions(items),
    getMaoObraLajePrice: () => getMaoObraLajePrice(items),
  };
}
