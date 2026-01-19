import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Calculator, Grid3X3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrency, formatNumber } from '@/lib/orcamento-calculos';
import { Precos } from '@/lib/orcamento-types';

export interface LajeItem {
  id: string;
  nome: string;
  areaM2: number;
  espessuraM: number;
  tipo?: string;
  observacao?: string;
}

export interface ResultadoLajeCalculado {
  areaTotalM2: number;
  volumeTotalM3: number;
  custoConcreto: number;
  custoMaoObra: number;
  custoTotal: number;
}

interface LajeFormProps {
  lajes: LajeItem[];
  onLajesChange: (lajes: LajeItem[]) => void;
  precos: Precos;
  resultado: ResultadoLajeCalculado;
}

export function LajeForm({ lajes, onLajesChange, precos, resultado }: LajeFormProps) {
  const addLaje = () => {
    const newLaje: LajeItem = {
      id: `laje-${Date.now()}`,
      nome: `Laje ${lajes.length + 1}`,
      areaM2: 0,
      espessuraM: 0.12, // 12cm default
    };
    onLajesChange([...lajes, newLaje]);
  };

  const removeLaje = (id: string) => {
    if (lajes.length <= 1) return; // Keep at least one
    onLajesChange(lajes.filter(l => l.id !== id));
  };

  const updateLaje = (id: string, field: keyof LajeItem, value: string | number) => {
    onLajesChange(lajes.map(l => {
      if (l.id !== id) return l;
      
      // Validate: prevent negative values
      if (typeof value === 'number' && value < 0) {
        value = 0;
      }
      
      return { ...l, [field]: value };
    }));
  };

  const hasData = lajes.some(l => l.areaM2 > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Grid3X3 className="w-5 h-5 text-primary" />
            Lajes
          </h2>
          <p className="text-muted-foreground text-sm">
            Volume = Área × Espessura | Custo = Concreto + Mão de Obra
          </p>
        </div>
        <Button onClick={addLaje} variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Laje
        </Button>
      </div>

      {/* Lajes Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[30%]">Nome</TableHead>
              <TableHead className="w-[20%]">Área (m²)</TableHead>
              <TableHead className="w-[20%]">Espessura (m)</TableHead>
              <TableHead className="w-[20%]">Volume (m³)</TableHead>
              <TableHead className="w-[10%]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lajes.map((laje) => {
              const volumeM3 = laje.areaM2 * laje.espessuraM;
              return (
                <TableRow key={laje.id}>
                  <TableCell>
                    <Input
                      value={laje.nome}
                      onChange={(e) => updateLaje(laje.id, 'nome', e.target.value)}
                      placeholder="Nome da laje"
                      className="h-9"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={laje.areaM2 || ''}
                      onChange={(e) => updateLaje(laje.id, 'areaM2', Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="0.00"
                      className="h-9"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={laje.espessuraM || ''}
                      onChange={(e) => updateLaje(laje.id, 'espessuraM', Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="0.12"
                      className="h-9"
                    />
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-muted-foreground">
                      {formatNumber(volumeM3, 3)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeLaje(laje.id)}
                      disabled={lajes.length <= 1}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Prices Reference */}
      <div className="flex gap-4 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
        <div>
          <span className="font-medium">Concreto:</span> {formatCurrency(precos.concretoM3)}/m³
        </div>
        <div>
          <span className="font-medium">M.O. Laje:</span> {formatCurrency(precos.maoObraLaje)}/m²
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
              <div className="text-lg font-semibold">{formatNumber(resultado.areaTotalM2)} m²</div>
            </div>
            <div className="bg-background rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Volume Total</div>
              <div className="text-lg font-semibold">{formatNumber(resultado.volumeTotalM3, 3)} m³</div>
            </div>
            <div className="bg-background rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Custo Concreto</div>
              <div className="text-lg font-semibold text-primary">{formatCurrency(resultado.custoConcreto)}</div>
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
      )}

      {!hasData && (
        <div className="text-center py-8 text-muted-foreground bg-muted/30 rounded-xl">
          <Grid3X3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>Preencha a área das lajes para calcular os custos</p>
        </div>
      )}
    </div>
  );
}

// Calculate laje results
export function calcularLajeResultado(lajes: LajeItem[], precos: Precos): ResultadoLajeCalculado {
  const areaTotalM2 = lajes.reduce((sum, l) => sum + Math.max(0, l.areaM2 || 0), 0);
  const volumeTotalM3 = lajes.reduce((sum, l) => sum + Math.max(0, (l.areaM2 || 0) * (l.espessuraM || 0)), 0);
  
  const custoConcreto = volumeTotalM3 * precos.concretoM3;
  const custoMaoObra = areaTotalM2 * precos.maoObraLaje;
  const custoTotal = custoConcreto + custoMaoObra;

  return {
    areaTotalM2,
    volumeTotalM3,
    custoConcreto,
    custoMaoObra,
    custoTotal,
  };
}
