// Types for Sapata (isolated footing) foundation calculations

import { FckTipo } from './baldrame-types';

export type SapataDataSource = 'ARQ_EXISTENTE' | 'ARQ_NOVO' | 'MANUAL';

export interface SapataTipo {
  id: string;
  nome: string;
  quantidade: number;
  larguraM: number;
  comprimentoM: number;
  alturaM: number;
}

export interface SapataInput {
  sapata_enabled: boolean;
  data_source: SapataDataSource;
  tipos: SapataTipo[];
  fck_selected: FckTipo;
  // Coefficient snapshot (from admin config)
  coef_aco_kg_por_m3: number;
  perda_concreto_percent: number;
  perda_aco_percent: number;
  // Optional: viga de amarração (uses existing baldrame)
  incluir_viga_amarracao: boolean;
  // File references
  arquivo_id?: string;
  group_id?: string;
  last_extracao_id?: string;
}

export interface SapataResultado {
  tipos_resultado: {
    nome: string;
    quantidade: number;
    volume_unitario_m3: number;
    volume_total_m3: number;
  }[];
  volume_total_m3: number;
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
  coef_aco_usado: number;
}

export const DEFAULT_SAPATA_TIPO: SapataTipo = {
  id: crypto.randomUUID(),
  nome: 'Tipo A',
  quantidade: 1,
  larguraM: 0.8,
  comprimentoM: 0.8,
  alturaM: 0.3,
};

export const DEFAULT_SAPATA_INPUT: SapataInput = {
  sapata_enabled: false,
  data_source: 'MANUAL',
  tipos: [{ ...DEFAULT_SAPATA_TIPO }],
  fck_selected: 'FCK25',
  coef_aco_kg_por_m3: 90,
  perda_concreto_percent: 5,
  perda_aco_percent: 3,
  incluir_viga_amarracao: false,
};
