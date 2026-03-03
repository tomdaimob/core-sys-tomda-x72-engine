import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { AlertTriangle, Grid3X3, Info } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/orcamento-calculos';

export interface TelaSoldadaInput {
  tela_enabled: boolean;
  camadas: number;
  painel_option: '2x3' | '2.45x6' | '2x5' | 'custom';
  largura_m: number;
  comprimento_m: number;
  perda_percent: number;
}

export const DEFAULT_TELA_SOLDADA: TelaSoldadaInput = {
  tela_enabled: true,
  camadas: 1,
  painel_option: '2x3',
  largura_m: 2.0,
  comprimento_m: 3.0,
  perda_percent: 10,
};

export interface TelaSoldadaResultado {
  area_radier_m2: number;
  area_tela_total_m2: number;
  area_painel_m2: number;
  qtd_paineis: number;
  custo_total: number;
  preco_painel: number;
}

const PAINEL_OPTIONS = [
  { value: '2x3', label: 'Padrão: 2,00m × 3,00m (6,00 m²)', largura: 2.0, comprimento: 3.0 },
  { value: '2.45x6', label: 'Grande: 2,45m × 6,00m (14,70 m²)', largura: 2.45, comprimento: 6.0 },
  { value: '2x5', label: 'Médio: 2,00m × 5,00m (10,00 m²)', largura: 2.0, comprimento: 5.0 },
  { value: 'custom', label: 'Personalizado', largura: 0, comprimento: 0 },
];

interface TelaSoldadaFormProps {
  input: TelaSoldadaInput;
  onInputChange: (input: TelaSoldadaInput) => void;
  areaRadierM2: number;
  catalogItems: Array<{ nome: string; preco: number; categoria: string }>;
  isAdmin?: boolean;
}

export function calcularTelaSoldada(
  input: TelaSoldadaInput,
  areaRadierM2: number,
  precoPainel: number,
): TelaSoldadaResultado {
  if (!input.tela_enabled || areaRadierM2 <= 0) {
    return { area_radier_m2: areaRadierM2, area_tela_total_m2: 0, area_painel_m2: 0, qtd_paineis: 0, custo_total: 0, preco_painel: precoPainel };
  }

  const largura = input.painel_option === 'custom' ? input.largura_m : (PAINEL_OPTIONS.find(p => p.value === input.painel_option)?.largura || 2.0);
  const comprimento = input.painel_option === 'custom' ? input.comprimento_m : (PAINEL_OPTIONS.find(p => p.value === input.painel_option)?.comprimento || 3.0);

  const area_painel_m2 = largura * comprimento;
  const area_tela_total_m2 = areaRadierM2 * input.camadas;
  const fator_perda = 1 + (input.perda_percent / 100);
  const qtd_paineis = area_painel_m2 > 0 ? Math.ceil((area_tela_total_m2 * fator_perda) / area_painel_m2) : 0;
  const custo_total = qtd_paineis * precoPainel;

  return { area_radier_m2: areaRadierM2, area_tela_total_m2, area_painel_m2, qtd_paineis, custo_total, preco_painel: precoPainel };
}

export function getTelaSoldadaPreco(catalogItems: Array<{ nome: string; preco: number; categoria: string }>): number {
  const item = catalogItems.find(i => i.nome.toLowerCase().includes('tela soldada') && i.nome.toLowerCase().includes('painel'));
  return item?.preco || 0;
}

export function TelaSoldadaForm({ input, onInputChange, areaRadierM2, catalogItems, isAdmin = false }: TelaSoldadaFormProps) {
  const precoPainel = getTelaSoldadaPreco(catalogItems);
  const resultado = useMemo(() => calcularTelaSoldada(input, areaRadierM2, precoPainel), [input, areaRadierM2, precoPainel]);

  const handlePainelChange = (option: string) => {
    const preset = PAINEL_OPTIONS.find(p => p.value === option);
    if (preset && option !== 'custom') {
      onInputChange({ ...input, painel_option: option as TelaSoldadaInput['painel_option'], largura_m: preset.largura, comprimento_m: preset.comprimento });
    } else {
      onInputChange({ ...input, painel_option: 'custom' });
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Grid3X3 className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base">Tela Soldada (Radier)</CardTitle>
          </div>
          <div className="flex items-center gap-3">
            {resultado.qtd_paineis > 0 && resultado.custo_total > 0 && (
              <Badge variant="outline" className="text-blue-700 border-blue-300">
                {formatCurrency(resultado.custo_total)}
              </Badge>
            )}
            <Switch
              id="tela_enabled"
              checked={input.tela_enabled}
              onCheckedChange={(checked) => onInputChange({ ...input, tela_enabled: checked })}
            />
            <Label htmlFor="tela_enabled" className="text-sm cursor-pointer">Incluir</Label>
          </div>
        </div>
      </CardHeader>

      {input.tela_enabled && (
        <CardContent className="space-y-4">
          {/* Camadas + Painel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Número de camadas</Label>
              <Select
                value={String(input.camadas)}
                onValueChange={(v) => {
                  const val = parseInt(v);
                  onInputChange({ ...input, camadas: val > 0 ? val : 1 });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 camada</SelectItem>
                  <SelectItem value="2">2 camadas</SelectItem>
                  <SelectItem value="3">3 camadas</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Quantidade de camadas deve seguir o projeto estrutural.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Tamanho do painel</Label>
              <Select value={input.painel_option} onValueChange={handlePainelChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAINEL_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Custom panel dimensions */}
          {input.painel_option === 'custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Largura (m)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.5"
                  value={input.largura_m || ''}
                  onChange={(e) => onInputChange({ ...input, largura_m: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Comprimento (m)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.5"
                  value={input.comprimento_m || ''}
                  onChange={(e) => onInputChange({ ...input, comprimento_m: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>
          )}

          {/* Perda */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1">
                      <Label>Perda por sobreposição (%)</Label>
                      <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Perda por sobreposição considera emendas (20–30 cm). Padrão 10%.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Input
                type="number"
                min={0}
                max={20}
                step={1}
                value={input.perda_percent}
                onChange={(e) => {
                  let val = parseFloat(e.target.value) || 0;
                  if (val < 0) val = 0;
                  if (val > 20) val = 20;
                  onInputChange({ ...input, perda_percent: val });
                }}
              />
            </div>
          </div>

          {/* Resumo */}
          {areaRadierM2 > 0 && (
            <div className="bg-accent/50 rounded-lg p-4 space-y-1.5">
              <h4 className="text-sm font-semibold mb-2">Resumo Tela Soldada</h4>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <div>Área do radier:</div>
                <div className="font-medium">{formatNumber(areaRadierM2)} m²</div>
                <div>Camadas:</div>
                <div className="font-medium">{input.camadas}</div>
                <div>Área total de tela:</div>
                <div className="font-medium">{formatNumber(resultado.area_tela_total_m2)} m²</div>
                <div>Área do painel:</div>
                <div className="font-medium">{formatNumber(resultado.area_painel_m2, 2)} m²</div>
                <div>Perda sobreposição:</div>
                <div className="font-medium">{input.perda_percent}%</div>
                <div className="font-semibold border-t pt-1 mt-1">Qtd. painéis:</div>
                <div className="font-bold border-t pt-1 mt-1 text-primary">{resultado.qtd_paineis} unid</div>
              </div>

              {precoPainel > 0 ? (
                <div className="flex justify-between items-center mt-2 pt-2 border-t text-sm">
                  <span>Preço/painel: {formatCurrency(precoPainel)}</span>
                  <span className="font-bold text-base text-primary">{formatCurrency(resultado.custo_total)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-2 pt-2 border-t text-sm text-amber-700">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Defina o preço do painel da tela no catálogo de preços.</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
