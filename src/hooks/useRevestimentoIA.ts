import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useProjectPdfStorage } from '@/hooks/useProjectPdfStorage';

export interface AmbienteMedidas {
  nome: string;
  tipo: 'cozinha' | 'banheiro';
  perimetro_m: number;
  altura_total_m: number;
  altura_meia_parede_m: number;
  area_portas_m2: number;
  area_janelas_m2: number;
  area_aberturas_total_m2: number;
  confianca: number;
}

export interface ExtractionResult {
  ambientes: AmbienteMedidas[];
  metadados: {
    pagina_planta?: number;
    paginas_cortes_usadas?: number[];
    observacoes: string;
  };
}

export interface IAExtracao {
  id: string;
  orcamento_id: string;
  status: 'pendente' | 'sucesso' | 'erro';
  dados_brutos: ExtractionResult | null;
  confianca: number | null;
  observacoes: string | null;
  created_at: string;
}

export function useRevestimentoIA(orcamentoId: string | null | undefined) {
  const { toast } = useToast();
  const [extracao, setExtracao] = useState<IAExtracao | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const { uploadProjectPdf, getActiveArquivoId } = useProjectPdfStorage(orcamentoId);

  // Fetch existing extraction
  const fetchExtracao = useCallback(async () => {
    if (!orcamentoId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('ia_extracoes')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching extraction:', error);
      } else if (data) {
        setExtracao(data as unknown as IAExtracao);
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

  // Extract measurements from PDF
  const extractFromPdf = async (file: File): Promise<ExtractionResult | null> => {
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
      // Upload PDF to storage first
      const arquivoId = await uploadProjectPdf(file);
      if (!arquivoId) {
        throw new Error('Falha ao salvar o arquivo PDF.');
      }

      // Convert file to base64
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      // Call edge function with arquivo_id
      const { data, error } = await supabase.functions.invoke('extract-revestimento-medidas', {
        body: {
          pdfBase64: base64,
          fileName: file.name,
          orcamentoId,
          arquivoId,
        },
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        toast({
          title: 'Medidas extraídas com sucesso!',
          description: `${data.data.ambientes.length} ambiente(s) identificado(s)`,
        });
        
        // Refresh extraction data
        await fetchExtracao();
        
        return data.data as ExtractionResult;
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
        title: 'Medidas removidas',
        description: 'As medidas extraídas foram removidas.',
      });
    } catch (error) {
      console.error('Error clearing extraction:', error);
    }
  };

  return {
    extracao,
    loading,
    extracting,
    extractFromPdf,
    clearExtracao,
    refetch: fetchExtracao,
    hasExtracao: !!extracao && extracao.status === 'sucesso' && !!extracao.dados_brutos,
  };
}
