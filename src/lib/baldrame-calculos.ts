import { BaldrameInput, BaldrameResultado, FCK_CATALOG_NAMES } from './baldrame-types';

interface BaldramePrecos {
  concreto: { nome: string; preco: number }; // Selected FCK price
  aco_kg: number;
  mo_m3: number;
}

export function calcularBaldrame(
  input: BaldrameInput,
  precos: BaldramePrecos
): BaldrameResultado {
  // Calculate total length
  const comprimentoTotal = input.baldrame_externo_m + 
    (input.incluir_baldrame_interno ? input.baldrame_interno_m : 0);

  // Convert dimensions to meters
  const larguraM = input.baldrame_largura_cm / 100;
  const alturaM = input.baldrame_altura_cm / 100;

  // Calculate base volume
  const volumeBase = comprimentoTotal * larguraM * alturaM;

  // Apply loss percentage
  const volumeFinal = volumeBase * (1 + input.baldrame_perda_concreto_percent / 100);

  // Calculate steel
  const acoBase = comprimentoTotal * input.baldrame_coef_aco_kg_por_m;
  const acoFinal = acoBase * (1 + input.baldrame_perda_aco_percent / 100);

  // Calculate costs
  const custoConcreto = volumeFinal * precos.concreto.preco;
  const custoAco = acoFinal * precos.aco_kg;
  const custoMo = volumeFinal * precos.mo_m3;
  const custoTotal = custoConcreto + custoAco + custoMo;

  return {
    comprimento_total_m: comprimentoTotal,
    volume_m3: volumeBase,
    volume_final_m3: volumeFinal,
    aco_kg: acoBase,
    aco_final_kg: acoFinal,
    custo_concreto: custoConcreto,
    custo_aco: custoAco,
    custo_mo: custoMo,
    custo_total: custoTotal,
    concreto_nome: precos.concreto.nome,
    preco_concreto_m3: precos.concreto.preco,
    preco_aco_kg: precos.aco_kg,
    preco_mo_m3: precos.mo_m3,
  };
}

export function getBaldramePrecos(
  catalogItems: Array<{ nome: string; preco: number; categoria: string }>,
  fckSelected: 'FCK25' | 'FCK30' | 'FCK35'
): BaldramePrecos | null {
  const concretoNome = FCK_CATALOG_NAMES[fckSelected];
  const concreto = catalogItems.find(
    (item) => item.categoria === 'Concreto' && item.nome === concretoNome
  );
  const aco = catalogItems.find(
    (item) => item.categoria === 'Aço/Fibra' && item.nome === 'Ferragem / Aço CA-50'
  );
  const mo = catalogItems.find(
    (item) => item.categoria === 'Mão de Obra' && item.nome === 'Mão de Obra - Viga Baldrame'
  );

  if (!concreto || !aco || !mo) return null;

  return {
    concreto: { nome: concreto.nome, preco: concreto.preco },
    aco_kg: aco.preco,
    mo_m3: mo.preco,
  };
}
