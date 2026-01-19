import { Sparkles, Calculator } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatCurrency, formatNumber } from '@/lib/orcamento-calculos';
import { Precos } from '@/lib/orcamento-types';

export interface AcabamentosInput {
  areaPiso: number;
  tipoPiso: 'ceramico' | 'porcelanato';
  areaPintura: number;
  demaosPintura: number;
}

export interface ResultadoAcabamentosCalculado {
  custoPiso: number;
  custoMaoObraPiso: number;
  custoPintura: number;
  custoMaoObraPintura: number;
  quantidadeTinta: number;
  custoTotal: number;
}

interface AcabamentosFormProps {
  acabamentos: AcabamentosInput;
  onAcabamentosChange: (acabamentos: AcabamentosInput) => void;
  precos: Precos;
  resultado: ResultadoAcabamentosCalculado;
}

// Constants
const RENDIMENTO_TINTA_M2 = 50; // m² per can (18L)
const MAO_OBRA_PISO_M2 = 35; // R$/m² for floor installation

export function AcabamentosForm({ acabamentos, onAcabamentosChange, precos, resultado }: AcabamentosFormProps) {
  const updateField = (field: keyof AcabamentosInput, value: string | number) => {
    if (typeof value === 'string') {
      const numValue = Math.max(0, parseFloat(value) || 0);
      onAcabamentosChange({ ...acabamentos, [field]: numValue });
    } else {
      onAcabamentosChange({ ...acabamentos, [field]: value });
    }
  };

  const hasData = acabamentos.areaPiso > 0 || acabamentos.areaPintura > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Acabamentos
        </h2>
        <p className="text-muted-foreground text-sm">
          Piso + Pintura | Rendimento tinta: {RENDIMENTO_TINTA_M2} m²/galão
        </p>
      </div>

      {/* Piso Section */}
      <div className="p-4 bg-accent/30 rounded-xl border border-accent space-y-4">
        <h3 className="font-medium text-foreground flex items-center gap-2">
          🏠 Piso
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="input-group">
            <Label className="input-label">Área do Piso (m²)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={acabamentos.areaPiso || ''}
              onChange={(e) => updateField('areaPiso', e.target.value)}
              placeholder="Ex: 120"
            />
          </div>
          <div className="input-group">
            <Label className="input-label">Tipo de Piso</Label>
            <select
              value={acabamentos.tipoPiso}
              onChange={(e) => updateField('tipoPiso', e.target.value as 'ceramico' | 'porcelanato')}
              className="input-field"
            >
              <option value="ceramico">Cerâmico ({formatCurrency(precos.pisoCeramicoM2)}/m²)</option>
              <option value="porcelanato">Porcelanato ({formatCurrency(precos.porcelanatoPisoM2)}/m²)</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Mão de obra: {formatCurrency(MAO_OBRA_PISO_M2)}/m²
        </p>
      </div>

      {/* Pintura Section */}
      <div className="p-4 bg-accent/30 rounded-xl border border-accent space-y-4">
        <h3 className="font-medium text-foreground flex items-center gap-2">
          🎨 Pintura
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="input-group">
            <Label className="input-label">Área de Pintura (m²)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={acabamentos.areaPintura || ''}
              onChange={(e) => updateField('areaPintura', e.target.value)}
              placeholder="Ex: 200"
            />
          </div>
          <div className="input-group">
            <Label className="input-label">Número de Demãos</Label>
            <select
              value={acabamentos.demaosPintura}
              onChange={(e) => updateField('demaosPintura', parseInt(e.target.value))}
              className="input-field"
            >
              <option value={1}>1 demão</option>
              <option value={2}>2 demãos</option>
              <option value={3}>3 demãos</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Tinta: {formatCurrency(precos.pinturaTinta)}/galão | M.O.: {formatCurrency(precos.maoObraPintura)}/m²
        </p>
      </div>

      {/* Prices Reference */}
      <div className="flex flex-wrap gap-4 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
        <div>
          <span className="font-medium">Cerâmico:</span> {formatCurrency(precos.pisoCeramicoM2)}/m²
        </div>
        <div>
          <span className="font-medium">Porcelanato:</span> {formatCurrency(precos.porcelanatoPisoM2)}/m²
        </div>
        <div>
          <span className="font-medium">Tinta (galão 18L):</span> {formatCurrency(precos.pinturaTinta)}
        </div>
        <div>
          <span className="font-medium">M.O. Pintura:</span> {formatCurrency(precos.maoObraPintura)}/m²
        </div>
      </div>

      {/* Results */}
      {hasData && (
        <div className="bg-accent/50 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Resultado do Cálculo</h3>
          </div>
          
          {/* Piso Results */}
          {acabamentos.areaPiso > 0 && (
            <div className="border-b border-accent pb-4">
              <h4 className="text-sm font-medium mb-2 text-muted-foreground">Piso</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-background rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Material</div>
                  <div className="text-lg font-semibold text-primary">{formatCurrency(resultado.custoPiso)}</div>
                </div>
                <div className="bg-background rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Mão de Obra</div>
                  <div className="text-lg font-semibold text-primary">{formatCurrency(resultado.custoMaoObraPiso)}</div>
                </div>
                <div className="bg-background rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Subtotal Piso</div>
                  <div className="text-lg font-semibold">{formatCurrency(resultado.custoPiso + resultado.custoMaoObraPiso)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Pintura Results */}
          {acabamentos.areaPintura > 0 && (
            <div className="border-b border-accent pb-4">
              <h4 className="text-sm font-medium mb-2 text-muted-foreground">Pintura</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-background rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Galões de Tinta</div>
                  <div className="text-lg font-semibold">{resultado.quantidadeTinta} un</div>
                </div>
                <div className="bg-background rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Custo Tinta</div>
                  <div className="text-lg font-semibold text-primary">{formatCurrency(resultado.custoPintura)}</div>
                </div>
                <div className="bg-background rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Mão de Obra</div>
                  <div className="text-lg font-semibold text-primary">{formatCurrency(resultado.custoMaoObraPintura)}</div>
                </div>
                <div className="bg-background rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Subtotal Pintura</div>
                  <div className="text-lg font-semibold">{formatCurrency(resultado.custoPintura + resultado.custoMaoObraPintura)}</div>
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-between items-center">
            <span className="text-muted-foreground">Custo Total Acabamentos:</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(resultado.custoTotal)}</span>
          </div>
        </div>
      )}

      {!hasData && (
        <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-xl">
          <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Preencha as áreas para calcular os custos de acabamentos</p>
        </div>
      )}
    </div>
  );
}

// Calculate acabamentos results
export function calcularAcabamentosResultado(acabamentos: AcabamentosInput, precos: Precos): ResultadoAcabamentosCalculado {
  const areaPiso = Math.max(0, acabamentos.areaPiso || 0);
  const areaPintura = Math.max(0, acabamentos.areaPintura || 0);
  const demaos = Math.max(1, acabamentos.demaosPintura || 2);

  // Floor
  const precoPiso = acabamentos.tipoPiso === 'ceramico' 
    ? precos.pisoCeramicoM2 
    : precos.porcelanatoPisoM2;
  const custoPiso = areaPiso * precoPiso;
  const custoMaoObraPiso = areaPiso * MAO_OBRA_PISO_M2;

  // Painting
  const areaComDemaos = areaPintura * demaos;
  const quantidadeTinta = Math.ceil(areaComDemaos / RENDIMENTO_TINTA_M2);
  const custoPintura = quantidadeTinta * precos.pinturaTinta;
  const custoMaoObraPintura = areaPintura * precos.maoObraPintura;

  const custoTotal = custoPiso + custoMaoObraPiso + custoPintura + custoMaoObraPintura;

  return {
    custoPiso,
    custoMaoObraPiso,
    custoPintura,
    custoMaoObraPintura,
    quantidadeTinta,
    custoTotal,
  };
}
