import * as React from 'react';
import { PaintBucket, Calculator, AlertTriangle, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { formatCurrency, formatNumber } from '@/lib/orcamento-calculos';
import { Precos } from '@/lib/orcamento-types';
import { ResultadoParedesDetalhado } from '@/components/orcamento/ParedesForm';

export interface RebocoInput {
  aplicarInterno: boolean;
  aplicarExterno: boolean;
  perdaPercentual: number;
  espessuraMedia: number; // mm (informativo)
  // Legacy fields - kept for compatibility but auto-calculated
  areaInternaM2?: number;
  areaExternaM2?: number;
}

export interface ResultadoRebocoCalculado {
  areaInternaM2: number;
  areaExternaM2: number;
  areaTotal: number;
  perdaPercentual: number;
  areaComPerda: number;
  precoIcflexM2: number;
  precoMaoObraM2: number;
  custoIcflex: number;
  custoMaoObra: number;
  custoTotal: number;
  // Legacy fields for compatibility
  quantidadeSacos?: number;
  custoMaterial?: number;
}

interface RebocoFormProps {
  reboco: RebocoInput;
  onRebocoChange: (reboco: RebocoInput) => void;
  precos: Precos;
  resultado: ResultadoRebocoCalculado;
  resultadoParedes: ResultadoParedesDetalhado | null;
  precoIcflexM2: number;
  precoMaoObraRebocoM2: number;
}

export function RebocoForm({ 
  reboco, 
  onRebocoChange, 
  precos, 
  resultado, 
  resultadoParedes,
  precoIcflexM2,
  precoMaoObraRebocoM2,
}: RebocoFormProps) {
  const paredesCalculadas = resultadoParedes && resultadoParedes.areaLiquidaTotal > 0;
  const hasData = resultado.areaTotal > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <PaintBucket className="w-5 h-5 text-primary" />
          Reboco (ICFLEX)
        </h2>
        <p className="text-muted-foreground text-sm">
          Áreas calculadas automaticamente a partir das paredes ICF
        </p>
      </div>

      {/* Warning if Paredes not calculated */}
      {!paredesCalculadas && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800 dark:text-amber-200">Paredes não calculadas</h4>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Calcule as Paredes primeiro para gerar a metragem do reboco automaticamente.
            </p>
          </div>
        </div>
      )}

      {/* Áreas das Paredes (read-only) */}
      {paredesCalculadas && (
        <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-primary" />
            <h3 className="font-medium text-sm">Áreas das Paredes (calculadas)</h3>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex justify-between p-2 bg-background rounded-lg">
              <span className="text-muted-foreground">Área Interna:</span>
              <span className="font-medium">{formatNumber(resultado.areaInternaM2)} m²</span>
            </div>
            <div className="flex justify-between p-2 bg-background rounded-lg">
              <span className="text-muted-foreground">Área Externa:</span>
              <span className="font-medium">{formatNumber(resultado.areaExternaM2)} m²</span>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4 p-4 bg-accent/30 rounded-xl border border-accent">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-foreground">Reboco Interno</h3>
              <p className="text-xs text-muted-foreground">
                Aplicar ICFLEX nas paredes internas
              </p>
            </div>
            <Switch
              id="aplicar_interno"
              name="aplicar_interno"
              checked={reboco.aplicarInterno}
              onCheckedChange={(checked) => 
                onRebocoChange({ ...reboco, aplicarInterno: checked })
              }
            />
          </div>
          {reboco.aplicarInterno && paredesCalculadas && (
            <div className="text-sm text-muted-foreground pt-2 border-t border-accent">
              Área: <span className="font-medium text-foreground">{formatNumber(resultado.areaInternaM2)} m²</span>
            </div>
          )}
        </div>

        <div className="space-y-4 p-4 bg-accent/30 rounded-xl border border-accent">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-foreground">Reboco Externo</h3>
              <p className="text-xs text-muted-foreground">
                Aplicar ICFLEX nas paredes externas
              </p>
            </div>
            <Switch
              id="aplicar_externo"
              name="aplicar_externo"
              checked={reboco.aplicarExterno}
              onCheckedChange={(checked) => 
                onRebocoChange({ ...reboco, aplicarExterno: checked })
              }
            />
          </div>
          {reboco.aplicarExterno && paredesCalculadas && (
            <div className="text-sm text-muted-foreground pt-2 border-t border-accent">
              Área: <span className="font-medium text-foreground">{formatNumber(resultado.areaExternaM2)} m²</span>
            </div>
          )}
        </div>
      </div>

      {/* Perda e Espessura */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="input-group">
          <Label htmlFor="perda_percentual" className="input-label">Perda/Desperdício (%)</Label>
          <Input
            id="perda_percentual"
            name="perda_percentual"
            type="number"
            min="0"
            max="50"
            step="1"
            value={reboco.perdaPercentual}
            onChange={(e) => 
              onRebocoChange({ 
                ...reboco, 
                perdaPercentual: Math.max(0, Math.min(50, parseFloat(e.target.value) || 0))
              })
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            Margem adicional para desperdício e recortes
          </p>
        </div>
        <div className="input-group">
          <Label htmlFor="espessura_media" className="input-label">Espessura Média (mm) - Informativo</Label>
          <Input
            id="espessura_media"
            name="espessura_media"
            type="number"
            min="1"
            max="10"
            step="0.5"
            value={reboco.espessuraMedia}
            onChange={(e) => 
              onRebocoChange({ 
                ...reboco, 
                espessuraMedia: Math.max(1, Math.min(10, parseFloat(e.target.value) || 3))
              })
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            Referência para especificação (não afeta custo)
          </p>
        </div>
      </div>

      {/* Prices Reference (read-only) */}
      <div className="bg-muted/30 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-3">Preços do Catálogo (somente leitura)</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex justify-between p-2 bg-background rounded-lg">
            <span className="text-muted-foreground">ICFLEX Reboco:</span>
            <span className="font-medium">{formatCurrency(precoIcflexM2)}/m²</span>
          </div>
          <div className="flex justify-between p-2 bg-background rounded-lg">
            <span className="text-muted-foreground">Mão de Obra:</span>
            <span className="font-medium">{formatCurrency(precoMaoObraRebocoM2)}/m²</span>
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
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-background rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Área Total</div>
              <div className="text-lg font-semibold">{formatNumber(resultado.areaTotal)} m²</div>
            </div>
            <div className="bg-background rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Área c/ Perda</div>
              <div className="text-lg font-semibold">{formatNumber(resultado.areaComPerda)} m²</div>
              <div className="text-xs text-muted-foreground">+{resultado.perdaPercentual}%</div>
            </div>
            <div className="bg-background rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Custo ICFLEX</div>
              <div className="text-lg font-semibold text-primary">{formatCurrency(resultado.custoIcflex)}</div>
            </div>
            <div className="bg-background rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Custo M.O.</div>
              <div className="text-lg font-semibold text-primary">{formatCurrency(resultado.custoMaoObra)}</div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="grid grid-cols-2 gap-4 text-sm border-t border-accent pt-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Área Interna aplicada:</span>
              <span>{reboco.aplicarInterno ? formatNumber(resultado.areaInternaM2) : 0} m²</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Área Externa aplicada:</span>
              <span>{reboco.aplicarExterno ? formatNumber(resultado.areaExternaM2) : 0} m²</span>
            </div>
          </div>

          <div className="border-t border-accent pt-4 flex justify-between items-center">
            <span className="text-muted-foreground">Custo Total Reboco:</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(resultado.custoTotal)}</span>
          </div>
        </div>
      )}

      {!hasData && paredesCalculadas && (
        <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-xl">
          <PaintBucket className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Ative ao menos uma opção de reboco para calcular os custos</p>
        </div>
      )}
    </div>
  );
}

// Calculate reboco results based on paredes INPUT (not just resultado)
export function calcularRebocoResultado(
  reboco: RebocoInput, 
  resultadoParedes: ResultadoParedesDetalhado | null,
  precoIcflexM2: number,
  precoMaoObraM2: number,
  paredesInput?: { areaExternaM2?: number; areaInternaM2?: number; modoAvancado?: boolean; segmentos?: Array<{ areaParedeM2: number; tipoForma: string }> }
): ResultadoRebocoCalculado {
  // Get areas from paredes INPUT - use the actual values entered by the user
  let areaInternaM2 = 0;
  let areaExternaM2 = 0;

  if (paredesInput) {
    if (paredesInput.modoAvancado && paredesInput.segmentos && paredesInput.segmentos.length > 0) {
      // Advanced mode: estimate based on form type
      // ICF 18 are typically external, ICF 12 are typically internal
      paredesInput.segmentos.forEach((seg) => {
        if (seg.tipoForma === 'ICF 18') {
          areaExternaM2 += seg.areaParedeM2;
        } else {
          areaInternaM2 += seg.areaParedeM2;
        }
      });
      
      // If all same type, split by 70/30
      const totalFromSegments = areaExternaM2 + areaInternaM2;
      if (areaExternaM2 === 0 && totalFromSegments > 0) {
        areaExternaM2 = totalFromSegments * 0.7;
        areaInternaM2 = totalFromSegments * 0.3;
      } else if (areaInternaM2 === 0 && totalFromSegments > 0) {
        areaExternaM2 = totalFromSegments * 0.7;
        areaInternaM2 = totalFromSegments * 0.3;
      }
    } else {
      // Simple mode: use the direct input values
      areaExternaM2 = paredesInput.areaExternaM2 || 0;
      areaInternaM2 = paredesInput.areaInternaM2 || 0;
    }
  } else if (resultadoParedes && resultadoParedes.areaLiquidaTotal > 0) {
    // Fallback to resultado if no input provided
    // Estimate based on form distribution
    const formas18Area = resultadoParedes.formas18Qtd * 0.5; // Each form = 0.5 m²
    const formas12Area = resultadoParedes.formas12Qtd * 0.5;
    
    areaExternaM2 = formas18Area;
    areaInternaM2 = formas12Area;
    
    // If all same type, split 70/30
    if (areaExternaM2 === 0 && areaInternaM2 === 0) {
      const totalArea = resultadoParedes.areaLiquidaTotal;
      areaExternaM2 = totalArea * 0.7;
      areaInternaM2 = totalArea * 0.3;
    }
  }

  // Apply toggles
  const areaInternaAplicada = reboco.aplicarInterno ? areaInternaM2 : 0;
  const areaExternaAplicada = reboco.aplicarExterno ? areaExternaM2 : 0;
  const areaTotal = areaInternaAplicada + areaExternaAplicada;

  // Apply waste percentage
  const perdaPercentual = reboco.perdaPercentual || 10;
  const areaComPerda = areaTotal * (1 + perdaPercentual / 100);

  // Calculate costs
  const custoIcflex = areaComPerda * precoIcflexM2;
  const custoMaoObra = areaComPerda * precoMaoObraM2;
  const custoTotal = custoIcflex + custoMaoObra;

  return {
    areaInternaM2,
    areaExternaM2,
    areaTotal,
    perdaPercentual,
    areaComPerda,
    precoIcflexM2,
    precoMaoObraM2: precoMaoObraM2,
    custoIcflex,
    custoMaoObra,
    custoTotal,
    // Legacy compatibility
    quantidadeSacos: 0,
    custoMaterial: custoIcflex,
  };
}
