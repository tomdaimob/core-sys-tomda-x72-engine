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

type IntentType =
  | 'explicar' | 'diagnosticar' | 'recalcular' | 'listar'
  | 'acao' | 'saudacao' | 'ajuda' | 'toggle' | 'adicionar'
  | 'importar' | 'desconhecido';

interface Intent {
  type: IntentType;
  etapa?: string;
  actionId?: string;
  target?: string;
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
  if (/^(oi|olá|ola|hey|bom dia|boa tarde|boa noite|e aí|eai)\b/.test(lower)) {
    return { type: 'saudacao' };
  }

  // Ajuda / help
  if (/^(ajuda|help|comandos|o que você faz|o que voce faz|menu)\b/.test(lower)) {
    return { type: 'ajuda' };
  }

  // Explicar / Por que / Como calcula
  if (/explicar|explica|por que|porque|como calcula|como funciona|o que é|qual a fórmula|formula|detalha|por que deu/.test(lower)) {
    return { type: 'explicar', etapa };
  }

  // Diagnóstico
  if (/está zerado|zerado|faltando|erro|problema|não calculou|nao calculou|vazio|não soma|nao soma/.test(lower)) {
    return { type: 'diagnosticar', etapa };
  }

  // Recalcular
  if (/recalcular|calcular tudo|recalc|atualizar calculo|calcular novamente/.test(lower)) {
    return { type: 'recalcular', etapa };
  }

  // Toggle (ativar/desativar)
  if (/ativar|desativar|habilitar|desabilitar/.test(lower)) {
    let target = 'unknown';
    if (/laje/.test(lower)) target = 'laje';
    else if (/radier|fundação|fundacao/.test(lower)) target = 'fundacao';
    else if (/revestimento/.test(lower)) target = 'revestimento';
    else if (/reboco/.test(lower)) target = 'reboco';
    else if (/sapata/.test(lower)) target = 'sapata';
    else if (/tela/.test(lower)) target = 'tela';
    const action = /desativar|desabilitar/.test(lower) ? 'desativar' : 'ativar';
    return { type: 'toggle', target, actionId: `${action}_${target}` };
  }

  // Importar
  if (/importar|reimportar|ler pdf|ler imagens/.test(lower)) {
    return { type: 'importar', actionId: 'reimportar_pdf' };
  }

  // Adicionar / Duplicar
  if (/adicionar|criar|duplicar|novo pavimento|nova laje/.test(lower)) {
    if (/pavimento/.test(lower)) return { type: 'adicionar', actionId: /duplicar/.test(lower) ? 'duplicar_pavimento' : 'adicionar_pavimento' };
    if (/laje/.test(lower)) return { type: 'adicionar', actionId: 'adicionar_laje' };
    if (/porta/.test(lower)) return { type: 'adicionar', actionId: 'adicionar_porta' };
    return { type: 'adicionar', etapa };
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
  if (/ver anexos|baixar planta|anexos/.test(lower)) {
    return { type: 'acao', actionId: 'ver_anexos' };
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

function formatarExplicacao(info: EtapaConhecimento, inputs: Record<string, any>, orcamento: any): string {
  let resp = '';
  if (orcamento) {
    resp += `📋 **Orçamento ${orcamento.codigo}** — ${orcamento.cliente}\n\n`;
  }
  resp += `## ${info.nome}\n\n${info.descricao}\n\n`;

  // Fonte de dados
  resp += `**Fonte dos dados:** Manual / PDF / Pavimentos\n\n`;

  resp += `### Dados de Entrada\n${info.inputs.map(i => `- ${i}`).join('\n')}\n\n`;

  // Mostrar valores reais se existirem
  const etapaKey = Object.keys(ETAPA_ALIASES).find(k => ETAPAS_CONHECIMENTO[ETAPA_ALIASES[k]] === info);
  const inputData = etapaKey ? inputs[ETAPA_ALIASES[etapaKey]] : null;
  if (inputData && Object.keys(inputData).length > 0) {
    const entries = Object.entries(inputData).filter(([, v]) => v !== null && v !== undefined && v !== '');
    if (entries.length > 0) {
      resp += `### Valores Atuais\n`;
      entries.slice(0, 10).forEach(([k, v]) => {
        resp += `- \`${k}\`: ${typeof v === 'number' ? v.toLocaleString('pt-BR') : v}\n`;
      });
      resp += `\n`;
    }
  }

  resp += `### Resultados\n${info.outputs.map(o => `- ${o}`).join('\n')}\n\n`;
  if (info.formula) {
    resp += `### Fórmula\n\`${info.formula}\`\n\n`;
  }
  if (info.observacoes?.length) {
    resp += `### Observações\n${info.observacoes.map(o => `- ${o}`).join('\n')}\n\n`;
  }
  resp += `> 💡 Resultados podem variar conforme modo de entrada (manual vs PDF) e coeficientes de perda.`;
  return resp;
}

function diagnosticarEtapa(etapa: string, inputs: Record<string, any>, resultados: any, orcamento: any): string {
  const info = ETAPAS_CONHECIMENTO[etapa];
  if (!info) return `Não encontrei a etapa "${etapa}" no sistema.`;

  const inputData = inputs[etapa];
  let resp = '';
  if (orcamento) resp += `📋 **Orçamento ${orcamento.codigo}**\n\n`;
  resp += `## Diagnóstico: ${info.nome}\n\n`;

  if (!inputData || Object.keys(inputData).length === 0) {
    resp += `⚠️ **Nenhum dado de entrada encontrado** para esta etapa.\n\n`;
    resp += `**Sugestão:** Preencha os dados manualmente ou importe do PDF do projeto.`;
    return resp;
  }

  resp += `### Dados de entrada encontrados:\n`;
  const entries = Object.entries(inputData).slice(0, 15);
  entries.forEach(([k, v]) => {
    const status = v === 0 || v === null || v === undefined ? '❌' : '✅';
    resp += `${status} \`${k}\`: ${v ?? '(vazio)'}\n`;
  });
  resp += `\n`;

  // Check for zero values
  const zeros = Object.entries(inputData).filter(([, v]) => v === 0 || v === null || v === undefined);
  if (zeros.length > 0) {
    resp += `⚠️ **${zeros.length} campo(s) zerado(s) ou vazio(s)** — isso pode estar causando resultado zero no cálculo.\n\n`;
    resp += `**Sugestão:** Reimporte o PDF ou preencha manualmente.`;
  } else {
    resp += `✅ Todos os campos de entrada possuem valores. Se o resultado ainda está zerado, verifique os preços no catálogo.`;
  }

  return resp;
}

const HELP_TEXT = `## 🏗️ Mr. Obras — Comandos Disponíveis

### 📖 Explicar cálculos
- "Explicar radier" — mostra fórmula, inputs e resultado
- "Como calcula reboco?" — detalha cálculo do reboco
- "Por que a laje deu esse valor?"

### 🔍 Diagnosticar problemas
- "Por que o radier está zerado?"
- "O que falta no reboco?"
- "Por que não soma?"

### 🔄 Recalcular
- "Recalcular tudo"
- "Calcular tudo (prédio)"

### 📥 Importação
- "Reimportar PDF"
- "Trocar para modo manual"

### 🏢 Estrutura
- "Adicionar pavimento"
- "Duplicar pavimento"
- "Adicionar laje igual"
- "Ativar/Desativar laje"
- "Ativar/Desativar radier"

### 📄 Relatórios
- "Gerar proposta (cliente)"
- "Gerar relatório detalhado" *(admin)*

### ⚙️ Administração *(admin)*
- "Atualizar CUB-PA"
- "Ver anexos"

### 📋 Outros
- "Listar etapas" — mostra todas as etapas
- "Ajuda" — este menu`;

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
      content = `Olá! Sou o **Mr. Obras Assistente** 🏗️\n\nEstou aqui para ajudar com o orçamento${orcamento ? ` **${orcamento.codigo}** (${orcamento.cliente})` : ''}.\n\nPosso:\n- Explicar qualquer cálculo\n- Diagnosticar valores zerados\n- Executar ações no orçamento\n\nDigite **"ajuda"** para ver todos os comandos.`;
      break;

    case 'ajuda':
      content = HELP_TEXT;
      break;

    case 'explicar':
      if (intent.etapa && ETAPAS_CONHECIMENTO[intent.etapa]) {
        const info = ETAPAS_CONHECIMENTO[intent.etapa];
        if (intent.etapa === 'margens' && !isAdmin) {
          content = `## Desconto Comercial\n\nVocê pode solicitar desconto comercial para o cliente. ${MENSAGENS_SIGILO.sigiloLucroBdi}`;
        } else {
          content = formatarExplicacao(info, inputs, orcamento);
        }
        actions.push({ label: '🔄 Recalcular tudo', actionId: 'recalcular_tudo' });
      } else {
        content = `Sobre qual etapa você quer saber? As etapas disponíveis são:\n\n${Object.values(ETAPAS_CONHECIMENTO).map(e => `- **${e.nome}**`).join('\n')}\n\nDigite: "explicar [nome da etapa]"`;
      }
      break;

    case 'diagnosticar':
      if (intent.etapa) {
        if (intent.etapa === 'margens' && !isAdmin) {
          content = MENSAGENS_SIGILO.sigiloLucroBdi;
        } else {
          content = diagnosticarEtapa(intent.etapa, inputs, resultados, orcamento);
          actions.push(
            { label: '🔄 Recalcular tudo', actionId: 'recalcular_tudo' },
            { label: '📥 Reimportar PDF', actionId: 'reimportar_pdf' },
          );
        }
      } else {
        content = 'Qual etapa está com problema? Diga algo como:\n- "Por que o radier está zerado?"\n- "O que falta no reboco?"\n- "Por que a laje não soma?"';
      }
      break;

    case 'recalcular':
      content = '🔄 Para recalcular, use o botão abaixo ou salve o orçamento. Os cálculos são atualizados automaticamente.';
      actions.push(
        { label: '🔄 Recalcular tudo', actionId: 'recalcular_tudo' },
        { label: '🏢 Calcular prédio', actionId: 'calcular_predio' },
      );
      break;

    case 'toggle':
      content = `Para ${intent.actionId?.startsWith('ativar') ? 'ativar' : 'desativar'} **${intent.target}**, acesse a aba correspondente no orçamento e use o toggle/checkbox.`;
      actions.push({ label: `⚡ ${intent.actionId?.startsWith('ativar') ? 'Ativar' : 'Desativar'} ${intent.target}`, actionId: intent.actionId || '' });
      break;

    case 'importar':
      content = 'Para reimportar medidas, use o botão abaixo ou acesse a aba "Projeto".';
      actions.push(
        { label: '📥 Reimportar PDF', actionId: 'reimportar_pdf' },
        { label: '✏️ Modo Manual', actionId: 'modo_manual' },
      );
      break;

    case 'adicionar':
      switch (intent.actionId) {
        case 'adicionar_pavimento':
          content = 'Para adicionar um pavimento, use o botão abaixo:';
          actions.push({ label: '🏢 Adicionar Pavimento', actionId: 'adicionar_pavimento' });
          break;
        case 'duplicar_pavimento':
          content = 'Para duplicar um pavimento, acesse a aba "Paredes" e use a opção de duplicação no pavimento desejado.';
          break;
        case 'adicionar_laje':
          content = 'Para adicionar uma laje, use o botão abaixo:';
          actions.push({ label: '➕ Adicionar Laje', actionId: 'adicionar_laje' });
          break;
        default:
          content = 'O que deseja adicionar? Diga "adicionar pavimento", "adicionar laje" ou "duplicar pavimento".';
      }
      break;

    case 'listar':
      content = `As etapas do simulador são:\n\n${Object.values(ETAPAS_CONHECIMENTO).map(e => `- **${e.nome}**: ${e.descricao.substring(0, 80)}...`).join('\n')}`;
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
          content = 'Para gerar a Proposta Comercial:';
          actions.push({ label: '📄 Gerar Proposta (Cliente)', actionId: 'gerar_proposta' });
          break;
        case 'gerar_relatorio_admin':
          if (!isAdmin) {
            content = `🔒 ${MENSAGENS_SIGILO.acessoNegado}\n\nPosso registrar a solicitação para o Gestor.`;
            actions.push({ label: '📩 Solicitar ao Gestor', actionId: 'solicitar_gestor' });
          } else {
            content = 'Para gerar o Relatório Detalhado:';
            actions.push({ label: '📊 Gerar Relatório Detalhado', actionId: 'gerar_relatorio_admin', adminOnly: true });
          }
          break;
        case 'atualizar_cub':
          if (!isAdmin) {
            content = `🔒 ${MENSAGENS_SIGILO.acessoNegado}`;
            actions.push({ label: '📩 Solicitar ao Gestor', actionId: 'solicitar_gestor' });
          } else {
            content = 'Vou atualizar o CUB-PA:';
            actions.push({ label: '📈 Atualizar CUB-PA', actionId: 'atualizar_cub', adminOnly: true });
          }
          break;
        case 'ver_anexos':
          if (!isAdmin) {
            content = `🔒 ${MENSAGENS_SIGILO.acessoNegado}`;
          } else {
            content = 'Os anexos estão disponíveis na aba "Relatórios" do orçamento.';
            actions.push({ label: '📎 Ver Anexos', actionId: 'ver_anexos', adminOnly: true });
          }
          break;
        case 'modo_manual':
          content = 'Para trocar para modo manual:';
          actions.push({ label: '✏️ Modo Manual', actionId: 'modo_manual' });
          break;
        default:
          content = 'Ação não reconhecida. Digite **"ajuda"** para ver os comandos disponíveis.';
      }
      break;

    default:
      if (intent.etapa && ETAPAS_CONHECIMENTO[intent.etapa]) {
        content = `Entendi que você está perguntando sobre **${ETAPAS_CONHECIMENTO[intent.etapa].nome}**. O que deseja?\n\n- "Explicar ${intent.etapa}" — ver fórmula e dados\n- "Por que ${intent.etapa} está zerado?" — diagnóstico`;
        actions.push(
          { label: `📖 Explicar ${ETAPAS_CONHECIMENTO[intent.etapa].nome}`, actionId: 'explicar_etapa', params: { etapa: intent.etapa } },
        );
      } else {
        content = `Não entendi completamente. Digite **"ajuda"** para ver os comandos disponíveis.\n\nExemplos rápidos:\n- "Explicar radier"\n- "Por que reboco está zerado?"\n- "Recalcular tudo"\n- "Gerar proposta"`;
      }
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
