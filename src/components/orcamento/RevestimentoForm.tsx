import { useState, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Home, Bath, ChefHat } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/orcamento-calculos';

// Types
export type TipoAmbiente = 'cozinha' | 'banheiro';
export type TipoMaterial = 'ceramica' | 'porcelanato';
export type TipoAltura = 'inteira' | 'meia';

export interface AmbienteRevestimento {
  id: string;
  tipo: TipoAmbiente;
  nome: string;
  incluir: boolean;
  perimetroM: number;
  tipoAltura: TipoAltura;
  alturaInteiraM: number;
  alturaMeiaM: number;
  descontarAberturas: boolean;
  areaAberturasM2: number;
  tipoMaterial: TipoMaterial;
  perdaPercentual: number;
}

export interface RevestimentoInput {
  ambientes: AmbienteRevestimento[];
  incluirArgamassa: boolean;
  incluirRejunte: boolean;
  incluirMaoObra: boolean;
}

export interface ResultadoAmbiente {
  id: string;
  nome: string;
  tipo: TipoAmbiente;
  areaBrutaM2: number;
  areaLiquidaM2: number;
  areaComPerdaM2: number;
  tipoMaterial: TipoMaterial;
  custoMaterial: number;
  custoArgamassa: number;
  custoRejunte: number;
  custoMaoObra: number;
  custoTotal: number;
}

export interface ResultadoRevestimento {
  ambientes: ResultadoAmbiente[];
  areaTotalM2: number;
  custoMaterial: number;
  custoArgamassa: number;
  custoRejunte: number;
  custoMaoObra: number;
  custoTotal: number;
  precoPorM2: number;
}

export interface PrecosRevestimento {
  ceramicaM2: number;
  porcelanatoM2: number;
  argamassaM2: number;
  rejunteM2: number;
  maoObraM2: number;
}

// Default values
const createDefaultAmbiente = (tipo: TipoAmbiente, index = 1): AmbienteRevestimento => ({
  id: `${tipo}-${Date.now()}-${index}`,
  tipo,
  nome: tipo === 'cozinha' ? 'Cozinha' : `Banheiro ${index}`,
  incluir: tipo === 'banheiro', // Default ON for bathroom, OFF for kitchen
  perimetroM: 0,
  tipoAltura: 'inteira',
  alturaInteiraM: 2.70,
  alturaMeiaM: 1.20,
  descontarAberturas: false,
  areaAberturasM2: 0,
  tipoMaterial: 'ceramica',
  perdaPercentual: 10,
});

export const DEFAULT_REVESTIMENTO: RevestimentoInput = {
  ambientes: [
    createDefaultAmbiente('cozinha'),
    createDefaultAmbiente('banheiro', 1),
  ],
  incluirArgamassa: true,
  incluirRejunte: true,
  incluirMaoObra: true,
};

// Calculate function
export function calcularRevestimentoResultado(
  input: RevestimentoInput,
  precos: PrecosRevestimento
): ResultadoRevestimento {
  const ambientesResultado: ResultadoAmbiente[] = input.ambientes
    .filter(amb => amb.incluir)
    .map(amb => {
      const altura = amb.tipoAltura === 'inteira' ? amb.alturaInteiraM : amb.alturaMeiaM;
      const areaBrutaM2 = amb.perimetroM * altura;
      const areaLiquidaM2 = Math.max(areaBrutaM2 - (amb.descontarAberturas ? amb.areaAberturasM2 : 0), 0);
      const areaComPerdaM2 = areaLiquidaM2 * (1 + amb.perdaPercentual / 100);
      
      const precoMaterial = amb.tipoMaterial === 'ceramica' ? precos.ceramicaM2 : precos.porcelanatoM2;
      const custoMaterial = areaComPerdaM2 * precoMaterial;
      const custoArgamassa = input.incluirArgamassa ? areaComPerdaM2 * precos.argamassaM2 : 0;
      const custoRejunte = input.incluirRejunte ? areaComPerdaM2 * precos.rejunteM2 : 0;
      const custoMaoObra = input.incluirMaoObra ? areaComPerdaM2 * precos.maoObraM2 : 0;
      const custoTotal = custoMaterial + custoArgamassa + custoRejunte + custoMaoObra;
      
      return {
        id: amb.id,
        nome: amb.nome,
        tipo: amb.tipo,
        areaBrutaM2,
        areaLiquidaM2,
        areaComPerdaM2,
        tipoMaterial: amb.tipoMaterial,
        custoMaterial,
        custoArgamassa,
        custoRejunte,
        custoMaoObra,
        custoTotal,
      };
    });
  
  const areaTotalM2 = ambientesResultado.reduce((sum, a) => sum + a.areaComPerdaM2, 0);
  const custoMaterial = ambientesResultado.reduce((sum, a) => sum + a.custoMaterial, 0);
  const custoArgamassa = ambientesResultado.reduce((sum, a) => sum + a.custoArgamassa, 0);
  const custoRejunte = ambientesResultado.reduce((sum, a) => sum + a.custoRejunte, 0);
  const custoMaoObra = ambientesResultado.reduce((sum, a) => sum + a.custoMaoObra, 0);
  const custoTotal = custoMaterial + custoArgamassa + custoRejunte + custoMaoObra;
  const precoPorM2 = areaTotalM2 > 0 ? custoTotal / areaTotalM2 : 0;
  
  return {
    ambientes: ambientesResultado,
    areaTotalM2,
    custoMaterial,
    custoArgamassa,
    custoRejunte,
    custoMaoObra,
    custoTotal,
    precoPorM2,
  };
}

interface RevestimentoFormProps {
  revestimento: RevestimentoInput;
  onRevestimentoChange: (revestimento: RevestimentoInput) => void;
  precos: PrecosRevestimento;
  resultado: ResultadoRevestimento;
}

export function RevestimentoForm({
  revestimento,
  onRevestimentoChange,
  precos,
  resultado,
}: RevestimentoFormProps) {
  
  const updateAmbiente = (id: string, updates: Partial<AmbienteRevestimento>) => {
    const newAmbientes = revestimento.ambientes.map(amb =>
      amb.id === id ? { ...amb, ...updates } : amb
    );
    onRevestimentoChange({ ...revestimento, ambientes: newAmbientes });
  };
  
  const addBanheiro = () => {
    const banheiroCount = revestimento.ambientes.filter(a => a.tipo === 'banheiro').length;
    const newBanheiro = createDefaultAmbiente('banheiro', banheiroCount + 1);
    onRevestimentoChange({
      ...revestimento,
      ambientes: [...revestimento.ambientes, newBanheiro],
    });
  };
  
  const removeAmbiente = (id: string) => {
    const ambiente = revestimento.ambientes.find(a => a.id === id);
    // Don't allow removing if it's the only bathroom or the kitchen
    if (ambiente?.tipo === 'cozinha') return;
    if (ambiente?.tipo === 'banheiro') {
      const banheiroCount = revestimento.ambientes.filter(a => a.tipo === 'banheiro').length;
      if (banheiroCount <= 1) return;
    }
    onRevestimentoChange({
      ...revestimento,
      ambientes: revestimento.ambientes.filter(a => a.id !== id),
    });
  };
  
  const getAmbienteIcon = (tipo: TipoAmbiente) => {
    return tipo === 'cozinha' ? ChefHat : Bath;
  };
  
  const getResultadoAmbiente = (id: string) => {
    return resultado.ambientes.find(a => a.id === id);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Revestimento (Cozinha e Banheiros)</h2>
        <Button variant="outline" size="sm" onClick={addBanheiro}>
          <Plus className="w-4 h-4 mr-1" />
          Adicionar Banheiro
        </Button>
      </div>
      
      {/* Ambiente Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {revestimento.ambientes.map((ambiente) => {
          const Icon = getAmbienteIcon(ambiente.tipo);
          const resultadoAmb = getResultadoAmbiente(ambiente.id);
          const canRemove = ambiente.tipo === 'banheiro' && 
            revestimento.ambientes.filter(a => a.tipo === 'banheiro').length > 1;
          
          return (
            <Card 
              key={ambiente.id} 
              className={`transition-all ${ambiente.incluir ? 'border-primary/50 bg-primary/5' : 'opacity-60'}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      ambiente.tipo === 'cozinha' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{ambiente.nome}</CardTitle>
                      {ambiente.incluir && resultadoAmb && (
                        <div className="flex gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">
                            {formatNumber(resultadoAmb.areaComPerdaM2, 1)} m²
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {formatCurrency(resultadoAmb.custoTotal)}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canRemove && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeAmbiente(ambiente.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`incluir-${ambiente.id}`} className="text-sm text-muted-foreground">
                        Incluir
                      </Label>
                      <Switch
                        id={`incluir-${ambiente.id}`}
                        checked={ambiente.incluir}
                        onCheckedChange={(checked) => updateAmbiente(ambiente.id, { incluir: checked })}
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              {ambiente.incluir && (
                <CardContent className="space-y-4">
                  {/* Perímetro */}
                  <div className="input-group">
                    <Label htmlFor={`perimetro-${ambiente.id}`} className="input-label">
                      Perímetro do Ambiente (m) *
                    </Label>
                    <Input
                      id={`perimetro-${ambiente.id}`}
                      type="number"
                      step="0.1"
                      value={ambiente.perimetroM || ''}
                      onChange={(e) => updateAmbiente(ambiente.id, { 
                        perimetroM: parseFloat(e.target.value) || 0 
                      })}
                      placeholder="Ex: 10"
                    />
                  </div>
                  
                  {/* Altura do Revestimento */}
                  <div className="space-y-2">
                    <Label className="input-label">Altura do Revestimento</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => updateAmbiente(ambiente.id, { tipoAltura: 'inteira' })}
                        className={`p-3 rounded-lg border text-sm transition-all ${
                          ambiente.tipoAltura === 'inteira' 
                            ? 'border-primary bg-primary/10 text-primary' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="font-medium">Parede Inteira</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {ambiente.alturaInteiraM}m
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateAmbiente(ambiente.id, { tipoAltura: 'meia' })}
                        className={`p-3 rounded-lg border text-sm transition-all ${
                          ambiente.tipoAltura === 'meia' 
                            ? 'border-primary bg-primary/10 text-primary' 
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <div className="font-medium">Meia Parede</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {ambiente.alturaMeiaM}m
                        </div>
                      </button>
                    </div>
                    
                    {/* Editable heights */}
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="input-group">
                        <Label htmlFor={`altura-inteira-${ambiente.id}`} className="text-xs text-muted-foreground">
                          Altura inteira (m)
                        </Label>
                        <Input
                          id={`altura-inteira-${ambiente.id}`}
                          type="number"
                          step="0.1"
                          value={ambiente.alturaInteiraM || ''}
                          onChange={(e) => updateAmbiente(ambiente.id, { 
                            alturaInteiraM: parseFloat(e.target.value) || 0 
                          })}
                          className="h-8"
                        />
                      </div>
                      <div className="input-group">
                        <Label htmlFor={`altura-meia-${ambiente.id}`} className="text-xs text-muted-foreground">
                          Altura meia (m)
                        </Label>
                        <Input
                          id={`altura-meia-${ambiente.id}`}
                          type="number"
                          step="0.1"
                          value={ambiente.alturaMeiaM || ''}
                          onChange={(e) => updateAmbiente(ambiente.id, { 
                            alturaMeiaM: parseFloat(e.target.value) || 0 
                          })}
                          className="h-8"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Descontar Aberturas */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`aberturas-${ambiente.id}`}
                        checked={ambiente.descontarAberturas}
                        onCheckedChange={(checked) => updateAmbiente(ambiente.id, { 
                          descontarAberturas: checked 
                        })}
                      />
                      <Label htmlFor={`aberturas-${ambiente.id}`} className="text-sm">
                        Descontar aberturas (portas/janelas)
                      </Label>
                    </div>
                    {ambiente.descontarAberturas && (
                      <div className="input-group pl-8">
                        <Label htmlFor={`area-aberturas-${ambiente.id}`} className="text-xs text-muted-foreground">
                          Área de aberturas (m²)
                        </Label>
                        <Input
                          id={`area-aberturas-${ambiente.id}`}
                          type="number"
                          step="0.1"
                          value={ambiente.areaAberturasM2 || ''}
                          onChange={(e) => updateAmbiente(ambiente.id, { 
                            areaAberturasM2: parseFloat(e.target.value) || 0 
                          })}
                          className="h-8"
                          placeholder="Ex: 2.5"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Tipo de Material */}
                  <div className="input-group">
                    <Label htmlFor={`material-${ambiente.id}`} className="input-label">
                      Tipo de Material
                    </Label>
                    <select
                      id={`material-${ambiente.id}`}
                      value={ambiente.tipoMaterial}
                      onChange={(e) => updateAmbiente(ambiente.id, { 
                        tipoMaterial: e.target.value as TipoMaterial 
                      })}
                      className="input-field"
                    >
                      <option value="ceramica">Cerâmica ({formatCurrency(precos.ceramicaM2)}/m²)</option>
                      <option value="porcelanato">Porcelanato ({formatCurrency(precos.porcelanatoM2)}/m²)</option>
                    </select>
                  </div>
                  
                  {/* Perdas */}
                  <div className="input-group">
                    <Label htmlFor={`perdas-${ambiente.id}`} className="input-label">
                      Perdas/Quebras (%)
                    </Label>
                    <Input
                      id={`perdas-${ambiente.id}`}
                      type="number"
                      min={5}
                      max={15}
                      value={ambiente.perdaPercentual || ''}
                      onChange={(e) => {
                        const val = Math.min(15, Math.max(5, parseFloat(e.target.value) || 10));
                        updateAmbiente(ambiente.id, { perdaPercentual: val });
                      }}
                      placeholder="10"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Entre 5% e 15%</p>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
      
      {/* Global Options */}
      <div className="bg-accent/30 rounded-xl p-4 border border-accent">
        <h3 className="font-medium mb-3">Itens Incluídos no Custo</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <div>
              <Label className="text-sm">Argamassa ACIII</Label>
              <p className="text-xs text-muted-foreground">{formatCurrency(precos.argamassaM2)}/m²</p>
            </div>
            <Switch
              checked={revestimento.incluirArgamassa}
              onCheckedChange={(checked) => onRevestimentoChange({ 
                ...revestimento, 
                incluirArgamassa: checked 
              })}
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <div>
              <Label className="text-sm">Rejunte</Label>
              <p className="text-xs text-muted-foreground">{formatCurrency(precos.rejunteM2)}/m²</p>
            </div>
            <Switch
              checked={revestimento.incluirRejunte}
              onCheckedChange={(checked) => onRevestimentoChange({ 
                ...revestimento, 
                incluirRejunte: checked 
              })}
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <div>
              <Label className="text-sm">Mão de Obra</Label>
              <p className="text-xs text-muted-foreground">{formatCurrency(precos.maoObraM2)}/m²</p>
            </div>
            <Switch
              checked={revestimento.incluirMaoObra}
              onCheckedChange={(checked) => onRevestimentoChange({ 
                ...revestimento, 
                incluirMaoObra: checked 
              })}
            />
          </div>
        </div>
      </div>
      
      {/* Summary Card */}
      {resultado.areaTotalM2 > 0 && (
        <div className="bg-primary/10 rounded-xl p-6 border border-primary/20">
          <h3 className="font-medium text-foreground mb-4 flex items-center gap-2">
            <Home className="w-5 h-5 text-primary" />
            Resumo do Revestimento
          </h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-background/50 rounded-lg p-3">
              <div className="text-2xl font-bold text-primary">
                {formatNumber(resultado.areaTotalM2, 1)} m²
              </div>
              <div className="text-sm text-muted-foreground">Área Total</div>
            </div>
            <div className="bg-background/50 rounded-lg p-3">
              <div className="text-lg font-semibold">
                {formatCurrency(resultado.custoMaterial)}
              </div>
              <div className="text-sm text-muted-foreground">Material</div>
            </div>
            <div className="bg-background/50 rounded-lg p-3">
              <div className="text-lg font-semibold">
                {formatCurrency(resultado.custoMaoObra)}
              </div>
              <div className="text-sm text-muted-foreground">Mão de Obra</div>
            </div>
            <div className="bg-background/50 rounded-lg p-3">
              <div className="text-lg font-semibold">
                {formatCurrency(resultado.precoPorM2)}/m²
              </div>
              <div className="text-sm text-muted-foreground">Preço Médio</div>
            </div>
          </div>
          
          <div className="border-t border-primary/20 pt-4">
            <div className="flex justify-between items-center">
              <span className="font-medium">Custo Total Revestimento:</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(resultado.custoTotal)}
              </span>
            </div>
          </div>
          
          {/* Detail breakdown by ambiente */}
          <div className="mt-4 pt-4 border-t border-primary/10">
            <p className="text-xs text-muted-foreground mb-2">Detalhamento por ambiente:</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {resultado.ambientes.map((amb) => (
                <div key={amb.id} className="flex justify-between text-sm p-2 bg-background/50 rounded">
                  <span>{amb.nome}</span>
                  <span className="font-medium">
                    {formatNumber(amb.areaComPerdaM2, 1)} m² — {formatCurrency(amb.custoTotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
