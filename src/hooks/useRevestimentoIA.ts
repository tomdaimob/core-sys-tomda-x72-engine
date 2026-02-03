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
  arquivo_id: string;
  tipo: string | null;
  status: 'pendente' | 'sucesso' | 'erro';
  dados_brutos: ExtractionResult | null;
  payload_json: ExtractionResult | null;
  confianca: number | null;
  observacoes: string | null;
  created_at: string;
}

export interface ArquivoAtivo {
  id: string;
  nome: string;
  storage_path: string;
  created_at: string;
  version: number;
}

const EXTRACAO_TIPO = 'REVESTIMENTO_MEDIDAS';

export function useRevestimentoIA(orcamentoId: string | null | undefined) {
  const { toast } = useToast();
  const [extracao, setExtracao] = useState<IAExtracao | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [arquivoAtivo, setArquivoAtivo] = useState<ArquivoAtivo | null>(null);
  const { uploadProjectPdf } = useProjectPdfStorage(orcamentoId);

  // Fetch the active arquivo and the latest extraction for that arquivo
  const fetchData = useCallback(async () => {
    if (!orcamentoId) {
      setLoading(false);
      setExtracao(null);
      setArquivoAtivo(null);
      return;
    }

    setLoading(true);
    try {
      // Step 1: fetch active PROJETO_PDF (único ativo por orcamento, mais recente)
      const { data: arquivoData, error: arquivoError } = await supabase
        .from('arquivos')
        .select('id, nome, storage_path, created_at, version')
        .eq('orcamento_id', orcamentoId)
        .eq('tipo', 'PROJETO_PDF')
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (arquivoError) {
        console.error('Error fetching arquivo ativo:', arquivoError);
      }

      const arquivo = arquivoData as ArquivoAtivo | null;
      setArquivoAtivo(arquivo);

      if (!arquivo) {
        // Sem arquivo ativo → sem extração
        setExtracao(null);
        setLoading(false);
        return;
      }

      // Step 2: buscar a extração mais recente desse arquivo com tipo REVESTIMENTO_MEDIDAS
      const { data: extracaoData, error: extracaoError } = await supabase
        .from('ia_extracoes')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .eq('arquivo_id', arquivo.id)
        .eq('tipo', EXTRACAO_TIPO)
        .eq('status', 'sucesso')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (extracaoError) {
        console.error('Error fetching extracao:', extracaoError);
      }

      if (extracaoData) {
        setExtracao(extracaoData as unknown as IAExtracao);
      } else {
        setExtracao(null);
      }
    } catch (err) {
      console.error('Error in fetchData:', err);
    } finally {
      setLoading(false);
    }
  }, [orcamentoId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Call edge function and handle response, returning extraction result
  const callEdgeFunctionAndUpdate = useCallback(
    async (pdfBase64: string, fileName: string, arquivoId: string): Promise<ExtractionResult | null> => {
      const { data, error } = await supabase.functions.invoke('extract-revestimento-medidas', {
        body: {
          pdfBase64,
          fileName,
          orcamentoId,
          arquivoId,
        },
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        // Refresh data to get latest from DB
        await fetchData();
        return data.data as ExtractionResult;
      } else if (data?.error) {
        throw new Error(data.error);
      }
      return null;
    },
    [orcamentoId, fetchData]
  );

  // Upload a NEW PDF, then extract
  const extractFromPdf = useCallback(
    async (file: File): Promise<ExtractionResult | null> => {
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
        // Upload to storage (creates new arquivos record; trigger sets version + ativo)
        const arquivoId = await uploadProjectPdf(file);
        if (!arquivoId) {
          throw new Error('Falha ao salvar o arquivo PDF.');
        }

        // Convert file to base64
        const buffer = await file.arrayBuffer();
        const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

        const result = await callEdgeFunctionAndUpdate(base64, file.name, arquivoId);
        if (result) {
          toast({
            title: 'Medidas extraídas com sucesso!',
            description: `${result.ambientes.length} ambiente(s) identificado(s)`,
          });
        }
        return result;
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
    },
    [orcamentoId, toast, uploadProjectPdf, callEdgeFunctionAndUpdate]
  );

  // Re-extract from existing active arquivo (reimport)
  const reimportFromActiveArquivo = useCallback(async (): Promise<ExtractionResult | null> => {
    if (!orcamentoId || !arquivoAtivo) {
      toast({
        title: 'Erro',
        description: 'Nenhum arquivo PDF ativo encontrado para reimportar.',
        variant: 'destructive',
      });
      return null;
    }

    setExtracting(true);

    try {
      // Download PDF from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('projetos')
        .download(arquivoAtivo.storage_path);

      if (downloadError) throw downloadError;
      if (!fileData) throw new Error('Arquivo não encontrado no storage');

      const buffer = await fileData.arrayBuffer();
      const base64 = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));

      const result = await callEdgeFunctionAndUpdate(base64, arquivoAtivo.nome, arquivoAtivo.id);
      if (result) {
        toast({
          title: 'Medidas reimportadas com sucesso!',
          description: `${result.ambientes.length} ambiente(s) identificado(s)`,
        });
      }
      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Não foi possível reimportar as medidas.';
      console.error('Error reimporting:', error);
      toast({
        title: 'Erro na reimportação',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    } finally {
      setExtracting(false);
    }
  }, [orcamentoId, arquivoAtivo, toast, callEdgeFunctionAndUpdate]);

  // Clear extraction (delete ia_extracao record)
  const clearExtracao = useCallback(async () => {
    if (!orcamentoId || !extracao) return;

    try {
      await supabase.from('ia_extracoes').delete().eq('id', extracao.id);
      setExtracao(null);
      toast({
        title: 'Medidas removidas',
        description: 'As medidas extraídas foram removidas.',
      });
    } catch (error) {
      console.error('Error clearing extraction:', error);
    }
  }, [orcamentoId, extracao, toast]);

  // Derived booleans
  const hasExtracao = !!extracao && extracao.status === 'sucesso' && !!(extracao.dados_brutos || extracao.payload_json);
  const hasArquivoAtivo = !!arquivoAtivo;

  // Determine if currently shown extraction matches the active arquivo
  const extracaoMatchesArquivo = hasExtracao && arquivoAtivo && extracao.arquivo_id === arquivoAtivo.id;

  return {
    extracao,
    loading,
    extracting,
    extractFromPdf,
    reimportFromActiveArquivo,
    clearExtracao,
    refetch: fetchData,
    hasExtracao,
    arquivoAtivo,
    hasArquivoAtivo,
    extracaoMatchesArquivo,
  };
}
