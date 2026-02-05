import * as React from 'react';
import { useState, useEffect, useMemo } from 'react';
import { Calculator, Grid3X3, AlertCircle, Building, Home, Power, PowerOff } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatNumber } from '@/lib/orcamento-calculos';
import { Alert, AlertDescription } from '@/components/ui/alert';

export type TipoLaje = 'AUTO' | 'PISO_2_ANDAR' | 'FORRO';

export interface LajeInput {
  tipo: TipoLaje;
  laje_enabled: boolean; // Toggle para incluir/excluir laje do orçamento
  areaM2: number;
  espessuraM: number;
  concretoItemId: string;
  temSegundoAndar: boolean;
}

export interface ConcretoOption {
  id: string;
  nome: string;
  preco: number;
  fck: string; // e.g., "FCK 25", "FCK 30", "FCK 35"
}

export interface ResultadoLajeCalculado {
  tipo: TipoLaje;
  tipoNome: string;
  areaTotalM2: number;
  espessuraM: number;
  volumeTotalM3: number;
  concretoNome: string;
  precoConcreto: number;
  precoMaoObraM2: number;
  custoConcreto: number;
  custoMaoObra: number;
  custoTotal: number;
}

interface LajeFormProps {
  laje: LajeInput;
  onLajeChange: (laje: LajeInput) => void;
  concretoOptions: ConcretoOption[];
  precoMaoObraLajeM2: number;
  areaProjetoM2: number;
  resultado: ResultadoLajeCalculado;
}

// Default concrete option (FCK 25)
const DEFAULT_CONCRETO_ID = 'fck-25-default';

export function LajeForm({ 
  laje, 
  onLajeChange, 
  concretoOptions, 
  precoMaoObraLajeM2,
  areaProjetoM2,
  resultado 
}: LajeFormProps) {
  // Determine if we have valid data
  const hasData = resultado.areaTotalM2 > 0;
  const lajeEnabled = laje.laje_enabled ?? true;

  const handleLajeEnabledChange = (enabled: boolean) => {
    onLajeChange({ ...laje, laje_enabled: enabled });
  };

  // Handle second floor toggle
  const handleSegundoAndarChange = (checked: boolean) => {
    const newTipo = checked ? 'PISO_2_ANDAR' : 'FORRO';
    const newEspessura = checked ? 0.10 : 0.06; // 10cm for floor, 6cm for ceiling
    
    onLajeChange({
      ...laje,
      temSegundoAndar: checked,
      tipo: newTipo,
      espessuraM: laje.espessuraM === 0 ? newEspessura : laje.espessuraM,
    });
  };

  // Handle area change
  const handleAreaChange = (value: number) => {
    onLajeChange({
      ...laje,
      areaM2: Math.max(0, value),
    });
  };

  // Handle espessura change
  const handleEspessuraChange = (value: number) => {
    onLajeChange({
      ...laje,
      espessuraM: Math.max(0, value),
    });
  };

  // Handle concrete selection
  const handleConcretoChange = (itemId: string) => {
    onLajeChange({
      ...laje,
      concretoItemId: itemId,
    });
  };

  // Get selected concrete info
  const selectedConcreto = concretoOptions.find(c => c.id === laje.concretoItemId) || concretoOptions[0];

  // Disabled state render
  if (!lajeEnabled) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Grid3X3 className="w-5 h-5 text-primary" />
            Laje
          </h2>
          <div className="flex items-center gap-3">
            <Switch
              id="laje_enabled"
              checked={lajeEnabled}
              onCheckedChange={handleLajeEnabledChange}
            />
            <Label htmlFor="laje_enabled" className="text-sm font-medium cursor-pointer">
              Incluir no orçamento
            </Label>
          </div>
        </div>

        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <PowerOff className="w-12 h-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">
              Laje desativada neste orçamento
            </h3>
            <p className="text-sm text-muted-foreground/70 mb-4">
              Ative para incluir os custos de laje no orçamento
            </p>
            <Button 
              variant="outline" 
              onClick={() => handleLajeEnabledChange(true)}
              className="flex items-center gap-2"
            >
              <Power className="w-4 h-4" />
              Ativar Laje
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Grid3X3 className="w-5 h-5 text-primary" />
            Laje
          </h2>
          <p className="text-muted-foreground text-sm">
            Volume = Área × Espessura | Custo = Concreto + Mão de Obra
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            id="laje_enabled"
            checked={lajeEnabled}
            onCheckedChange={handleLajeEnabledChange}
          />
          <Label htmlFor="laje_enabled" className="text-sm font-medium cursor-pointer">
            Incluir no orçamento
          </Label>
        </div>
      </div>

      {/* Configuration */}
      <div className="bg-muted/30 rounded-xl p-5 space-y-5">
        {/* Second Floor Toggle */}
        <div className="flex items-center justify-between p-3 bg-background rounded-lg">
          <div className="flex items-center gap-3">
            {laje.temSegundoAndar ? (
              <Building className="w-5 h-5 text-primary" />
            ) : (
              <Home className="w-5 h-5 text-muted-foreground" />
            )}
            <div>
              <Label className="text-sm font-medium">Tem 2º andar?</Label>
              <p className="text-xs text-muted-foreground">
                {laje.temSegundoAndar 
                  ? 'Laje como piso de 2º andar (espessura padrão 10cm)' 
                  : 'Laje como forro (espessura padrão 6cm)'}
              </p>
            </div>
          </div>
          <Switch
            id="tem_segundo_andar"
            name="tem_segundo_andar"
            checked={laje.temSegundoAndar}
            onCheckedChange={handleSegundoAndarChange}
          />
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Área */}
          <div className="input-group">
            <Label htmlFor="laje_area" className="input-label">Área (m²)</Label>
            <Input
              id="laje_area"
              name="laje_area"
              type="number"
              min="0"
              step="0.01"
              value={laje.areaM2 || ''}
              onChange={(e) => handleAreaChange(parseFloat(e.target.value) || 0)}
              placeholder={areaProjetoM2 > 0 ? String(areaProjetoM2) : '0.00'}
            />
            {areaProjetoM2 > 0 && laje.areaM2 === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Usando área do projeto: {formatNumber(areaProjetoM2)} m²
              </p>
            )}
          </div>

          {/* Espessura */}
          <div className="input-group">
            <Label htmlFor="laje_espessura" className="input-label">Espessura (m)</Label>
            <Input
              id="laje_espessura"
              name="laje_espessura"
              type="number"
              min="0"
              step="0.01"
              value={laje.espessuraM || ''}
              onChange={(e) => handleEspessuraChange(parseFloat(e.target.value) || 0)}
              placeholder={laje.tipo === 'FORRO' ? '0.06' : '0.10'}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Padrão: {laje.tipo === 'FORRO' ? '6cm (Forro)' : '10cm (Piso)'}
            </p>
          </div>

          {/* Concreto FCK */}
          <div className="input-group">
            <Label htmlFor="laje_concreto" className="input-label">Concreto (FCK)</Label>
            <Select
              value={laje.concretoItemId || (concretoOptions[0]?.id || '')}
              onValueChange={handleConcretoChange}
            >
              <SelectTrigger id="laje_concreto" name="laje_concreto">
                <SelectValue placeholder="Selecione o concreto" />
              </SelectTrigger>
              <SelectContent>
                {concretoOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.fck} - {formatCurrency(option.preco)}/m³
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Prices Reference */}
        <div className="flex gap-4 text-sm text-muted-foreground bg-background/50 rounded-lg p-3">
          <div>
            <span className="font-medium">Concreto {selectedConcreto?.fck}:</span>{' '}
            {formatCurrency(selectedConcreto?.preco || 0)}/m³
          </div>
          <div>
            <span className="font-medium">M.O. Laje:</span>{' '}
            {formatCurrency(precoMaoObraLajeM2)}/m²
          </div>
        </div>
      </div>

      {/* Results */}
      {hasData ? (
        <div className="bg-accent/50 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">Resultado do Cálculo</h3>
          </div>
          
          {/* Type badge */}
          <div className="mb-3">
            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
              resultado.tipo === 'FORRO' 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
            }`}>
              {resultado.tipo === 'FORRO' ? <Home className="w-4 h-4" /> : <Building className="w-4 h-4" />}
              {resultado.tipoNome}
            </span>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-background rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Área Total</div>
              <div className="text-lg font-semibold">{formatNumber(resultado.areaTotalM2)} m²</div>
            </div>
            <div className="bg-background rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Volume Total</div>
              <div className="text-lg font-semibold">{formatNumber(resultado.volumeTotalM3, 3)} m³</div>
            </div>
            <div className="bg-background rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Custo Concreto</div>
              <div className="text-lg font-semibold text-primary">{formatCurrency(resultado.custoConcreto)}</div>
              <div className="text-xs text-muted-foreground">{resultado.concretoNome}</div>
            </div>
            <div className="bg-background rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Custo M.O.</div>
              <div className="text-lg font-semibold text-primary">{formatCurrency(resultado.custoMaoObra)}</div>
            </div>
          </div>

          <div className="border-t border-accent pt-4 flex justify-between items-center">
            <span className="text-muted-foreground">Custo Total Laje:</span>
            <span className="text-xl font-bold text-primary">{formatCurrency(resultado.custoTotal)}</span>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-xl">
          <Grid3X3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Preencha a área da laje para calcular os custos</p>
        </div>
      )}

      {/* Warning if no M.O. price */}
      {precoMaoObraLajeM2 === 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Atenção:</strong> O preço de "Mão de Obra Laje" não está configurado no catálogo de preços.
            O cálculo de mão de obra será R$ 0,00.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Calculate laje results with FCK selection and FORRO mode
export function calcularLajeResultado(
  laje: LajeInput,
  concretoOptions: ConcretoOption[],
  precoMaoObraLajeM2: number,
  areaProjetoM2: number
): ResultadoLajeCalculado {
  // Determine effective area (use project area if laje area is 0)
  const areaEfetiva = laje.areaM2 > 0 ? laje.areaM2 : areaProjetoM2;
  
  // Determine effective tipo
  let tipoEfetivo: TipoLaje = laje.tipo || 'AUTO';
  
  // AUTO mode: if no 2nd floor, default to FORRO
  if (tipoEfetivo === 'AUTO') {
    tipoEfetivo = laje.temSegundoAndar ? 'PISO_2_ANDAR' : 'FORRO';
  }
  
  // Determine effective espessura based on tipo
  let espessuraEfetiva = laje.espessuraM;
  if (espessuraEfetiva <= 0) {
    espessuraEfetiva = tipoEfetivo === 'FORRO' ? 0.06 : 0.10;
  }
  
  // Get concrete info
  let selectedConcreto = concretoOptions.find(c => c.id === laje.concretoItemId);
  
  // Fallback: find FCK 25 if no selection
  if (!selectedConcreto) {
    selectedConcreto = concretoOptions.find(c => c.nome.includes('FCK 25')) || concretoOptions[0];
  }
  
  const precoConcreto = selectedConcreto?.preco || 0;
  const concretoNome = selectedConcreto?.fck || 'Não selecionado';
  
  // If area is 0 or invalid, return empty result (but don't break)
  if (areaEfetiva <= 0) {
    return {
      tipo: tipoEfetivo,
      tipoNome: tipoEfetivo === 'FORRO' ? 'Laje Forro' : 'Laje Piso 2º Andar',
      areaTotalM2: 0,
      espessuraM: espessuraEfetiva,
      volumeTotalM3: 0,
      concretoNome,
      precoConcreto,
      precoMaoObraM2: precoMaoObraLajeM2,
      custoConcreto: 0,
      custoMaoObra: 0,
      custoTotal: 0,
    };
  }
  
  // Calculate volume
  const volumeTotalM3 = areaEfetiva * espessuraEfetiva;
  
  // Calculate costs
  const custoConcreto = volumeTotalM3 * precoConcreto;
  const custoMaoObra = areaEfetiva * precoMaoObraLajeM2;
  const custoTotal = custoConcreto + custoMaoObra;
  
  return {
    tipo: tipoEfetivo,
    tipoNome: tipoEfetivo === 'FORRO' ? 'Laje Forro' : 'Laje Piso 2º Andar',
    areaTotalM2: areaEfetiva,
    espessuraM: espessuraEfetiva,
    volumeTotalM3,
    concretoNome,
    precoConcreto,
    precoMaoObraM2: precoMaoObraLajeM2,
    custoConcreto,
    custoMaoObra,
    custoTotal,
  };
}
