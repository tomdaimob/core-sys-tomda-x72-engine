import jsPDF from 'jspdf';
import { formatCurrency, formatNumber } from './orcamento-calculos';
import { formatDocument } from './document-validation';
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
}

// Textos das propostas
const getTextoPropostaParedeCinza = (vars: {
  cliente: string;
  areaM2: string;
  valorTotal: string;
  valorM2: string;
  nomeVendedor: string;
}) => `Olá, ${vars.cliente}!

Conforme solicitado, apresentamos a proposta para execução da sua obra utilizando o sistema ICF (Insulated Concrete Forms / EPS) — uma tecnologia moderna que entrega mais velocidade, mais precisão e mais conforto, com excelente custo-benefício no resultado estrutural.

RESUMO DO INVESTIMENTO
• Área da obra: ${vars.areaM2} m²
• Valor total (Parede Cinza): ${vars.valorTotal}
• Valor por m²: ${vars.valorM2}

O QUE ESTÁ INCLUSO (PAREDE CINZA)
• Estrutura e vedação em ICF (EPS + concreto armado)
• Etapas previstas conforme orçamento: paredes, formas (12/18), concretagem, aço/fibra, laje quando aplicável, reboco ICFLex quando aplicável (conforme itens do orçamento)
• Execução técnica com padrão e metodologia de obra

O QUE NÃO ESTÁ INCLUSO (NESTA MODALIDADE)
• Acabamentos (piso, revestimentos, pintura final, louças/metais, forro decorativo, marcenaria, paisagismo etc.), salvo se descrito em itens adicionais.

POR QUE CONSTRUIR COM ICF?
• Obra mais rápida e organizada: menos retrabalho e mais previsibilidade
• Conforto térmico e acústico: desempenho superior no dia a dia
• Estrutura robusta: núcleo em concreto armado, alta durabilidade
• Padrão de execução: qualidade e consistência do início ao fim

PRÓXIMOS PASSOS
Se estiver de acordo, seguimos com:
1) alinhamento final do escopo (Parede Cinza) e validação técnica
2) cronograma e condições
3) assinatura e mobilização de obra`;

const getTextoPropostaObraCompleta = (vars: {
  cliente: string;
  areaM2: string;
  valorTotal: string;
  valorM2: string;
  nomeVendedor: string;
}) => `Olá, ${vars.cliente}!

Conforme solicitado, apresentamos a proposta para execução da sua obra com o sistema ICF (Insulated Concrete Forms / EPS), integrando estrutura + acabamentos, com foco em qualidade, prazo e padrão de entrega.

RESUMO DO INVESTIMENTO
• Área da obra: ${vars.areaM2} m²
• Valor total (Obra Completa): ${vars.valorTotal}
• Valor por m²: ${vars.valorM2}

O QUE ESTÁ INCLUSO (OBRA COMPLETA)
• Execução completa da obra, incluindo estrutura em ICF e as etapas de acabamentos conforme o escopo definido.
• Materiais e mão de obra previstos de acordo com o orçamento aprovado (itens e quantitativos do orçamento).

POR QUE CONSTRUIR COM ICF?
• Mais eficiência e previsibilidade: obra limpa, organizada e com menos retrabalho
• Conforto e valorização: desempenho térmico e acústico superior
• Estrutura robusta e durável: núcleo em concreto armado
• Qualidade de entrega: padrão técnico, controle e acompanhamento

PRÓXIMOS PASSOS
Se estiver de acordo, seguimos com:
1) validação final do escopo e acabamentos escolhidos
2) cronograma de execução e marcos de pagamento
3) assinatura e início da mobilização`;

/**
 * Generates a commercial proposal PDF with a persuasive template and logo
 */
export async function exportarPropostaComercialPDF(data: PropostaData): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 15;

  // Load the new logo
  const logoImg = new Image();
  logoImg.crossOrigin = 'anonymous';
  
  await new Promise<void>((resolve) => {
    logoImg.onload = () => resolve();
    logoImg.onerror = () => resolve(); // Continue even if logo fails
    logoImg.src = icfLogoNew;
  });

  // === HEADER WITH WHITE BACKGROUND ===
  // White header bar
  doc.setFillColor(255, 255, 255); // White
  doc.rect(0, 0, pageWidth, 45, 'F');
  
  // Add logo if loaded
  if (logoImg.complete && logoImg.naturalWidth > 0) {
    try {
      // Calculate logo dimensions (max height 35px, maintain aspect ratio)
      const maxLogoHeight = 35;
      const logoAspectRatio = logoImg.naturalWidth / logoImg.naturalHeight;
      const logoHeight = Math.min(maxLogoHeight, 35);
      const logoWidth = logoHeight * logoAspectRatio;
      
      doc.addImage(logoImg, 'PNG', margin, 5, logoWidth, logoHeight);
    } catch (e) {
      // If logo fails, just show text
      doc.setTextColor(11, 61, 46); // Forest green for text
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('ICF TECNOLOGIA E CONSTRUÇÃO', margin, 28);
    }
  } else {
    // Fallback text if no logo
    doc.setTextColor(11, 61, 46); // Forest green for text
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('ICF TECNOLOGIA E CONSTRUÇÃO', margin, 28);
  }

  yPos = 55;

  // === TÍTULO DO DOCUMENTO ===
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
  
  // Divider
  doc.setDrawColor(11, 143, 59);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  
  yPos += 15;

  // === CAIXA DE RESUMO DO INVESTIMENTO ===
  const boxHeight = 60;
  
  // Background box with soft green
  doc.setFillColor(240, 250, 245); // Soft green background
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, boxHeight, 4, 4, 'F');
  
  // Green border
  doc.setDrawColor(11, 143, 59);
  doc.setLineWidth(1);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, boxHeight, 4, 4, 'S');

  // Box title
  yPos += 12;
  doc.setTextColor(11, 143, 59);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMO DO INVESTIMENTO', margin + 10, yPos);
  
  yPos += 12;
  
  // Two column layout for box content
  const col1X = margin + 10;
  const col2X = pageWidth / 2 + 5;
  
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Column 1
  doc.text(`Código: ${data.codigo || '-'}`, col1X, yPos);
  doc.text(`Data: ${data.dataGeracao.toLocaleDateString('pt-BR')}`, col2X, yPos);
  
  yPos += 8;
  const tipoCliente = data.clienteTipo || 'PF';
  const clienteLabel = tipoCliente === 'PJ' ? 'Razão Social' : 'Cliente';
  doc.text(`${clienteLabel}: ${data.cliente || 'Cliente'}`, col1X, yPos);
  // Show document if available
  if (data.clienteDocumento) {
    const docLabel = tipoCliente === 'PJ' ? 'CNPJ' : 'CPF';
    doc.text(`${docLabel}: ${formatDocument(data.clienteDocumento, tipoCliente)}`, col2X, yPos);
    yPos += 8;
    doc.text(`Área: ${formatNumber(data.areaTotal)} m²`, col1X, yPos);
    if (tipoCliente === 'PJ' && data.clienteResponsavel) {
      doc.text(`Responsável: ${data.clienteResponsavel}`, col2X, yPos);
    }
  } else {
    doc.text(`Área: ${formatNumber(data.areaTotal)} m²`, col2X, yPos);
  }
  
  yPos += 10;
  
  // Highlighted values
  doc.setFillColor(11, 143, 59);
  doc.roundedRect(col1X, yPos - 5, 80, 18, 2, 2, 'F');
  doc.roundedRect(col2X, yPos - 5, 75, 18, 2, 2, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('VALOR TOTAL:', col1X + 4, yPos + 3);
  doc.text(formatCurrency(data.valorTotal), col1X + 4, yPos + 10);
  
  doc.text('VALOR/m²:', col2X + 4, yPos + 3);
  doc.text(formatCurrency(data.valorPorM2), col2X + 4, yPos + 10);

  yPos += boxHeight - 20;

  // === CORPO DA PROPOSTA ===
  yPos += 15;
  
  const vars = {
    cliente: data.cliente || 'Cliente',
    areaM2: formatNumber(data.areaTotal),
    valorTotal: formatCurrency(data.valorTotal),
    valorM2: formatCurrency(data.valorPorM2),
    nomeVendedor: data.nomeVendedor || '-',
  };
  
  const textoCompleto = data.tipoProposta === 'parede_cinza' 
    ? getTextoPropostaParedeCinza(vars)
    : getTextoPropostaObraCompleta(vars);
  
  // Split text into paragraphs
  const paragrafos = textoCompleto.split('\n\n');
  
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  for (const paragrafo of paragrafos) {
    if (!paragrafo.trim()) continue;
    
    // Check if it's a section header (ALL CAPS)
    const isHeader = paragrafo === paragrafo.toUpperCase() && paragrafo.length < 50;
    
    if (isHeader) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(11, 143, 59);
    } else if (paragrafo.startsWith('•')) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
    }
    
    const lines = paragrafo.split('\n');
    for (const line of lines) {
      // Check for page break
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = 25;
        
        // Add footer to previous page and header to new page
        addFooter(doc, pageWidth, pageHeight);
      }
      
      const splitLine = doc.splitTextToSize(line, pageWidth - 2 * margin);
      doc.text(splitLine, margin, yPos);
      yPos += splitLine.length * 5;
    }
    
    yPos += 4;
  }

  // === ATENCIOSAMENTE ===
  yPos += 10;
  
  if (yPos > pageHeight - 140) {
    doc.addPage();
    yPos = 25;
  }
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Atenciosamente,', margin, yPos);
  
  yPos += 8;
  
  doc.setFont('helvetica', 'bold');
  doc.text(data.nomeVendedor || '-', margin, yPos);
  yPos += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('ICF Tecnologia e Construção', margin, yPos);

  // === CONDIÇÕES E ASSINATURAS ===
  yPos += 20;
  
  // Check if we need a new page for the signature section (need at least 120mm)
  if (yPos > pageHeight - 120) {
    doc.addPage();
    yPos = 25;
  }

  // Section separator
  doc.setDrawColor(11, 143, 59);
  doc.setLineWidth(1);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 12;

  // Section title
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 143, 59);
  doc.setFontSize(12);
  doc.text('CONDIÇÕES E ASSINATURAS', margin, yPos);
  yPos += 15;

  // Reset text styles
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(10);
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);

  // Prazo de Obra field
  doc.text('Prazo de Obra:', margin, yPos);
  const prazoLabelWidth = doc.getTextWidth('Prazo de Obra: ');
  doc.line(margin + prazoLabelWidth + 2, yPos, pageWidth - margin, yPos);
  yPos += 12;

  // Forma de pagamento field (2 lines for more space)
  doc.text('Forma de pagamento:', margin, yPos);
  yPos += 6;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 18;

  // === SIGNATURES SECTION ===
  const signColWidth = (pageWidth - 2 * margin - 15) / 2;
  const signCol1X = margin;
  const signCol2X = margin + signColWidth + 15;

  // Column headers
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(11, 143, 59);
  doc.setFontSize(11);
  doc.text('CLIENTE', signCol1X, yPos);
  doc.text('VENDEDOR / EMPRESA', signCol2X, yPos);
  yPos += 12;

  // Reset for signature fields
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(9);
  doc.setDrawColor(120, 120, 120);
  doc.setLineWidth(0.3);

  // Row 1: Signature lines
  doc.text('Assinatura do Cliente:', signCol1X, yPos);
  doc.line(signCol1X + 38, yPos, signCol1X + signColWidth, yPos);

  doc.text('Assinatura do Vendedor:', signCol2X, yPos);
  doc.line(signCol2X + 42, yPos, signCol2X + signColWidth, yPos);
  yPos += 12;

  // Row 2: Name
  doc.text('Nome:', signCol1X, yPos);
  doc.line(signCol1X + 14, yPos, signCol1X + signColWidth, yPos);

  doc.text(`Vendedor: ${data.nomeVendedor || '________________________'}`, signCol2X, yPos);
  yPos += 12;

  // Row 3: CPF/CNPJ and Company
  doc.text('CPF/CNPJ:', signCol1X, yPos);
  doc.line(signCol1X + 20, yPos, signCol1X + signColWidth, yPos);

  doc.text('ICF Tecnologia e Construção', signCol2X, yPos);
  yPos += 12;

  // Row 4: Date
  doc.text('Data: ____/____/______', signCol1X, yPos);

  // === FOOTER (add to all pages) ===
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
  
  // Turquoise green footer bar
  doc.setFillColor(11, 143, 59); // Turquoise green (#0B8F3B)
  doc.rect(0, footerY - 5, pageWidth, 20, 'F');
  
  // Footer text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('CNPJ: 36.263.498/0001-22  |  @icftecnologiaeconstrucao', pageWidth / 2, footerY + 5, { align: 'center' });
}

// Re-export legacy function for backwards compatibility
export function exportarPropostaComercialPDFLegacy(data: Omit<PropostaData, 'tipoProposta'>): void {
  exportarPropostaComercialPDF({ ...data, tipoProposta: 'obra_completa' });
}
