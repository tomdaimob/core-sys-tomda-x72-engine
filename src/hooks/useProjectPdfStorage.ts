import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ArquivoProjeto {
  id: string;
  orcamento_id: string;
  tipo: string;
  storage_path: string;
  nome: string;
  mime_type: string | null;
  uploaded_by: string | null;
  ativo: boolean | null;
  created_at: string;
  tamanho_bytes: number | null;
  version: number;
  uploader_name?: string;
}

export function useProjectPdfStorage(orcamentoId: string | null | undefined) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [arquivos, setArquivos] = useState<ArquivoProjeto[]>([]);
  const [loading, setLoading] = useState(false);

  // Upload PDF to storage and create arquivo record
  const uploadProjectPdf = useCallback(async (file: File): Promise<string | null> => {
    if (!orcamentoId) {
      toast({
        title: 'Erro',
        description: 'Orçamento não identificado.',
        variant: 'destructive',
      });
      return null;
    }

    setUploading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Generate unique filename with timestamp
      const timestamp = Date.now();
      const storagePath = `${orcamentoId}/${timestamp}_planta.pdf`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('projetos')
        .upload(storagePath, file, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Insert novo registro – trigger DB já desativa anteriores e incrementa version
      const { data: arquivo, error: insertError } = await supabase
        .from('arquivos')
        .insert({
          orcamento_id: orcamentoId,
          tipo: 'PROJETO_PDF',
          storage_path: storagePath,
          nome: file.name,
          mime_type: 'application/pdf',
          uploaded_by: user.id,
          tamanho_bytes: file.size,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return arquivo?.id || null;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao fazer upload do PDF.';
      console.error('Error uploading PDF:', error);
      toast({
        title: 'Erro no upload',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploading(false);
    }
  }, [orcamentoId, toast]);

  // Fetch arquivos for admin view (only active PROJETO_PDF)
  const fetchArquivos = useCallback(async () => {
    if (!orcamentoId) return;

    setLoading(true);
    try {
      // Get arquivos
      const { data: arquivosData, error } = await supabase
        .from('arquivos')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .eq('tipo', 'PROJETO_PDF')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get uploader names from profiles
      const arquivosWithNames: ArquivoProjeto[] = [];
      
      for (const arq of arquivosData || []) {
        let uploaderName = 'Desconhecido';
        
        if (arq.uploaded_by) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('user_id', arq.uploaded_by)
            .single();
          
          if (profile?.full_name) {
            uploaderName = profile.full_name;
          }
        }
        
        arquivosWithNames.push({
          ...arq,
          uploader_name: uploaderName,
        });
      }

      setArquivos(arquivosWithNames);
    } catch (error) {
      console.error('Error fetching arquivos:', error);
    } finally {
      setLoading(false);
    }
  }, [orcamentoId]);

  // Get signed URL for download (admin only)
  const getDownloadUrl = useCallback(async (storagePath: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.storage
        .from('projetos')
        .createSignedUrl(storagePath, 3600); // 1 hour expiry

      if (error) throw error;
      return data?.signedUrl || null;
    } catch (error) {
      console.error('Error getting download URL:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível gerar o link de download.',
        variant: 'destructive',
      });
      return null;
    }
  }, [toast]);

  // Download file
  const downloadArquivo = useCallback(async (arquivo: ArquivoProjeto) => {
    const url = await getDownloadUrl(arquivo.storage_path);
    if (url) {
      const link = document.createElement('a');
      link.href = url;
      link.download = arquivo.nome;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [getDownloadUrl]);

  // Get the most recent active arquivo_id for IA extraction
  const getActiveArquivoId = useCallback(async (): Promise<string | null> => {
    if (!orcamentoId) return null;

    try {
      const { data, error } = await supabase
        .from('arquivos')
        .select('id')
        .eq('orcamento_id', orcamentoId)
        .eq('tipo', 'PROJETO_PDF')
        .eq('ativo', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.id || null;
    } catch (error) {
      console.error('Error getting active arquivo:', error);
      return null;
    }
  }, [orcamentoId]);

  return {
    uploading,
    loading,
    arquivos,
    uploadProjectPdf,
    fetchArquivos,
    getDownloadUrl,
    downloadArquivo,
    getActiveArquivoId,
  };
}
