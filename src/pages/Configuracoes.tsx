import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, Save, DoorOpen, Warehouse, Loader2, RefreshCw, Building } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Json } from '@/integrations/supabase/types';
import { formatCurrency } from '@/lib/orcamento-calculos';

interface PortasPortoesPadroes {
  porta_interna_largura: number;
  porta_interna_altura: number;
  porta_externa_largura: number;
  porta_externa_altura: number;
  portao_garagem_largura: number;
  portao_garagem_altura: number;
  portao_pedestres_largura: number;
  portao_pedestres_altura: number;
}

const DEFAULT_PADROES: PortasPortoesPadroes = {
  porta_interna_largura: 0.80,
  porta_interna_altura: 2.10,
  porta_externa_largura: 0.90,
  porta_externa_altura: 2.10,
  portao_garagem_largura: 3.00,
  portao_garagem_altura: 2.20,
  portao_pedestres_largura: 1.00,
  portao_pedestres_altura: 2.20,
};

export default function Configuracoes() {
  const { toast } = useToast();
  const { isAdmin, user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Company settings
  const [nomeEmpresa, setNomeEmpresa] = useState('ICF TECNOLOGIA E CONSTRUÇÃO');
  const [cnpj, setCnpj] = useState('');
  const [email, setEmail] = useState('');
  
  // Portas/Portões defaults
  const [padroes, setPadroes] = useState<PortasPortoesPadroes>(DEFAULT_PADROES);

  // CUB-PA
  const [cubRefMesAno, setCubRefMesAno] = useState('');
  const [cubValorM2, setCubValorM2] = useState<number>(0);
  const [cubPadrao, setCubPadrao] = useState('R8-N');
  const [updatingCub, setUpdatingCub] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Load company settings
        const { data: empresaData } = await supabase
          .from('configuracoes_globais')
          .select('valor')
          .eq('chave', 'empresa')
          .single();
        
        if (empresaData?.valor) {
          const empresa = empresaData.valor as { nome?: string; cnpj?: string; email?: string };
          setNomeEmpresa(empresa.nome || 'ICF TECNOLOGIA E CONSTRUÇÃO');
          setCnpj(empresa.cnpj || '');
          setEmail(empresa.email || '');
        }

        // Load portas/portões defaults
        const { data: padroesData } = await supabase
          .from('configuracoes_globais')
          .select('valor')
          .eq('chave', 'portas_portoes_padroes')
          .single();
        
        if (padroesData?.valor && typeof padroesData.valor === 'object') {
          setPadroes({
            ...DEFAULT_PADROES,
            ...(padroesData.valor as unknown as PortasPortoesPadroes),
          });
        }

        // Load CUB-PA
        const { data: cubData } = await supabase
          .from('indicadores_custo')
          .select('*')
          .eq('uf', 'PA')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (cubData) {
          setCubRefMesAno(cubData.cub_ref_mes_ano || '');
          setCubValorM2(cubData.cub_valor_m2 || 0);
          setCubPadrao(cubData.cub_padrao || 'R8-N');
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSave = async () => {
    if (!isAdmin) {
      toast({ 
        title: 'Acesso negado', 
        description: 'Apenas administradores podem alterar configurações.',
        variant: 'destructive' 
      });
      return;
    }

    setSaving(true);
    try {
      // Save company settings using separate insert/update
      const empresaPayload = { nome: nomeEmpresa, cnpj, email };
      
      // Check if exists first
      const { data: existingEmpresa } = await supabase
        .from('configuracoes_globais')
        .select('id')
        .eq('chave', 'empresa')
        .single();

      if (existingEmpresa) {
        await supabase
          .from('configuracoes_globais')
          .update({ 
            valor: empresaPayload as unknown as Json,
            updated_by: user?.id 
          })
          .eq('chave', 'empresa');
      } else {
        await supabase
          .from('configuracoes_globais')
          .insert([{ 
            chave: 'empresa',
            valor: empresaPayload as unknown as Json,
            updated_by: user?.id 
          }]);
      }

      // Save portas/portões defaults
      const { data: existingPadroes } = await supabase
        .from('configuracoes_globais')
        .select('id')
        .eq('chave', 'portas_portoes_padroes')
        .single();

      if (existingPadroes) {
        await supabase
          .from('configuracoes_globais')
          .update({ 
            valor: padroes as unknown as Json,
            updated_by: user?.id 
          })
          .eq('chave', 'portas_portoes_padroes');
      } else {
        await supabase
          .from('configuracoes_globais')
          .insert([{ 
            chave: 'portas_portoes_padroes',
            valor: padroes as unknown as Json,
            updated_by: user?.id 
          }]);
      }

      toast({ title: 'Configurações salvas!' });
    } catch (error) {
      console.error('Error saving:', error);
      toast({ 
        title: 'Erro ao salvar', 
        description: 'Não foi possível salvar as configurações.',
        variant: 'destructive' 
      });
    } finally {
      setSaving(false);
    }
  };

  const updatePadrao = (key: keyof PortasPortoesPadroes, value: number) => {
    setPadroes(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="animate-fade-in max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <SettingsIcon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
            <p className="text-muted-foreground">Personalize o sistema</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Company Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Dados da Empresa</CardTitle>
              <CardDescription>Informações que aparecem nos relatórios e propostas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="input-group">
                <Label className="input-label">Nome da Empresa</Label>
                <Input 
                  value={nomeEmpresa} 
                  onChange={(e) => setNomeEmpresa(e.target.value)}
                  disabled={!isAdmin}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="input-group">
                  <Label className="input-label">CNPJ</Label>
                  <Input 
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                    placeholder="00.000.000/0001-00" 
                    disabled={!isAdmin}
                  />
                </div>
                <div className="input-group">
                  <Label className="input-label">E-mail de Contato</Label>
                  <Input 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contato@empresa.com" 
                    disabled={!isAdmin}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Portas/Portões Defaults */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <DoorOpen className="w-5 h-5 text-blue-600" />
                <div>
                  <CardTitle>Dimensões Padrão - Portas e Portões</CardTitle>
                  <CardDescription>
                    Valores usados quando a IA não conseguir identificar as dimensões no PDF
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Portas */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-blue-700 flex items-center gap-2">
                  <DoorOpen className="w-4 h-4" />
                  Portas
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-blue-50/50 p-4 rounded-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">Porta Interna - Largura (m)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={padroes.porta_interna_largura}
                      onChange={(e) => updatePadrao('porta_interna_largura', parseFloat(e.target.value) || 0)}
                      disabled={!isAdmin}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Área: {(padroes.porta_interna_largura * padroes.porta_interna_altura).toFixed(2)} m²
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Porta Interna - Altura (m)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={padroes.porta_interna_altura}
                      onChange={(e) => updatePadrao('porta_interna_altura', parseFloat(e.target.value) || 0)}
                      disabled={!isAdmin}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Porta Externa - Largura (m)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={padroes.porta_externa_largura}
                      onChange={(e) => updatePadrao('porta_externa_largura', parseFloat(e.target.value) || 0)}
                      disabled={!isAdmin}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Área: {(padroes.porta_externa_largura * padroes.porta_externa_altura).toFixed(2)} m²
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Porta Externa - Altura (m)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={padroes.porta_externa_altura}
                      onChange={(e) => updatePadrao('porta_externa_altura', parseFloat(e.target.value) || 0)}
                      disabled={!isAdmin}
                    />
                  </div>
                </div>
              </div>

              {/* Portões */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-amber-700 flex items-center gap-2">
                  <Warehouse className="w-4 h-4" />
                  Portões
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-amber-50/50 p-4 rounded-lg">
                  <div>
                    <Label className="text-xs text-muted-foreground">Portão Garagem - Largura (m)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={padroes.portao_garagem_largura}
                      onChange={(e) => updatePadrao('portao_garagem_largura', parseFloat(e.target.value) || 0)}
                      disabled={!isAdmin}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Área: {(padroes.portao_garagem_largura * padroes.portao_garagem_altura).toFixed(2)} m²
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Portão Garagem - Altura (m)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={padroes.portao_garagem_altura}
                      onChange={(e) => updatePadrao('portao_garagem_altura', parseFloat(e.target.value) || 0)}
                      disabled={!isAdmin}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Portão Pedestres - Largura (m)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={padroes.portao_pedestres_largura}
                      onChange={(e) => updatePadrao('portao_pedestres_largura', parseFloat(e.target.value) || 0)}
                      disabled={!isAdmin}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Área: {(padroes.portao_pedestres_largura * padroes.portao_pedestres_altura).toFixed(2)} m²
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Portão Pedestres - Altura (m)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={padroes.portao_pedestres_altura}
                      onChange={(e) => updatePadrao('portao_pedestres_altura', parseFloat(e.target.value) || 0)}
                      disabled={!isAdmin}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CUB-PA Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-primary" />
                <div>
                  <CardTitle>CUB-PA (Sinduscon-PA)</CardTitle>
                  <CardDescription>
                    Custo Unitário Básico — usado como referência nos PDFs do cliente
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="input-group">
                  <Label className="text-xs text-muted-foreground">Mês/Ano de Referência</Label>
                  <Input
                    placeholder="02/2026"
                    value={cubRefMesAno}
                    onChange={(e) => setCubRefMesAno(e.target.value)}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="input-group">
                  <Label className="text-xs text-muted-foreground">Valor CUB (R$/m²)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={cubValorM2 || ''}
                    onChange={(e) => setCubValorM2(parseFloat(e.target.value) || 0)}
                    disabled={!isAdmin}
                  />
                </div>
                <div className="input-group">
                  <Label className="text-xs text-muted-foreground">Padrão</Label>
                  <Input
                    value={cubPadrao}
                    onChange={(e) => setCubPadrao(e.target.value)}
                    disabled={!isAdmin}
                    placeholder="R8-N"
                  />
                </div>
              </div>
              {cubValorM2 > 0 && (
                <div className="p-3 bg-primary/10 rounded-lg text-sm">
                  <span className="font-medium">CUB-PA atual:</span>{' '}
                  {formatCurrency(cubValorM2)}/m² — Ref: {cubRefMesAno || 'N/A'} — Padrão: {cubPadrao}
                </div>
              )}
              {isAdmin && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      setUpdatingCub(true);
                      try {
                        // Save manual values
                        const { data: existing } = await supabase
                          .from('indicadores_custo')
                          .select('id')
                          .eq('uf', 'PA')
                          .maybeSingle();
                        
                        if (existing) {
                          await supabase
                            .from('indicadores_custo')
                            .update({
                              cub_ref_mes_ano: cubRefMesAno,
                              cub_valor_m2: cubValorM2,
                              cub_padrao: cubPadrao,
                              updated_by: user?.id,
                              updated_at: new Date().toISOString(),
                            })
                            .eq('id', existing.id);
                        } else {
                          await supabase
                            .from('indicadores_custo')
                            .insert({
                              uf: 'PA',
                              cub_ref_mes_ano: cubRefMesAno,
                              cub_valor_m2: cubValorM2,
                              cub_padrao: cubPadrao,
                              updated_by: user?.id,
                            });
                        }
                        toast({ title: 'CUB-PA salvo manualmente!' });
                      } catch (error) {
                        console.error('Error updating CUB:', error);
                        toast({ title: 'Erro ao salvar CUB-PA', variant: 'destructive' });
                      } finally {
                        setUpdatingCub(false);
                      }
                    }}
                    disabled={updatingCub}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Manual
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={async () => {
                      setUpdatingCub(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('update-cub-pa', {
                          body: { padrao: cubPadrao || 'R8-N' },
                        });
                        if (error) throw error;
                        if (data?.ok) {
                          setCubRefMesAno(data.cub_ref_mes_ano || '');
                          setCubValorM2(data.cub_valor_m2 || 0);
                          setCubPadrao(data.cub_padrao || 'R8-N');
                          toast({ title: 'CUB-PA atualizado automaticamente!', description: `Fonte: ${data.cub_fonte_url || 'Sinduscon-PA'}` });
                        } else {
                          toast({ title: 'Erro', description: data?.error || 'Falha ao buscar CUB-PA', variant: 'destructive' });
                        }
                      } catch (error: any) {
                        console.error('Error auto-updating CUB:', error);
                        toast({ title: 'Erro ao buscar CUB-PA automaticamente', description: error?.message || 'Verifique manualmente o site do Sinduscon-PA', variant: 'destructive' });
                      } finally {
                        setUpdatingCub(false);
                      }
                    }}
                    disabled={updatingCub}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${updatingCub ? 'animate-spin' : ''}`} />
                    {updatingCub ? 'Buscando...' : 'Atualizar CUB-PA (automático)'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          {isAdmin && (
            <Button onClick={handleSave} disabled={saving} className="btn-primary">
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          )}

          {!isAdmin && (
            <p className="text-sm text-muted-foreground">
              Apenas administradores podem alterar as configurações.
            </p>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
