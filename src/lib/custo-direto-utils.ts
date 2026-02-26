/**
 * Utility to extract materials vs labor breakdown from calculation results.
 * Each stage returns { materiais, mao_obra, total }.
 * Used for the client PDF pie chart (100% direct costs, no BDI/profit).
 */

export interface CustoBreakdown {
  materiais: number;
  mao_obra: number;
  total: number;
}

export interface CustoDiretoConsolidado {
  fundacao: CustoBreakdown;
  paredes: CustoBreakdown;
  piso: CustoBreakdown;
  laje: CustoBreakdown;
  acabamento: CustoBreakdown;
  mao_obra_total_geral: number;
  custo_direto_total: number;
}

export interface PieSlice {
  nome: string;
  valor: number;
  percent: number;
  cor: string;
}

const COLORS = [
  '#0B8F3B', // Fundação - green
  '#1565C0', // Paredes - blue
  '#F57C00', // Piso - orange
  '#7B1FA2', // Laje - purple
  '#00838F', // Acabamento - teal
  '#C62828', // Mão de Obra - red
];

export function extrairCustoDireto(resultados: {
  paredes?: any;
  radier?: any;
  baldrame?: any;
  sapata?: any;
  laje?: any;
  reboco?: any;
  acabamentos?: any;
  revestimento?: any;
  portasPortoes?: any;
}): CustoDiretoConsolidado {
  // FUNDAÇÃO (radier + baldrame + sapata)
  const radierMat = (resultados.radier?.custoConcreto || 0) + (resultados.radier?.custoFibra || 0);
  const radierMO = resultados.radier?.custoMaoObra || 0;
  const baldrameMat = (resultados.baldrame?.custo_concreto || 0) + (resultados.baldrame?.custo_aco || 0);
  const baldrameMO = resultados.baldrame?.custo_mao_obra || 0;
  const sapataMat = (resultados.sapata?.custo_concreto || 0) + (resultados.sapata?.custo_aco || 0);
  const sapataMO = resultados.sapata?.custo_mao_obra || 0;

  const fundacao: CustoBreakdown = {
    materiais: radierMat + baldrameMat + sapataMat,
    mao_obra: radierMO + baldrameMO + sapataMO,
    total: (resultados.radier?.custoTotal || 0) + (resultados.baldrame?.custo_total || 0) + (resultados.sapata?.custo_total || 0),
  };

  // PAREDES
  const paredesMat = (resultados.paredes?.custoFormasTotal || resultados.paredes?.custoFormas || 0) +
    (resultados.paredes?.custoConcreto || 0) +
    (resultados.paredes?.custoFerragem || 0);
  const paredesMO = resultados.paredes?.custoMaoObra || 0;

  const paredes: CustoBreakdown = {
    materiais: paredesMat,
    mao_obra: paredesMO,
    total: resultados.paredes?.custoTotal || 0,
  };

  // PISO (from acabamentos - floor part)
  const pisoMat = resultados.acabamentos?.custoPiso || 0;
  const pisoMO = resultados.acabamentos?.custoMaoObraPiso || 0;

  const piso: CustoBreakdown = {
    materiais: pisoMat,
    mao_obra: pisoMO,
    total: (resultados.acabamentos?.subtotalPiso || (pisoMat + pisoMO)),
  };

  // LAJE
  const lajeMat = resultados.laje?.custoConcreto || 0;
  const lajeMO = resultados.laje?.custoMaoObra || 0;

  const laje: CustoBreakdown = {
    materiais: lajeMat,
    mao_obra: lajeMO,
    total: resultados.laje?.custoTotal || 0,
  };

  // ACABAMENTO (reboco + pintura + revestimento + portas/portões - excludes piso which is separate)
  const rebocoMat = resultados.reboco?.custoIcflex || resultados.reboco?.custoMaterial || 0;
  const rebocoMO = resultados.reboco?.custoMaoObra || 0;
  
  const pinturaMat = resultados.acabamentos?.custoPintura || 0;
  const pinturaMO = resultados.acabamentos?.custoMaoObraPintura || 0;

  const revestMat = (resultados.revestimento?.custoMaterial || 0) +
    (resultados.revestimento?.custoArgamassa || 0) +
    (resultados.revestimento?.custoRejunte || 0);
  const revestMO = resultados.revestimento?.custoMaoObra || 0;

  const portasMat = resultados.portasPortoes?.custoTotal || 0; // portas/portões are all material
  const portasMO = 0;

  const acabamento: CustoBreakdown = {
    materiais: rebocoMat + pinturaMat + revestMat + portasMat,
    mao_obra: rebocoMO + pinturaMO + revestMO + portasMO,
    total: (resultados.reboco?.custoTotal || 0) +
      (resultados.acabamentos?.subtotalPintura || (pinturaMat + pinturaMO)) +
      (resultados.revestimento?.custoTotal || 0) +
      (resultados.portasPortoes?.custoTotal || 0),
  };

  const mao_obra_total_geral = fundacao.mao_obra + paredes.mao_obra + piso.mao_obra + laje.mao_obra + acabamento.mao_obra;
  const custo_direto_total = fundacao.total + paredes.total + piso.total + laje.total + acabamento.total;

  return {
    fundacao,
    paredes,
    piso,
    laje,
    acabamento,
    mao_obra_total_geral,
    custo_direto_total,
  };
}

export function gerarFatiasPizza(custo: CustoDiretoConsolidado): PieSlice[] {
  if (custo.custo_direto_total <= 0) return [];

  const fatias: PieSlice[] = [
    { nome: 'Fundação', valor: custo.fundacao.materiais, percent: 0, cor: COLORS[0] },
    { nome: 'Paredes', valor: custo.paredes.materiais, percent: 0, cor: COLORS[1] },
    { nome: 'Piso', valor: custo.piso.materiais, percent: 0, cor: COLORS[2] },
    { nome: 'Laje', valor: custo.laje.materiais, percent: 0, cor: COLORS[3] },
    { nome: 'Acabamento', valor: custo.acabamento.materiais, percent: 0, cor: COLORS[4] },
    { nome: 'Mão de Obra', valor: custo.mao_obra_total_geral, percent: 0, cor: COLORS[5] },
  ].filter(f => f.valor > 0);

  const total = fatias.reduce((s, f) => s + f.valor, 0);
  
  // Calculate percentages
  let sumPercent = 0;
  fatias.forEach((f, i) => {
    if (i < fatias.length - 1) {
      f.percent = Math.round((f.valor / total) * 1000) / 10;
      sumPercent += f.percent;
    } else {
      // Last slice gets the remainder to ensure 100%
      f.percent = Math.round((100 - sumPercent) * 10) / 10;
    }
  });

  return fatias;
}

// Default equivalent area coefficients
export interface AmbienteAEq {
  nome: string;
  quantidade: number;
  areaMediaAmb: number;
  areaTotal: number;
  coefAreaEq: number;
  areaEquivalente: number;
}

export const DEFAULT_COEF_AREA_EQ: Record<string, number> = {
  'Dormitório': 1.0,
  'Sala': 1.0,
  'Cozinha': 1.0,
  'Banheiro': 1.5,
  'Garagem': 0.65,
  'Área de Serviço': 0.50,
  'Área Gourmet': 0.65,
};

export function calcularAreaEquivalente(ambientes: AmbienteAEq[]): {
  areaTotal: number;
  areaEquivalente: number;
} {
  const areaTotal = ambientes.reduce((s, a) => s + a.areaTotal, 0);
  const areaEquivalente = ambientes.reduce((s, a) => s + a.areaTotal * a.coefAreaEq, 0);
  return { areaTotal, areaEquivalente };
}
