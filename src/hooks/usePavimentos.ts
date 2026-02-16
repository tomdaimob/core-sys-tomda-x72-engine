import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Pavimento {
  id: string;
  orcamento_id: string;
  nome: string;
  ordem: number;
  tipo: 'NORMAL' | 'TIPO';
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
  // Client-side calculated results
  resultado_paredes?: {
    area_liquida_m2: number;
    custo_paredes: number;
  } | null;
}

export interface PavimentoCreate {
  nome: string;
  ordem?: number;
  multiplicador?: number;
  tipo?: 'NORMAL' | 'TIPO';
}

export function usePavimentos(orcamentoId: string | null | undefined) {
  const { toast } = useToast();
  const [pavimentos, setPavimentos] = useState<Pavimento[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoImport, setAutoImport] = useState(true);

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
          tipo: input.tipo ?? 'NORMAL',
        } as any)
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
          tipo: 'NORMAL',
          includes_fundacao: source.includes_fundacao,
          includes_laje: source.includes_laje,
          includes_reboco: source.includes_reboco,
          includes_revestimento: source.includes_revestimento,
          includes_portas: source.includes_portas,
          includes_portoes: source.includes_portoes,
        } as any)
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

    await updatePavimento(pavimentoId, { status: 'PROCESSANDO' } as any);

    try {
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const storagePath = `${orcamentoId}/${timestamp}_${randomSuffix}_pav.pdf`;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { error: uploadError } = await supabase.storage
        .from('projetos')
        .upload(storagePath, pdfFile, { contentType: 'application/pdf', upsert: false });
      if (uploadError) throw uploadError;

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

      await updatePavimento(pavimentoId, { pdf_arquivo_id: arquivo.id } as any);

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

  // Copy measurements from "Pavimento Tipo" to a target pavimento
  const copyFromTipo = useCallback(async (targetId: string) => {
    const tipoPav = pavimentos.find(p => p.tipo === 'TIPO' && p.status === 'SUCESSO' && p.medidas_json);
    if (!tipoPav) {
      toast({ title: 'Nenhum Pavimento Tipo com medidas disponível', variant: 'destructive' });
      return false;
    }

    try {
      const { error } = await supabase
        .from('orcamento_pavimentos')
        .update({
          medidas_json: tipoPav.medidas_json,
          status: 'SUCESSO',
          last_extracao_id: tipoPav.last_extracao_id,
        } as any)
        .eq('id', targetId);

      if (error) throw error;

      setPavimentos(prev => prev.map(p => 
        p.id === targetId ? { 
          ...p, 
          medidas_json: tipoPav.medidas_json, 
          status: 'SUCESSO' as const, 
          last_extracao_id: tipoPav.last_extracao_id 
        } : p
      ));

      toast({ title: 'Medidas do Tipo aplicadas', description: 'Medidas copiadas com sucesso.' });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao copiar medidas', description: error.message, variant: 'destructive' });
      return false;
    }
  }, [pavimentos, toast]);

  // Calculate wall cost for a single floor
  const calculateWallsForFloor = useCallback((pavimento: Pavimento, custoParedeM2: number) => {
    if (!pavimento.medidas_json) return null;
    const m = pavimento.medidas_json;
    const altura = m.pe_direito_m || m.altura_paredes_m || 2.70;
    const areaExt = (m.perimetro_externo_m || 0) * altura;
    const areaInt = (m.paredes_internas_m || 0) * altura;
    const areaLiquida = Math.max(areaExt + areaInt - (m.aberturas_m2 || 0), 0);
    const custoParedes = areaLiquida * custoParedeM2;
    return { area_liquida_m2: areaLiquida, custo_paredes: custoParedes };
  }, []);

  // Calculate all floors and return building total
  const calculateAllFloors = useCallback((custoParedeM2: number) => {
    const results: Array<{
      pavimento_id: string;
      nome: string;
      tipo: string;
      multiplicador: number;
      medidas: any;
      paredes: { area_liquida_m2: number; custo_paredes: number } | null;
      total_unitario: number;
      total_final: number;
      status: string;
    }> = [];

    let totalGeralPredio = 0;
    const pendentes: string[] = [];

    for (const pav of pavimentos) {
      if (pav.status !== 'SUCESSO' || !pav.medidas_json) {
        pendentes.push(pav.nome);
        results.push({
          pavimento_id: pav.id,
          nome: pav.nome,
          tipo: pav.tipo || 'NORMAL',
          multiplicador: pav.multiplicador,
          medidas: null,
          paredes: null,
          total_unitario: 0,
          total_final: 0,
          status: pav.status,
        });
        continue;
      }

      const paredesResult = calculateWallsForFloor(pav, custoParedeM2);
      const totalUnit = paredesResult?.custo_paredes || 0;
      const totalFinal = totalUnit * pav.multiplicador;
      totalGeralPredio += totalFinal;

      results.push({
        pavimento_id: pav.id,
        nome: pav.nome,
        tipo: pav.tipo || 'NORMAL',
        multiplicador: pav.multiplicador,
        medidas: pav.medidas_json,
        paredes: paredesResult,
        total_unitario: totalUnit,
        total_final: totalFinal,
        status: 'OK',
      });
    }

    // Update local state with results
    setPavimentos(prev => prev.map(p => {
      const r = results.find(x => x.pavimento_id === p.id);
      if (r?.paredes) {
        return { ...p, resultado_paredes: r.paredes };
      }
      return p;
    }));

    return { results, totalGeralPredio, pendentes };
  }, [pavimentos, calculateWallsForFloor]);

  const isMultiPavimento = pavimentos.length >= 2;

  // Get the Tipo pavimento (if exists and has success)
  const pavimentoTipo = pavimentos.find(p => p.tipo === 'TIPO' && p.status === 'SUCESSO');

  return {
    pavimentos,
    loading,
    isMultiPavimento,
    autoImport,
    setAutoImport,
    pavimentoTipo,
    addPavimento,
    updatePavimento,
    removePavimento,
    duplicatePavimento,
    extractMedidasForPavimento,
    copyFromTipo,
    calculateWallsForFloor,
    calculateAllFloors,
    fetchPavimentos,
  };
}
