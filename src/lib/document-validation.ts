// CPF and CNPJ validation utilities

/**
 * Remove all non-digit characters from a string
 */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Format CPF: 000.000.000-00
 */
export function formatCPF(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  return digits
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

/**
 * Format CNPJ: 00.000.000/0000-00
 */
export function formatCNPJ(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

/**
 * Format document based on type
 */
export function formatDocument(value: string, tipo: 'PF' | 'PJ'): string {
  return tipo === 'PF' ? formatCPF(value) : formatCNPJ(value);
}

/**
 * Mask document for display (optional privacy): ***.***.***-**
 */
export function maskDocument(value: string, tipo: 'PF' | 'PJ'): string {
  if (tipo === 'PF') {
    return '***.***.***-**';
  }
  return '**.***.***/****-**';
}

/**
 * Validate CPF using the checksum algorithm
 */
export function validateCPF(cpf: string): boolean {
  const digits = onlyDigits(cpf);
  
  if (digits.length !== 11) return false;
  
  // Check for known invalid sequences (all same digits)
  if (/^(\d)\1+$/.test(digits)) return false;
  
  // Calculate first check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i]) * (10 - i);
  }
  let remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[9])) return false;
  
  // Calculate second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * (11 - i);
  }
  remainder = (sum * 10) % 11;
  if (remainder === 10 || remainder === 11) remainder = 0;
  if (remainder !== parseInt(digits[10])) return false;
  
  return true;
}

/**
 * Validate CNPJ using the checksum algorithm
 */
export function validateCNPJ(cnpj: string): boolean {
  const digits = onlyDigits(cnpj);
  
  if (digits.length !== 14) return false;
  
  // Check for known invalid sequences (all same digits)
  if (/^(\d)\1+$/.test(digits)) return false;
  
  // Calculate first check digit
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i]) * weights1[i];
  }
  let remainder = sum % 11;
  const check1 = remainder < 2 ? 0 : 11 - remainder;
  if (check1 !== parseInt(digits[12])) return false;
  
  // Calculate second check digit
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i]) * weights2[i];
  }
  remainder = sum % 11;
  const check2 = remainder < 2 ? 0 : 11 - remainder;
  if (check2 !== parseInt(digits[13])) return false;
  
  return true;
}

/**
 * Validate document based on type
 */
export function validateDocument(value: string, tipo: 'PF' | 'PJ'): boolean {
  return tipo === 'PF' ? validateCPF(value) : validateCNPJ(value);
}

/**
 * Validate name (minimum 2 words for PF, minimum 3 chars for PJ)
 */
export function validateName(name: string, tipo: 'PF' | 'PJ'): boolean {
  const trimmed = name.trim();
  
  if (tipo === 'PJ') {
    return trimmed.length >= 3;
  }
  
  // For PF: at least 2 words with minimum 2 chars each
  const words = trimmed.split(/\s+/).filter(w => w.length >= 2);
  return words.length >= 2 && trimmed.length >= 8;
}

export interface ClienteData {
  tipo: 'PF' | 'PJ';
  nome: string;
  documento: string;
  responsavel?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: {
    nome?: string;
    documento?: string;
    responsavel?: string;
  };
}

/**
 * Validate all client data
 */
export function validateClienteData(data: ClienteData): ValidationResult {
  const errors: ValidationResult['errors'] = {};
  
  // Validate name
  if (!data.nome.trim()) {
    errors.nome = data.tipo === 'PF' 
      ? 'Informe o nome completo' 
      : 'Informe a razão social';
  } else if (!validateName(data.nome, data.tipo)) {
    errors.nome = data.tipo === 'PF' 
      ? 'Nome deve ter pelo menos 2 palavras (8 caracteres)' 
      : 'Razão social deve ter pelo menos 3 caracteres';
  }
  
  // Validate document
  const docDigits = onlyDigits(data.documento);
  if (!docDigits) {
    errors.documento = data.tipo === 'PF' ? 'Informe o CPF' : 'Informe o CNPJ';
  } else if (!validateDocument(data.documento, data.tipo)) {
    errors.documento = data.tipo === 'PF' ? 'CPF inválido' : 'CNPJ inválido';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
