import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Lock, Unlock, FileText, Edit3, AlertTriangle } from 'lucide-react';
import { ModoMedidas, ModoMedidasState } from '@/hooks/useModoMedidas';
import { cn } from '@/lib/utils';

interface ModoMedidasSelectorProps {
  state: ModoMedidasState;
  onModoChange: (modo: ModoMedidas) => void;
  onManualLockChange: (locked: boolean) => void;
  hasArquivos: boolean;
  disabled?: boolean;
}

export function ModoMedidasSelector({
  state,
  onModoChange,
  onManualLockChange,
  hasArquivos,
  disabled = false,
}: ModoMedidasSelectorProps) {
  const { modo_medidas, manual_lock } = state;
  const isManual = modo_medidas === 'MANUAL';

  return (
    <div className="space-y-4">
      {/* Badge de status no topo */}
      <div className="flex items-center gap-2">
        <Badge 
          variant={isManual ? (manual_lock ? 'destructive' : 'secondary') : 'default'}
          className="gap-1"
        >
          {isManual ? (
            manual_lock ? (
              <>
                <Lock className="w-3 h-3" />
                Modo: Manual (Travado)
              </>
            ) : (
              <>
                <Edit3 className="w-3 h-3" />
                Modo: Manual
              </>
            )
          ) : (
            <>
              <FileText className="w-3 h-3" />
              Modo: Importação
            </>
          )}
        </Badge>
      </div>

      {/* Seletor de modo */}
      <RadioGroup
        value={modo_medidas}
        onValueChange={(value) => onModoChange(value as ModoMedidas)}
        disabled={disabled}
        className="space-y-3"
      >
        <div className={cn(
          'flex items-start space-x-3 p-3 rounded-lg border transition-colors',
          modo_medidas === 'IMPORTACAO' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
        )}>
          <RadioGroupItem value="IMPORTACAO" id="modo-importacao" className="mt-1" />
          <div className="flex-1">
            <Label htmlFor="modo-importacao" className="font-medium cursor-pointer">
              Importar automaticamente (PDF/Imagens)
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              A IA analisa a planta e extrai as medidas automaticamente.
              {!hasArquivos && (
                <span className="text-destructive ml-1">
                  (Nenhum arquivo enviado ainda)
                </span>
              )}
            </p>
          </div>
        </div>

        <div className={cn(
          'flex items-start space-x-3 p-3 rounded-lg border transition-colors',
          modo_medidas === 'MANUAL' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
        )}>
          <RadioGroupItem value="MANUAL" id="modo-manual" className="mt-1" />
          <div className="flex-1">
            <Label htmlFor="modo-manual" className="font-medium cursor-pointer">
              Inserir manualmente
            </Label>
            <p className="text-sm text-muted-foreground mt-1">
              Digite as medidas manualmente quando não tiver projeto em PDF.
            </p>
          </div>
        </div>
      </RadioGroup>

      {/* Checkbox de trava (aparece apenas no modo manual) */}
      {isManual && (
        <div className={cn(
          'p-4 rounded-lg border-2 transition-all',
          manual_lock 
            ? 'border-destructive/50 bg-destructive/10' 
            : 'border-muted bg-muted'
        )}>
          <div className="flex items-start space-x-3">
            <Checkbox
              id="manual-lock"
              checked={manual_lock}
              onCheckedChange={(checked) => onManualLockChange(checked as boolean)}
              disabled={disabled}
              className="mt-0.5"
            />
            <div className="flex-1">
              <Label 
                htmlFor="manual-lock" 
                className={cn(
                  'font-medium cursor-pointer flex items-center gap-2',
                  manual_lock && 'text-destructive'
                )}
              >
                {manual_lock ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <Unlock className="w-4 h-4" />
                )}
                Usar MANUAL e ignorar importação/IA
                <Badge variant="outline" className="text-xs">
                  recomendado
                </Badge>
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                {manual_lock ? (
                  <span className="text-destructive">
                    <strong>Trava ativa:</strong> As medidas manuais serão usadas em todos os cálculos. 
                    Subir novos arquivos NÃO substituirá seus dados.
                  </span>
                ) : (
                  <>
                    <AlertTriangle className="w-3 h-3 inline mr-1 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Atenção: Sem a trava, subir um PDF pode sobrescrever suas medidas manuais.
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
