import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Pencil, AlertTriangle, Home } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export interface MedidasConfirmadas {
  perimetro_externo_m: number;
  paredes_internas_m: number;
  altura_paredes_m: number;
  aberturas_m2: number;
  area_total_m2: number;
  quantidade_unidades: number;
}

interface ConfirmarMedidasModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pavimentoNome: string;
  medidasExtraidas: any | null;
  confianca?: number;
  observacoes?: string;
  onConfirm: (medidas: MedidasConfirmadas) => void;
  onCancel: () => void;
}

const formatNumber = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ConfirmarMedidasModal({
  open,
  onOpenChange,
  pavimentoNome,
  medidasExtraidas,
  confianca,
  observacoes,
  onConfirm,
  onCancel,
}: ConfirmarMedidasModalProps) {
  const [medidas, setMedidas] = useState<MedidasConfirmadas>({
    perimetro_externo_m: 0,
    paredes_internas_m: 0,
    altura_paredes_m: 2.70,
    aberturas_m2: 0,
    area_total_m2: 0,
    quantidade_unidades: 1,
  });

  // Populate from extracted data when modal opens
  useEffect(() => {
    if (medidasExtraidas && open) {
      setMedidas({
        perimetro_externo_m: medidasExtraidas.perimetro_externo_m || 0,
        paredes_internas_m: medidasExtraidas.paredes_internas_m || 0,
        altura_paredes_m: medidasExtraidas.pe_direito_m || medidasExtraidas.altura_paredes_m || 2.70,
        aberturas_m2: medidasExtraidas.aberturas_m2 || 0,
        area_total_m2: medidasExtraidas.area_total_m2 || 0,
        quantidade_unidades: medidasExtraidas.quantidade_unidades || 1,
      });
    }
  }, [medidasExtraidas, open]);

  const canConfirm = medidas.perimetro_externo_m > 0 && medidas.altura_paredes_m > 0;

  const qtdUnidades = medidas.quantidade_unidades || 1;
  // Preview calculated values (per unit)
  const areaExt = medidas.perimetro_externo_m * medidas.altura_paredes_m;
  const areaInt = medidas.paredes_internas_m * medidas.altura_paredes_m;
  const areaBruta = areaExt + areaInt;
  const areaLiquida = Math.max(areaBruta - medidas.aberturas_m2, 0);
  // Total for all units
  const areaLiquidaTotal = areaLiquida * qtdUnidades;

  const handleConfirm = () => {
    if (canConfirm) {
      onConfirm(medidas);
    }
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  const confiancaPercent = confianca != null ? (confianca > 1 ? confianca : confianca * 100) : null;
  const isLowConfidence = confiancaPercent != null && confiancaPercent < 50;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-primary" />
            Confirmar Medidas — {pavimentoNome}
          </DialogTitle>
          <DialogDescription>
            Revise e ajuste os valores extraídos antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        {/* Confiança */}
        {confiancaPercent != null && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Confiança IA:</span>
            <Badge variant={isLowConfidence ? 'destructive' : 'default'} className={!isLowConfidence ? 'bg-green-500/10 text-green-700 border-green-500/20' : ''}>
              {formatNumber(confiancaPercent)}%
            </Badge>
            {isLowConfidence && (
              <span className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Confira os valores
              </span>
            )}
          </div>
        )}

        {observacoes && (
          <p className="text-xs text-muted-foreground bg-muted rounded-lg p-2">{observacoes}</p>
        )}

        {/* Editable fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-sm">Perímetro externo (m) *</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={medidas.perimetro_externo_m || ''}
              onChange={e => setMedidas(prev => ({ ...prev, perimetro_externo_m: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Paredes internas (m)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={medidas.paredes_internas_m || ''}
              onChange={e => setMedidas(prev => ({ ...prev, paredes_internas_m: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Altura paredes (m) *</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={medidas.altura_paredes_m || ''}
              onChange={e => setMedidas(prev => ({ ...prev, altura_paredes_m: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm">Aberturas (m²)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={medidas.aberturas_m2 || ''}
              onChange={e => setMedidas(prev => ({ ...prev, aberturas_m2: parseFloat(e.target.value) || 0 }))}
            />
          </div>
           <div className="space-y-1">
            <Label className="text-sm">Área total construída (m²) <span className="text-muted-foreground">(opcional)</span></Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              value={medidas.area_total_m2 || ''}
              onChange={e => setMedidas(prev => ({ ...prev, area_total_m2: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-sm flex items-center gap-1">
              <Home className="w-3.5 h-3.5" />
              Qtd. unidades (casas) *
            </Label>
            <Input
              type="number"
              step="1"
              min="1"
              max="20"
              value={medidas.quantidade_unidades || 1}
              onChange={e => setMedidas(prev => ({ ...prev, quantidade_unidades: Math.max(1, parseInt(e.target.value) || 1) }))}
            />
            {qtdUnidades > 1 && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {qtdUnidades} unidades iguais — medidas serão multiplicadas
              </p>
            )}
          </div>
        </div>

        {/* Preview */}
        {canConfirm && (
          <div className="bg-accent/50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Área ext. bruta:</span>
              <span>{formatNumber(areaExt)} m²</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Área int. bruta:</span>
              <span>{formatNumber(areaInt)} m²</span>
            </div>
            <div className="flex justify-between font-semibold border-t pt-1">
              <span>Área líquida paredes:</span>
              <span className="text-primary">{formatNumber(areaLiquida)} m²</span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCancel}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm} className="gap-1">
            <CheckCircle2 className="w-4 h-4" />
            Confirmar e Calcular
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
