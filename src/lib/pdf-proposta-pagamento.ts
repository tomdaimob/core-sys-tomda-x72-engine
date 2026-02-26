/**
 * PDF Cliente — Proposta de Pagamento
 * Contains: Pie chart (100% direct costs, NO BDI/profit), Equivalent Area, CUB-PA reference.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, formatNumber } from './orcamento-calculos';
import { formatDocument } from './document-validation';
import { 
  extrairCustoDireto, 
  gerarFatiasPizza, 
  PieSlice,
  AmbienteAEq,
  calcularAreaEquivalente,
} from './custo-direto-utils';
import icfLogoNew from '@/assets/icf-logo-new.png';

export interface PropostaPagamentoData {
  cliente: string;
  codigo: string;
  projeto?: string;
  areaTotal: number;
  valorTotal: number; // sale value (for reference only, not shown in pie)
  valorPorM2: number;
  clienteTipo?: 'PF' | 'PJ';
  clienteDocumento?: string;
  clienteResponsavel?: string;
  nomeVendedor: string;
  dataGeracao: Date;
  // Results for breakdown
  resultados: {
    paredes?: any;
    radier?: any;
    baldrame?: any;
    sapata?: any;
    laje?: any;
    reboco?: any;
    acabamentos?: any;
    revestimento?: any;
    portasPortoes?: any;
  };
  // Equivalent area
  ambientesAEq?: AmbienteAEq[];
  // CUB-PA
  cubPA?: {
    refMesAno: string;
    valorM2: number;
    padrao?: string;
    fonteUrl?: string;
  } | null;
}

function drawPieChart(doc: jsPDF, fatias: PieSlice[], x: number, y: number, radius: number) {
  if (fatias.length === 0) return;
  
  let startAngle = -Math.PI / 2; // Start from top
  
  for (const fatia of fatias) {
    const sliceAngle = (fatia.percent / 100) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;
    
    // Draw slice using filled path
    const hex = fatia.cor;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    doc.setFillColor(r, g, b);
    
    // Draw pie slice as a filled triangle fan
    const steps = Math.max(20, Math.ceil(sliceAngle / 0.05));
    const points: number[][] = [[x, y]];
    
    for (let i = 0; i <= steps; i++) {
      const angle = startAngle + (sliceAngle * i) / steps;
      points.push([
        x + radius * Math.cos(angle),
        y + radius * Math.sin(angle),
      ]);
    }
    
    // Use lines to draw the slice
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.5);
    
    // Start path
    const firstPoint = points[0];
    doc.triangle(
      firstPoint[0], firstPoint[1],
      points[1][0], points[1][1],
      points[Math.floor(points.length / 2)][0], points[Math.floor(points.length / 2)][1],
      'F'
    );
    
    // Draw the actual slice using multiple small triangles
    for (let i = 1; i < points.length - 1; i++) {
      doc.triangle(
        x, y,
        points[i][0], points[i][1],
        points[i + 1][0], points[i + 1][1],
        'F'
      );
    }
    
    startAngle = endAngle;
  }
}

export async function exportarPropostaPagamentoPDF(data: PropostaPagamentoData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 15;

  // Load logo
  const logoImg = new Image();
  logoImg.crossOrigin = 'anonymous';
  await new Promise<void>((resolve) => {
    logoImg.onload = () => resolve();
    logoImg.onerror = () => resolve();
    logoImg.src = icfLogoNew;
  });

  // === HEADER ===
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  if (logoImg.complete && logoImg.naturalWidth > 0) {
    try {
      const maxLogoHeight = 35;
      const logoAspectRatio = logoImg.naturalWidth / logoImg.naturalHeight;
      const logoHeight = Math.min(maxLogoHeight, 35);
      const logoWidth = logoHeight * logoAspectRatio;
      doc.addImage(logoImg, 'PNG', margin, 5, logoWidth, logoHeight);
    } catch {
      doc.setTextColor(11, 61, 46);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('ICF TECNOLOGIA E CONSTRUÇÃO', margin, 28);
    }
  } else {
    doc.setTextColor(11, 61, 46);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('ICF TECNOLOGIA E CONSTRUÇÃO', margin, 28);
  }

  yPos = 55;

  // === TITLE ===
  doc.setTextColor(11, 143, 59);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('PROPOSTA DE PAGAMENTO', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;
  
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Composição de Custos Diretos da Obra', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;
  
  doc.setDrawColor(11, 143, 59);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 12;

  // === CLIENT INFO ===
  const tipoCliente = data.clienteTipo || 'PF';
  const clienteInfo: (string | number)[][] = [
    [tipoCliente === 'PJ' ? 'Razão Social:' : 'Cliente:', data.cliente || 'Não informado'],
    ['Código:', data.codigo],
    ['Área Total:', `${formatNumber(data.areaTotal)} m²`],
    ['Data:', data.dataGeracao.toLocaleDateString('pt-BR')],
  ];

  if (data.clienteDocumento) {
    const docLabel = tipoCliente === 'PJ' ? 'CNPJ' : 'CPF';
    clienteInfo.splice(1, 0, [`${docLabel}:`, formatDocument(data.clienteDocumento, tipoCliente)]);
  }

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

  // === PIE CHART SECTION ===
  const custoDir = extrairCustoDireto(data.resultados);
  const fatias = gerarFatiasPizza(custoDir);

  if (fatias.length > 0 && custoDir.custo_direto_total > 0) {
    doc.setTextColor(11, 143, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPOSIÇÃO DO CUSTO DIRETO (sem BDI/Lucro)', margin, yPos);
    yPos += 8;

    // Draw pie chart
    const pieRadius = 28;
    const pieCenterX = margin + pieRadius + 5;
    const pieCenterY = yPos + pieRadius + 5;
    
    drawPieChart(doc, fatias, pieCenterX, pieCenterY, pieRadius);

    // Legend on the right
    const legendX = pieCenterX + pieRadius + 20;
    let legendY = yPos + 5;

    doc.setFontSize(9);
    for (const fatia of fatias) {
      const hex = fatia.cor;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      
      doc.setFillColor(r, g, b);
      doc.rect(legendX, legendY - 3, 8, 8, 'F');
      
      doc.setTextColor(50, 50, 50);
      doc.setFont('helvetica', 'normal');
      doc.text(`${fatia.nome}: ${fatia.percent}% — ${formatCurrency(fatia.valor)}`, legendX + 12, legendY + 3);
      legendY += 10;
    }

    yPos = Math.max(pieCenterY + pieRadius + 10, legendY + 5);

    // Cost table
    const costTableBody = fatias.map(f => [f.nome, `${f.percent}%`, formatCurrency(f.valor)]);
    costTableBody.push(['TOTAL CUSTO DIRETO', '100%', formatCurrency(custoDir.custo_direto_total)]);

    autoTable(doc, {
      startY: yPos,
      head: [['Categoria', '%', 'Valor (R$)']],
      body: costTableBody,
      theme: 'striped',
      headStyles: { fillColor: [11, 143, 59], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 25, halign: 'center' },
        2: { cellWidth: 45, halign: 'right' },
      },
      margin: { left: margin, right: margin },
      didParseCell: function(hookData) {
        if (hookData.row.index === costTableBody.length - 1 && hookData.section === 'body') {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [240, 250, 245];
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 12;
  }

  // Check page break
  if (yPos > pageHeight - 100) {
    doc.addPage();
    yPos = 25;
  }

  // === EQUIVALENT AREA SECTION ===
  if (data.ambientesAEq && data.ambientesAEq.length > 0) {
    doc.setTextColor(11, 143, 59);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('ÁREA EQUIVALENTE (NBR 12721)', margin, yPos);
    yPos += 8;

    const aeqBody = data.ambientesAEq.map(a => [
      a.nome,
      String(a.quantidade),
      formatNumber(a.areaMediaAmb, 2),
      formatNumber(a.areaTotal, 2),
      formatNumber(a.coefAreaEq, 2),
      formatNumber(a.areaEquivalente, 2),
    ]);

    const totals = calcularAreaEquivalente(data.ambientesAEq);
    aeqBody.push(['TOTAL', '', '', formatNumber(totals.areaTotal, 2), '', formatNumber(totals.areaEquivalente, 2)]);

    autoTable(doc, {
      startY: yPos,
      head: [['Ambiente', 'Qtd.', 'Área Méd.', 'Área Total', 'Coef.', 'Área Eq.']],
      body: aeqBody,
      theme: 'striped',
      headStyles: { fillColor: [11, 143, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 15, halign: 'center' },
        2: { cellWidth: 25, halign: 'right' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 25, halign: 'right' },
      },
      margin: { left: margin, right: margin },
      didParseCell: function(hookData) {
        if (hookData.row.index === aeqBody.length - 1 && hookData.section === 'body') {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [240, 250, 245];
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;

    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.setFont('helvetica', 'normal');
    doc.text(`Área Total: ${formatNumber(totals.areaTotal)} m²`, margin, yPos);
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.text(`Área Equivalente (AEq): ${formatNumber(totals.areaEquivalente)} m²`, margin, yPos);
    yPos += 12;
  }

  // Check page break
  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = 25;
  }

  // === CUB-PA REFERENCE ===
  doc.setTextColor(11, 143, 59);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('REFERÊNCIAS DE CUSTO', margin, yPos);
  yPos += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.text('SINAPI (IBGE/CAIXA) — UF: Pará', margin, yPos);
  yPos += 5;

  if (data.cubPA && data.cubPA.valorM2 > 0) {
    const padraoStr = data.cubPA.padrao ? ` — ${data.cubPA.padrao}` : '';
    const fonteStr = data.cubPA.fonteUrl ? ' (fonte: Sinduscon-PA/cub.org.br)' : '';
    doc.text(`CUB-PA (Sinduscon-PA) — ${data.cubPA.refMesAno}${padraoStr} — ${formatCurrency(data.cubPA.valorM2)}/m²${fonteStr}`, margin, yPos);
  } else {
    doc.setTextColor(180, 80, 80);
    doc.text('CUB-PA: indisponível no momento (tente atualizar novamente)', margin, yPos);
  }
  yPos += 12;

  // === VALUE BOX ===
  doc.setFillColor(11, 61, 46);
  doc.rect(margin, yPos, pageWidth - 2 * margin, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR TOTAL:', margin + 10, yPos + 13);
  doc.setFontSize(16);
  doc.text(formatCurrency(data.valorTotal), pageWidth - margin - 10, yPos + 13, { align: 'right' });
  yPos += 25;

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Valor por m²: ${formatCurrency(data.valorPorM2)}`, margin, yPos);

  // === FOOTER ===
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 15;
    doc.setFillColor(8, 196, 138);
    doc.rect(0, footerY - 5, pageWidth, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('CNPJ: 36.263.498/0001-22  |  @icftecnologiaeconstrucao', pageWidth / 2, footerY + 5, { align: 'center' });
  }

  const fileName = `proposta_pagamento_${data.codigo}_${(data.cliente || 'cliente').replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
