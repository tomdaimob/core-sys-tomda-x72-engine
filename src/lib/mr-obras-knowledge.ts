// Mr. Obras Assistente — Base de Conhecimento do Simulador ICF

export interface EtapaConhecimento {
  nome: string;
  descricao: string;
  inputs: string[];
  outputs: string[];
  formula?: string;
  observacoes?: string[];
}

export const ETAPAS_CONHECIMENTO: Record<string, EtapaConhecimento> = {
  paredes: {
    nome: 'Paredes ICF',
    descricao: 'Cálculo de paredes externas e internas usando formas ICF (18cm ou 12cm). Área líquida = área bruta - aberturas.',
    inputs: [
      'Área externa (m²) — fonte: IA/PDF ou manual',
      'Área interna (m²) — fonte: IA/PDF ou manual',
      'Tipo de forma externa (ICF 18 ou ICF 12)',
      'Tipo de forma interna (ICF 18 ou ICF 12)',
      'Segmentos avançados (modo avançado)',
    ],
    outputs: [
      'Área líquida total (m²)',
      'Quantidade de formas ICF 18 e ICF 12 (unid)',
      'Volume de concreto (m³)',
      'Peso de ferragem (kg)',
      'Custo de formas, concreto, ferragem, mão de obra',
      'Custo total paredes (R$)',
      'Preço por m² (R$/m²)',
    ],
    formula: 'Área líquida = Σ(área_segmento). Qtd formas = ceil(área / 0.5m²). Volume concreto = área × espessura. Ferragem = volume × coef.',
    observacoes: [
      'Formas ICF 18: parede de 18cm de espessura (uso externo típico)',
      'Formas ICF 12: parede de 12cm de espessura (uso interno típico)',
      'Cada forma ICF cobre 0,5 m² (1,25m × 0,40m)',
    ],
  },
  reboco: {
    nome: 'Reboco (ICFlex)',
    descricao: 'Reboco interno e externo. Interno = 2 faces, Externo = 2 faces. Usa ICFlex como material principal.',
    inputs: [
      'Área interna (m²) — calculada automaticamente das paredes',
      'Área externa (m²) — calculada automaticamente das paredes',
    ],
    outputs: [
      'Área total com perda (%)',
      'Custo ICFlex (R$)',
      'Custo mão de obra (R$)',
      'Custo total reboco (R$)',
    ],
    formula: 'Área com perda = (área_interna + área_externa) × (1 + perda%). Custo = área × preço_icflex/m² + área × preço_mo/m².',
    observacoes: [
      'Perda padrão de reboco: definida no catálogo de preços',
      'ICFlex substitui argamassa convencional em paredes ICF',
    ],
  },
  revestimento: {
    nome: 'Revestimento',
    descricao: 'Revestimento de paredes (cerâmico, porcelanato) com opções de meia parede ou parede inteira.',
    inputs: [
      'Tipo: cerâmico ou porcelanato (normal ou premium)',
      'Modo: meia parede (1,50m) ou parede inteira (pé direito)',
      'Área a revestir (m²)',
    ],
    outputs: [
      'Área total (m²)',
      'Custo material (R$)',
      'Custo mão de obra (R$)',
      'Custo total (R$)',
    ],
    formula: 'Área = perímetro × altura_revestimento. Custo = área × preço_material/m² + área × preço_mo/m².',
  },
  radier: {
    nome: 'Radier (Fundação)',
    descricao: 'Fundação tipo radier: laje de concreto armado no solo. Inclui concreto, fibra (aço ou PP), tela soldada e mão de obra.',
    inputs: [
      'Área do radier (m²)',
      'Espessura (cm)',
      'Tipo de fibra (aço ou PP)',
      'Tela soldada: habilitada/desabilitada, camadas, tamanho painel, perda sobreposição (%)',
    ],
    outputs: [
      'Volume de concreto (m³)',
      'Consumo de fibra (kg)',
      'Quantidade de painéis de tela (unid)',
      'Custo concreto, fibra, tela, mão de obra',
      'Custo total radier (R$)',
    ],
    formula: 'Volume = área × espessura/100. Fibra: aço=25kg/m³, PP=5kg/m³. Tela: qtd = ceil((área × camadas × (1+perda%/100)) / área_painel).',
    observacoes: [
      'Tela soldada padrão: 2,00m × 3,00m (6,00 m²)',
      'Perda por sobreposição padrão: 10% (emendas 20-30cm)',
    ],
  },
  baldrame: {
    nome: 'Baldrame (Fundação)',
    descricao: 'Viga de fundação (baldrame) que distribui carga das paredes para o solo.',
    inputs: [
      'Comprimento linear (m) — perímetro + paredes internas',
      'Perfil (largura × altura em cm)',
      'Coeficientes de aço (kg/m)',
    ],
    outputs: [
      'Volume de concreto (m³)',
      'Peso de aço (kg)',
      'Custo concreto, aço, mão de obra',
      'Custo total baldrame (R$)',
    ],
    formula: 'Volume = comprimento × (largura/100) × (altura/100) × (1+perda%). Aço = comprimento × coef_kg/m × (1+perda%).',
  },
  sapata: {
    nome: 'Sapata (Fundação)',
    descricao: 'Fundação por sapatas isoladas sob pilares. Pode ser extraída de projeto estrutural via IA.',
    inputs: [
      'Quantidade e dimensões de sapatas (extraído via IA ou manual)',
      'Volume total (m³)',
      'Coeficientes de aço (kg/m³)',
    ],
    outputs: [
      'Volume de concreto (m³)',
      'Peso de aço (kg)',
      'Custo concreto, aço, mão de obra',
      'Custo total sapata (R$)',
    ],
    formula: 'Volume = Σ(largura × comprimento × altura) por sapata. Aço = volume × coef_kg/m³ × (1+perda%).',
  },
  laje: {
    nome: 'Laje',
    descricao: 'Laje de concreto (forro ou entre pavimentos). Suporta múltiplas linhas com diferentes espessuras.',
    inputs: [
      'Linhas de laje: descrição, área (m²), espessura (cm)',
    ],
    outputs: [
      'Volume por linha (m³)',
      'Custo concreto e mão de obra por linha',
      'Custo total laje (R$)',
      'Preço por m² (R$/m²)',
    ],
    formula: 'Volume = área × espessura/100. Custo = volume × preço_concreto + área × preço_mo.',
    observacoes: [
      'Laje forro típica: 6cm a 8cm',
      'Laje entre pavimentos: 10cm a 15cm',
    ],
  },
  acabamentos: {
    nome: 'Acabamentos',
    descricao: 'Piso (cerâmico ou porcelanato) e pintura.',
    inputs: [
      'Área de piso (m²)',
      'Tipo de piso (cerâmico, porcelanato)',
      'Área de pintura (m²)',
      'Demãos de pintura',
    ],
    outputs: [
      'Custo piso + mão de obra',
      'Custo pintura + mão de obra',
      'Custo total acabamentos (R$)',
    ],
    formula: 'Piso: custo = área × preço/m². Pintura: custo = área × demãos × preço_tinta/rendimento + área × preço_mo.',
  },
  portas_portoes: {
    nome: 'Portas e Portões',
    descricao: 'Somatório de portas e portões por tipo, material e dimensão.',
    inputs: [
      'Lista de aberturas: tipo, largura, altura, material',
      'Fonte: IA/PDF ou manual',
    ],
    outputs: [
      'Área total (m²)',
      'Custo por item e total (R$)',
    ],
    formula: 'Área = largura × altura. Custo = área × preço_material ou preço unitário.',
  },
  margens: {
    nome: 'Margens e Desconto',
    descricao: 'Lucro, BDI e desconto comercial. Lucro e BDI são sigilosos (apenas admin).',
    inputs: [
      'Lucro (%) — ADMIN ONLY',
      'BDI (%) — ADMIN ONLY',
      'Desconto comercial (%)',
    ],
    outputs: [
      'Subtotal',
      'Valor de lucro (R$) — ADMIN ONLY',
      'Valor de BDI (R$) — ADMIN ONLY',
      'Valor de desconto (R$)',
      'Total de venda (R$)',
    ],
    formula: 'Total = subtotal × (1 + lucro%) × (1 + bdi%) × (1 - desconto%).',
    observacoes: [
      '⚠️ SIGILO: Vendedor NÃO vê lucro e BDI',
      'Desconto > 5% pode exigir aprovação do gestor',
    ],
  },
};

export const REGRAS_PERMISSAO = {
  vendedor: {
    pode: [
      'Preencher dados do projeto e cliente',
      'Importar PDF e extrair medidas via IA',
      'Preencher medidas manuais',
      'Recalcular etapas e total',
      'Adicionar/duplicar pavimentos',
      'Adicionar/remover linhas de laje',
      'Solicitar aprovação de desconto',
      'Gerar Proposta Comercial (PDF cliente)',
    ],
    naoPode: [
      'Editar catálogo de preços',
      'Editar coeficientes técnicos (baldrame, sapata)',
      'Ver ou alterar Lucro e BDI',
      'Aprovar/negar desconto',
      'Gerar Relatório Detalhado (admin)',
      'Atualizar CUB-PA',
      'Ver auditoria completa',
    ],
  },
  admin: {
    pode: ['Todas as ações do vendedor', 'Todas as ações restritas listadas acima'],
  },
};

export const MENSAGENS_SIGILO = {
  acessoNegado: 'Essa ação requer permissão do Gestor. Você pode solicitar ao administrador.',
  sigiloLucroBdi: 'Os valores de Lucro e BDI são sigilosos e gerenciados pelo Gestor.',
};

export function getEtapaInfo(etapa: string): EtapaConhecimento | null {
  return ETAPAS_CONHECIMENTO[etapa] || null;
}

export function listarEtapas(): string[] {
  return Object.keys(ETAPAS_CONHECIMENTO);
}
