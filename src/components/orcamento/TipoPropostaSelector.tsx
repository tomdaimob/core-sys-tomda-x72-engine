import { Building2, Hammer } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { TipoProposta } from '@/lib/pdf-proposta-comercial';

interface TipoPropostaSelectorProps {
  tipoProposta: TipoProposta;
  onTipoPropostaChange: (tipo: TipoProposta) => void;
}

export function TipoPropostaSelector({ tipoProposta, onTipoPropostaChange }: TipoPropostaSelectorProps) {
  return (
    <div className="bg-accent/30 rounded-xl p-5 border border-accent mb-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Building2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-medium text-foreground">Tipo de Proposta</h3>
          <p className="text-sm text-muted-foreground">Selecione o escopo da obra</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => onTipoPropostaChange('parede_cinza')}
          className={cn(
            'flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all',
            tipoProposta === 'parede_cinza'
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/50 hover:bg-muted/30'
          )}
        >
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            tipoProposta === 'parede_cinza' ? 'bg-primary text-white' : 'bg-muted'
          )}>
            <Building2 className="w-6 h-6" />
          </div>
          <div className="text-center">
            <p className={cn(
              'font-medium',
              tipoProposta === 'parede_cinza' ? 'text-primary' : 'text-foreground'
            )}>
              Parede Cinza
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Estrutura ICF sem acabamentos
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onTipoPropostaChange('obra_completa')}
          className={cn(
            'flex flex-col items-center gap-3 p-4 rounded-xl border-2 transition-all',
            tipoProposta === 'obra_completa'
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/50 hover:bg-muted/30'
          )}
        >
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            tipoProposta === 'obra_completa' ? 'bg-primary text-white' : 'bg-muted'
          )}>
            <Hammer className="w-6 h-6" />
          </div>
          <div className="text-center">
            <p className={cn(
              'font-medium',
              tipoProposta === 'obra_completa' ? 'text-primary' : 'text-foreground'
            )}>
              Obra Completa
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Estrutura + acabamentos
            </p>
          </div>
        </button>
      </div>

      {tipoProposta === 'parede_cinza' && (
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
          <p className="text-sm text-amber-700">
            <strong>Parede Cinza:</strong> Os campos de Acabamentos, Revestimentos, Tintas e Portas/Portões serão desabilitados.
          </p>
        </div>
      )}
    </div>
  );
}
