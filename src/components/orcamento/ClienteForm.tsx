import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, User, Building2 } from 'lucide-react';
import { 
  formatCPF, 
  formatCNPJ, 
  onlyDigits, 
  validateClienteData,
  type ClienteData,
  type ValidationResult
} from '@/lib/document-validation';

export interface ClienteFormData {
  clienteTipo: 'PF' | 'PJ';
  clienteNome: string;
  clienteDocumento: string;
  clienteResponsavel: string;
}

interface ClienteFormProps {
  data: ClienteFormData;
  onChange: (data: ClienteFormData) => void;
  onValidationChange: (isValid: boolean) => void;
  showErrors?: boolean;
}

export function ClienteForm({ 
  data, 
  onChange, 
  onValidationChange,
  showErrors = false 
}: ClienteFormProps) {
  const [touched, setTouched] = useState({
    nome: false,
    documento: false,
  });
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: false,
    errors: {},
  });

  // Validate on data change
  useEffect(() => {
    const clienteData: ClienteData = {
      tipo: data.clienteTipo,
      nome: data.clienteNome,
      documento: data.clienteDocumento,
      responsavel: data.clienteResponsavel,
    };
    const result = validateClienteData(clienteData);
    setValidation(result);
    onValidationChange(result.isValid);
  }, [data, onValidationChange]);

  const handleTipoChange = (isPJ: boolean) => {
    onChange({
      ...data,
      clienteTipo: isPJ ? 'PJ' : 'PF',
      // Clear document when switching type
      clienteDocumento: '',
      clienteResponsavel: isPJ ? data.clienteResponsavel : '',
    });
    setTouched({ nome: false, documento: false });
  };

  const handleNomeChange = (value: string) => {
    onChange({ ...data, clienteNome: value });
  };

  const handleDocumentoChange = (value: string) => {
    const formatted = data.clienteTipo === 'PF' 
      ? formatCPF(value) 
      : formatCNPJ(value);
    onChange({ ...data, clienteDocumento: formatted });
  };

  const handleResponsavelChange = (value: string) => {
    onChange({ ...data, clienteResponsavel: value });
  };

  const handleBlur = (field: 'nome' | 'documento') => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const shouldShowError = (field: 'nome' | 'documento') => {
    return (touched[field] || showErrors) && validation.errors[field];
  };

  const isPJ = data.clienteTipo === 'PJ';

  return (
    <div className="space-y-6">
      {/* Type selector */}
      <div className="flex items-center justify-between p-4 bg-accent/30 rounded-xl border border-accent">
        <div className="flex items-center gap-3">
          {isPJ ? (
            <Building2 className="w-5 h-5 text-primary" />
          ) : (
            <User className="w-5 h-5 text-primary" />
          )}
          <div>
            <span className="font-medium">
              {isPJ ? 'Pessoa Jurídica (CNPJ)' : 'Pessoa Física (CPF)'}
            </span>
            <p className="text-sm text-muted-foreground">
              {isPJ 
                ? 'Preencha os dados da empresa' 
                : 'Preencha os dados do cliente'}
            </p>
          </div>
        </div>
        <Switch
          id="tipo-pessoa"
          checked={isPJ}
          onCheckedChange={handleTipoChange}
        />
      </div>

      {/* Form fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Nome / Razão Social */}
        <div className="input-group">
          <Label htmlFor="cliente-nome" className="input-label">
            {isPJ ? 'Razão Social *' : 'Nome Completo *'}
          </Label>
          <Input
            id="cliente-nome"
            name="cliente-nome"
            value={data.clienteNome}
            onChange={(e) => handleNomeChange(e.target.value)}
            onBlur={() => handleBlur('nome')}
            placeholder={isPJ ? 'Razão social da empresa' : 'Nome completo do cliente'}
            className={shouldShowError('nome') ? 'border-destructive' : ''}
          />
          {shouldShowError('nome') && (
            <p className="text-sm text-destructive flex items-center gap-1 mt-1">
              <AlertCircle className="w-3 h-3" />
              {validation.errors.nome}
            </p>
          )}
        </div>

        {/* CPF / CNPJ */}
        <div className="input-group">
          <Label htmlFor="cliente-documento" className="input-label">
            {isPJ ? 'CNPJ *' : 'CPF *'}
          </Label>
          <Input
            id="cliente-documento"
            name="cliente-documento"
            value={data.clienteDocumento}
            onChange={(e) => handleDocumentoChange(e.target.value)}
            onBlur={() => handleBlur('documento')}
            placeholder={isPJ ? '00.000.000/0000-00' : '000.000.000-00'}
            className={shouldShowError('documento') ? 'border-destructive' : ''}
            maxLength={isPJ ? 18 : 14}
          />
          {shouldShowError('documento') && (
            <p className="text-sm text-destructive flex items-center gap-1 mt-1">
              <AlertCircle className="w-3 h-3" />
              {validation.errors.documento}
            </p>
          )}
        </div>

        {/* Responsável (only for PJ) */}
        {isPJ && (
          <div className="input-group md:col-span-2">
            <Label htmlFor="cliente-responsavel" className="input-label">
              Nome do Responsável (opcional)
            </Label>
            <Input
              id="cliente-responsavel"
              name="cliente-responsavel"
              value={data.clienteResponsavel}
              onChange={(e) => handleResponsavelChange(e.target.value)}
              placeholder="Nome do responsável pelo contato"
            />
          </div>
        )}
      </div>

      {/* Validation summary */}
      {!validation.isValid && showErrors && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Preencha todos os dados obrigatórios do cliente para continuar
          </p>
        </div>
      )}
    </div>
  );
}

export default ClienteForm;
