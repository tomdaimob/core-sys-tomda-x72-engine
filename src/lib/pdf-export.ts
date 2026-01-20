import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatNumber } from './orcamento-calculos';

interface ProjetoData {
  cliente: string;
  codigo: string;
  projeto: string;
  areaTotal: number;
  peDireito: number;
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
  custoPiso?: number;
  custoMaoObraPiso?: number;
  custoPintura?: number;
  custoMaoObraPintura?: number;
  quantidadeTinta?: number;
  custoTotal?: number;
}

interface Margens {
  lucroPercent: number;
  bdiPercent: number;
  descontoPercent: number;
}

interface PDFExportData {
  projeto: ProjetoData;
  consolidado: ConsolidadoData;
  resultadoParedes?: ResultadoParedes | null;
  resultadoRadier?: ResultadoRadier | null;
  resultadoLaje?: ResultadoLaje | null;
  resultadoReboco?: ResultadoReboco | null;
  resultadoAcabamentos?: ResultadoAcabamentos | null;
  margens: Margens;
}

export function exportarOrcamentoPDF(data: PDFExportData): void {
  const { projeto, consolidado, resultadoParedes, resultadoRadier, resultadoLaje, resultadoReboco, resultadoAcabamentos, margens } = data;
  
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let yPos = 20;

  // === HEADER ===
  // Logo placeholder (green rectangle with company name)
  doc.setFillColor(11, 143, 59); // #0B8F3B
  doc.rect(margin, yPos, 50, 15, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('ICF TECNOLOGIA', margin + 3, yPos + 10);
  
  // Title
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO DE CONSTRUÇÃO ICF', pageWidth / 2, yPos + 8, { align: 'center' });
  
  yPos += 25;
  
  // Divider
  doc.setDrawColor(11, 143, 59);
  doc.setLineWidth(1);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  // === DADOS DO CLIENTE ===
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 143, 59);
  doc.text('DADOS DO CLIENTE', margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  
  const clienteInfo = [
    ['Cliente:', projeto.cliente || 'Não informado'],
    ['Código:', projeto.codigo],
    ['Projeto:', projeto.projeto || 'Não informado'],
    ['Área Total:', `${formatNumber(projeto.areaTotal)} m²`],
    ['Pé-Direito:', `${formatNumber(projeto.peDireito, 2)} m`],
    ['Data:', new Date().toLocaleDateString('pt-BR')],
  ];

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

  // Laje
  if (resultadoLaje && (resultadoLaje.custoTotal || 0) > 0) {
    detalhesBody.push(
      ['LAJE', '', '', ''],
      ['  Área Total', `${formatNumber(resultadoLaje.areaTotalM2 || 0)} m²`, '', ''],
      ['  Volume Total', `${formatNumber(resultadoLaje.volumeTotalM3 || 0)} m³`, '', ''],
      ['  Custo Concreto', '', formatCurrency(resultadoLaje.custoConcreto || 0), ''],
      ['  Custo Mão de Obra', '', formatCurrency(resultadoLaje.custoMaoObra || 0), ''],
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
    detalhesBody.push(
      ['ACABAMENTOS', '', '', ''],
      ['  Custo Piso', '', formatCurrency(resultadoAcabamentos.custoPiso || 0), ''],
      ['  Mão de Obra Piso', '', formatCurrency(resultadoAcabamentos.custoMaoObraPiso || 0), ''],
      ['  Custo Pintura', '', formatCurrency(resultadoAcabamentos.custoPintura || 0), ''],
      ['  Mão de Obra Pintura', '', formatCurrency(resultadoAcabamentos.custoMaoObraPintura || 0), ''],
      ['  Qtd. Latas Tinta', `${resultadoAcabamentos.quantidadeTinta || 0} latas`, '', ''],
      ['  Subtotal Acabamentos', '', '', formatCurrency(resultadoAcabamentos.custoTotal || 0)],
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

  // Total Box
  doc.setFillColor(11, 143, 59);
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

  // === FOOTER ===
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 10, pageWidth - margin, footerY - 10);
  
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text('ICF TECNOLOGIA E CONSTRUÇÃO - Orçamento gerado pelo Sistema de Simulador Orçamentário', pageWidth / 2, footerY, { align: 'center' });
  doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, footerY + 5, { align: 'center' });

  // Save
  const fileName = `orcamento_${projeto.codigo}_${projeto.cliente.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
