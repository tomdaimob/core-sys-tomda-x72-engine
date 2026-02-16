import { SapataInput, SapataResultado } from './sapata-types';
import { FCK_CATALOG_NAMES } from './baldrame-types';

interface SapataPrecos {
  concreto: { nome: string; preco: number };
  aco_kg: number;
  mo_m3: number;
}

export function calcularSapata(
  input: SapataInput,
  precos: SapataPrecos
): SapataResultado {
  const tipos_resultado = input.tipos.map((tipo) => {
    const volume_unitario = tipo.larguraM * tipo.comprimentoM * tipo.alturaM;
    return {
      nome: tipo.nome,
      quantidade: tipo.quantidade,
      volume_unitario_m3: volume_unitario,
      volume_total_m3: tipo.quantidade * volume_unitario,
    };
  });

  const volume_total = tipos_resultado.reduce((sum, t) => sum + t.volume_total_m3, 0);
  const volume_final = volume_total * (1 + input.perda_concreto_percent / 100);

  const aco_kg = volume_total * input.coef_aco_kg_por_m3;
  const aco_final = aco_kg * (1 + input.perda_aco_percent / 100);

  const custo_concreto = volume_final * precos.concreto.preco;
  const custo_aco = aco_final * precos.aco_kg;
  const custo_mo = volume_final * precos.mo_m3;
  const custo_total = custo_concreto + custo_aco + custo_mo;

  return {
    tipos_resultado,
    volume_total_m3: volume_total,
    volume_final_m3: volume_final,
    aco_kg,
    aco_final_kg: aco_final,
    custo_concreto,
    custo_aco,
    custo_mo,
    custo_total,
    concreto_nome: precos.concreto.nome,
    preco_concreto_m3: precos.concreto.preco,
    preco_aco_kg: precos.aco_kg,
    preco_mo_m3: precos.mo_m3,
    coef_aco_usado: input.coef_aco_kg_por_m3,
  };
}

export function getSapataPrecos(
  catalogItems: Array<{ nome: string; preco: number; categoria: string }>,
  fckSelected: 'FCK25' | 'FCK30' | 'FCK35'
): SapataPrecos | null {
  const concretoNome = FCK_CATALOG_NAMES[fckSelected];
  const concreto = catalogItems.find(
    (item) => item.categoria === 'Concreto' && item.nome === concretoNome
  );
  const aco = catalogItems.find(
    (item) => item.categoria === 'Aço/Fibra' && item.nome === 'Ferragem / Aço CA-50'
  );
  const mo = catalogItems.find(
    (item) => item.categoria === 'Mão de Obra' && item.nome === 'Mão de Obra - Sapata'
  );

  if (!concreto || !aco || !mo) return null;

  return {
    concreto: { nome: concreto.nome, preco: concreto.preco },
    aco_kg: aco.preco,
    mo_m3: mo.preco,
  };
}
