import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface DoorGateItem {
  id?: string;
  label: string;
  width_m: number;
  height_m: number;
  area_m2: number;
  confianca: number;
  page_number?: number;
  inferred?: boolean;
  tipo?: 'INTERNA' | 'EXTERNA';
  material?: 'MADEIRA' | 'ALUMINIO' | 'FERRO';
  origem?: 'PDF' | 'MANUAL' | 'DUPLICADO';
}

export interface PortasPortoesExtractionResult {
  doors: {
    count: number;
    items: DoorGateItem[];
    area_total_m2: number;
    counts_per_page?: Record<number, number>;
  };
  gates: {
    count: number;
    items: DoorGateItem[];
    area_total_m2: number;
    counts_per_page?: Record<number, number>;
  };
  source: {
    pages_used: number[];
    pages_total?: number;
    notes: string;
    warnings?: string[];
    detected_units?: number;
    is_geminada?: boolean;
  };
}

export interface IAExtracao {
  id: string;
  orcamento_id: string;
  status: 'pendente' | 'sucesso' | 'erro';
  dados_brutos: PortasPortoesExtractionResult | null;
  confianca: number | null;
  observacoes: string | null;
  created_at: string;
}

export function usePortasPortoesIA(orcamentoId: string | null | undefined) {
  const { toast } = useToast();
  const [extracao, setExtracao] = useState<IAExtracao | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);

  // Fetch existing extraction for doors/gates
  const fetchExtracao = useCallback(async () => {
    if (!orcamentoId) {
      setLoading(false);
      return;
    }

    try {
      // Look for extraction with doors/gates data
      const { data, error } = await supabase
        .from('ia_extracoes')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching extraction:', error);
      } else if (data && data.length > 0) {
        // Find one with doors/gates structure
        const doorsGatesExtraction = data.find(ext => {
          const dados = ext.dados_brutos as unknown as PortasPortoesExtractionResult;
          return dados && 'doors' in dados && 'gates' in dados;
        });
        
        if (doorsGatesExtraction) {
          setExtracao(doorsGatesExtraction as unknown as IAExtracao);
        }
      }
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }, [orcamentoId]);

  useEffect(() => {
    fetchExtracao();
  }, [fetchExtracao]);

  // Extract doors/gates from PDF
  const extractFromPdf = async (file: File): Promise<PortasPortoesExtractionResult | null> => {
    if (!orcamentoId) {
      toast({
        title: 'Erro',
        description: 'Orçamento não identificado. Salve o orçamento antes de importar medidas.',
        variant: 'destructive',
      });
      return null;
    }

    setExtracting(true);

    try {
      // Convert file to base64
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      // Try to get default dimensions from global config
      let defaultDimensions = null;
      try {
        const { data: configData } = await supabase
          .from('configuracoes_globais')
          .select('valor')
          .eq('chave', 'portas_portoes_padroes')
          .single();
        
        if (configData?.valor) {
          defaultDimensions = configData.valor;
        }
      } catch (e) {
        // Use defaults from edge function
      }

      // Call edge function
      const { data, error } = await supabase.functions.invoke('extract-openings-doors-gates', {
        body: {
          pdfBase64: base64,
          fileName: file.name,
          orcamentoId,
          defaultDimensions,
        },
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        const result = data.data as PortasPortoesExtractionResult;
        const warnings = result.source?.warnings || [];
        
        toast({
          title: 'Portas e portões identificados!',
          description: data.message || `${result.doors.count} porta(s) e ${result.gates.count} portão(ões)`,
        });
        
        // Show warnings if any
        if (warnings.length > 0) {
          setTimeout(() => {
            toast({
              title: 'Atenção',
              description: warnings[0],
              variant: 'destructive',
            });
          }, 1000);
        }
        
        // Refresh extraction data
        await fetchExtracao();
        
        return result;
      } else if (data?.error) {
        throw new Error(data.error);
      }

      return null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível extrair as medidas do PDF.';
      console.error('Error extracting PDF:', error);
      toast({
        title: 'Erro na extração',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    } finally {
      setExtracting(false);
    }
  };

  // Clear extraction
  const clearExtracao = async () => {
    if (!orcamentoId || !extracao) return;

    try {
      await supabase
        .from('ia_extracoes')
        .delete()
        .eq('id', extracao.id);

      setExtracao(null);
      toast({
        title: 'Dados removidos',
        description: 'Os dados extraídos foram removidos.',
      });
    } catch (error) {
      console.error('Error clearing extraction:', error);
    }
  };

  const extractedData = extracao?.dados_brutos as PortasPortoesExtractionResult | null;

  return {
    extracao,
    extractedData,
    loading,
    extracting,
    extractFromPdf,
    clearExtracao,
    refetch: fetchExtracao,
    hasExtracao: !!extracao && extracao.status === 'sucesso' && !!extractedData,
  };
}
