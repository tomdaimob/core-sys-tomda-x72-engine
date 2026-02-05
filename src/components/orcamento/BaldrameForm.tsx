import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Info, Ruler } from 'lucide-react';
import { useBaldrameConfiguracoes, BaldrameConfig } from '@/hooks/useBaldrameConfiguracoes';
import { BaldrameInput, BaldrameResultado, FckTipo } from '@/lib/baldrame-types';
import { calcularBaldrame, getBaldramePrecos } from '@/lib/baldrame-calculos';
import { formatCurrency, formatNumber } from '@/lib/orcamento-calculos';
import { cn } from '@/lib/utils';

interface BaldrameFormProps {
  input: BaldrameInput;
  onInputChange: (input: BaldrameInput) => void;
  perimetroExternoM: number; // From projeto/medidas
  catalogItems: Array<{ nome: string; preco: number; categoria: string }>;
  isAdmin?: boolean;
  resultado: BaldrameResultado | null;
}

export function BaldrameForm({
  input,
  onInputChange,
  perimetroExternoM,
  catalogItems,
  isAdmin = false,
  resultado,
}: BaldrameFormProps) {
  const { configs, isLoading: loadingConfigs, getConfigByPerfil } = useBaldrameConfiguracoes();
  const [showCustom, setShowCustom] = useState(input.baldrame_perfil === 'Personalizado');

  // Auto-fill perimetro from projeto
  useEffect(() => {
    if (perimetroExternoM > 0 && input.baldrame_externo_m === 0) {
      onInputChange({ ...input, baldrame_externo_m: perimetroExternoM });
    }
  }, [perimetroExternoM]);

  // Handle profile selection
  const handlePerfilChange = (perfilNome: string) => {
    if (perfilNome === 'Personalizado') {
      setShowCustom(true);
      onInputChange({ ...input, baldrame_perfil: perfilNome });
    } else {
      setShowCustom(false);
      const config = getConfigByPerfil(perfilNome);
      if (config) {
        onInputChange({
          ...input,
          baldrame_perfil: perfilNome,
          baldrame_largura_cm: config.largura_cm,
          baldrame_altura_cm: config.altura_cm,
          baldrame_coef_aco_kg_por_m: config.coef_aco_kg_por_m,
          baldrame_perda_concreto_percent: config.perda_concreto_percent,
          baldrame_perda_aco_percent: config.perda_aco_percent,
        });
      }
    }
  };

  // Check if coefficient is within recommended range
  const currentConfig = getConfigByPerfil(input.baldrame_perfil);
  const coefOutOfRange = currentConfig && (
    input.baldrame_coef_aco_kg_por_m < currentConfig.coef_aco_min ||
    input.baldrame_coef_aco_kg_por_m > currentConfig.coef_aco_max
  );

  return (
    <Card className="border-orange-200 bg-orange-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-orange-600" />
            <CardTitle className="text-lg text-orange-900">Viga Baldrame</CardTitle>
          </div>
          {resultado && resultado.custo_total > 0 && (
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              {formatCurrency(resultado.custo_total)}
            </Badge>
          )}
        </div>
        <CardDescription className="text-orange-700">
          Fundação em viga baldrame com concreto armado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Comprimentos */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-orange-900">Comprimentos</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="baldrame-externo">Baldrame Externo (m)</Label>
              <div className="relative">
                <Input
                  id="baldrame-externo"
                  type="number"
                  step="0.01"
                  min="0"
                  value={input.baldrame_externo_m || ''}
                  onChange={(e) =>
                    onInputChange({ ...input, baldrame_externo_m: parseFloat(e.target.value) || 0 })
                  }
                  className="pr-8"
                  placeholder={perimetroExternoM > 0 ? String(perimetroExternoM) : '0.00'}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  m
                </span>
              </div>
              {perimetroExternoM > 0 && (
                <p className="text-xs text-muted-foreground">
                  Sugerido do projeto: {formatNumber(perimetroExternoM)} m
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="incluir-interno">Incluir Interno</Label>
                <Switch
                  id="incluir-interno"
                  checked={input.incluir_baldrame_interno}
                  onCheckedChange={(checked) =>
                    onInputChange({ ...input, incluir_baldrame_interno: checked })
                  }
                />
              </div>
              {input.incluir_baldrame_interno && (
                <div className="relative">
                  <Input
                    id="baldrame-interno"
                    type="number"
                    step="0.01"
                    min="0"
                    value={input.baldrame_interno_m || ''}
                    onChange={(e) =>
                      onInputChange({ ...input, baldrame_interno_m: parseFloat(e.target.value) || 0 })
                    }
                    className="pr-8"
                    placeholder="0.00"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    m
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Comprimento Total</Label>
              <div className="h-10 flex items-center px-3 rounded-md border bg-muted text-foreground font-medium">
                {formatNumber(resultado?.comprimento_total_m || 0)} m
              </div>
            </div>
          </div>
        </div>

        {/* Seção da viga */}
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-orange-900">Seção da Viga</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="baldrame-perfil">Perfil</Label>
              <select
                id="baldrame-perfil"
                value={input.baldrame_perfil}
                onChange={(e) => handlePerfilChange(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {loadingConfigs ? (
                  <option>Carregando...</option>
                ) : (
                  <>
                    {configs.map((c) => (
                      <option key={c.id} value={c.perfil_nome}>
                        {c.perfil_nome}
                      </option>
                    ))}
                    <option value="Personalizado">Personalizado</option>
                  </>
                )}
              </select>
            </div>

            {showCustom && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="baldrame-largura">Largura (cm)</Label>
                  <Input
                    id="baldrame-largura"
                    type="number"
                    min="10"
                    max="50"
                    value={input.baldrame_largura_cm}
                    onChange={(e) =>
                      onInputChange({ ...input, baldrame_largura_cm: parseFloat(e.target.value) || 20 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="baldrame-altura">Altura (cm)</Label>
                  <Input
                    id="baldrame-altura"
                    type="number"
                    min="20"
                    max="60"
                    value={input.baldrame_altura_cm}
                    onChange={(e) =>
                      onInputChange({ ...input, baldrame_altura_cm: parseFloat(e.target.value) || 30 })
                    }
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="baldrame-fck">Resistência do Concreto</Label>
              <select
                id="baldrame-fck"
                value={input.baldrame_fck_selected}
                onChange={(e) =>
                  onInputChange({ ...input, baldrame_fck_selected: e.target.value as FckTipo })
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="FCK25">FCK 25 MPa</option>
                <option value="FCK30">FCK 30 MPa</option>
                <option value="FCK35">FCK 35 MPa</option>
              </select>
            </div>
          </div>
        </div>

        {/* Resultados calculados */}
        {resultado && resultado.comprimento_total_m > 0 && (
          <div className="bg-white rounded-lg p-4 border border-orange-200 space-y-3">
            <h4 className="font-medium text-sm text-orange-900">Cálculos</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-2 bg-orange-50 rounded">
                <p className="text-muted-foreground text-xs">Volume (m³)</p>
                <p className="font-medium">
                  {formatNumber(resultado.volume_m3)} → {formatNumber(resultado.volume_final_m3)}
                </p>
                <p className="text-xs text-muted-foreground">
                  (+{input.baldrame_perda_concreto_percent}% perdas)
                </p>
              </div>
              <div className="p-2 bg-orange-50 rounded">
                <p className="text-muted-foreground text-xs">Aço (kg)</p>
                <p className="font-medium">
                  {formatNumber(resultado.aco_kg, 0)} → {formatNumber(resultado.aco_final_kg, 0)}
                </p>
                <p className="text-xs text-muted-foreground">
                  ({formatNumber(input.baldrame_coef_aco_kg_por_m)} kg/m +{input.baldrame_perda_aco_percent}%)
                </p>
              </div>
              <div className="p-2 bg-orange-50 rounded">
                <p className="text-muted-foreground text-xs">Custo Concreto</p>
                <p className="font-medium">{formatCurrency(resultado.custo_concreto)}</p>
              </div>
              <div className="p-2 bg-orange-50 rounded">
                <p className="text-muted-foreground text-xs">Custo Aço</p>
                <p className="font-medium">{formatCurrency(resultado.custo_aco)}</p>
              </div>
              <div className="p-2 bg-orange-50 rounded">
                <p className="text-muted-foreground text-xs">Mão de Obra</p>
                <p className="font-medium">{formatCurrency(resultado.custo_mo)}</p>
              </div>
              <div className="p-2 bg-orange-100 rounded col-span-2 md:col-span-3">
                <p className="text-muted-foreground text-xs">Total Baldrame</p>
                <p className="font-bold text-lg text-orange-800">
                  {formatCurrency(resultado.custo_total)}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Coef out of range warning - admin only */}
        {isAdmin && coefOutOfRange && currentConfig && (
          <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-3 border border-amber-200">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Coeficiente de aço fora do range recomendado</p>
              <p className="text-xs mt-1">
                Para perfil {currentConfig.perfil_nome}: recomendado {currentConfig.coef_aco_min}–
                {currentConfig.coef_aco_max} kg/m. Atual: {input.baldrame_coef_aco_kg_por_m} kg/m
              </p>
            </div>
          </div>
        )}

        {/* Safety notice */}
        <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>
            Estimativas de aço e mão de obra dependem do projeto estrutural. Coeficientes podem ser
            ajustados pelo Gestor na página de Configurações.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
