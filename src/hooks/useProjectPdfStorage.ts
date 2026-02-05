import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const MAX_FILE_SIZE_MB = 25;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const ALLOWED_TYPES = {
  'application/pdf': 'PROJETO_PDF',
  'image/png': 'PROJETO_IMG',
  'image/jpeg': 'PROJETO_IMG',
} as const;

export type ArquivoTipo = 'PROJETO_PDF' | 'PROJETO_IMG';

export interface ArquivoProjeto {
  id: string;
  orcamento_id: string;
  tipo: ArquivoTipo;
  storage_path: string;
  nome: string;
  mime_type: string | null;
  uploaded_by: string | null;
  ativo: boolean;
  created_at: string;
  tamanho_bytes: number | null;
  version: number;
  group_id: string | null;
  uploader_name?: string;
}

export function useProjectPdfStorage(orcamentoId: string | null | undefined) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [arquivos, setArquivos] = useState<ArquivoProjeto[]>([]);
  const [loading, setLoading] = useState(false);

  /**
   * Validate file type and size
   */
  const validateFile = useCallback((file: File): { valid: boolean; tipo: ArquivoTipo | null; error?: string } => {
    const mimeType = file.type as keyof typeof ALLOWED_TYPES;
    
    if (!ALLOWED_TYPES[mimeType]) {
      return {
        valid: false,
        tipo: null,
        error: 'Formato inválido. Aceito: PDF, PNG ou JPG.',
      };
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return {
        valid: false,
        tipo: null,
        error: `O arquivo excede o limite de ${MAX_FILE_SIZE_MB}MB. Tamanho: ${(file.size / (1024 * 1024)).toFixed(1)}MB`,
      };
    }

    return {
      valid: true,
      tipo: ALLOWED_TYPES[mimeType],
    };
  }, []);

  /**
   * Upload a single file to storage and create arquivo record.
   * Atomic: if DB insert fails, we remove the file from storage.
   */
  const uploadFile = useCallback(async (
    file: File, 
    groupId?: string
  ): Promise<{ id: string; tipo: ArquivoTipo } | null> => {
    if (!orcamentoId) {
      toast({
        title: 'Erro',
        description: 'Orçamento não identificado.',
        variant: 'destructive',
      });
      return null;
    }

    const validation = validateFile(file);
    if (!validation.valid || !validation.tipo) {
      toast({
        title: 'Arquivo inválido',
        description: validation.error,
        variant: 'destructive',
      });
      return null;
    }

    const tipo = validation.tipo;
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || 'file';
    const storagePath = `${orcamentoId}/${timestamp}_${randomSuffix}.${extension}`;

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado. Faça login novamente.');
      }

      // Step 1: Upload to storage FIRST
      const { error: uploadError } = await supabase.storage
        .from('projetos')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        throw new Error(`Falha ao enviar arquivo: ${uploadError.message}`);
      }

      // Step 2: Insert record in database (trigger handles version + ativo)
      const insertData: any = {
        orcamento_id: orcamentoId,
        tipo,
        storage_path: storagePath,
        nome: file.name,
        mime_type: file.type,
        uploaded_by: user.id,
        tamanho_bytes: file.size,
      };

      if (groupId) {
        insertData.group_id = groupId;
      }

      const { data: arquivo, error: insertError } = await supabase
        .from('arquivos')
        .insert([insertData])
        .select()
        .single();

      if (insertError) {
        // Rollback: remove uploaded file from storage
        console.error('DB insert error, rolling back storage:', insertError);
        await supabase.storage.from('projetos').remove([storagePath]);
        throw new Error(`Falha ao registrar arquivo no sistema: ${insertError.message}`);
      }

      return { id: arquivo?.id || '', tipo };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido ao fazer upload.';
      console.error('Error uploading file:', error);
      toast({
        title: 'Erro no upload',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    }
  }, [orcamentoId, validateFile, toast]);

  /**
   * Upload PDF to storage (backward compatibility)
   */
  const uploadProjectPdf = useCallback(async (file: File): Promise<string | null> => {
    setUploading(true);
    try {
      const result = await uploadFile(file);
      return result?.id || null;
    } finally {
      setUploading(false);
    }
  }, [uploadFile]);

  /**
   * Upload multiple images with a shared group_id
   */
  const uploadProjectImages = useCallback(async (files: File[]): Promise<string | null> => {
    if (files.length === 0) return null;

    setUploading(true);
    const groupId = crypto.randomUUID();
    const results: string[] = [];

    try {
      for (const file of files) {
        const result = await uploadFile(file, groupId);
        if (result?.id) {
          results.push(result.id);
        }
      }

      if (results.length === 0) {
        throw new Error('Nenhuma imagem foi salva.');
      }

      toast({
        title: 'Upload concluído',
        description: `${results.length} imagem(s) enviada(s) com sucesso.`,
      });

      return groupId;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro no upload das imagens.';
      toast({
        title: 'Erro no upload',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploading(false);
    }
  }, [uploadFile, toast]);

  // Fetch arquivos for admin view (all PROJETO_PDF for this orcamento)
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
            .maybeSingle();
          
          if (profile?.full_name) {
            uploaderName = profile.full_name;
          }
        }
        
        arquivosWithNames.push({
          ...arq,
          tipo: arq.tipo as ArquivoTipo,
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
    uploadProjectImages,
    fetchArquivos,
    getDownloadUrl,
    downloadArquivo,
    getActiveArquivoId,
  };
}
