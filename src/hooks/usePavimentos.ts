import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MedidasConfirmadas } from '@/components/orcamento/ConfirmarMedidasModal';

export type PavimentoStatus = 'PENDENTE' | 'PROCESSANDO' | 'AGUARDANDO_CONFIRMACAO' | 'SUCESSO' | 'ERRO';

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
  status: PavimentoStatus;
  medidas_json: any | null;
  medidas_extraidas: any | null;
  medidas_confirmadas: MedidasConfirmadas | null;
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
    area_ext_m2: number;
    area_int_m2: number;
    area_liquida_m2: number;
    area_liquida_final_m2: number;
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
  // Track which pavimento needs confirmation
  const [pendingConfirmation, setPendingConfirmation] = useState<string | null>(null);

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

  // Upload + extract: returns extracted data and sets status to AGUARDANDO_CONFIRMACAO
  const extractMedidasForPavimento = useCallback(async (
    pavimentoId: string, 
    pdfFile: File
  ) => {
    if (!orcamentoId) return false;

    await updatePavimento(pavimentoId, { status: 'PROCESSANDO', medidas_extraidas: null, medidas_confirmadas: null } as any);

    try {
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const storagePath = `${orcamentoId}/${timestamp}_${randomSuffix}_pav.pdf`;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { error: uploadError } = await supabase.storage
        .from('projetos')
        .upload(storagePath, pdfFile, { contentType: pdfFile.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data: arquivo, error: arqError } = await supabase
        .from('arquivos')
        .insert({
          orcamento_id: orcamentoId,
          tipo: 'PAVIMENTO_PDF',
          storage_path: storagePath,
          nome: pdfFile.name,
          mime_type: pdfFile.type,
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
        // Store extracted data and set to AGUARDANDO_CONFIRMACAO
        await updatePavimento(pavimentoId, {
          status: 'AGUARDANDO_CONFIRMACAO',
          medidas_extraidas: data.data,
          medidas_json: data.data,
          last_extracao_id: data.extracaoId || null,
        } as any);
        
        // Trigger confirmation modal
        setPendingConfirmation(pavimentoId);
        toast({ title: 'Medidas extraídas!', description: `Confirme os valores do pavimento.` });
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

  // Confirm measurements for a pavimento — saves to DB and calculates walls
  const confirmMedidas = useCallback(async (
    pavimentoId: string, 
    medidas: MedidasConfirmadas,
    custoParedeM2: number
  ) => {
    try {
      // Save confirmed measurements to DB
      const { error } = await supabase
        .from('orcamento_pavimentos')
        .update({
          medidas_confirmadas: medidas as any,
          medidas_json: medidas as any,
          status: 'SUCESSO',
        } as any)
        .eq('id', pavimentoId);

      if (error) throw error;

      // Calculate walls for this pavimento
      const pav = pavimentos.find(p => p.id === pavimentoId);
      const mult = pav?.multiplicador || 1;
      const altura = medidas.altura_paredes_m || 2.70;
      const qtdUnidades = medidas.quantidade_unidades || 1;
      const areaExt = medidas.perimetro_externo_m * altura * qtdUnidades;
      const areaInt = medidas.paredes_internas_m * altura * qtdUnidades;
      const aberturas = medidas.aberturas_m2 * qtdUnidades;
      const areaLiquida = Math.max(areaExt + areaInt - aberturas, 0);
      const areaLiquidaFinal = areaLiquida * mult;

      const resultado = {
        area_ext_m2: areaExt,
        area_int_m2: areaInt,
        area_liquida_m2: areaLiquida,
        area_liquida_final_m2: areaLiquidaFinal,
        custo_paredes: areaLiquida * custoParedeM2,
      };

      // Update local state
      setPavimentos(prev => prev.map(p => 
        p.id === pavimentoId ? { 
          ...p, 
          medidas_confirmadas: medidas,
          medidas_json: medidas,
          status: 'SUCESSO' as const, 
          resultado_paredes: resultado,
        } : p
      ));

      setPendingConfirmation(null);
      toast({ title: 'Medidas confirmadas!', description: 'Paredes calculadas com sucesso.' });
      return resultado;
    } catch (error: any) {
      toast({ title: 'Erro ao confirmar medidas', description: error.message, variant: 'destructive' });
      return null;
    }
  }, [pavimentos, toast]);

  // Open manual entry modal (for ERRO or PENDENTE pavimentos)
  const openManualEntry = useCallback((pavimentoId: string) => {
    setPendingConfirmation(pavimentoId);
  }, []);

  // Copy measurements from "Pavimento Tipo" to a target pavimento
  const copyFromTipo = useCallback(async (targetId: string) => {
    const tipoPav = pavimentos.find(p => p.tipo === 'TIPO' && p.status === 'SUCESSO' && p.medidas_confirmadas);
    if (!tipoPav) {
      toast({ title: 'Nenhum Pavimento Tipo com medidas disponível', variant: 'destructive' });
      return false;
    }

    try {
      const { error } = await supabase
        .from('orcamento_pavimentos')
        .update({
          medidas_json: tipoPav.medidas_confirmadas,
          medidas_confirmadas: tipoPav.medidas_confirmadas,
          medidas_extraidas: tipoPav.medidas_extraidas,
          status: 'SUCESSO',
          last_extracao_id: tipoPav.last_extracao_id,
        } as any)
        .eq('id', targetId);

      if (error) throw error;

      setPavimentos(prev => prev.map(p => 
        p.id === targetId ? { 
          ...p, 
          medidas_json: tipoPav.medidas_confirmadas, 
          medidas_confirmadas: tipoPav.medidas_confirmadas,
          medidas_extraidas: tipoPav.medidas_extraidas,
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
    const m = pavimento.medidas_confirmadas || pavimento.medidas_json;
    if (!m) return null;
    const altura = m.altura_paredes_m || m.pe_direito_m || 2.70;
    const qtdUnidades = m.quantidade_unidades || 1;
    const areaExt = (m.perimetro_externo_m || 0) * altura * qtdUnidades;
    const areaInt = (m.paredes_internas_m || 0) * altura * qtdUnidades;
    const aberturas = (m.aberturas_m2 || 0) * qtdUnidades;
    const areaLiquida = Math.max(areaExt + areaInt - aberturas, 0);
    const areaLiquidaFinal = areaLiquida * pavimento.multiplicador;
    const custoParedes = areaLiquida * custoParedeM2;
    return { 
      area_ext_m2: areaExt,
      area_int_m2: areaInt,
      area_liquida_m2: areaLiquida, 
      area_liquida_final_m2: areaLiquidaFinal,
      custo_paredes: custoParedes,
    };
  }, []);

  // Calculate all floors and return building total + propagation data
  const calculateAllFloors = useCallback(async (custoParedeM2: number) => {
    // Refetch from DB first
    let currentPavimentos = pavimentos;
    if (orcamentoId) {
      const { data } = await supabase
        .from('orcamento_pavimentos')
        .select('*')
        .eq('orcamento_id', orcamentoId)
        .order('ordem', { ascending: true });
      if (data) {
        currentPavimentos = data as unknown as Pavimento[];
        setPavimentos(currentPavimentos);
      }
    }

    const results: Array<{
      pavimento_id: string;
      nome: string;
      tipo: string;
      multiplicador: number;
      medidas: any;
      paredes: { area_ext_m2: number; area_int_m2: number; area_liquida_m2: number; area_liquida_final_m2: number; custo_paredes: number } | null;
      total_unitario: number;
      total_final: number;
      status: string;
    }> = [];

    let totalGeralPredio = 0;
    let paredes_total_area = 0;
    let reboco_total_int = 0;
    let reboco_total_ext = 0;
    const pendentes: string[] = [];

    for (const pav of currentPavimentos) {
      const m = pav.medidas_confirmadas || pav.medidas_json;
      if (pav.status !== 'SUCESSO' || !m) {
        pendentes.push(pav.nome);
        results.push({
          pavimento_id: pav.id, nome: pav.nome, tipo: pav.tipo || 'NORMAL',
          multiplicador: pav.multiplicador, medidas: null, paredes: null,
          total_unitario: 0, total_final: 0, status: pav.status,
        });
        continue;
      }

      const paredesResult = calculateWallsForFloor(pav, custoParedeM2);
      const totalUnit = paredesResult?.custo_paredes || 0;
      const totalFinal = totalUnit * pav.multiplicador;
      totalGeralPredio += totalFinal;

      if (paredesResult) {
        paredes_total_area += paredesResult.area_liquida_final_m2;
        reboco_total_int += paredesResult.area_int_m2 * pav.multiplicador;
        reboco_total_ext += paredesResult.area_ext_m2 * pav.multiplicador;
      }

      results.push({
        pavimento_id: pav.id, nome: pav.nome, tipo: pav.tipo || 'NORMAL',
        multiplicador: pav.multiplicador, medidas: m, paredes: paredesResult,
        total_unitario: totalUnit, total_final: totalFinal, status: 'OK',
      });
    }

    // Update local state with results
    setPavimentos(prev => prev.map(p => {
      const r = results.find(x => x.pavimento_id === p.id);
      if (r?.paredes) return { ...p, resultado_paredes: r.paredes };
      return p;
    }));

    // Save propagation data to orcamento_resultados
    if (orcamentoId) {
      await supabase
        .from('orcamento_resultados')
        .upsert({
          orcamento_id: orcamentoId,
          resultados_pavimentos_json: results as any,
          total_geral_predio: totalGeralPredio,
          paredes_total_area_m2: paredes_total_area,
          reboco_total_area_interno_m2: reboco_total_int,
          reboco_total_area_externo_m2: reboco_total_ext,
        } as any, { onConflict: 'orcamento_id' });
    }

    return { results, totalGeralPredio, pendentes, paredes_total_area, reboco_total_int, reboco_total_ext };
  }, [orcamentoId, pavimentos, calculateWallsForFloor]);

  const isMultiPavimento = pavimentos.length >= 2;
  const pavimentoTipo = pavimentos.find(p => p.tipo === 'TIPO' && p.status === 'SUCESSO');

  // Get pavimento waiting for confirmation
  const pavimentoPendingConfirmation = pendingConfirmation 
    ? pavimentos.find(p => p.id === pendingConfirmation) 
    : null;

  return {
    pavimentos,
    loading,
    isMultiPavimento,
    autoImport,
    setAutoImport,
    pavimentoTipo,
    pendingConfirmation,
    pavimentoPendingConfirmation,
    setPendingConfirmation,
    addPavimento,
    updatePavimento,
    removePavimento,
    duplicatePavimento,
    extractMedidasForPavimento,
    confirmMedidas,
    openManualEntry,
    copyFromTipo,
    calculateWallsForFloor,
    calculateAllFloors,
    fetchPavimentos,
  };
}
