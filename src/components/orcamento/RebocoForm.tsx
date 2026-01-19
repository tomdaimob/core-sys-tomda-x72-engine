import { PaintBucket, Calculator } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatNumber } from '@/lib/orcamento-calculos';
import { Precos } from '@/lib/orcamento-types';

export interface RebocoInput {
  areaInternaM2: number;
  areaExternaM2: number;
}

export interface ResultadoRebocoCalculado {
  areaTotal: number;
  quantidadeSacos: number;
  custoMaterial: number;
  custoMaoObra: number;
  custoTotal: number;
}

interface RebocoFormProps {
  reboco: RebocoInput;
  onRebocoChange: (reboco: RebocoInput) => void;
  precos: Precos;
  resultado: ResultadoRebocoCalculado;
}

// Consumption: ~0.5 saco per m² (average for internal/external)
const CONSUMO_ARGAMASSA_M2 = 0.5;

export function RebocoForm({ reboco, onRebocoChange, precos, resultado }: RebocoFormProps) {
  const updateField = (field: keyof RebocoInput, value: string) => {
    const numValue = Math.max(0, parseFloat(value) || 0);
    onRebocoChange({ ...reboco, [field]: numValue });
  };

  const hasData = reboco.areaInternaM2 > 0 || reboco.areaExternaM2 > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <PaintBucket className="w-5 h-5 text-primary" />
          Reboco
        </h2>
        <p className="text-muted-foreground text-sm">
          Consumo médio: {CONSUMO_ARGAMASSA_M2} saco/m² | Custo = Material + Mão de Obra
        </p>
      </div>

      {/* Input Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4 p-4 bg-accent/30 rounded-xl border border-accent">
          <h3 className="font-medium text-foreground">Área Interna</h3>
          <div className="input-group">
            <Label className="input-label">Área (m²)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={reboco.areaInternaM2 || ''}
              onChange={(e) => updateField('areaInternaM2', e.target.value)}
              placeholder="Ex: 150"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Paredes internas que receberão reboco
          </p>
        </div>

        <div className="space-y-4 p-4 bg-accent/30 rounded-xl border border-accent">
          <h3 className="font-medium text-foreground">Área Externa</h3>
          <div className="input-group">
            <Label className="input-label">Área (m²)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={reboco.areaExternaM2 || ''}
              onChange={(e) => updateField('areaExternaM2', e.target.value)}
              placeholder="Ex: 80"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Paredes externas/fachada que receberão reboco
          </p>
        </div>
      </div>

      {/* Prices Reference */}
      <div className="flex gap-4 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
        <div>
          <span className="font-medium">Argamassa (saco):</span> {formatCurrency(precos.argamassaSaco)}
        </div>
        <div>
          <span className="font-medium">M.O. Reboco/m²:</span> {formatCurrency(precos.maoObraReboco)}
        </div>
      </div>

      {/* Results */}
      {hasData && (
        <div className="bg-accent/50 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Resultado do Cálculo</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-background rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Área Total</div>
              <div className="text-lg font-semibold">{formatNumber(resultado.areaTotal)} m²</div>
            </div>
            <div className="bg-background rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Sacos Argamassa</div>
              <div className="text-lg font-semibold">{resultado.quantidadeSacos} un</div>
            </div>
            <div className="bg-background rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Custo Material</div>
              <div className="text-lg font-semibold text-primary">{formatCurrency(resultado.custoMaterial)}</div>
            </div>
            <div className="bg-background rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Custo M.O.</div>
              <div className="text-lg font-semibold text-primary">{formatCurrency(resultado.custoMaoObra)}</div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-4 text-sm border-t border-accent pt-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Área Interna:</span>
              <span>{formatNumber(reboco.areaInternaM2)} m²</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Área Externa:</span>
              <span>{formatNumber(reboco.areaExternaM2)} m²</span>
            </div>
          </div>

          <div className="border-t border-accent pt-4 flex justify-between items-center">
            <span className="text-muted-foreground">Custo Total Reboco:</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(resultado.custoTotal)}</span>
          </div>
        </div>
      )}

      {!hasData && (
        <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-xl">
          <PaintBucket className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Preencha as áreas para calcular os custos de reboco</p>
        </div>
      )}
    </div>
  );
}

// Calculate reboco results
export function calcularRebocoResultado(reboco: RebocoInput, precos: Precos): ResultadoRebocoCalculado {
  const areaInterna = Math.max(0, reboco.areaInternaM2 || 0);
  const areaExterna = Math.max(0, reboco.areaExternaM2 || 0);
  const areaTotal = areaInterna + areaExterna;
  
  // ~0.5 saco per m² (average)
  const quantidadeSacos = Math.ceil(areaTotal * CONSUMO_ARGAMASSA_M2);
  
  const custoMaterial = quantidadeSacos * precos.argamassaSaco;
  const custoMaoObra = areaTotal * precos.maoObraReboco;
  const custoTotal = custoMaterial + custoMaoObra;

  return {
    areaTotal,
    quantidadeSacos,
    custoMaterial,
    custoMaoObra,
    custoTotal,
  };
}
