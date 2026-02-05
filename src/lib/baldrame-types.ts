// Types for Viga Baldrame foundation calculations

export type FundacaoTipo = 'RADIER' | 'BALDRAME' | 'RADIER_BALDRAME';
export type FckTipo = 'FCK25' | 'FCK30' | 'FCK35';

export interface BaldrameInput {
  fundacao_tipo: FundacaoTipo;
  incluir_baldrame_interno: boolean;
  baldrame_externo_m: number;
  baldrame_interno_m: number;
  baldrame_perfil: string; // e.g., "20 x 30 cm" or "personalizado"
  baldrame_largura_cm: number;
  baldrame_altura_cm: number;
  baldrame_fck_selected: FckTipo;
  // Snapshot of coefficients used (for auditability)
  baldrame_coef_aco_kg_por_m: number;
  baldrame_perda_concreto_percent: number;
  baldrame_perda_aco_percent: number;
}

export interface BaldrameResultado {
  comprimento_total_m: number;
  volume_m3: number;
  volume_final_m3: number;
  aco_kg: number;
  aco_final_kg: number;
  custo_concreto: number;
  custo_aco: number;
  custo_mo: number;
  custo_total: number;
  // For PDF export
  concreto_nome: string;
  preco_concreto_m3: number;
  preco_aco_kg: number;
  preco_mo_m3: number;
}

export const DEFAULT_BALDRAME_INPUT: BaldrameInput = {
  fundacao_tipo: 'RADIER',
  incluir_baldrame_interno: false,
  baldrame_externo_m: 0,
  baldrame_interno_m: 0,
  baldrame_perfil: '20 x 30 cm',
  baldrame_largura_cm: 20,
  baldrame_altura_cm: 30,
  baldrame_fck_selected: 'FCK25',
  baldrame_coef_aco_kg_por_m: 12,
  baldrame_perda_concreto_percent: 5,
  baldrame_perda_aco_percent: 3,
};

// Map FCK selection to catalog name
export const FCK_CATALOG_NAMES: Record<FckTipo, string> = {
  FCK25: 'Concreto Usinado FCK 25',
  FCK30: 'Concreto Usinado FCK 30',
  FCK35: 'Concreto Usinado FCK 35',
};
