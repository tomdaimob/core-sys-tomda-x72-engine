import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Pavimento {
  id: string;
  orcamento_id: string;
  nome: string;
  ordem: number;
  multiplicador: number;
  pdf_arquivo_id: string | null;
  imagens_group_id: string | null;
  last_extracao_id: string | null;
  status: 'PENDENTE' | 'PROCESSANDO' | 'SUCESSO' | 'ERRO';
  medidas_json: any | null;
  overrides_json: any | null;
  includes_fundacao: boolean;
  includes_laje: boolean;
  includes_reboco: boolean;
  includes_revestimento: boolean;
  includes_portas: boolean;
  includes_portoes: boolean;
  created_at: string;
  updated_at: string;
}

export interface PavimentoCreate {
  nome: string;
  ordem?: number;
  multiplicador?: number;
}

export function usePavimentos(orcamentoId: string | null | undefined) {
  const { toast } = useToast();
  const [pavimentos, setPavimentos] = useState<Pavimento[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPavimentos = useCallback(async () => {
    if (!orcamentoId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orcamento_pavimentos')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .order('ordem', { ascending: true });

      if (error) throw error;
      setPavimentos((data || []) as unknown as Pavimento[]);
    } catch (error) {
      console.error('Error fetching pavimentos:', error);
    } finally {
      setLoading(false);
    }
  }, [orcamentoId]);

  useEffect(() => {
    fetchPavimentos();
  }, [fetchPavimentos]);

  const addPavimento = useCallback(async (input: PavimentoCreate) => {
    if (!orcamentoId) return null;
    try {
      const nextOrdem = pavimentos.length > 0 
        ? Math.max(...pavimentos.map(p => p.ordem)) + 1 
        : 1;

      const { data, error } = await supabase
        .from('orcamento_pavimentos')
        .insert({
          orcamento_id: orcamentoId,
          nome: input.nome,
          ordem: input.ordem ?? nextOrdem,
          multiplicador: input.multiplicador ?? 1,
        })
        .select()
        .single();

      if (error) throw error;
      const pav = data as unknown as Pavimento;
      setPavimentos(prev => [...prev, pav].sort((a, b) => a.ordem - b.ordem));
      return pav;
    } catch (error: any) {
      toast({ title: 'Erro ao adicionar pavimento', description: error.message, variant: 'destructive' });
      return null;
    }
  }, [orcamentoId, pavimentos, toast]);

  const updatePavimento = useCallback(async (id: string, updates: Partial<Pavimento>) => {
    try {
      const { error } = await supabase
        .from('orcamento_pavimentos')
        .update(updates as any)
        .eq('id', id);

      if (error) throw error;
      setPavimentos(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar pavimento', description: error.message, variant: 'destructive' });
    }
  }, [toast]);

  const removePavimento = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('orcamento_pavimentos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setPavimentos(prev => prev.filter(p => p.id !== id));
      toast({ title: 'Pavimento removido' });
    } catch (error: any) {
      toast({ title: 'Erro ao remover pavimento', description: error.message, variant: 'destructive' });
    }
  }, [toast]);

  const duplicatePavimento = useCallback(async (id: string) => {
    const source = pavimentos.find(p => p.id === id);
    if (!source || !orcamentoId) return null;

    const sameNameCount = pavimentos.filter(p => p.nome.startsWith(source.nome.replace(/\s*\d+$/, ''))).length;
    const baseName = source.nome.replace(/\s*\d+$/, '').trim();
    const newName = `${baseName} ${sameNameCount + 1}`;

    try {
      const { data, error } = await supabase
        .from('orcamento_pavimentos')
        .insert({
          orcamento_id: orcamentoId,
          nome: newName,
          ordem: Math.max(...pavimentos.map(p => p.ordem)) + 1,
          multiplicador: source.multiplicador,
          includes_fundacao: source.includes_fundacao,
          includes_laje: source.includes_laje,
          includes_reboco: source.includes_reboco,
          includes_revestimento: source.includes_revestimento,
          includes_portas: source.includes_portas,
          includes_portoes: source.includes_portoes,
        })
        .select()
        .single();

      if (error) throw error;
      const pav = data as unknown as Pavimento;
      setPavimentos(prev => [...prev, pav].sort((a, b) => a.ordem - b.ordem));
      toast({ title: 'Pavimento duplicado', description: `"${newName}" criado.` });
      return pav;
    } catch (error: any) {
      toast({ title: 'Erro ao duplicar', description: error.message, variant: 'destructive' });
      return null;
    }
  }, [orcamentoId, pavimentos, toast]);

  const extractMedidasForPavimento = useCallback(async (
    pavimentoId: string, 
    pdfFile: File
  ) => {
    if (!orcamentoId) return false;

    // Update status to PROCESSANDO
    await updatePavimento(pavimentoId, { status: 'PROCESSANDO' } as any);

    try {
      // Upload PDF first
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const storagePath = `${orcamentoId}/${timestamp}_${randomSuffix}_pav.pdf`;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { error: uploadError } = await supabase.storage
        .from('projetos')
        .upload(storagePath, pdfFile, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw uploadError;

      // Create arquivo record
      const { data: arquivo, error: arqError } = await supabase
        .from('arquivos')
        .insert({
          orcamento_id: orcamentoId,
          tipo: 'PROJETO_PDF',
          storage_path: storagePath,
          nome: pdfFile.name,
          mime_type: 'application/pdf',
          uploaded_by: user.id,
          tamanho_bytes: pdfFile.size,
        })
        .select()
        .single();

      if (arqError) {
        await supabase.storage.from('projetos').remove([storagePath]);
        throw arqError;
      }

      // Link arquivo to pavimento
      await updatePavimento(pavimentoId, { pdf_arquivo_id: arquivo.id } as any);

      // Call extract edge function
      const buffer = await pdfFile.arrayBuffer();
      const base64 = btoa(new Uint8Array(buffer).reduce((d, b) => d + String.fromCharCode(b), ''));

      const { data, error } = await supabase.functions.invoke('extract-floor-measurements', {
        body: {
          pdfBase64: base64,
          fileName: pdfFile.name,
          orcamentoId,
          pavimentoId,
          arquivoId: arquivo.id,
        },
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        await updatePavimento(pavimentoId, {
          status: 'SUCESSO',
          medidas_json: data.data,
          last_extracao_id: data.extracaoId || null,
        } as any);
        toast({ title: 'Medidas extraídas', description: `Confiança: ${data.data.confianca}%` });
        return true;
      } else {
        throw new Error(data?.error || 'Falha na extração');
      }
    } catch (error: any) {
      console.error('Extract error:', error);
      await updatePavimento(pavimentoId, { status: 'ERRO' } as any);
      toast({ title: 'Erro na extração', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [orcamentoId, updatePavimento, toast]);

  const isMultiPavimento = pavimentos.length >= 2;

  return {
    pavimentos,
    loading,
    isMultiPavimento,
    addPavimento,
    updatePavimento,
    removePavimento,
    duplicatePavimento,
    extractMedidasForPavimento,
    fetchPavimentos,
  };
}
