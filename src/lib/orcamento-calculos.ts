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
  SegmentoParede,
} from './orcamento-types';

// Calculate walls (Paredes) - New format with ICF 18 and ICF 12 support
export function calcularParedes(
  input: InputParedes,
  precos: Precos
): ResultadoParedes {
  let formas18Qtd = 0;
  let formas12Qtd = 0;
  let areaLiquidaTotal = 0;

  if (input.modoAvancado && input.segmentos && input.segmentos.length > 0) {
    // Advanced mode: calculate by segment
    input.segmentos.forEach((seg) => {
      const qtdFormas = Math.ceil(seg.areaParedeM2 / ICF_FORM_AREA);
      areaLiquidaTotal += seg.areaParedeM2;
      if (seg.tipoForma === 'ICF 18') {
        formas18Qtd += qtdFormas;
      } else {
        formas12Qtd += qtdFormas;
      }
    });
  } else {
    // Simple mode: external and internal areas
    const areaExterna = input.areaExternaM2 || 0;
    const areaInterna = input.areaInternaM2 || 0;
    areaLiquidaTotal = areaExterna + areaInterna;

    const formasExterna = Math.ceil(areaExterna / ICF_FORM_AREA);
    const formasInterna = Math.ceil(areaInterna / ICF_FORM_AREA);

    if (input.tipoFormaExterna === 'ICF 18') {
      formas18Qtd += formasExterna;
    } else {
      formas12Qtd += formasExterna;
    }

    if (input.tipoFormaInterna === 'ICF 18') {
      formas18Qtd += formasInterna;
    } else {
      formas12Qtd += formasInterna;
    }
  }

  // Calculate costs
  const custoFormas18 = formas18Qtd * precos.formaIcf18;
  const custoFormas12 = formas12Qtd * precos.formaIcf12;
  const custoFormasTotal = custoFormas18 + custoFormas12;

  // Concrete: total forms area * average thickness (consider 15cm average)
  const espessuraMediaM = 0.15;
  const volumeConcreto = areaLiquidaTotal * espessuraMediaM * 0.7; // 70% fill factor
  const custoConcreto = volumeConcreto * precos.concretoM3;

  // Steel reinforcement: ~80 kg/m³
  const pesoFerragem = volumeConcreto * 80;
  const custoFerragem = pesoFerragem * precos.ferragemKg;

  // Labor
  const custoMaoObra = areaLiquidaTotal * precos.maoObraParede;

  const custoTotal = custoFormasTotal + custoConcreto + custoFerragem + custoMaoObra;
  const precoPorM2 = areaLiquidaTotal > 0 ? custoTotal / areaLiquidaTotal : 0;

  return {
    areaLiquidaTotal,
    formas18Qtd,
    formas12Qtd,
    custoFormas18,
    custoFormas12,
    custoFormasTotal,
    volumeConcreto,
    custoConcreto,
    pesoFerragem,
    custoFerragem,
    custoMaoObra,
    custoTotal,
    precoPorM2,
    // Legacy fields for backward compatibility
    areaLiquida: areaLiquidaTotal,
    quantidadeFormas: formas18Qtd + formas12Qtd,
    custoPorForma: (formas18Qtd + formas12Qtd) > 0 ? custoFormasTotal / (formas18Qtd + formas12Qtd) : 0,
    custoFormas: custoFormasTotal,
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

// Calculate plaster (Reboco) - Legacy function for backward compatibility
export function calcularReboco(
  input: InputReboco,
  precos: Precos
): ResultadoReboco {
  const areaInternaM2 = input.areaInternaM2 || 0;
  const areaExternaM2 = input.areaExternaM2 || 0;
  const areaTotal = areaInternaM2 + areaExternaM2;
  const perdaPercentual = 10; // Default 10%
  const areaComPerda = areaTotal * (1 + perdaPercentual / 100);
  
  const precoIcflexM2 = precos.maoObraReboco; // Use as fallback
  const precoMaoObraM2 = precos.maoObraReboco;
  
  const custoIcflex = areaComPerda * precoIcflexM2;
  const custoMaoObra = areaComPerda * precoMaoObraM2;
  const custoTotal = custoIcflex + custoMaoObra;
  
  return {
    areaInternaM2,
    areaExternaM2,
    areaTotal,
    perdaPercentual,
    areaComPerda,
    precoIcflexM2,
    precoMaoObraM2,
    custoIcflex,
    custoMaoObra,
    custoTotal,
    // Legacy fields
    quantidadeSacos: Math.ceil(areaTotal * 0.5),
    custoMaterial: custoIcflex,
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
