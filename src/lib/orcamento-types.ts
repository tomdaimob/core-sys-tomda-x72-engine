// Types for the ICF Budget System

export type TipoFormaICF = 'ICF 18' | 'ICF 12';
export interface Projeto {
  cliente: string;
  codigo: string;
  projeto?: string;
  areaTotal?: number;
  peDireito?: number;
  perimetroExterno?: number;
  paredesInternas?: number;
  aberturas?: number;
}

export interface Precos {
  // Paredes
  formaIcf18: number;
  formaIcf12: number;
  concretoM3: number;
  ferragemKg: number;
  maoObraParede: number;
  
  // Radier
  fibraAcoKg: number;
  fibraPpKg: number;
  maoObraRadier: number;
  
  // Laje
  maoObraLaje: number;
  
  // Reboco
  argamassaSaco: number;
  maoObraReboco: number;
  
  // Acabamentos
  pisoCeramicoM2: number;
  porcelanatoPisoM2: number;
  pinturaTinta: number;
  maoObraPintura: number;
}


export interface SegmentoParede {
  id: string;
  descricao: string;
  areaParedeM2: number;
  tipoForma: TipoFormaICF;
}

export interface InputParedes {
  areaExternaM2: number;
  areaInternaM2: number;
  tipoFormaExterna: TipoFormaICF;
  tipoFormaInterna: TipoFormaICF;
  modoAvancado: boolean;
  segmentos: SegmentoParede[];
  // Legacy fields for backward compatibility
  areaLiquidaM2?: number;
  espessuraCm?: number;
  tipoForma?: '18' | '12';
  volumeConcretoM3?: number;
  pesoFerragemKg?: number;
}

export interface InputRadier {
  areaM2: number;
  espessuraCm: number;
  tipoFibra: 'aco' | 'pp';
  volumeM3?: number;
}

export interface InputLaje {
  linhas: {
    descricao: string;
    areaM2: number;
    espessuraCm: number;
    volumeM3?: number;
  }[];
}

export interface InputReboco {
  areaInternaM2: number;
  areaExternaM2: number;
}

export interface InputAcabamentos {
  areaPiso: number;
  tipoPiso: 'ceramico' | 'porcelanato';
  areaPintura: number;
  demaosPintura: number;
}

export interface Margens {
  lucroPercent: number;
  bdiPercent: number;
  descontoPercent: number;
}

// Results calculated from inputs
export interface ResultadoParedes {
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
  // Legacy fields for backward compatibility
  areaLiquida?: number;
  quantidadeFormas?: number;
  custoPorForma?: number;
  custoFormas?: number;
}

export interface ResultadoRadier {
  areaM2: number;
  volumeM3: number;
  consumoFibra: number;
  custoConcreto: number;
  custoFibra: number;
  custoMaoObra: number;
  custoTotal: number;
  precoPorM2: number;
}

export interface ResultadoLaje {
  linhas: {
    descricao: string;
    areaM2: number;
    volumeM3: number;
    custoConcreto: number;
    custoMaoObra: number;
    custoTotal: number;
  }[];
  areaTotalM2: number;
  volumeTotalM3: number;
  custoTotal: number;
  precoPorM2: number;
}

export interface ResultadoReboco {
  areaTotal: number;
  quantidadeSacos: number;
  custoMaterial: number;
  custoMaoObra: number;
  custoTotal: number;
}

export interface ResultadoAcabamentos {
  custoPiso: number;
  custoMaoObraPiso: number;
  custoPintura: number;
  custoMaoObraPintura: number;
  custoTotal: number;
}

export interface Consolidado {
  custoParedes: number;
  custoRadier: number;
  custoLaje: number;
  custoReboco: number;
  custoAcabamentos: number;
  subtotal: number;
  lucro: number;
  bdi: number;
  desconto: number;
  totalVenda: number;
  areaTotalM2: number;
  precoPorM2Global: number;
}

export interface OrcamentoCompleto {
  id?: string;
  userId?: string;
  projeto: Projeto;
  precos: Precos;
  inputs: {
    paredes?: InputParedes;
    radier?: InputRadier;
    laje?: InputLaje;
    reboco?: InputReboco;
    acabamentos?: InputAcabamentos;
  };
  margens: Margens;
  resultados?: {
    paredes?: ResultadoParedes;
    radier?: ResultadoRadier;
    laje?: ResultadoLaje;
    reboco?: ResultadoReboco;
    acabamentos?: ResultadoAcabamentos;
    consolidado?: Consolidado;
  };
  status: 'rascunho' | 'em_andamento' | 'concluido' | 'arquivado';
  createdAt?: string;
  updatedAt?: string;
}

// ICF Form constants
export const ICF_FORM_AREA = 1.25 * 0.40; // 0.5 m² per form
export const FIBRA_ACO_CONSUMO = 25; // kg/m³
export const FIBRA_PP_CONSUMO = 5; // kg/m³

// Default prices
export const DEFAULT_PRECOS: Precos = {
  formaIcf18: 85.00,
  formaIcf12: 72.00,
  concretoM3: 450.00,
  ferragemKg: 8.50,
  maoObraParede: 45.00,
  fibraAcoKg: 12.00,
  fibraPpKg: 28.00,
  maoObraRadier: 35.00,
  maoObraLaje: 55.00,
  argamassaSaco: 32.00,
  maoObraReboco: 28.00,
  pisoCeramicoM2: 45.00,
  porcelanatoPisoM2: 85.00,
  pinturaTinta: 180.00,
  maoObraPintura: 18.00,
};

export const DEFAULT_MARGENS: Margens = {
  lucroPercent: 15,
  bdiPercent: 25,
  descontoPercent: 0,
};
