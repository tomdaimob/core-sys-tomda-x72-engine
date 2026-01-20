import * as React from 'react';
import { Sparkles, Calculator, AlertTriangle, Info, Grid2X2, Paintbrush } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatCurrency, formatNumber } from '@/lib/orcamento-calculos';
import { Precos, ResultadoRadier } from '@/lib/orcamento-types';
import { ResultadoRebocoCalculado } from './RebocoForm';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface AcabamentosInput {
  areaPiso: number;
  tipoPiso: 'ceramico' | 'porcelanato';
  areaPintura: number;
  demaosPintura: number;
  usarAreaRadier: boolean; // Auto-fill from Radier
  usarAreaReboco: boolean; // Auto-fill from Reboco
}

export interface AcabamentosPrecos {
  pisoCeramicoM2: number;
  porcelanatoPisoM2: number;
  assentamentoPisoM2: number;
  tintaGalao: number;
  pinturaAplicacaoM2: number;
}

export interface ResultadoAcabamentosCalculado {
  // Piso
  areaPisoM2: number;
  tipoPiso: 'ceramico' | 'porcelanato';
  precoPisoM2: number;
  custoPiso: number;
  precoAssentamentoM2: number;
  custoMaoObraPiso: number;
  subtotalPiso: number;
  // Pintura
  areaPinturaM2: number;
  demaosPintura: number;
  areaPinturaComDemaos: number;
  quantidadeTinta: number;
  precoTintaGalao: number;
  custoPintura: number;
  precoPinturaAplicacaoM2: number;
  custoMaoObraPintura: number;
  subtotalPintura: number;
  // Total
  custoTotal: number;
}

interface AcabamentosFormProps {
  acabamentos: AcabamentosInput;
  onAcabamentosChange: (acabamentos: AcabamentosInput) => void;
  precos: Precos;
  precosAcabamentos: AcabamentosPrecos;
  resultado: ResultadoAcabamentosCalculado;
  resultadoRadier: ResultadoRadier | null;
  resultadoReboco: ResultadoRebocoCalculado | null;
}

// Constants
const RENDIMENTO_TINTA_M2 = 50; // m² per can (18L)

export function AcabamentosForm({ 
  acabamentos, 
  onAcabamentosChange, 
  precos,
  precosAcabamentos,
  resultado,
  resultadoRadier,
  resultadoReboco,
}: AcabamentosFormProps) {
  const areaRadierDisponivel = resultadoRadier && resultadoRadier.areaM2 > 0;
  const areaRebocoDisponivel = resultadoReboco && resultadoReboco.areaTotal > 0;

  const updateField = (field: keyof AcabamentosInput, value: string | number | boolean) => {
    if (typeof value === 'string') {
      const numValue = Math.max(0, parseFloat(value) || 0);
      onAcabamentosChange({ ...acabamentos, [field]: numValue });
    } else {
      onAcabamentosChange({ ...acabamentos, [field]: value });
    }
  };

  // Toggle to use Radier area
  const handleUsarAreaRadier = (checked: boolean) => {
    onAcabamentosChange({
      ...acabamentos,
      usarAreaRadier: checked,
      areaPiso: checked && resultadoRadier ? resultadoRadier.areaM2 : acabamentos.areaPiso,
    });
  };

  // Toggle to use Reboco area
  const handleUsarAreaReboco = (checked: boolean) => {
    onAcabamentosChange({
      ...acabamentos,
      usarAreaReboco: checked,
      areaPintura: checked && resultadoReboco ? resultadoReboco.areaTotal : acabamentos.areaPintura,
    });
  };

  const hasData = resultado.areaPisoM2 > 0 || resultado.areaPinturaM2 > 0;

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

      {/* Info about automatic areas */}
      {(areaRadierDisponivel || areaRebocoDisponivel) && (
        <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-primary" />
            <h3 className="font-medium text-sm">Áreas disponíveis (automático)</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {areaRadierDisponivel && (
              <div className="flex justify-between p-2 bg-background rounded-lg">
                <span className="text-muted-foreground">Área Radier (Piso):</span>
                <span className="font-medium">{formatNumber(resultadoRadier!.areaM2)} m²</span>
              </div>
            )}
            {areaRebocoDisponivel && (
              <div className="flex justify-between p-2 bg-background rounded-lg">
                <span className="text-muted-foreground">Área Reboco (Pintura):</span>
                <span className="font-medium">{formatNumber(resultadoReboco!.areaTotal)} m²</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Piso Section */}
      <div className="p-4 bg-accent/30 rounded-xl border border-accent space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <Grid2X2 className="w-4 h-4" /> Piso
          </h3>
          {areaRadierDisponivel && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Usar área do Radier</span>
              <Switch
                id="usar_area_radier"
                name="usar_area_radier"
                checked={acabamentos.usarAreaRadier}
                onCheckedChange={handleUsarAreaRadier}
              />
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="input-group">
            <Label htmlFor="area_piso" className="input-label">Área do Piso (m²)</Label>
            <Input
              id="area_piso"
              name="area_piso"
              type="number"
              min="0"
              step="0.01"
              value={acabamentos.areaPiso || ''}
              onChange={(e) => {
                updateField('areaPiso', e.target.value);
                if (acabamentos.usarAreaRadier) {
                  onAcabamentosChange({ ...acabamentos, usarAreaRadier: false, areaPiso: parseFloat(e.target.value) || 0 });
                }
              }}
              placeholder={areaRadierDisponivel ? String(resultadoRadier!.areaM2) : 'Ex: 120'}
              disabled={acabamentos.usarAreaRadier}
            />
            {acabamentos.usarAreaRadier && areaRadierDisponivel && (
              <p className="text-xs text-primary mt-1 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Usando área do Radier automaticamente
              </p>
            )}
          </div>
          <div className="input-group">
            <Label htmlFor="tipo_piso" className="input-label">Tipo de Piso</Label>
            <select
              id="tipo_piso"
              name="tipo_piso"
              value={acabamentos.tipoPiso}
              onChange={(e) => updateField('tipoPiso', e.target.value as 'ceramico' | 'porcelanato')}
              className="input-field"
            >
              <option value="ceramico">Cerâmico ({formatCurrency(precosAcabamentos.pisoCeramicoM2)}/m²)</option>
              <option value="porcelanato">Porcelanato ({formatCurrency(precosAcabamentos.porcelanatoPisoM2)}/m²)</option>
            </select>
          </div>
        </div>
        
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Material: {formatCurrency(acabamentos.tipoPiso === 'ceramico' ? precosAcabamentos.pisoCeramicoM2 : precosAcabamentos.porcelanatoPisoM2)}/m²</span>
          <span>Assentamento: {formatCurrency(precosAcabamentos.assentamentoPisoM2)}/m²</span>
        </div>
      </div>

      {/* Pintura Section */}
      <div className="p-4 bg-accent/30 rounded-xl border border-accent space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-foreground flex items-center gap-2">
            <Paintbrush className="w-4 h-4" /> Pintura
          </h3>
          {areaRebocoDisponivel && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Usar área do Reboco</span>
              <Switch
                id="usar_area_reboco"
                name="usar_area_reboco"
                checked={acabamentos.usarAreaReboco}
                onCheckedChange={handleUsarAreaReboco}
              />
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="input-group">
            <Label htmlFor="area_pintura" className="input-label">Área de Pintura (m²)</Label>
            <Input
              id="area_pintura"
              name="area_pintura"
              type="number"
              min="0"
              step="0.01"
              value={acabamentos.areaPintura || ''}
              onChange={(e) => {
                updateField('areaPintura', e.target.value);
                if (acabamentos.usarAreaReboco) {
                  onAcabamentosChange({ ...acabamentos, usarAreaReboco: false, areaPintura: parseFloat(e.target.value) || 0 });
                }
              }}
              placeholder={areaRebocoDisponivel ? String(resultadoReboco!.areaTotal) : 'Ex: 200'}
              disabled={acabamentos.usarAreaReboco}
            />
            {acabamentos.usarAreaReboco && areaRebocoDisponivel && (
              <p className="text-xs text-primary mt-1 flex items-center gap-1">
                <Info className="w-3 h-3" />
                Usando área do Reboco automaticamente
              </p>
            )}
          </div>
          <div className="input-group">
            <Label htmlFor="demaos_pintura" className="input-label">Número de Demãos</Label>
            <select
              id="demaos_pintura"
              name="demaos_pintura"
              value={acabamentos.demaosPintura}
              onChange={(e) => updateField('demaosPintura', parseInt(e.target.value))}
              className="input-field"
            >
              <option value={1}>1 demão</option>
              <option value={2}>2 demãos (recomendado)</option>
              <option value={3}>3 demãos</option>
            </select>
          </div>
        </div>
        
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>Tinta (18L): {formatCurrency(precosAcabamentos.tintaGalao)}/galão</span>
          <span>Aplicação: {formatCurrency(precosAcabamentos.pinturaAplicacaoM2)}/m²</span>
        </div>
      </div>

      {/* Warnings */}
      {!areaRadierDisponivel && !areaRebocoDisponivel && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Dica:</strong> Preencha Radier e Reboco nas etapas anteriores para preenchimento automático das áreas.
          </AlertDescription>
        </Alert>
      )}

      {/* Prices Reference */}
      <div className="bg-muted/30 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-3">Preços do Catálogo</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div className="flex justify-between p-2 bg-background rounded-lg">
            <span className="text-muted-foreground">Cerâmico:</span>
            <span className="font-medium">{formatCurrency(precosAcabamentos.pisoCeramicoM2)}/m²</span>
          </div>
          <div className="flex justify-between p-2 bg-background rounded-lg">
            <span className="text-muted-foreground">Porcelanato:</span>
            <span className="font-medium">{formatCurrency(precosAcabamentos.porcelanatoPisoM2)}/m²</span>
          </div>
          <div className="flex justify-between p-2 bg-background rounded-lg">
            <span className="text-muted-foreground">Assentamento:</span>
            <span className="font-medium">{formatCurrency(precosAcabamentos.assentamentoPisoM2)}/m²</span>
          </div>
          <div className="flex justify-between p-2 bg-background rounded-lg">
            <span className="text-muted-foreground">Tinta 18L:</span>
            <span className="font-medium">{formatCurrency(precosAcabamentos.tintaGalao)}</span>
          </div>
          <div className="flex justify-between p-2 bg-background rounded-lg">
            <span className="text-muted-foreground">M.O. Pintura:</span>
            <span className="font-medium">{formatCurrency(precosAcabamentos.pinturaAplicacaoM2)}/m²</span>
          </div>
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
          {resultado.areaPisoM2 > 0 && (
            <div className="border-b border-accent pb-4">
              <h4 className="text-sm font-medium mb-2 text-muted-foreground flex items-center gap-1">
                <Grid2X2 className="w-4 h-4" /> Piso ({resultado.tipoPiso === 'ceramico' ? 'Cerâmico' : 'Porcelanato'})
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-background rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Área</div>
                  <div className="text-lg font-semibold">{formatNumber(resultado.areaPisoM2)} m²</div>
                </div>
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
                  <div className="text-lg font-semibold">{formatCurrency(resultado.subtotalPiso)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Pintura Results */}
          {resultado.areaPinturaM2 > 0 && (
            <div className="border-b border-accent pb-4">
              <h4 className="text-sm font-medium mb-2 text-muted-foreground flex items-center gap-1">
                <Paintbrush className="w-4 h-4" /> Pintura ({resultado.demaosPintura} demão{resultado.demaosPintura > 1 ? 's' : ''})
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-background rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Área</div>
                  <div className="text-lg font-semibold">{formatNumber(resultado.areaPinturaM2)} m²</div>
                </div>
                <div className="bg-background rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Área c/ Demãos</div>
                  <div className="text-lg font-semibold">{formatNumber(resultado.areaPinturaComDemaos)} m²</div>
                </div>
                <div className="bg-background rounded-lg p-3">
                  <div className="text-xs text-muted-foreground mb-1">Galões Tinta</div>
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
              </div>
              <div className="mt-3 flex justify-end">
                <span className="text-sm">Subtotal Pintura: <strong>{formatCurrency(resultado.subtotalPintura)}</strong></span>
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

// Calculate acabamentos results using catalog prices
export function calcularAcabamentosResultado(
  acabamentos: AcabamentosInput, 
  precosAcabamentos: AcabamentosPrecos,
  resultadoRadier: { areaM2: number } | null,
  resultadoReboco: { areaTotal: number } | null
): ResultadoAcabamentosCalculado {
  // Determine effective areas
  let areaPisoM2 = acabamentos.areaPiso || 0;
  let areaPinturaM2 = acabamentos.areaPintura || 0;

  // Use Radier area if toggle is on
  if (acabamentos.usarAreaRadier && resultadoRadier && resultadoRadier.areaM2 > 0) {
    areaPisoM2 = resultadoRadier.areaM2;
  }

  // Use Reboco area if toggle is on
  if (acabamentos.usarAreaReboco && resultadoReboco && resultadoReboco.areaTotal > 0) {
    areaPinturaM2 = resultadoReboco.areaTotal;
  }

  // Floor calculation
  const tipoPiso = acabamentos.tipoPiso || 'ceramico';
  const precoPisoM2 = tipoPiso === 'ceramico' 
    ? precosAcabamentos.pisoCeramicoM2 
    : precosAcabamentos.porcelanatoPisoM2;
  const custoPiso = areaPisoM2 * precoPisoM2;
  const precoAssentamentoM2 = precosAcabamentos.assentamentoPisoM2;
  const custoMaoObraPiso = areaPisoM2 * precoAssentamentoM2;
  const subtotalPiso = custoPiso + custoMaoObraPiso;

  // Painting calculation
  const demaosPintura = Math.max(1, acabamentos.demaosPintura || 2);
  const areaPinturaComDemaos = areaPinturaM2 * demaosPintura;
  const quantidadeTinta = Math.ceil(areaPinturaComDemaos / RENDIMENTO_TINTA_M2);
  const precoTintaGalao = precosAcabamentos.tintaGalao;
  const custoPintura = quantidadeTinta * precoTintaGalao;
  const precoPinturaAplicacaoM2 = precosAcabamentos.pinturaAplicacaoM2;
  const custoMaoObraPintura = areaPinturaM2 * precoPinturaAplicacaoM2;
  const subtotalPintura = custoPintura + custoMaoObraPintura;

  const custoTotal = subtotalPiso + subtotalPintura;

  return {
    // Piso
    areaPisoM2,
    tipoPiso,
    precoPisoM2,
    custoPiso,
    precoAssentamentoM2,
    custoMaoObraPiso,
    subtotalPiso,
    // Pintura
    areaPinturaM2,
    demaosPintura,
    areaPinturaComDemaos,
    quantidadeTinta,
    precoTintaGalao,
    custoPintura,
    precoPinturaAplicacaoM2,
    custoMaoObraPintura,
    subtotalPintura,
    // Total
    custoTotal,
  };
}
