import { Check, X, AlertTriangle, Ruler, Home, DoorOpen, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatNumber } from '@/lib/orcamento-calculos';
import { useState } from 'react';

interface ExtractedData {
  area_total_m2: number;
  pe_direito_m: number;
  perimetro_externo_m: number;
  paredes_internas_m: number;
  aberturas_m2: number;
  confianca: number;
  observacoes: string;
  quantidade_unidades?: number;
}

interface ReviewExtractionProps {
  data: ExtractedData;
  onConfirm: (data: ExtractedData) => void;
  onCancel: () => void;
}

export function ReviewExtraction({ data, onConfirm, onCancel }: ReviewExtractionProps) {
  const [editedData, setEditedData] = useState<ExtractedData>({
    ...data,
    quantidade_unidades: data.quantidade_unidades || 1,
  });

  const getConfiancaColor = (value: number) => {
    if (value >= 80) return 'text-green-600 bg-green-100';
    if (value >= 50) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getConfiancaLabel = (value: number) => {
    if (value >= 80) return 'Alta';
    if (value >= 50) return 'Média';
    return 'Baixa';
  };

  const handleChange = (field: keyof ExtractedData, value: number) => {
    setEditedData({ ...editedData, [field]: value });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl shadow-elevated max-w-lg w-full animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="bg-primary/10 p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Revisão dos Dados Extraídos
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Verifique e ajuste os valores antes de confirmar
              </p>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${getConfiancaColor(editedData.confianca)}`}>
              {getConfiancaLabel(editedData.confianca)} ({editedData.confianca}%)
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Main metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="input-group">
              <Label className="input-label flex items-center gap-2">
                <Home className="w-4 h-4 text-primary" />
                Área Total (m²)
              </Label>
              <Input
                type="number"
                value={editedData.area_total_m2}
                onChange={(e) => handleChange('area_total_m2', parseFloat(e.target.value) || 0)}
                className="text-lg font-semibold"
              />
            </div>
            <div className="input-group">
              <Label className="input-label flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Pé-Direito (m)
              </Label>
              <Input
                type="number"
                step="0.1"
                value={editedData.pe_direito_m}
                onChange={(e) => handleChange('pe_direito_m', parseFloat(e.target.value) || 0)}
                className="text-lg font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="input-group">
              <Label className="input-label flex items-center gap-2">
                <Ruler className="w-4 h-4 text-muted-foreground" />
                Perím. Externo (m)
              </Label>
              <Input
                type="number"
                value={editedData.perimetro_externo_m}
                onChange={(e) => handleChange('perimetro_externo_m', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="input-group">
              <Label className="input-label">
                Paredes Int. (m)
              </Label>
              <Input
                type="number"
                value={editedData.paredes_internas_m}
                onChange={(e) => handleChange('paredes_internas_m', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="input-group">
              <Label className="input-label flex items-center gap-2">
                <DoorOpen className="w-4 h-4 text-muted-foreground" />
                Aberturas (m²)
              </Label>
              <Input
                type="number"
                value={editedData.aberturas_m2}
                onChange={(e) => handleChange('aberturas_m2', parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Observations */}
          {editedData.observacoes && (
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  {editedData.observacoes}
                </p>
              </div>
            </div>
          )}

          {/* Calculated area preview */}
          <div className="bg-primary/5 rounded-xl p-4 border border-primary/20">
            <h3 className="text-sm font-medium text-foreground mb-3">Cálculos Derivados</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Área Paredes Externas:</span>
                <span className="ml-2 font-medium">
                  {formatNumber(editedData.perimetro_externo_m * editedData.pe_direito_m)} m²
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Área Paredes Internas:</span>
                <span className="ml-2 font-medium">
                  {formatNumber(editedData.paredes_internas_m * editedData.pe_direito_m)} m²
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Área Líquida Paredes:</span>
                <span className="ml-2 font-semibold text-primary">
                  {formatNumber(
                    (editedData.perimetro_externo_m + editedData.paredes_internas_m) * editedData.pe_direito_m - editedData.aberturas_m2
                  )} m²
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-border bg-muted/30">
          <Button
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={() => onConfirm(editedData)}
            className="flex-1 btn-primary"
          >
            <Check className="w-4 h-4 mr-2" />
            Confirmar e Calcular
          </Button>
        </div>
      </div>
    </div>
  );
}
