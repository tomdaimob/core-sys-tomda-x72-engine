import { useEffect, useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, Info, Plus, Trash2, Copy, Anchor, Upload, Loader2, Sparkles } from 'lucide-react';
import { useSapataConfiguracoes } from '@/hooks/useSapataConfiguracoes';
import { SapataInput, SapataTipo, SapataResultado, DEFAULT_SAPATA_TIPO } from '@/lib/sapata-types';
import { calcularSapata, getSapataPrecos } from '@/lib/sapata-calculos';
import { formatCurrency, formatNumber } from '@/lib/orcamento-calculos';
import { FckTipo } from '@/lib/baldrame-types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SapataFormProps {
  input: SapataInput;
  onInputChange: (input: SapataInput) => void;
  catalogItems: Array<{ nome: string; preco: number; categoria: string }>;
  isAdmin?: boolean;
  resultado: SapataResultado | null;
  orcamentoId?: string;
}

export function SapataForm({
  input,
  onInputChange,
  catalogItems,
  isAdmin = false,
  resultado,
  orcamentoId,
}: SapataFormProps) {
  const { toast } = useToast();
  const { configs, getDefaultConfig } = useSapataConfiguracoes();
  const [extracting, setExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-apply default config on first load
  useEffect(() => {
    const defaultConfig = getDefaultConfig();
    if (defaultConfig && input.coef_aco_kg_por_m3 === 90 && configs.length > 0) {
      onInputChange({
        ...input,
        coef_aco_kg_por_m3: defaultConfig.coef_aco_kg_por_m3,
        perda_concreto_percent: defaultConfig.perda_concreto_percent,
        perda_aco_percent: defaultConfig.perda_aco_percent,
      });
    }
  }, [configs]);

  const addTipo = () => {
    const nextLetter = String.fromCharCode(65 + input.tipos.length); // A, B, C...
    onInputChange({
      ...input,
      tipos: [
        ...input.tipos,
        {
          ...DEFAULT_SAPATA_TIPO,
          id: crypto.randomUUID(),
          nome: `Tipo ${nextLetter}`,
        },
      ],
    });
  };

  const removeTipo = (id: string) => {
    if (input.tipos.length <= 1) return;
    onInputChange({
      ...input,
      tipos: input.tipos.filter((t) => t.id !== id),
    });
  };

  const updateTipo = (id: string, updates: Partial<SapataTipo>) => {
    onInputChange({
      ...input,
      tipos: input.tipos.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    });
  };

  const duplicateTipo = (tipo: SapataTipo) => {
    const nextLetter = String.fromCharCode(65 + input.tipos.length);
    onInputChange({
      ...input,
      tipos: [
        ...input.tipos,
        { ...tipo, id: crypto.randomUUID(), nome: `Tipo ${nextLetter}` },
      ],
    });
  };

  const defaultConfig = getDefaultConfig();
  const coefOutOfRange = defaultConfig && (
    input.coef_aco_kg_por_m3 < defaultConfig.coef_aco_min ||
    input.coef_aco_kg_por_m3 > defaultConfig.coef_aco_max
  );

  const totalSapatas = input.tipos.reduce((sum, t) => sum + t.quantidade, 0);

  const handleStructuralUpload = async (file: File) => {
    if (!orcamentoId) { toast({ title: 'Salve o orçamento primeiro', variant: 'destructive' }); return; }
    setExtracting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const ts = Date.now();
      const rnd = Math.random().toString(36).substring(2, 8);
      const storagePath = `${orcamentoId}/${ts}_${rnd}_fundacao.pdf`;
      const { error: upErr } = await supabase.storage.from('projetos').upload(storagePath, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: arq, error: arqErr } = await supabase.from('arquivos').insert({
        orcamento_id: orcamentoId, tipo: 'FUNDACAO_PDF', storage_path: storagePath,
        nome: file.name, mime_type: file.type, uploaded_by: user.id, tamanho_bytes: file.size,
      }).select().single();
      if (arqErr) { await supabase.storage.from('projetos').remove([storagePath]); throw arqErr; }
      const buffer = await file.arrayBuffer();
      const base64 = btoa(new Uint8Array(buffer).reduce((d, b) => d + String.fromCharCode(b), ''));
      const { data, error } = await supabase.functions.invoke('extract-sapata-structural', {
        body: { pdfBase64: base64, fileName: file.name, orcamentoId, arquivoId: arq.id },
      });
      if (error) throw error;
      if (data?.success && data?.data?.tipos?.length > 0) {
        const newTipos = data.data.tipos.map((t: any) => ({
          id: crypto.randomUUID(), nome: t.nome, quantidade: t.quantidade,
          larguraM: t.largura_m, comprimentoM: t.comprimento_m, alturaM: t.altura_m,
        }));
        onInputChange({ ...input, tipos: newTipos, data_source: 'ARQ_NOVO' as any, arquivo_id: arq.id, last_extracao_id: data.extracaoId });
        toast({ title: 'Sapatas extraídas!', description: `${newTipos.length} tipo(s) encontrado(s). Confiança: ${data.data.confianca}%` });
      } else {
        toast({ title: 'Extração com baixa confiança', description: data?.data?.observacoes || 'Preencha manualmente.', variant: 'destructive' });
      }
    } catch (e: any) {
      toast({ title: 'Erro na extração', description: e.message, variant: 'destructive' });
    } finally { setExtracting(false); }
  };

  return (
    <Card className="border-purple-200 bg-purple-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Anchor className="w-5 h-5 text-purple-600" />
            <CardTitle className="text-lg text-purple-900">Sapata Isolada</CardTitle>
          </div>
          {resultado && resultado.custo_total > 0 && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-800">
              {formatCurrency(resultado.custo_total)}
            </Badge>
          )}
        </div>
        <CardDescription className="text-purple-700">
          Fundação em sapatas isoladas de concreto armado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Structural upload */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/40 rounded-lg border">
          <input type="file" accept=".pdf" className="hidden" ref={fileInputRef}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleStructuralUpload(f); e.target.value = ''; }} />
          <Button variant="outline" size="sm" className="gap-1" onClick={() => fileInputRef.current?.click()} disabled={extracting}>
            {extracting ? <><Loader2 className="w-4 h-4 animate-spin" />Extraindo...</> : <><Upload className="w-4 h-4" />Importar Projeto Estrutural</>}
          </Button>
          <span className="text-xs text-muted-foreground">PDF com detalhamento de sapatas/pilares</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="sapata-fck">Resistência do Concreto</Label>
            <select
              id="sapata-fck"
              value={input.fck_selected}
              onChange={(e) =>
                onInputChange({ ...input, fck_selected: e.target.value as FckTipo })
              }
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="FCK25">FCK 25 MPa</option>
              <option value="FCK30">FCK 30 MPa</option>
              <option value="FCK35">FCK 35 MPa</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>Total de Sapatas</Label>
            <div className="h-10 flex items-center px-3 rounded-md border bg-muted text-foreground font-medium">
              {totalSapatas} unidades
            </div>
          </div>
        </div>

        {/* Tipos de sapata */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm text-purple-900">Tipos de Sapata</h4>
            <Button variant="outline" size="sm" onClick={addTipo} className="text-purple-700">
              <Plus className="w-4 h-4 mr-1" />
              Adicionar Tipo
            </Button>
          </div>

          {input.tipos.map((tipo, index) => {
            const volUnit = tipo.larguraM * tipo.comprimentoM * tipo.alturaM;
            return (
              <div key={tipo.id} className="border rounded-lg p-4 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Input
                      value={tipo.nome}
                      onChange={(e) => updateTipo(tipo.id, { nome: e.target.value })}
                      className="w-32 h-8 text-sm font-medium"
                    />
                    <span className="text-xs text-muted-foreground">
                      Vol. unitário: {formatNumber(volUnit, 3)} m³
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => duplicateTipo(tipo)}
                      title="Duplicar tipo"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    {input.tipos.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeTipo(tipo.id)}
                        title="Remover tipo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Quantidade</Label>
                    <Input
                      type="number"
                      min="1"
                      value={tipo.quantidade || ''}
                      onChange={(e) =>
                        updateTipo(tipo.id, { quantidade: parseInt(e.target.value) || 1 })
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Largura (m)</Label>
                    <Input
                      type="number"
                      step="0.05"
                      min="0.1"
                      value={tipo.larguraM || ''}
                      onChange={(e) =>
                        updateTipo(tipo.id, { larguraM: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Comprimento (m)</Label>
                    <Input
                      type="number"
                      step="0.05"
                      min="0.1"
                      value={tipo.comprimentoM || ''}
                      onChange={(e) =>
                        updateTipo(tipo.id, { comprimentoM: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Altura (m)</Label>
                    <Input
                      type="number"
                      step="0.05"
                      min="0.1"
                      value={tipo.alturaM || ''}
                      onChange={(e) =>
                        updateTipo(tipo.id, { alturaM: parseFloat(e.target.value) || 0 })
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Viga de amarração */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <Switch
            id="viga-amarracao"
            checked={input.incluir_viga_amarracao}
            onCheckedChange={(checked) =>
              onInputChange({ ...input, incluir_viga_amarracao: checked })
            }
          />
          <Label htmlFor="viga-amarracao" className="text-sm cursor-pointer">
            Incluir viga de amarração entre sapatas (usa cálculo do Baldrame)
          </Label>
        </div>

        {/* Resultados */}
        {resultado && resultado.volume_total_m3 > 0 && (
          <div className="bg-white rounded-lg p-4 border border-purple-200 space-y-3">
            <h4 className="font-medium text-sm text-purple-900">Cálculos</h4>
            
            {/* Per-type breakdown */}
            {resultado.tipos_resultado.length > 1 && (
              <div className="text-xs space-y-1 mb-2">
                {resultado.tipos_resultado.map((tr, i) => (
                  <div key={i} className="flex justify-between text-muted-foreground">
                    <span>{tr.nome}: {tr.quantidade}x ({formatNumber(tr.volume_unitario_m3, 3)} m³ cada)</span>
                    <span>{formatNumber(tr.volume_total_m3, 3)} m³</span>
                  </div>
                ))}
              </div>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-2 bg-purple-50 rounded">
                <p className="text-muted-foreground text-xs">Volume (m³)</p>
                <p className="font-medium">
                  {formatNumber(resultado.volume_total_m3)} → {formatNumber(resultado.volume_final_m3)}
                </p>
                <p className="text-xs text-muted-foreground">
                  (+{input.perda_concreto_percent}% perdas)
                </p>
              </div>
              <div className="p-2 bg-purple-50 rounded">
                <p className="text-muted-foreground text-xs">Aço (kg)</p>
                <p className="font-medium">
                  {formatNumber(resultado.aco_kg, 0)} → {formatNumber(resultado.aco_final_kg, 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  ({formatNumber(input.coef_aco_kg_por_m3)} kg/m³ +{input.perda_aco_percent}%)
                </p>
              </div>
              <div className="p-2 bg-purple-50 rounded">
                <p className="text-muted-foreground text-xs">Custo Concreto</p>
                <p className="font-medium">{formatCurrency(resultado.custo_concreto)}</p>
              </div>
              <div className="p-2 bg-purple-50 rounded">
                <p className="text-muted-foreground text-xs">Custo Aço</p>
                <p className="font-medium">{formatCurrency(resultado.custo_aco)}</p>
              </div>
              <div className="p-2 bg-purple-50 rounded">
                <p className="text-muted-foreground text-xs">Mão de Obra</p>
                <p className="font-medium">{formatCurrency(resultado.custo_mo)}</p>
              </div>
              <div className="p-2 bg-purple-100 rounded col-span-2 md:col-span-3">
                <p className="text-muted-foreground text-xs">Total Sapata</p>
                <p className="font-bold text-lg text-purple-800">
                  {formatCurrency(resultado.custo_total)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Coef out of range warning */}
        {isAdmin && coefOutOfRange && defaultConfig && (
          <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-3 border border-amber-200">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Coeficiente de aço fora do range recomendado</p>
              <p className="text-xs mt-1">
                Recomendado: {defaultConfig.coef_aco_min}–{defaultConfig.coef_aco_max} kg/m³.
                Atual: {input.coef_aco_kg_por_m3} kg/m³
              </p>
            </div>
          </div>
        )}

        {/* Safety notice */}
        <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>
            Estimativas de aço baseiam-se no coeficiente kg/m³ (padrão 90). Para maior precisão,
            utilize o projeto estrutural. Coeficientes são ajustáveis pelo Gestor em Configurações.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
