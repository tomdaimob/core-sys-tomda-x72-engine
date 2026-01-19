import {
  Precos,
  InputParedes,
  InputRadier,
  InputLaje,
  InputReboco,
  InputAcabamentos,
  Margens,
  ResultadoParedes,
  ResultadoRadier,
  ResultadoLaje,
  ResultadoReboco,
  ResultadoAcabamentos,
  Consolidado,
  ICF_FORM_AREA,
  FIBRA_ACO_CONSUMO,
  FIBRA_PP_CONSUMO,
} from './orcamento-types';

// Calculate walls (Paredes)
export function calcularParedes(
  input: InputParedes,
  precos: Precos
): ResultadoParedes {
  const areaLiquida = input.areaLiquidaM2;
  
  // Each ICF form = 0.5 m² (1.25 × 0.40)
  const quantidadeFormas = Math.ceil(areaLiquida / ICF_FORM_AREA);
  
  // Select form price based on type
  const custoPorForma = input.tipoForma === '18' ? precos.formaIcf18 : precos.formaIcf12;
  const custoFormas = quantidadeFormas * custoPorForma;
  
  // Concrete volume (area × thickness in meters × factor)
  const espessuraM = input.espessuraCm / 100;
  const volumeConcreto = input.volumeConcretoM3 || areaLiquida * espessuraM * 0.7; // 70% fill
  const custoConcreto = volumeConcreto * precos.concretoM3;
  
  // Steel reinforcement
  const pesoFerragem = input.pesoFerragemKg || volumeConcreto * 80; // ~80 kg/m³
  const custoFerragem = pesoFerragem * precos.ferragemKg;
  
  // Labor
  const custoMaoObra = areaLiquida * precos.maoObraParede;
  
  const custoTotal = custoFormas + custoConcreto + custoFerragem + custoMaoObra;
  const precoPorM2 = areaLiquida > 0 ? custoTotal / areaLiquida : 0;
  
  return {
    areaLiquida,
    quantidadeFormas,
    custoPorForma,
    custoFormas,
    volumeConcreto,
    custoConcreto,
    pesoFerragem,
    custoFerragem,
    custoMaoObra,
    custoTotal,
    precoPorM2,
  };
}

// Calculate foundation (Radier)
export function calcularRadier(
  input: InputRadier,
  precos: Precos
): ResultadoRadier {
  const areaM2 = input.areaM2;
  const espessuraM = input.espessuraCm / 100;
  const volumeM3 = input.volumeM3 || areaM2 * espessuraM;
  
  // Fiber consumption based on type
  const consumoFibraPorM3 = input.tipoFibra === 'aco' ? FIBRA_ACO_CONSUMO : FIBRA_PP_CONSUMO;
  const consumoFibra = volumeM3 * consumoFibraPorM3;
  
  // Costs
  const custoConcreto = volumeM3 * precos.concretoM3;
  const custoFibra = consumoFibra * (input.tipoFibra === 'aco' ? precos.fibraAcoKg : precos.fibraPpKg);
  const custoMaoObra = areaM2 * precos.maoObraRadier;
  
  const custoTotal = custoConcreto + custoFibra + custoMaoObra;
  const precoPorM2 = areaM2 > 0 ? custoTotal / areaM2 : 0;
  
  return {
    areaM2,
    volumeM3,
    consumoFibra,
    custoConcreto,
    custoFibra,
    custoMaoObra,
    custoTotal,
    precoPorM2,
  };
}

// Calculate slab (Laje) - multiple lines
export function calcularLaje(
  input: InputLaje,
  precos: Precos
): ResultadoLaje {
  const linhas = input.linhas.map((linha) => {
    const espessuraM = linha.espessuraCm / 100;
    const volumeM3 = linha.volumeM3 || linha.areaM2 * espessuraM;
    
    const custoConcreto = volumeM3 * precos.concretoM3;
    const custoMaoObra = linha.areaM2 * precos.maoObraLaje;
    const custoTotal = custoConcreto + custoMaoObra;
    
    return {
      descricao: linha.descricao,
      areaM2: linha.areaM2,
      volumeM3,
      custoConcreto,
      custoMaoObra,
      custoTotal,
    };
  });
  
  const areaTotalM2 = linhas.reduce((sum, l) => sum + l.areaM2, 0);
  const volumeTotalM3 = linhas.reduce((sum, l) => sum + l.volumeM3, 0);
  const custoTotal = linhas.reduce((sum, l) => sum + l.custoTotal, 0);
  const precoPorM2 = areaTotalM2 > 0 ? custoTotal / areaTotalM2 : 0;
  
  return {
    linhas,
    areaTotalM2,
    volumeTotalM3,
    custoTotal,
    precoPorM2,
  };
}

// Calculate plaster (Reboco)
export function calcularReboco(
  input: InputReboco,
  precos: Precos
): ResultadoReboco {
  const areaTotal = input.areaInternaM2 + input.areaExternaM2;
  
  // ~0.5 saco per m² (average)
  const quantidadeSacos = Math.ceil(areaTotal * 0.5);
  
  const custoMaterial = quantidadeSacos * precos.argamassaSaco;
  const custoMaoObra = areaTotal * precos.maoObraReboco;
  const custoTotal = custoMaterial + custoMaoObra;
  
  return {
    areaTotal,
    quantidadeSacos,
    custoMaterial,
    custoMaoObra,
    custoTotal,
  };
}

// Calculate finishes (Acabamentos)
export function calcularAcabamentos(
  input: InputAcabamentos,
  precos: Precos
): ResultadoAcabamentos {
  // Floor
  const precoPiso = input.tipoPiso === 'ceramico' 
    ? precos.pisoCeramicoM2 
    : precos.porcelanatoPisoM2;
  const custoPiso = input.areaPiso * precoPiso;
  const custoMaoObraPiso = input.areaPiso * 25; // Fixed labor per m²
  
  // Painting
  const rendimentoTinta = 50; // m² per can
  const quantidadeTinta = Math.ceil((input.areaPintura * input.demaosPintura) / rendimentoTinta);
  const custoPintura = quantidadeTinta * precos.pinturaTinta;
  const custoMaoObraPintura = input.areaPintura * precos.maoObraPintura;
  
  const custoTotal = custoPiso + custoMaoObraPiso + custoPintura + custoMaoObraPintura;
  
  return {
    custoPiso,
    custoMaoObraPiso,
    custoPintura,
    custoMaoObraPintura,
    custoTotal,
  };
}

// Consolidate all results
export function consolidarOrcamento(
  resultados: {
    paredes?: ResultadoParedes;
    radier?: ResultadoRadier;
    laje?: ResultadoLaje;
    reboco?: ResultadoReboco;
    acabamentos?: ResultadoAcabamentos;
  },
  margens: Margens,
  areaTotalProjeto: number
): Consolidado {
  const custoParedes = resultados.paredes?.custoTotal || 0;
  const custoRadier = resultados.radier?.custoTotal || 0;
  const custoLaje = resultados.laje?.custoTotal || 0;
  const custoReboco = resultados.reboco?.custoTotal || 0;
  const custoAcabamentos = resultados.acabamentos?.custoTotal || 0;
  
  const subtotal = custoParedes + custoRadier + custoLaje + custoReboco + custoAcabamentos;
  
  const lucro = subtotal * (margens.lucroPercent / 100);
  const bdi = (subtotal + lucro) * (margens.bdiPercent / 100);
  const totalBruto = subtotal + lucro + bdi;
  const desconto = totalBruto * (margens.descontoPercent / 100);
  const totalVenda = totalBruto - desconto;
  
  const areaTotalM2 = areaTotalProjeto || 
    (resultados.radier?.areaM2 || 0) + 
    (resultados.laje?.areaTotalM2 || 0);
  
  const precoPorM2Global = areaTotalM2 > 0 ? totalVenda / areaTotalM2 : 0;
  
  return {
    custoParedes,
    custoRadier,
    custoLaje,
    custoReboco,
    custoAcabamentos,
    subtotal,
    lucro,
    bdi,
    desconto,
    totalVenda,
    areaTotalM2,
    precoPorM2Global,
  };
}

// Format currency
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

// Format number
export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}
