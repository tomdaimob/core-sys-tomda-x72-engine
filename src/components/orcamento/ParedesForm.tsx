import { useState } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatNumber } from '@/lib/orcamento-calculos';
import { Precos, ICF_FORM_AREA } from '@/lib/orcamento-types';

export type TipoForma = 'ICF 18' | 'ICF 12';

export interface SegmentoParede {
  id: string;
  descricao: string;
  areaParedeM2: number;
  tipoForma: TipoForma;
}

export interface ParedesInput {
  areaExternaM2: number;
  areaInternaM2: number;
  tipoFormaExterna: TipoForma;
  tipoFormaInterna: TipoForma;
  modoAvancado: boolean;
  segmentos: SegmentoParede[];
}

export interface ResultadoParedesDetalhado {
  areaLiquidaTotal: number;
  formas18Qtd: number;
  formas12Qtd: number;
  custoFormas18: number;
  custoFormas12: number;
  custoFormasTotal: number;
  volumeConcreto: number;
  custoConcreto: number;
  pesoFerragem: number;
  custoFerragem: number;
  custoMaoObra: number;
  custoTotal: number;
  precoPorM2: number;
}

interface ParedesFormProps {
  paredes: ParedesInput;
  onParedesChange: (paredes: ParedesInput) => void;
  precos: Precos;
  resultado: ResultadoParedesDetalhado;
}

export function calcularParedesResultado(
  paredes: ParedesInput,
  precos: Precos
): ResultadoParedesDetalhado {
  let formas18Qtd = 0;
  let formas12Qtd = 0;
  let areaLiquidaTotal = 0;

  if (paredes.modoAvancado && paredes.segmentos.length > 0) {
    // Advanced mode: calculate by segment
    paredes.segmentos.forEach((seg) => {
      const qtdFormas = Math.ceil(seg.areaParedeM2 / ICF_FORM_AREA);
      areaLiquidaTotal += seg.areaParedeM2;
      if (seg.tipoForma === 'ICF 18') {
        formas18Qtd += qtdFormas;
      } else {
        formas12Qtd += qtdFormas;
      }
    });
  } else {
    // Simple mode: external and internal areas
    const areaExterna = paredes.areaExternaM2 || 0;
    const areaInterna = paredes.areaInternaM2 || 0;
    areaLiquidaTotal = areaExterna + areaInterna;

    const formasExterna = Math.ceil(areaExterna / ICF_FORM_AREA);
    const formasInterna = Math.ceil(areaInterna / ICF_FORM_AREA);

    if (paredes.tipoFormaExterna === 'ICF 18') {
      formas18Qtd += formasExterna;
    } else {
      formas12Qtd += formasExterna;
    }

    if (paredes.tipoFormaInterna === 'ICF 18') {
      formas18Qtd += formasInterna;
    } else {
      formas12Qtd += formasInterna;
    }
  }

  // Calculate costs
  const custoFormas18 = formas18Qtd * precos.formaIcf18;
  const custoFormas12 = formas12Qtd * precos.formaIcf12;
  const custoFormasTotal = custoFormas18 + custoFormas12;

  // Concrete: total forms area * average thickness (consider 15cm average)
  const espessuraMediaM = 0.15;
  const volumeConcreto = areaLiquidaTotal * espessuraMediaM * 0.7; // 70% fill factor
  const custoConcreto = volumeConcreto * precos.concretoM3;

  // Steel reinforcement: ~80 kg/m³
  const pesoFerragem = volumeConcreto * 80;
  const custoFerragem = pesoFerragem * precos.ferragemKg;

  // Labor
  const custoMaoObra = areaLiquidaTotal * precos.maoObraParede;

  const custoTotal = custoFormasTotal + custoConcreto + custoFerragem + custoMaoObra;
  const precoPorM2 = areaLiquidaTotal > 0 ? custoTotal / areaLiquidaTotal : 0;

  return {
    areaLiquidaTotal,
    formas18Qtd,
    formas12Qtd,
    custoFormas18,
    custoFormas12,
    custoFormasTotal,
    volumeConcreto,
    custoConcreto,
    pesoFerragem,
    custoFerragem,
    custoMaoObra,
    custoTotal,
    precoPorM2,
  };
}

export function ParedesForm({ paredes, onParedesChange, precos, resultado }: ParedesFormProps) {
  const [showDetails, setShowDetails] = useState(false);

  const addSegmento = () => {
    const newSegmento: SegmentoParede = {
      id: `seg-${Date.now()}`,
      descricao: `Segmento ${paredes.segmentos.length + 1}`,
      areaParedeM2: 0,
      tipoForma: 'ICF 18',
    };
    onParedesChange({
      ...paredes,
      segmentos: [...paredes.segmentos, newSegmento],
    });
  };

  const removeSegmento = (id: string) => {
    onParedesChange({
      ...paredes,
      segmentos: paredes.segmentos.filter((s) => s.id !== id),
    });
  };

  const updateSegmento = (id: string, updates: Partial<SegmentoParede>) => {
    onParedesChange({
      ...paredes,
      segmentos: paredes.segmentos.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    });
  };

  const handleModoAvancadoChange = (checked: boolean) => {
    if (checked && paredes.segmentos.length === 0) {
      // Initialize with one segment when enabling advanced mode
      addSegmento();
    }
    onParedesChange({ ...paredes, modoAvancado: checked });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Paredes ICF</h2>
          <p className="text-muted-foreground text-sm">
            Cada forma ICF = 0,5 m² (1,25 × 0,40)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="modo-avancado" className="text-sm">
            Modo avançado
          </Label>
          <Switch
            id="modo-avancado"
            checked={paredes.modoAvancado}
            onCheckedChange={handleModoAvancadoChange}
          />
        </div>
      </div>

      {!paredes.modoAvancado ? (
        // Simple mode
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="input-group">
              <Label className="input-label">Área Paredes Externas (m²)</Label>
              <Input
                type="number"
                min="0"
                value={paredes.areaExternaM2 || ''}
                onChange={(e) =>
                  onParedesChange({
                    ...paredes,
                    areaExternaM2: Math.max(0, parseFloat(e.target.value) || 0),
                  })
                }
                placeholder="0"
              />
            </div>
            <div className="input-group">
              <Label className="input-label">Tipo Forma Externa</Label>
              <Select
                value={paredes.tipoFormaExterna}
                onValueChange={(value: TipoForma) =>
                  onParedesChange({ ...paredes, tipoFormaExterna: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ICF 18">ICF 18 cm - {formatCurrency(precos.formaIcf18)}/un</SelectItem>
                  <SelectItem value="ICF 12">ICF 12 cm - {formatCurrency(precos.formaIcf12)}/un</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="input-group">
              <Label className="input-label">Área Paredes Internas (m²)</Label>
              <Input
                type="number"
                min="0"
                value={paredes.areaInternaM2 || ''}
                onChange={(e) =>
                  onParedesChange({
                    ...paredes,
                    areaInternaM2: Math.max(0, parseFloat(e.target.value) || 0),
                  })
                }
                placeholder="0"
              />
            </div>
            <div className="input-group">
              <Label className="input-label">Tipo Forma Interna</Label>
              <Select
                value={paredes.tipoFormaInterna}
                onValueChange={(value: TipoForma) =>
                  onParedesChange({ ...paredes, tipoFormaInterna: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ICF 18">ICF 18 cm - {formatCurrency(precos.formaIcf18)}/un</SelectItem>
                  <SelectItem value="ICF 12">ICF 12 cm - {formatCurrency(precos.formaIcf12)}/un</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      ) : (
        // Advanced mode with segments
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Adicione segmentos de parede com diferentes tipos de forma
            </p>
            <Button onClick={addSegmento} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Adicionar Segmento
            </Button>
          </div>

          {paredes.segmentos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum segmento adicionado. Clique em "Adicionar Segmento" para começar.
            </div>
          ) : (
            <div className="space-y-3">
              {paredes.segmentos.map((seg, index) => (
                <div
                  key={seg.id}
                  className="bg-accent/30 rounded-lg p-4 border border-accent"
                >
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div className="input-group">
                      <Label className="input-label text-xs">Descrição</Label>
                      <Input
                        value={seg.descricao}
                        onChange={(e) =>
                          updateSegmento(seg.id, { descricao: e.target.value })
                        }
                        placeholder={`Segmento ${index + 1}`}
                      />
                    </div>
                    <div className="input-group">
                      <Label className="input-label text-xs">Área (m²)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={seg.areaParedeM2 || ''}
                        onChange={(e) =>
                          updateSegmento(seg.id, {
                            areaParedeM2: Math.max(0, parseFloat(e.target.value) || 0),
                          })
                        }
                        placeholder="0"
                      />
                    </div>
                    <div className="input-group">
                      <Label className="input-label text-xs">Tipo Forma</Label>
                      <Select
                        value={seg.tipoForma}
                        onValueChange={(value: TipoForma) =>
                          updateSegmento(seg.id, { tipoForma: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ICF 18">ICF 18 cm</SelectItem>
                          <SelectItem value="ICF 12">ICF 12 cm</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSegmento(seg.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Formas: {Math.ceil(seg.areaParedeM2 / ICF_FORM_AREA)} un
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {resultado.areaLiquidaTotal > 0 && (
        <div className="bg-accent/50 rounded-lg p-4 mt-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Resultado Paredes</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-background rounded-lg p-2">
              <div className="text-muted-foreground text-xs">Formas ICF 18</div>
              <div className="font-medium">{resultado.formas18Qtd} un</div>
              <div className="text-primary text-xs">{formatCurrency(resultado.custoFormas18)}</div>
            </div>
            <div className="bg-background rounded-lg p-2">
              <div className="text-muted-foreground text-xs">Formas ICF 12</div>
              <div className="font-medium">{resultado.formas12Qtd} un</div>
              <div className="text-primary text-xs">{formatCurrency(resultado.custoFormas12)}</div>
            </div>
            <div className="bg-background rounded-lg p-2">
              <div className="text-muted-foreground text-xs">Área Total</div>
              <div className="font-medium">{formatNumber(resultado.areaLiquidaTotal)} m²</div>
            </div>
            <div className="bg-background rounded-lg p-2">
              <div className="text-muted-foreground text-xs">Custo Total</div>
              <div className="font-medium text-primary">{formatCurrency(resultado.custoTotal)}</div>
            </div>
          </div>

          {showDetails && (
            <div className="mt-4 pt-4 border-t border-accent grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custo Formas:</span>
                <span>{formatCurrency(resultado.custoFormasTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Volume Concreto:</span>
                <span>{formatNumber(resultado.volumeConcreto)} m³</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custo Concreto:</span>
                <span>{formatCurrency(resultado.custoConcreto)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ferragem:</span>
                <span>{formatNumber(resultado.pesoFerragem)} kg</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custo Ferragem:</span>
                <span>{formatCurrency(resultado.custoFerragem)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mão de Obra:</span>
                <span>{formatCurrency(resultado.custoMaoObra)}</span>
              </div>
              <div className="flex justify-between col-span-2 pt-2 border-t">
                <span className="font-medium">Preço/m²:</span>
                <span className="font-medium">{formatCurrency(resultado.precoPorM2)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
