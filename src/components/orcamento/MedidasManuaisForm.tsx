import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertCircle, Ruler, Info, Calculator, Check } from 'lucide-react';
import { MedidasManuais } from '@/hooks/useModoMedidas';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/orcamento-calculos';

interface MedidasManuaisFormProps {
  medidas: MedidasManuais;
  onMedidasChange: (medidas: Partial<MedidasManuais>) => void;
  isAdmin?: boolean;
  disabled?: boolean;
  onCalcular?: () => void;
}

export function MedidasManuaisForm({
  medidas,
  onMedidasChange,
  isAdmin = false,
  disabled = false,
  onCalcular,
}: MedidasManuaisFormProps) {
  const [showAreasDirectas, setShowAreasDirectas] = useState(medidas.usar_areas_diretas);
  const [calculado, setCalculado] = useState(false);

  // Validation
  const alturaValida = medidas.altura_paredes_m >= 2.2 && medidas.altura_paredes_m <= 4.0;
  const perimetroExternoValido = medidas.perimetro_externo_m > 0;
  const perimetroInternoAviso = medidas.perimetro_interno_m <= 0;
  const formularioValido = alturaValida && perimetroExternoValido;

  // Calculate derived values
  const areaExternaCalc = medidas.perimetro_externo_m * medidas.altura_paredes_m - medidas.aberturas_externas_m2;
  const areaInternaCalc = medidas.perimetro_interno_m * medidas.altura_paredes_m - medidas.aberturas_internas_m2;

  const handleNumberChange = (field: keyof MedidasManuais, value: string) => {
    const num = parseFloat(value) || 0;
    onMedidasChange({ [field]: num });
    setCalculado(false); // Reset calculated state when values change
  };

  const handleAreasDirectasToggle = (checked: boolean) => {
    setShowAreasDirectas(checked);
    onMedidasChange({ usar_areas_diretas: checked });
    setCalculado(false);
  };

  const handleCalcular = () => {
    if (formularioValido) {
      setCalculado(true);
      onCalcular?.();
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Ruler className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">Medidas da Obra (Manual)</CardTitle>
        </div>
        <CardDescription>
          Preencha as medidas para calcular paredes, reboco e revestimento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Campos obrigatórios */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Altura (pé-direito) */}
          <div className="space-y-2">
            <Label htmlFor="altura" className="flex items-center gap-1">
              Altura das Paredes (pé-direito) *
              {!alturaValida && (
                <span className="text-xs text-destructive">(2,2m a 4,0m)</span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="altura"
                type="number"
                step="0.01"
                min="2.2"
                max="4.0"
                value={medidas.altura_paredes_m || ''}
                onChange={(e) => handleNumberChange('altura_paredes_m', e.target.value)}
                className={cn(
                  'pr-8',
                  !alturaValida && 'border-destructive focus-visible:ring-destructive'
                )}
                disabled={disabled}
                placeholder="2.70"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                m
              </span>
            </div>
          </div>

          {/* Perímetro externo */}
          <div className="space-y-2">
            <Label htmlFor="perimetro-externo" className="flex items-center gap-1">
              Perímetro Externo *
              {!perimetroExternoValido && (
                <span className="text-xs text-destructive">(obrigatório)</span>
              )}
            </Label>
            <div className="relative">
              <Input
                id="perimetro-externo"
                type="number"
                step="0.01"
                min="0"
                value={medidas.perimetro_externo_m || ''}
                onChange={(e) => handleNumberChange('perimetro_externo_m', e.target.value)}
                className={cn(
                  'pr-8',
                  !perimetroExternoValido && 'border-destructive focus-visible:ring-destructive'
                )}
                disabled={disabled}
                placeholder="40.00"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                m
              </span>
            </div>
          </div>
        </div>

        {/* Campos opcionais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Perímetro interno */}
          <div className="space-y-2">
            <Label htmlFor="perimetro-interno" className="flex items-center gap-1">
              Perímetro Interno
              <span className="text-xs text-muted-foreground">(recomendado)</span>
            </Label>
            <div className="relative">
              <Input
                id="perimetro-interno"
                type="number"
                step="0.01"
                min="0"
                value={medidas.perimetro_interno_m || ''}
                onChange={(e) => handleNumberChange('perimetro_interno_m', e.target.value)}
                className="pr-8"
                disabled={disabled}
                placeholder="0.00"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                m
              </span>
            </div>
            {perimetroInternoAviso && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" />
                Deixe em branco apenas se não houver paredes internas.
              </p>
            )}
          </div>

          {/* Aberturas externas */}
          <div className="space-y-2">
            <Label htmlFor="aberturas-externas">Aberturas Externas (área total)</Label>
            <div className="relative">
              <Input
                id="aberturas-externas"
                type="number"
                step="0.01"
                min="0"
                value={medidas.aberturas_externas_m2 || ''}
                onChange={(e) => handleNumberChange('aberturas_externas_m2', e.target.value)}
                className="pr-8"
                disabled={disabled}
                placeholder="0.00"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                m²
              </span>
            </div>
          </div>

          {/* Aberturas internas */}
          <div className="space-y-2">
            <Label htmlFor="aberturas-internas">Aberturas Internas (área total)</Label>
            <div className="relative">
              <Input
                id="aberturas-internas"
                type="number"
                step="0.01"
                min="0"
                value={medidas.aberturas_internas_m2 || ''}
                onChange={(e) => handleNumberChange('aberturas_internas_m2', e.target.value)}
                className="pr-8"
                disabled={disabled}
                placeholder="0.00"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                m²
              </span>
            </div>
          </div>
        </div>

        {/* Áreas diretas - somente admin */}
        {isAdmin && (
          <div className="pt-4 border-t">
            <div className="flex items-start space-x-3 mb-4">
              <Checkbox
                id="usar-areas-diretas"
                checked={showAreasDirectas}
                onCheckedChange={handleAreasDirectasToggle}
                disabled={disabled}
              />
              <div>
                <Label htmlFor="usar-areas-diretas" className="font-medium cursor-pointer">
                  Informar áreas diretamente (quando eu já sei)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Modo avançado: ignore os perímetros e informe as áreas finais.
                </p>
              </div>
            </div>

            {showAreasDirectas && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-lg bg-muted">
                <div className="space-y-2">
                  <Label htmlFor="area-revestimento">Área Revestimento Total</Label>
                  <div className="relative">
                    <Input
                      id="area-revestimento"
                      type="number"
                      step="0.01"
                      min="0"
                      value={medidas.area_revestimento_total_m2 || ''}
                      onChange={(e) => handleNumberChange('area_revestimento_total_m2', e.target.value)}
                      className="pr-8"
                      disabled={disabled}
                      placeholder="0.00"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      m²
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="area-reboco-interno">Área Reboco Interno</Label>
                  <div className="relative">
                    <Input
                      id="area-reboco-interno"
                      type="number"
                      step="0.01"
                      min="0"
                      value={medidas.area_reboco_interno_m2 || ''}
                      onChange={(e) => handleNumberChange('area_reboco_interno_m2', e.target.value)}
                      className="pr-8"
                      disabled={disabled}
                      placeholder="0.00"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      m²
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="area-reboco-externo">Área Reboco Externo</Label>
                  <div className="relative">
                    <Input
                      id="area-reboco-externo"
                      type="number"
                      step="0.01"
                      min="0"
                      value={medidas.area_reboco_externo_m2 || ''}
                      onChange={(e) => handleNumberChange('area_reboco_externo_m2', e.target.value)}
                      className="pr-8"
                      disabled={disabled}
                      placeholder="0.00"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      m²
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info de validação */}
        {(!alturaValida || !perimetroExternoValido) && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Campos obrigatórios incompletos:</p>
              <ul className="list-disc list-inside mt-1">
                {!alturaValida && <li>Altura deve estar entre 2,20m e 4,00m</li>}
                {!perimetroExternoValido && <li>Perímetro externo deve ser maior que 0</li>}
              </ul>
            </div>
          </div>
        )}

        {/* Calculated preview */}
        {formularioValido && (
          <div className={cn(
            "rounded-lg p-4 border transition-all",
            calculado ? "bg-primary/5 border-primary/30" : "bg-muted/50 border-muted"
          )}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-sm">Prévia do Cálculo</h4>
              {calculado && (
                <div className="flex items-center gap-1 text-sm text-primary">
                  <Check className="w-4 h-4" />
                  <span>Calculado</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div className="p-2 bg-background rounded">
                <p className="text-muted-foreground text-xs">Área Ext. (paredes)</p>
                <p className="font-medium">{formatNumber(Math.max(0, areaExternaCalc))} m²</p>
              </div>
              <div className="p-2 bg-background rounded">
                <p className="text-muted-foreground text-xs">Área Int. (paredes)</p>
                <p className="font-medium">{formatNumber(Math.max(0, areaInternaCalc))} m²</p>
              </div>
              <div className="p-2 bg-background rounded">
                <p className="text-muted-foreground text-xs">Total Paredes</p>
                <p className="font-medium">{formatNumber(Math.max(0, areaExternaCalc + areaInternaCalc))} m²</p>
              </div>
              <div className="p-2 bg-background rounded">
                <p className="text-muted-foreground text-xs">Aberturas Total</p>
                <p className="font-medium">{formatNumber(medidas.aberturas_externas_m2 + medidas.aberturas_internas_m2)} m²</p>
              </div>
            </div>
          </div>
        )}

        {/* Calculate button */}
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            onClick={handleCalcular}
            disabled={!formularioValido || disabled}
            className={cn(
              "gap-2",
              calculado && "bg-primary/80"
            )}
          >
            <Calculator className="w-4 h-4" />
            {calculado ? 'Recalcular' : 'Calcular'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
