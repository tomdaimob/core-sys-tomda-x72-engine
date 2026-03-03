import jsPDF from 'jspdf';
import { formatCurrency, formatNumber } from './orcamento-calculos';
// NOTE: formatCurrency is used ONLY for VALOR TOTAL and R$/m² — never in the chart section
import { formatDocument } from './document-validation';
import { extrairCustoDireto, gerarFatiasPizza, PieSlice } from './custo-direto-utils';
import icfLogoNew from '@/assets/icf-logo-new.png';

export type TipoProposta = 'parede_cinza' | 'obra_completa';

export interface PropostaData {
  cliente: string;
  codigo: string;
  projeto?: string;
  areaTotal: number;
  valorTotal: number;
  valorPorM2: number;
  prazoEstimado?: string;
  nomeVendedor: string;
  dataGeracao: Date;
  tipoProposta: TipoProposta;
  clienteTipo?: 'PF' | 'PJ';
  clienteDocumento?: string;
  clienteResponsavel?: string;
  // Results for pie chart
  resultados?: {
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
}

function drawPieChart(doc: jsPDF, fatias: PieSlice[], cx: number, cy: number, radius: number) {
  if (fatias.length === 0) return;

  let startAngle = -Math.PI / 2;
  // Use percent values only — never monetary values
  const total = fatias.reduce((s, f) => s + f.percent, 0);

  for (const fatia of fatias) {
    const sliceAngle = (fatia.percent / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;

    // Draw filled arc using small triangles
    const hex = fatia.cor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    doc.setFillColor(r, g, b);

    const steps = Math.max(20, Math.ceil(sliceAngle * 30));
    const angleStep = sliceAngle / steps;

    for (let i = 0; i < steps; i++) {
      const a1 = startAngle + i * angleStep;
      const a2 = startAngle + (i + 1) * angleStep;
      const x1 = cx + radius * Math.cos(a1);
      const y1 = cy + radius * Math.sin(a1);
      const x2 = cx + radius * Math.cos(a2);
      const y2 = cy + radius * Math.sin(a2);

      doc.triangle(cx, cy, x1, y1, x2, y2, 'F');
    }

    startAngle = endAngle;
  }
}

/**
 * Generates a commercial proposal PDF for the client.
 * - Pie chart shows ONLY percentages (no R$ per category)
 * - Only 1 big number: VALOR TOTAL
 * - NO BDI/Lucro/Desconto anywhere
 * - Includes scope, validity, CTA, signatures
 */
export async function exportarPropostaComercialPDF(data: PropostaData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 15;

  // Load the logo
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
    } catch (e) {
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

  // === TÍTULO ===
  doc.setTextColor(11, 143, 59);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('PROPOSTA COMERCIAL', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;
  
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('ICF TECNOLOGIA E CONSTRUÇÃO', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;
  
  doc.setDrawColor(11, 143, 59);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 12;

  // === DADOS DO CLIENTE (compact box) ===
  doc.setFillColor(240, 250, 245);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 30, 3, 3, 'F');
  doc.setDrawColor(11, 143, 59);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 30, 3, 3, 'S');

  const col1X = margin + 8;
  const col2X = pageWidth / 2 + 5;
  yPos += 10;
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const tipoCliente = data.clienteTipo || 'PF';
  const clienteLabel = tipoCliente === 'PJ' ? 'Razão Social' : 'Cliente';
  doc.text(`${clienteLabel}: ${data.cliente || '-'}`, col1X, yPos);
  doc.text(`Código: ${data.codigo || '-'}`, col2X, yPos);
  yPos += 7;
  if (data.clienteDocumento) {
    const docLabel = tipoCliente === 'PJ' ? 'CNPJ' : 'CPF';
    doc.text(`${docLabel}: ${formatDocument(data.clienteDocumento, tipoCliente)}`, col1X, yPos);
  }
  doc.text(`Data: ${data.dataGeracao.toLocaleDateString('pt-BR')}`, col2X, yPos);
  yPos += 7;
  doc.text(`Área: ${formatNumber(data.areaTotal)} m²`, col1X, yPos);
  if (tipoCliente === 'PJ' && data.clienteResponsavel) {
    doc.text(`Responsável: ${data.clienteResponsavel}`, col2X, yPos);
  }
  yPos += 15;

  // === TEXTO PERSUASIVO ===
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const textoIntro = `Olá, ${data.cliente || 'Cliente'}!\n\nConforme solicitado, apresentamos a proposta para execução da sua obra com o sistema ICF (Formas EPS + Concreto Armado), que proporciona uma construção moderna, resistente e com alto conforto térmico.\n\nA seguir, apresentamos o valor total e a composição percentual do custo direto da obra (materiais e mão de obra), para facilitar sua compreensão.`;
  
  const introLines = doc.splitTextToSize(textoIntro, pageWidth - 2 * margin);
  doc.text(introLines, margin, yPos);
  yPos += introLines.length * 5 + 8;

  // === VALOR TOTAL (big number) ===
  doc.setFillColor(11, 143, 59);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 28, 4, 4, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR TOTAL DA OBRA', margin + 10, yPos + 10);
  
  doc.setFontSize(18);
  doc.text(formatCurrency(data.valorTotal), pageWidth - margin - 10, yPos + 12, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${formatCurrency(data.valorPorM2)}/m²`, pageWidth - margin - 10, yPos + 22, { align: 'right' });
  
  yPos += 38;

  // === PIE CHART (percentages only, no R$) ===
  if (data.resultados) {
    const custoDireto = extrairCustoDireto(data.resultados);
    const fatias = gerarFatiasPizza(custoDireto);

    if (fatias.length > 0) {
      // Check page break
      if (yPos > pageHeight - 120) {
        doc.addPage();
        yPos = 25;
      }

      // Section header
      doc.setTextColor(11, 143, 59);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Composição do Custo Direto', margin, yPos);
      yPos += 5;
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('(materiais e mão de obra — sem BDI ou lucro)', margin, yPos);
      yPos += 10;

      // Draw pie chart
      const chartCenterX = margin + 40;
      const chartCenterY = yPos + 35;
      const chartRadius = 30;
      drawPieChart(doc, fatias, chartCenterX, chartCenterY, chartRadius);

      // Legend (percentages ONLY — NO R$ values)
      const legendX = margin + 85;
      let legendY = yPos + 8;
      
      doc.setFontSize(9);
      for (const fatia of fatias) {
        const hex = fatia.cor.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        doc.setFillColor(r, g, b);
        doc.rect(legendX, legendY - 3, 4, 4, 'F');
        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
        doc.text(`${fatia.nome}: ${fatia.percent}%`, legendX + 7, legendY);
        legendY += 8;
      }

      yPos = chartCenterY + chartRadius + 10;

      // Explanation
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      const explicacao = 'Como ler o gráfico: cada fatia representa a participação percentual de cada etapa no custo direto da obra. O objetivo é dar transparência sobre onde está concentrado o investimento. O gráfico é composto apenas por custos diretos (materiais e mão de obra).';
      const explLines = doc.splitTextToSize(explicacao, pageWidth - 2 * margin);
      doc.text(explLines, margin, yPos);
      yPos += explLines.length * 4 + 8;
    }
  }

  // === ESCOPO ===
  if (yPos > pageHeight - 100) {
    doc.addPage();
    yPos = 25;
  }

  doc.setDrawColor(11, 143, 59);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  doc.setTextColor(11, 143, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('INCLUSO NESTA PROPOSTA', margin, yPos);
  yPos += 7;

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const inclusoItems = data.tipoProposta === 'parede_cinza'
    ? [
        '• Estrutura e vedação em ICF (EPS + concreto armado)',
        '• Etapas previstas: paredes, formas (12/18), concretagem, aço/fibra, laje e reboco quando aplicável',
        '• Execução técnica com padrão e metodologia de obra',
      ]
    : [
        '• Estrutura em ICF (EPS + concreto armado)',
        '• Acabamentos conforme escopo aprovado (piso, revestimentos, pintura, instalações)',
        '• Materiais e mão de obra previstos de acordo com o orçamento aprovado',
        '• Execução completa com padrão técnico e acompanhamento',
      ];

  for (const item of inclusoItems) {
    const lines = doc.splitTextToSize(item, pageWidth - 2 * margin - 5);
    doc.text(lines, margin + 3, yPos);
    yPos += lines.length * 4.5;
  }

  yPos += 6;
  doc.setTextColor(11, 143, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('NÃO INCLUSO (salvo se contratado à parte)', margin, yPos);
  yPos += 7;

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const naoIncluso = data.tipoProposta === 'parede_cinza'
    ? [
        '• Acabamentos (piso, revestimentos, pintura final, louças/metais, forro decorativo)',
        '• Marcenaria, paisagismo, mobiliário',
        '• Taxas, alvarás, ligações definitivas (água, esgoto, energia)',
      ]
    : [
        '• Mobiliário e marcenaria sob medida',
        '• Paisagismo e áreas externas não previstas',
        '• Taxas, alvarás, ligações definitivas (água, esgoto, energia)',
      ];

  for (const item of naoIncluso) {
    const lines = doc.splitTextToSize(item, pageWidth - 2 * margin - 5);
    doc.text(lines, margin + 3, yPos);
    yPos += lines.length * 4.5;
  }

  // === POR QUE ICF ===
  yPos += 8;
  if (yPos > pageHeight - 80) {
    doc.addPage();
    yPos = 25;
  }

  doc.setTextColor(11, 143, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('POR QUE CONSTRUIR COM ICF?', margin, yPos);
  yPos += 7;

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const porqueItems = [
    '• Obra mais rápida e organizada: menos retrabalho e mais previsibilidade',
    '• Conforto térmico e acústico: desempenho superior no dia a dia',
    '• Estrutura robusta: núcleo em concreto armado, alta durabilidade',
    '• Padrão de execução: qualidade e consistência do início ao fim',
  ];
  for (const item of porqueItems) {
    doc.text(item, margin + 3, yPos);
    yPos += 5;
  }

  // === VALIDADE + CTA ===
  yPos += 8;
  if (yPos > pageHeight - 80) {
    doc.addPage();
    yPos = 25;
  }

  doc.setDrawColor(11, 143, 59);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 10;

  doc.setTextColor(11, 143, 59);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('VALIDADE E PRÓXIMOS PASSOS', margin, yPos);
  yPos += 8;

  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Validade da proposta: ________ dias', margin + 3, yPos);
  yPos += 6;
  doc.text('Prazo estimado: ________ dias', margin + 3, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'italic');
  doc.text('Podemos agendar uma visita técnica ou videoconferência para validar medidas e fechar o cronograma?', margin + 3, yPos);
  yPos += 10;

  // === FORMA DE PAGAMENTO + ASSINATURAS ===
  if (yPos > pageHeight - 110) {
    doc.addPage();
    yPos = 25;
  }

  doc.setDrawColor(11, 143, 59);
  doc.setLineWidth(1);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 12;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 143, 59);
  doc.setFontSize(11);
  doc.text('CONDIÇÕES E ASSINATURAS', margin, yPos);
  yPos += 12;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);

  // Forma de pagamento
  doc.text('Forma de pagamento:', margin, yPos);
  yPos += 6;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 15;

  // Signatures - 2 columns
  const signColWidth = (pageWidth - 2 * margin - 15) / 2;
  const signCol1X = margin;
  const signCol2X = margin + signColWidth + 15;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 143, 59);
  doc.setFontSize(10);
  doc.text('CLIENTE', signCol1X, yPos);
  doc.text('VENDEDOR / EMPRESA', signCol2X, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);

  // Signature lines
  doc.text('Assinatura:', signCol1X, yPos);
  doc.line(signCol1X + 22, yPos, signCol1X + signColWidth, yPos);
  doc.text('Assinatura:', signCol2X, yPos);
  doc.line(signCol2X + 22, yPos, signCol2X + signColWidth, yPos);
  yPos += 10;

  doc.text('Nome:', signCol1X, yPos);
  doc.line(signCol1X + 14, yPos, signCol1X + signColWidth, yPos);
  doc.text(`Vendedor: ${data.nomeVendedor || '________________________'}`, signCol2X, yPos);
  yPos += 10;

  doc.text('CPF/CNPJ:', signCol1X, yPos);
  doc.line(signCol1X + 20, yPos, signCol1X + signColWidth, yPos);
  doc.text('ICF Tecnologia e Construção', signCol2X, yPos);
  yPos += 10;

  doc.text('Data: ____/____/______', signCol1X, yPos);

  // === FOOTER (all pages) ===
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, pageWidth, pageHeight);
  }

  // Save
  const tipoLabel = data.tipoProposta === 'parede_cinza' ? 'parede_cinza' : 'obra_completa';
  const fileName = `proposta_${tipoLabel}_${data.codigo}_${(data.cliente || 'cliente').replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}

function addFooter(doc: jsPDF, pageWidth: number, pageHeight: number) {
  const footerY = pageHeight - 15;
  
  doc.setFillColor(11, 61, 46); // Dark forest green #0B3D2E
  doc.rect(0, footerY - 5, pageWidth, 20, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('www.icfconstrucoes.com.br  |  @icftecnologiaeconstrucao  |  CNPJ: 36.263.498/0001-22', pageWidth / 2, footerY + 5, { align: 'center' });
}

// Re-export legacy function for backwards compatibility
export function exportarPropostaComercialPDFLegacy(data: Omit<PropostaData, 'tipoProposta'>): void {
  exportarPropostaComercialPDF({ ...data, tipoProposta: 'obra_completa' });
}
