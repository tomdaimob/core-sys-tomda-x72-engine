// Mr. Obras — Motor de Chat (intent matching + respostas)
import { ETAPAS_CONHECIMENTO, MENSAGENS_SIGILO, type EtapaConhecimento } from './mr-obras-knowledge';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: ChatAction[];
  timestamp: Date;
}

export interface ChatAction {
  label: string;
  actionId: string;
  params?: Record<string, any>;
  adminOnly?: boolean;
}

interface Intent {
  type: 'explicar' | 'diagnosticar' | 'recalcular' | 'listar' | 'acao' | 'saudacao' | 'desconhecido';
  etapa?: string;
  actionId?: string;
}

const ETAPA_ALIASES: Record<string, string> = {
  parede: 'paredes', paredes: 'paredes', 'parede icf': 'paredes',
  reboco: 'reboco', icflex: 'reboco',
  revestimento: 'revestimento', ceramica: 'revestimento', porcelanato: 'revestimento',
  radier: 'radier', fundação: 'radier', fundacao: 'radier',
  baldrame: 'baldrame',
  sapata: 'sapata', sapatas: 'sapata',
  laje: 'laje', lajes: 'laje',
  acabamento: 'acabamentos', acabamentos: 'acabamentos', piso: 'acabamentos', pintura: 'acabamentos',
  porta: 'portas_portoes', portas: 'portas_portoes', portão: 'portas_portoes', portoes: 'portas_portoes', 'portas e portões': 'portas_portoes',
  margem: 'margens', margens: 'margens', desconto: 'margens', lucro: 'margens', bdi: 'margens',
  tela: 'radier', 'tela soldada': 'radier',
};

function detectarEtapa(text: string): string | undefined {
  const lower = text.toLowerCase();
  for (const [alias, etapa] of Object.entries(ETAPA_ALIASES)) {
    if (lower.includes(alias)) return etapa;
  }
  return undefined;
}

function detectarIntent(text: string): Intent {
  const lower = text.toLowerCase().trim();
  const etapa = detectarEtapa(lower);

  // Saudações
  if (/^(oi|olá|ola|hey|bom dia|boa tarde|boa noite|e aí|eai)/.test(lower)) {
    return { type: 'saudacao' };
  }

  // Explicar / Por que / Como calcula
  if (/explicar|por que|porque|como calcula|como funciona|o que é|qual a fórmula|formula/.test(lower)) {
    return { type: 'explicar', etapa };
  }

  // Diagnóstico
  if (/está zerado|zerado|faltando|erro|problema|não calculou|nao calculou|vazio/.test(lower)) {
    return { type: 'diagnosticar', etapa };
  }

  // Recalcular
  if (/recalcular|calcular tudo|recalc|atualizar calculo/.test(lower)) {
    return { type: 'recalcular', etapa };
  }

  // Ações específicas
  if (/gerar proposta|gerar pdf|pdf cliente/.test(lower)) {
    return { type: 'acao', actionId: 'gerar_proposta' };
  }
  if (/relatório detalhado|relatorio detalhado|pdf admin/.test(lower)) {
    return { type: 'acao', actionId: 'gerar_relatorio_admin' };
  }
  if (/atualizar cub|cub-pa|cub pa/.test(lower)) {
    return { type: 'acao', actionId: 'atualizar_cub' };
  }
  if (/adicionar pavimento|novo pavimento/.test(lower)) {
    return { type: 'acao', actionId: 'adicionar_pavimento' };
  }
  if (/adicionar laje|nova laje|laje igual/.test(lower)) {
    return { type: 'acao', actionId: 'adicionar_laje' };
  }
  if (/reimportar|importar pdf|importar medidas/.test(lower)) {
    return { type: 'acao', actionId: 'reimportar_pdf' };
  }
  if (/modo manual|manual/.test(lower)) {
    return { type: 'acao', actionId: 'modo_manual' };
  }
  if (/listar|quais etapas|etapas/.test(lower)) {
    return { type: 'listar' };
  }
  if (/preço|preco|aumenta|diminui|alterar preço|editar preço/.test(lower)) {
    return { type: 'acao', actionId: 'editar_preco' };
  }

  return { type: 'desconhecido', etapa };
}

function formatarExplicacao(info: EtapaConhecimento): string {
  let resp = `## ${info.nome}\n\n${info.descricao}\n\n`;
  resp += `### Dados de Entrada\n${info.inputs.map(i => `- ${i}`).join('\n')}\n\n`;
  resp += `### Resultados\n${info.outputs.map(o => `- ${o}`).join('\n')}\n\n`;
  if (info.formula) {
    resp += `### Fórmula\n\`${info.formula}\`\n\n`;
  }
  if (info.observacoes?.length) {
    resp += `### Observações\n${info.observacoes.map(o => `- ${o}`).join('\n')}\n`;
  }
  return resp;
}

function diagnosticarEtapa(etapa: string, inputs: Record<string, any>, resultados: any): string {
  const info = ETAPAS_CONHECIMENTO[etapa];
  if (!info) return `Não encontrei a etapa "${etapa}" no sistema.`;

  const inputData = inputs[etapa];
  let resp = `## Diagnóstico: ${info.nome}\n\n`;

  if (!inputData || Object.keys(inputData).length === 0) {
    resp += `⚠️ **Nenhum dado de entrada encontrado** para esta etapa.\n\n`;
    resp += `**Sugestão:** Preencha os dados manualmente ou importe do PDF do projeto.`;
    return resp;
  }

  resp += `### Dados de entrada encontrados:\n`;
  resp += `\`\`\`json\n${JSON.stringify(inputData, null, 2)}\n\`\`\`\n\n`;

  // Check for zero values
  const zeros = Object.entries(inputData).filter(([, v]) => v === 0 || v === null || v === undefined);
  if (zeros.length > 0) {
    resp += `⚠️ **Campos zerados ou vazios:**\n`;
    zeros.forEach(([k]) => { resp += `- \`${k}\` está vazio/zero\n`; });
    resp += `\nIsso pode estar causando resultado zero no cálculo.`;
  } else {
    resp += `✅ Todos os campos de entrada possuem valores.`;
  }

  return resp;
}

export function processarMensagem(
  text: string,
  isAdmin: boolean,
  inputs: Record<string, any>,
  resultados: any,
  orcamento: any
): ChatMessage {
  const intent = detectarIntent(text);
  let content = '';
  let actions: ChatAction[] = [];

  switch (intent.type) {
    case 'saudacao':
      content = `Olá! Sou o **Mr. Obras Assistente** 🏗️\n\nEstou aqui para ajudar com o orçamento${orcamento ? ` **${orcamento.codigo}** (${orcamento.cliente})` : ''}.\n\nPosso:\n- Explicar qualquer cálculo\n- Diagnosticar valores zerados\n- Executar ações no orçamento\n\nO que precisa?`;
      break;

    case 'explicar':
      if (intent.etapa && ETAPAS_CONHECIMENTO[intent.etapa]) {
        const info = ETAPAS_CONHECIMENTO[intent.etapa];
        // Se vendedor perguntando sobre margens
        if (intent.etapa === 'margens' && !isAdmin) {
          content = `## Desconto Comercial\n\nVocê pode solicitar desconto comercial para o cliente. ${MENSAGENS_SIGILO.sigiloLucroBdi}`;
        } else {
          content = formatarExplicacao(info);
        }
      } else {
        content = `Sobre qual etapa você quer saber? As etapas disponíveis são:\n\n${Object.values(ETAPAS_CONHECIMENTO).map(e => `- **${e.nome}**`).join('\n')}`;
      }
      break;

    case 'diagnosticar':
      if (intent.etapa) {
        if (intent.etapa === 'margens' && !isAdmin) {
          content = MENSAGENS_SIGILO.sigiloLucroBdi;
        } else {
          content = diagnosticarEtapa(intent.etapa, inputs, resultados);
          actions.push({ label: '🔄 Recalcular tudo', actionId: 'recalcular_tudo' });
        }
      } else {
        content = 'Qual etapa está com problema? Diga algo como "Por que o radier está zerado?" ou "O que falta no reboco?".';
      }
      break;

    case 'recalcular':
      content = '🔄 Para recalcular, use o botão abaixo ou acesse a aba "Ações Rápidas".';
      actions.push({ label: '🔄 Recalcular tudo', actionId: 'recalcular_tudo' });
      break;

    case 'listar':
      content = `As etapas do simulador são:\n\n${Object.values(ETAPAS_CONHECIMENTO).map(e => `- **${e.nome}**: ${e.descricao.substring(0, 60)}...`).join('\n')}`;
      break;

    case 'acao':
      switch (intent.actionId) {
        case 'editar_preco':
          if (!isAdmin) {
            content = `🔒 ${MENSAGENS_SIGILO.acessoNegado}`;
            actions.push({ label: '📩 Solicitar ao Gestor', actionId: 'solicitar_gestor' });
          } else {
            content = 'Para editar preços, acesse a tela **Preços** no menu lateral.';
          }
          break;
        case 'gerar_proposta':
          content = 'Para gerar a Proposta Comercial, use o botão abaixo:';
          actions.push({ label: '📄 Gerar Proposta (Cliente)', actionId: 'gerar_proposta' });
          break;
        case 'gerar_relatorio_admin':
          if (!isAdmin) {
            content = `🔒 ${MENSAGENS_SIGILO.acessoNegado}`;
          } else {
            content = 'Para gerar o Relatório Detalhado:';
            actions.push({ label: '📊 Gerar Relatório Detalhado', actionId: 'gerar_relatorio_admin', adminOnly: true });
          }
          break;
        case 'atualizar_cub':
          if (!isAdmin) {
            content = `🔒 ${MENSAGENS_SIGILO.acessoNegado}`;
          } else {
            content = 'Vou atualizar o CUB-PA:';
            actions.push({ label: '📈 Atualizar CUB-PA', actionId: 'atualizar_cub', adminOnly: true });
          }
          break;
        case 'adicionar_pavimento':
          content = 'Use o botão abaixo para adicionar um pavimento:';
          actions.push({ label: '🏢 Adicionar Pavimento', actionId: 'adicionar_pavimento' });
          break;
        case 'adicionar_laje':
          content = 'Use o botão abaixo para adicionar uma laje:';
          actions.push({ label: '➕ Adicionar Laje', actionId: 'adicionar_laje' });
          break;
        case 'reimportar_pdf':
          content = 'Para reimportar medidas do PDF, use o botão abaixo:';
          actions.push({ label: '📑 Reimportar PDF', actionId: 'reimportar_pdf' });
          break;
        case 'modo_manual':
          content = 'Para trocar para modo manual:';
          actions.push({ label: '✏️ Modo Manual', actionId: 'modo_manual' });
          break;
        default:
          content = 'Ação não reconhecida. Tente reformular.';
      }
      break;

    default:
      content = `Não entendi completamente. Posso ajudar com:\n\n- **"Explicar [etapa]"** — ex: "explicar radier"\n- **"Por que [etapa] está zerado?"** — diagnóstico\n- **"Recalcular tudo"** — recálculo geral\n- **"Gerar proposta"** — PDF do cliente\n\nOu acesse a aba **Ações Rápidas** para botões de atalho.`;
      break;
  }

  return {
    id: crypto.randomUUID(),
    role: 'assistant',
    content,
    actions: actions.length > 0 ? actions : undefined,
    timestamp: new Date(),
  };
}
