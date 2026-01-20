import jsPDF from 'jspdf';
import { formatCurrency, formatNumber } from './orcamento-calculos';

interface PropostaData {
  cliente: string;
  codigo: string;
  projeto?: string;
  areaTotal: number;
  valorTotal: number;
  valorPorM2: number;
  prazoEstimado?: string;
  nomeVendedor: string;
  dataGeracao: Date;
}

/**
 * Generates a commercial proposal PDF with a persuasive template
 */
export function exportarPropostaComercialPDF(data: PropostaData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = 25;

  // === HEADER ===
  // Green header bar
  doc.setFillColor(11, 143, 59); // #0B8F3B
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  // Logo/Company name area
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('ICF TECNOLOGIA E CONSTRUÇÃO', margin, 25);
  
  // Subtitle
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Construção Sustentável e Inovadora', margin, 33);

  yPos = 60;

  // === TÍTULO DO DOCUMENTO ===
  doc.setTextColor(11, 143, 59);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('PROPOSTA COMERCIAL', pageWidth / 2, yPos, { align: 'center' });
  
  yPos += 15;
  
  // Divider
  doc.setDrawColor(11, 143, 59);
  doc.setLineWidth(1);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  
  yPos += 20;

  // === DADOS DO CLIENTE ===
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Prezado(a),', margin, yPos);
  
  yPos += 10;
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(data.cliente || '-', margin, yPos);
  
  yPos += 20;

  // === TEXTO PERSUASIVO ===
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  const textoIntro = [
    'É com grande satisfação que apresentamos nossa proposta para a execução do seu projeto',
    data.projeto ? `"${data.projeto}"` : '',
    'utilizando o sistema construtivo ICF (Insulated Concrete Forms).',
    '',
    'O sistema ICF oferece diversas vantagens:',
  ].filter(Boolean).join(' ');
  
  const splitIntro = doc.splitTextToSize(textoIntro, pageWidth - 2 * margin);
  doc.text(splitIntro, margin, yPos);
  yPos += splitIntro.length * 6 + 10;

  // Benefícios em lista
  const beneficios = [
    '✓ Economia de até 50% em energia (climatização)',
    '✓ Construção mais rápida e eficiente',
    '✓ Alta resistência estrutural e durabilidade',
    '✓ Excelente isolamento térmico e acústico',
    '✓ Sustentabilidade ambiental',
  ];

  doc.setTextColor(11, 143, 59);
  doc.setFont('helvetica', 'bold');
  beneficios.forEach(beneficio => {
    doc.text(beneficio, margin + 10, yPos);
    yPos += 8;
  });

  yPos += 15;

  // === CAIXA DE VALORES ===
  // Background box
  doc.setFillColor(245, 250, 247);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 80, 5, 5, 'F');
  
  // Border
  doc.setDrawColor(11, 143, 59);
  doc.setLineWidth(1);
  doc.roundedRect(margin, yPos, pageWidth - 2 * margin, 80, 5, 5, 'S');

  yPos += 15;

  // Código e Data
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Código: ${data.codigo}`, margin + 10, yPos);
  doc.text(`Data: ${data.dataGeracao.toLocaleDateString('pt-BR')}`, pageWidth - margin - 50, yPos);
  
  yPos += 15;

  // Área construída
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(11);
  doc.text('Área Construída:', margin + 10, yPos);
  doc.setFont('helvetica', 'bold');
  doc.text(`${formatNumber(data.areaTotal)} m²`, margin + 80, yPos);
  
  yPos += 12;

  // Valor por m²
  doc.setFont('helvetica', 'normal');
  doc.text('Valor por m²:', margin + 10, yPos);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(data.valorPorM2), margin + 80, yPos);

  yPos += 20;

  // Valor Total (destaque)
  doc.setFillColor(11, 143, 59);
  doc.roundedRect(margin + 10, yPos - 5, pageWidth - 2 * margin - 20, 22, 3, 3, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('VALOR TOTAL:', margin + 20, yPos + 9);
  
  doc.setFontSize(16);
  doc.text(formatCurrency(data.valorTotal), pageWidth - margin - 25, yPos + 9, { align: 'right' });

  yPos += 40;

  // Prazo estimado (se existir)
  if (data.prazoEstimado) {
    doc.setTextColor(60, 60, 60);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Prazo Estimado de Execução:', margin, yPos);
    doc.setFont('helvetica', 'bold');
    doc.text(data.prazoEstimado, margin + 70, yPos);
    yPos += 15;
  }

  yPos += 10;

  // === TEXTO DE FECHAMENTO ===
  doc.setTextColor(60, 60, 60);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const textoFechamento = `Esta proposta tem validade de 30 dias a partir da data de emissão. ` +
    `Estamos à disposição para esclarecer quaisquer dúvidas e agendar uma visita técnica. ` +
    `Será um prazer fazer parte da realização do seu projeto!`;
  
  const splitFechamento = doc.splitTextToSize(textoFechamento, pageWidth - 2 * margin);
  doc.text(splitFechamento, margin, yPos);
  yPos += splitFechamento.length * 5 + 15;

  // Assinatura
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.text('Atenciosamente,', margin, yPos);
  yPos += 15;

  // Linha de assinatura
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos + 15, margin + 80, yPos + 15);
  
  yPos += 20;
  
  doc.setFont('helvetica', 'bold');
  doc.text(data.nomeVendedor || '-', margin, yPos);
  yPos += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Consultor Comercial', margin, yPos);

  // === FOOTER ===
  const footerY = pageHeight - 25;
  
  // Green footer bar
  doc.setFillColor(11, 143, 59);
  doc.rect(0, footerY - 5, pageWidth, 30, 'F');
  
  // Footer text
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('www.icfconstrucoes.com.br', pageWidth / 2, footerY + 5, { align: 'center' });
  doc.setFontSize(9);
  doc.text('@icftecnologiaeconstrucao', pageWidth / 2, footerY + 12, { align: 'center' });

  // Save
  const fileName = `proposta_${data.codigo}_${(data.cliente || 'cliente').replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
