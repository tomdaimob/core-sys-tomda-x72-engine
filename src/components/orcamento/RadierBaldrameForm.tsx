import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Square, Layers, LayersIcon } from 'lucide-react';
import { BaldrameForm } from './BaldrameForm';
import { BaldrameInput, BaldrameResultado, FundacaoTipo, DEFAULT_BALDRAME_INPUT } from '@/lib/baldrame-types';
import { calcularBaldrame, getBaldramePrecos } from '@/lib/baldrame-calculos';
import { calcularRadier, formatCurrency, formatNumber } from '@/lib/orcamento-calculos';
import { InputRadier, ResultadoRadier, Precos } from '@/lib/orcamento-types';
import { cn } from '@/lib/utils';

interface RadierBaldrameFormProps {
  // Radier props
  radier: InputRadier;
  onRadierChange: (radier: InputRadier) => void;
  precos: Precos;
  resultadoRadier: ResultadoRadier | null;
  // Baldrame props
  baldrame: BaldrameInput;
  onBaldrameChange: (baldrame: BaldrameInput) => void;
  perimetroExternoM: number;
  catalogItems: Array<{ nome: string; preco: number; categoria: string }>;
  resultadoBaldrame: BaldrameResultado | null;
  isAdmin?: boolean;
}

export function RadierBaldrameForm({
  radier,
  onRadierChange,
  precos,
  resultadoRadier,
  baldrame,
  onBaldrameChange,
  perimetroExternoM,
  catalogItems,
  resultadoBaldrame,
  isAdmin = false,
}: RadierBaldrameFormProps) {
  const fundacaoTipo = baldrame.fundacao_tipo;

  const handleFundacaoChange = (tipo: FundacaoTipo) => {
    onBaldrameChange({ ...baldrame, fundacao_tipo: tipo });
  };

  // Calculate totals
  const custoRadier = fundacaoTipo !== 'BALDRAME' ? (resultadoRadier?.custoTotal || 0) : 0;
  const custoBaldrame = fundacaoTipo !== 'RADIER' ? (resultadoBaldrame?.custo_total || 0) : 0;
  const custoTotal = custoRadier + custoBaldrame;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fundação</h2>
        {custoTotal > 0 && (
          <Badge variant="secondary" className="text-base px-3 py-1">
            Total: {formatCurrency(custoTotal)}
          </Badge>
        )}
      </div>

      {/* Foundation type selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tipo de Fundação</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={fundacaoTipo}
            onValueChange={(v) => handleFundacaoChange(v as FundacaoTipo)}
            className="grid grid-cols-1 md:grid-cols-3 gap-3"
          >
            <div className="relative">
              <RadioGroupItem value="RADIER" id="tipo-radier" className="peer sr-only" />
              <Label
                htmlFor="tipo-radier"
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all',
                  'hover:bg-accent/50',
                  fundacaoTipo === 'RADIER'
                    ? 'border-primary bg-primary/5'
                    : 'border-muted'
                )}
              >
                <Square className="w-8 h-8 text-primary" />
                <span className="font-medium">Radier</span>
                <span className="text-xs text-muted-foreground text-center">
                  Laje de piso contínua
                </span>
              </Label>
            </div>

            <div className="relative">
              <RadioGroupItem value="BALDRAME" id="tipo-baldrame" className="peer sr-only" />
              <Label
                htmlFor="tipo-baldrame"
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all',
                  'hover:bg-accent/50',
                  fundacaoTipo === 'BALDRAME'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-muted'
                )}
              >
                <Layers className="w-8 h-8 text-orange-600" />
                <span className="font-medium">Viga Baldrame</span>
                <span className="text-xs text-muted-foreground text-center">
                  Fundação em vigas
                </span>
              </Label>
            </div>

            <div className="relative">
              <RadioGroupItem value="RADIER_BALDRAME" id="tipo-ambos" className="peer sr-only" />
              <Label
                htmlFor="tipo-ambos"
                className={cn(
                  'flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all',
                  'hover:bg-accent/50',
                  fundacaoTipo === 'RADIER_BALDRAME'
                    ? 'border-green-500 bg-green-50'
                    : 'border-muted'
                )}
              >
                <LayersIcon className="w-8 h-8 text-green-600" />
                <span className="font-medium">Radier + Baldrame</span>
                <span className="text-xs text-muted-foreground text-center">
                  Combinação de ambos
                </span>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Radier form */}
      {(fundacaoTipo === 'RADIER' || fundacaoTipo === 'RADIER_BALDRAME') && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Radier</CardTitle>
              {resultadoRadier && (
                <Badge variant="outline">{formatCurrency(resultadoRadier.custoTotal)}</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="radier_area">Área (m²)</Label>
                <Input
                  id="radier_area"
                  name="radier_area"
                  type="number"
                  value={radier.areaM2 || ''}
                  onChange={(e) =>
                    onRadierChange({ ...radier, areaM2: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="radier_espessura">Espessura (cm)</Label>
                <Input
                  id="radier_espessura"
                  name="radier_espessura"
                  type="number"
                  value={radier.espessuraCm}
                  onChange={(e) =>
                    onRadierChange({ ...radier, espessuraCm: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="radier_tipo_fibra">Tipo Fibra</Label>
                <select
                  id="radier_tipo_fibra"
                  name="radier_tipo_fibra"
                  value={radier.tipoFibra}
                  onChange={(e) =>
                    onRadierChange({ ...radier, tipoFibra: e.target.value as 'aco' | 'pp' })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="aco">Aço (25 kg/m³)</option>
                  <option value="pp">PP (5 kg/m³)</option>
                </select>
              </div>
            </div>
            {resultadoRadier && (
              <div className="bg-accent/50 rounded-lg p-4 mt-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Volume: {formatNumber(resultadoRadier.volumeM3)} m³</div>
                  <div>Custo Total: {formatCurrency(resultadoRadier.custoTotal)}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Baldrame form */}
      {(fundacaoTipo === 'BALDRAME' || fundacaoTipo === 'RADIER_BALDRAME') && (
        <BaldrameForm
          input={baldrame}
          onInputChange={onBaldrameChange}
          perimetroExternoM={perimetroExternoM}
          catalogItems={catalogItems}
          isAdmin={isAdmin}
          resultado={resultadoBaldrame}
        />
      )}
    </div>
  );
}
