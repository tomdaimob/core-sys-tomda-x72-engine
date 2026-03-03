import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatNumber } from './orcamento-calculos';
import { formatDocument } from './document-validation';
import icfLogoNew from '@/assets/icf-logo-new.png';

interface ProjetoData {
  cliente: string;
  codigo: string;
  projeto: string;
  areaTotal: number;
  peDireito: number;
  clienteTipo?: 'PF' | 'PJ';
  clienteDocumento?: string;
  clienteResponsavel?: string;
}

interface ConsolidadoData {
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
  precoPorM2Global: number;
}

interface ResultadoParedes {
  areaLiquidaTotal?: number;
  formas18Qtd?: number;
  formas12Qtd?: number;
  custoFormas18?: number;
  custoFormas12?: number;
  custoFormasTotal?: number;
  custoConcreto?: number;
  custoMaoObra?: number;
  custoTotal?: number;
  precoPorM2?: number;
  // Legacy
  areaLiquidaM2?: number;
  quantidadeFormas?: number;
  custoFormas?: number;
}

interface ResultadoRadier {
  areaM2?: number;
  volumeM3?: number;
  custoConcreto?: number;
  custoFibra?: number;
  custoMaoObra?: number;
  custoTotal?: number;
}

interface ResultadoLaje {
  areaTotalM2?: number;
  volumeTotalM3?: number;
  custoConcreto?: number;
  custoMaoObra?: number;
  custoTotal?: number;
  // New fields for FCK and type
  tipo?: 'AUTO' | 'PISO_2_ANDAR' | 'FORRO';
  tipoNome?: string;
  concretoNome?: string;
  espessuraM?: number;
}

interface ResultadoReboco {
  areaInternaM2?: number;
  areaExternaM2?: number;
  areaTotal?: number;
  areaComPerda?: number;
  perdaPercentual?: number;
  custoIcflex?: number;
  custoMaoObra?: number;
  custoTotal?: number;
  // Legacy
  quantidadeSacos?: number;
  custoMaterial?: number;
}

interface ResultadoAcabamentos {
  // Piso
  areaPisoM2?: number;
  tipoPiso?: 'ceramico' | 'porcelanato' | 'ceramico_premium' | 'porcelanato_premium';
  custoPiso?: number;
  custoMaoObraPiso?: number;
  subtotalPiso?: number;
  // Pintura
  areaPinturaM2?: number;
  demaosPintura?: number;
  quantidadeTinta?: number;
  tipoTinta?: 'fosca' | 'semi_brilho';
  custoPintura?: number;
  custoMaoObraPintura?: number;
  subtotalPintura?: number;
  // Total
  custoTotal?: number;
}

interface ResultadoRevestimento {
  areaTotalM2?: number;
  custoMaterial?: number;
  custoArgamassa?: number;
  custoRejunte?: number;
  custoMaoObra?: number;
  custoTotal?: number;
  precoPorM2?: number;
  ambientes?: Array<{
    nome: string;
    tipo: 'cozinha' | 'banheiro';
    areaComPerdaM2: number;
    tipoMaterial: 'ceramica' | 'ceramica_premium' | 'porcelanato' | 'porcelanato_premium';
    custoTotal: number;
  }>;
}

interface ResultadoPortasPortoes {
  areaPortasM2?: number;
  areaPortoesM2?: number;
  materialPorta?: 'MADEIRA' | 'ALUMINIO';
  materialPortao?: 'FERRO' | 'ALUMINIO';
  precoPortaM2?: number;
  precoPortaoM2?: number;
  custoPortas?: number;
  custoPortoes?: number;
  custoTotal?: number;
}

interface Margens {
  lucroPercent: number;
  bdiPercent: number;
  descontoPercent: number;
}

interface ResultadoTelaSoldada {
  area_radier_m2?: number;
  area_tela_total_m2?: number;
  area_painel_m2?: number;
  qtd_paineis?: number;
  custo_total?: number;
  preco_painel?: number;
}

interface PDFExportData {
  projeto: ProjetoData;
  consolidado: ConsolidadoData;
  resultadoParedes?: ResultadoParedes | null;
  resultadoRadier?: ResultadoRadier | null;
  resultadoTelaSoldada?: ResultadoTelaSoldada | null;
  resultadoLaje?: ResultadoLaje | null;
  resultadoReboco?: ResultadoReboco | null;
  resultadoAcabamentos?: ResultadoAcabamentos | null;
  resultadoRevestimento?: ResultadoRevestimento | null;
  resultadoPortasPortoes?: ResultadoPortasPortoes | null;
  margens: Margens;
}

// Proposta comercial is now exported from pdf-proposta-comercial.ts directly

export async function exportarOrcamentoPDF(data: PDFExportData): Promise<void> {
  const { projeto, consolidado, resultadoParedes, resultadoRadier, resultadoTelaSoldada, resultadoLaje, resultadoReboco, resultadoAcabamentos, resultadoRevestimento, resultadoPortasPortoes, margens } = data;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 20;

  // Load the new logo
  const logoImg = new Image();
  logoImg.crossOrigin = 'anonymous';
  
  await new Promise<void>((resolve) => {
    logoImg.onload = () => resolve();
    logoImg.onerror = () => resolve();
    logoImg.src = icfLogoNew;
  });

  // === HEADER WITH WHITE BACKGROUND ===
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Add logo if loaded
  if (logoImg.complete && logoImg.naturalWidth > 0) {
    try {
      const maxLogoHeight = 30;
      const logoAspectRatio = logoImg.naturalWidth / logoImg.naturalHeight;
      const logoHeight = Math.min(maxLogoHeight, 30);
      const logoWidth = logoHeight * logoAspectRatio;
      
      doc.addImage(logoImg, 'PNG', margin, 8, logoWidth, logoHeight);
    } catch (e) {
      // Fallback text
      doc.setTextColor(11, 61, 46);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('ICF TECNOLOGIA', margin + 3, yPos + 10);
    }
  } else {
    // Fallback text
    doc.setTextColor(11, 61, 46);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('ICF TECNOLOGIA', margin + 3, yPos + 10);
  }
  
  // Title
  doc.setTextColor(11, 61, 46); // Forest green for text
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO DE CONSTRUÇÃO ICF', pageWidth / 2, 25, { align: 'center' });
  
  yPos = 50;
  
  // Divider
  doc.setDrawColor(11, 61, 46);
  doc.setLineWidth(1);
  doc.line(margin, yPos - 5, pageWidth - margin, yPos - 5);

  // === DADOS DO CLIENTE ===
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 61, 46);
  doc.text('DADOS DO CLIENTE', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  
  const tipoCliente = projeto.clienteTipo || 'PF';
  const documentoLabel = tipoCliente === 'PJ' ? 'CNPJ:' : 'CPF:';
  const documentoFormatado = projeto.clienteDocumento 
    ? formatDocument(projeto.clienteDocumento, tipoCliente)
    : 'Não informado';
  
  const clienteInfo: (string | number)[][] = [
    [tipoCliente === 'PJ' ? 'Razão Social:' : 'Cliente:', projeto.cliente || 'Não informado'],
    [documentoLabel, documentoFormatado],
  ];
  
  // Add responsible person for PJ
  if (tipoCliente === 'PJ' && projeto.clienteResponsavel) {
    clienteInfo.push(['Responsável:', projeto.clienteResponsavel]);
  }
  
  clienteInfo.push(
    ['Código:', projeto.codigo],
    ['Projeto:', projeto.projeto || 'Não informado'],
    ['Área Total:', `${formatNumber(projeto.areaTotal)} m²`],
    ['Pé-Direito:', `${formatNumber(projeto.peDireito, 2)} m`],
    ['Data:', new Date().toLocaleDateString('pt-BR')],
  );

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: clienteInfo,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 40 },
      1: { cellWidth: 100 },
    },
    margin: { left: margin },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // === DETALHAMENTO DE CUSTOS ===
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 143, 59);
  doc.text('DETALHAMENTO DE CUSTOS', margin, yPos);
  yPos += 8;

  const detalhesBody: (string | number)[][] = [];

  // Paredes
  if (resultadoParedes && (resultadoParedes.custoTotal || 0) > 0) {
    const areaTotal = resultadoParedes.areaLiquidaTotal || resultadoParedes.areaLiquidaM2 || 0;
    detalhesBody.push(
      ['PAREDES ICF', '', '', ''],
      ['  Área Total', `${formatNumber(areaTotal)} m²`, '', ''],
      ['  Formas ICF 18 cm', `${resultadoParedes.formas18Qtd || 0} un`, formatCurrency(resultadoParedes.custoFormas18 || 0), ''],
      ['  Formas ICF 12 cm', `${resultadoParedes.formas12Qtd || 0} un`, formatCurrency(resultadoParedes.custoFormas12 || 0), ''],
      ['  Custo Concreto', '', formatCurrency(resultadoParedes.custoConcreto || 0), ''],
      ['  Custo Mão de Obra', '', formatCurrency(resultadoParedes.custoMaoObra || 0), ''],
      ['  Subtotal Paredes', '', '', formatCurrency(resultadoParedes.custoTotal || 0)],
    );
  }

  // Radier
  if (resultadoRadier && (resultadoRadier.custoTotal || 0) > 0) {
    detalhesBody.push(
      ['RADIER', '', '', ''],
      ['  Área', `${formatNumber(resultadoRadier.areaM2 || 0)} m²`, '', ''],
      ['  Volume', `${formatNumber(resultadoRadier.volumeM3 || 0)} m³`, '', ''],
      ['  Custo Concreto', '', formatCurrency(resultadoRadier.custoConcreto || 0), ''],
      ['  Custo Fibra', '', formatCurrency(resultadoRadier.custoFibra || 0), ''],
      ['  Custo Mão de Obra', '', formatCurrency(resultadoRadier.custoMaoObra || 0), ''],
      ['  Subtotal Radier', '', '', formatCurrency(resultadoRadier.custoTotal || 0)],
    );
  }

  // Tela Soldada
  if (resultadoTelaSoldada && (resultadoTelaSoldada.qtd_paineis || 0) > 0) {
    const largura = resultadoTelaSoldada.area_painel_m2 ? Math.sqrt(resultadoTelaSoldada.area_painel_m2 * 2/3) : 2;
    detalhesBody.push(
      ['TELA SOLDADA (RADIER)', '', '', ''],
      ['  Área Total Tela', `${formatNumber(resultadoTelaSoldada.area_tela_total_m2 || 0)} m²`, '', ''],
      ['  Área do Painel', `${formatNumber(resultadoTelaSoldada.area_painel_m2 || 0)} m²`, '', ''],
      ['  Qtd. Painéis', `${resultadoTelaSoldada.qtd_paineis} unid`, resultadoTelaSoldada.preco_painel ? formatCurrency(resultadoTelaSoldada.preco_painel) : '-', ''],
      ['  Subtotal Tela', '', '', resultadoTelaSoldada.custo_total ? formatCurrency(resultadoTelaSoldada.custo_total) : '-'],
    );
  }

  // Laje
  if (resultadoLaje && (resultadoLaje.custoTotal || 0) > 0) {
    const tipoDisplay = resultadoLaje.tipoNome || (resultadoLaje.tipo === 'FORRO' ? 'Laje Forro' : 'Laje Piso 2º Andar');
    const concretoDisplay = resultadoLaje.concretoNome || 'Concreto';
    const espessuraDisplay = resultadoLaje.espessuraM ? `${(resultadoLaje.espessuraM * 100).toFixed(0)}cm` : '-';
    
    detalhesBody.push(
      ['LAJE', '', '', ''],
      ['  Tipo', tipoDisplay, '', ''],
      ['  Área Total', `${formatNumber(resultadoLaje.areaTotalM2 || 0)} m²`, '', ''],
      ['  Espessura', espessuraDisplay, '', ''],
      ['  Volume Total', `${formatNumber(resultadoLaje.volumeTotalM3 || 0)} m³`, '', ''],
      ['  Concreto', concretoDisplay, formatCurrency(resultadoLaje.custoConcreto || 0), ''],
      ['  Mão de Obra', '', formatCurrency(resultadoLaje.custoMaoObra || 0), ''],
      ['  Subtotal Laje', '', '', formatCurrency(resultadoLaje.custoTotal || 0)],
    );
  }

  // Reboco (ICFLEX)
  if (resultadoReboco && (resultadoReboco.custoTotal || 0) > 0) {
    detalhesBody.push(
      ['REBOCO (ICFLEX)', '', '', ''],
      ['  Área Interna', `${formatNumber(resultadoReboco.areaInternaM2 || 0)} m²`, '', ''],
      ['  Área Externa', `${formatNumber(resultadoReboco.areaExternaM2 || 0)} m²`, '', ''],
      ['  Área Total', `${formatNumber(resultadoReboco.areaTotal || 0)} m²`, '', ''],
      ['  Área c/ Perda', `${formatNumber(resultadoReboco.areaComPerda || 0)} m² (+${resultadoReboco.perdaPercentual || 10}%)`, '', ''],
      ['  Custo ICFLEX', '', formatCurrency(resultadoReboco.custoIcflex || resultadoReboco.custoMaterial || 0), ''],
      ['  Custo Mão de Obra', '', formatCurrency(resultadoReboco.custoMaoObra || 0), ''],
      ['  Subtotal Reboco', '', '', formatCurrency(resultadoReboco.custoTotal || 0)],
    );
  }

  // Acabamentos
  if (resultadoAcabamentos && (resultadoAcabamentos.custoTotal || 0) > 0) {
    const tipoPisoDisplay = 
      resultadoAcabamentos.tipoPiso === 'porcelanato_premium' ? 'Porcelanato Premium' :
      resultadoAcabamentos.tipoPiso === 'porcelanato' ? 'Porcelanato' :
      resultadoAcabamentos.tipoPiso === 'ceramico_premium' ? 'Cerâmica Premium' : 'Cerâmico';
    const tipoTintaDisplay = resultadoAcabamentos.tipoTinta === 'semi_brilho' ? 'Semi Brilho' : 'Fosca';
    const demaosDisplay = resultadoAcabamentos.demaosPintura || 2;
    
    detalhesBody.push(
      ['ACABAMENTOS', '', '', ''],
    );
    
    // Piso section
    if ((resultadoAcabamentos.areaPisoM2 || 0) > 0) {
      detalhesBody.push(
        ['  Piso (' + tipoPisoDisplay + ')', `${formatNumber(resultadoAcabamentos.areaPisoM2 || 0)} m²`, '', ''],
        ['    Material', '', formatCurrency(resultadoAcabamentos.custoPiso || 0), ''],
        ['    Mão de Obra', '', formatCurrency(resultadoAcabamentos.custoMaoObraPiso || 0), ''],
        ['    Subtotal Piso', '', '', formatCurrency(resultadoAcabamentos.subtotalPiso || 0)],
      );
    }
    
    // Pintura section
    if ((resultadoAcabamentos.areaPinturaM2 || 0) > 0) {
      detalhesBody.push(
        ['  Pintura (' + demaosDisplay + ' demão' + (demaosDisplay > 1 ? 's' : '') + ')', `${formatNumber(resultadoAcabamentos.areaPinturaM2 || 0)} m²`, '', ''],
        ['    Galões Tinta', `${resultadoAcabamentos.quantidadeTinta || 0} un`, formatCurrency(resultadoAcabamentos.custoPintura || 0), ''],
        ['    Mão de Obra', '', formatCurrency(resultadoAcabamentos.custoMaoObraPintura || 0), ''],
        ['    Subtotal Pintura', '', '', formatCurrency(resultadoAcabamentos.subtotalPintura || 0)],
      );
    }
    
    detalhesBody.push(
      ['  Subtotal Acabamentos', '', '', formatCurrency(resultadoAcabamentos.custoTotal || 0)],
    );
  }

  // Revestimento (Cozinha e Banheiros)
  if (resultadoRevestimento && (resultadoRevestimento.custoTotal || 0) > 0) {
    detalhesBody.push(
      ['REVESTIMENTO (COZINHA/BANHEIROS)', '', '', ''],
    );
    
    // Detail by ambiente
    if (resultadoRevestimento.ambientes && resultadoRevestimento.ambientes.length > 0) {
      for (const amb of resultadoRevestimento.ambientes) {
        const tipoMaterialDisplay = amb.tipoMaterial === 'porcelanato' ? 'Porcelanato' : 'Cerâmica';
        detalhesBody.push(
          [`  ${amb.nome} (${tipoMaterialDisplay})`, `${formatNumber(amb.areaComPerdaM2, 1)} m²`, '', formatCurrency(amb.custoTotal)],
        );
      }
    } else {
      detalhesBody.push(
        ['  Área Total', `${formatNumber(resultadoRevestimento.areaTotalM2 || 0)} m²`, '', ''],
      );
    }
    
    // Cost breakdown
    if ((resultadoRevestimento.custoMaterial || 0) > 0) {
      detalhesBody.push(['  Material', '', formatCurrency(resultadoRevestimento.custoMaterial || 0), '']);
    }
    if ((resultadoRevestimento.custoArgamassa || 0) > 0) {
      detalhesBody.push(['  Argamassa ACIII', '', formatCurrency(resultadoRevestimento.custoArgamassa || 0), '']);
    }
    if ((resultadoRevestimento.custoRejunte || 0) > 0) {
      detalhesBody.push(['  Rejunte', '', formatCurrency(resultadoRevestimento.custoRejunte || 0), '']);
    }
    if ((resultadoRevestimento.custoMaoObra || 0) > 0) {
      detalhesBody.push(['  Mão de Obra', '', formatCurrency(resultadoRevestimento.custoMaoObra || 0), '']);
    }
    
    detalhesBody.push(
      ['  Subtotal Revestimento', '', '', formatCurrency(resultadoRevestimento.custoTotal || 0)],
    );
  }

  // Portas e Portões (Admin only)
  if (resultadoPortasPortoes && (resultadoPortasPortoes.custoTotal || 0) > 0) {
    const materialPortaDisplay = resultadoPortasPortoes.materialPorta === 'ALUMINIO' ? 'Alumínio' : 'Madeira';
    const materialPortaoDisplay = resultadoPortasPortoes.materialPortao === 'ALUMINIO' ? 'Alumínio' : 'Ferro';
    
    detalhesBody.push(
      ['PORTAS E PORTÕES', '', '', ''],
    );
    
    // Portas
    if ((resultadoPortasPortoes.areaPortasM2 || 0) > 0) {
      detalhesBody.push(
        [`  Portas (${materialPortaDisplay})`, `${formatNumber(resultadoPortasPortoes.areaPortasM2 || 0)} m²`, formatCurrency(resultadoPortasPortoes.precoPortaM2 || 0), formatCurrency(resultadoPortasPortoes.custoPortas || 0)],
      );
    }
    
    // Portões
    if ((resultadoPortasPortoes.areaPortoesM2 || 0) > 0) {
      detalhesBody.push(
        [`  Portões (${materialPortaoDisplay})`, `${formatNumber(resultadoPortasPortoes.areaPortoesM2 || 0)} m²`, formatCurrency(resultadoPortasPortoes.precoPortaoM2 || 0), formatCurrency(resultadoPortasPortoes.custoPortoes || 0)],
      );
    }
    
    detalhesBody.push(
      ['  Subtotal Portas/Portões', '', '', formatCurrency(resultadoPortasPortoes.custoTotal || 0)],
    );
  }

  if (detalhesBody.length > 0) {
    autoTable(doc, {
      startY: yPos,
      head: [['Item', 'Quantidade', 'Valor Unit.', 'Total']],
      body: detalhesBody,
      theme: 'striped',
      headStyles: { 
        fillColor: [11, 143, 59],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 40, halign: 'center' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' },
      },
      margin: { left: margin, right: margin },
      didParseCell: function(data) {
        // Bold section headers
        if (data.row.index >= 0 && data.section === 'body') {
          const text = String(data.cell.raw);
          if (!text.startsWith('  ') && text.length > 0) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 240, 240];
          }
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Check if we need a new page
  if (yPos > 220) {
    doc.addPage();
    yPos = 20;
  }

  // === RESUMO FINANCEIRO ===
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 143, 59);
  doc.text('RESUMO FINANCEIRO', margin, yPos);
  yPos += 8;

  const resumoBody = [
    ['Subtotal (Custos Diretos)', formatCurrency(consolidado.subtotal)],
    [`Lucro (${margens.lucroPercent}%)`, formatCurrency(consolidado.lucro)],
    [`BDI (${margens.bdiPercent}%)`, formatCurrency(consolidado.bdi)],
    [`Desconto (${margens.descontoPercent}%)`, `- ${formatCurrency(consolidado.desconto)}`],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: resumoBody,
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 60, halign: 'right' },
    },
    margin: { left: margin },
  });

  yPos = (doc as any).lastAutoTable.finalY + 5;

  // Total Box - using forest green
  doc.setFillColor(11, 61, 46); // Forest green
  doc.rect(margin, yPos, pageWidth - 2 * margin, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR TOTAL:', margin + 10, yPos + 13);
  doc.setFontSize(16);
  doc.text(formatCurrency(consolidado.totalVenda), pageWidth - margin - 10, yPos + 13, { align: 'right' });

  yPos += 30;

  // Price per m²
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Preço por m²: ${formatCurrency(consolidado.precoPorM2Global)}`, margin, yPos);

  // === FOOTER - Forest green bar ===
  const footerY = pageHeight - 15;
  doc.setFillColor(11, 61, 46); // Forest green
  doc.rect(0, footerY - 5, pageWidth, 20, 'F');
  
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('www.icfconstrucoes.com.br  |  @icftecnologiaeconstrucao', pageWidth / 2, footerY + 5, { align: 'center' });

  // Save
  const fileName = `orcamento_${projeto.codigo}_${projeto.cliente.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
