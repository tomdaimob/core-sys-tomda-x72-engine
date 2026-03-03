// Mr. Obras — Pipeline conversacional: classify → gather → analyze → respond
import { supabase } from '@/integrations/supabase/client';
import { ETAPAS_CONHECIMENTO, MENSAGENS_SIGILO, type EtapaConhecimento } from './mr-obras-knowledge';
import type { ChatAction } from './mr-obras-chat';

// ── Types ──────────────────────────────────────────────────────────

export interface PipelineContext {
  orcamento: any | null;
  inputs: Record<string, any>;
  resultados: any | null;
  pavimentos: any[];
  arquivos: any[];
  extracoes: any[];
}

export type IntentType =
  | 'explicar' | 'diagnosticar' | 'quanto_deu' | 'recalcular'
  | 'listar' | 'toggle' | 'adicionar' | 'importar'
  | 'acao' | 'saudacao' | 'ajuda' | 'desconhecido';

export interface Intent {
  type: IntentType;
  etapa?: string;
  actionId?: string;
  target?: string;
  raw: string;
}

export interface PipelineResult {
  content: string;
  actions: ChatAction[];
  sources: string[];  // e.g. ['DB', 'Manual', 'IA']
}

// ── Etapa aliases ──────────────────────────────────────────────────

const ETAPA_ALIASES: Record<string, string> = {
  parede: 'paredes', paredes: 'paredes', 'parede icf': 'paredes',
  reboco: 'reboco', icflex: 'reboco',
  revestimento: 'revestimento', ceramica: 'revestimento', porcelanato: 'revestimento',
  radier: 'radier', fundação: 'radier', fundacao: 'radier',
  baldrame: 'baldrame',
  sapata: 'sapata', sapatas: 'sapata',
  laje: 'laje', lajes: 'laje',
  acabamento: 'acabamentos', acabamentos: 'acabamentos', piso: 'acabamentos', pintura: 'acabamentos',
  porta: 'portas_portoes', portas: 'portas_portoes', portão: 'portas_portoes', portoes: 'portas_portoes',
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

// ── 1. Classify Intent ─────────────────────────────────────────────

export function classifyIntent(text: string): Intent {
  const lower = text.toLowerCase().trim();
  const etapa = detectarEtapa(lower);

  if (/^(oi|olá|ola|hey|bom dia|boa tarde|boa noite|e aí|eai)\b/.test(lower))
    return { type: 'saudacao', raw: text };

  if (/^(ajuda|help|comandos|o que você faz|o que voce faz|menu)\b/.test(lower))
    return { type: 'ajuda', raw: text };

  // "quanto deu" / "qual o valor" / "qual o total"
  if (/quanto (deu|custou|ficou)|qual o (valor|total|custo)|valor do|total do|custo do/.test(lower))
    return { type: 'quanto_deu', etapa, raw: text };

  if (/explicar|explica|por que|porque|como calcula|como funciona|o que é|qual a fórmula|formula|detalha|de onde (saiu|veio)/.test(lower))
    return { type: 'explicar', etapa, raw: text };

  if (/está zerado|zerado|faltando|erro|problema|não calculou|nao calculou|vazio|não soma|nao soma|não (está )?salvando|nao (esta )?salvando|misturou|não atualiz/.test(lower))
    return { type: 'diagnosticar', etapa, raw: text };

  if (/recalcular|calcular tudo|recalc|atualizar calculo|calcular novamente/.test(lower))
    return { type: 'recalcular', etapa, raw: text };

  if (/ativar|desativar|habilitar|desabilitar/.test(lower)) {
    let target = 'unknown';
    if (/laje/.test(lower)) target = 'laje';
    else if (/radier|fundação|fundacao/.test(lower)) target = 'fundacao';
    else if (/revestimento/.test(lower)) target = 'revestimento';
    else if (/reboco/.test(lower)) target = 'reboco';
    else if (/sapata/.test(lower)) target = 'sapata';
    else if (/tela/.test(lower)) target = 'tela';
    const action = /desativar|desabilitar/.test(lower) ? 'desativar' : 'ativar';
    return { type: 'toggle', target, actionId: `${action}_${target}`, raw: text };
  }

  if (/importar|reimportar|ler pdf|ler imagens/.test(lower))
    return { type: 'importar', actionId: 'reimportar_pdf', raw: text };

  if (/adicionar|criar|duplicar|novo pavimento|nova laje/.test(lower)) {
    if (/pavimento/.test(lower)) return { type: 'adicionar', actionId: /duplicar/.test(lower) ? 'duplicar_pavimento' : 'adicionar_pavimento', raw: text };
    if (/laje/.test(lower)) return { type: 'adicionar', actionId: 'adicionar_laje', raw: text };
    if (/porta/.test(lower)) return { type: 'adicionar', actionId: 'adicionar_porta', raw: text };
    return { type: 'adicionar', etapa, raw: text };
  }

  if (/gerar proposta|gerar pdf|pdf cliente/.test(lower))
    return { type: 'acao', actionId: 'gerar_proposta', raw: text };
  if (/relatório detalhado|relatorio detalhado|pdf admin/.test(lower))
    return { type: 'acao', actionId: 'gerar_relatorio_admin', raw: text };
  if (/atualizar cub|cub-pa|cub pa/.test(lower))
    return { type: 'acao', actionId: 'atualizar_cub', raw: text };
  if (/ver anexos|baixar planta|anexos/.test(lower))
    return { type: 'acao', actionId: 'ver_anexos', raw: text };
  if (/modo manual|manual/.test(lower))
    return { type: 'acao', actionId: 'modo_manual', raw: text };
  if (/listar|quais etapas|etapas/.test(lower))
    return { type: 'listar', raw: text };
  if (/preço|preco|aumenta|diminui|alterar preço|editar preço/.test(lower))
    return { type: 'acao', actionId: 'editar_preco', raw: text };

  return { type: 'desconhecido', etapa, raw: text };
}

// ── 2. Gather Context (fresh from DB) ──────────────────────────────

export async function gatherContext(orcamentoId: string | null): Promise<PipelineContext> {
  if (!orcamentoId) return { orcamento: null, inputs: {}, resultados: null, pavimentos: [], arquivos: [], extracoes: [] };

  const [orcRes, inputsRes, resultRes, pavRes, arqRes, extRes] = await Promise.all([
    supabase.from('orcamentos').select('*').eq('id', orcamentoId).single(),
    supabase.from('orcamento_inputs').select('*').eq('orcamento_id', orcamentoId),
    supabase.from('orcamento_resultados').select('*').eq('orcamento_id', orcamentoId).single(),
    supabase.from('orcamento_pavimentos').select('*').eq('orcamento_id', orcamentoId).order('ordem'),
    supabase.from('arquivos').select('*').eq('orcamento_id', orcamentoId).eq('ativo', true),
    supabase.from('ia_extracoes').select('*').eq('orcamento_id', orcamentoId).order('created_at', { ascending: false }).limit(10),
  ]);

  const inputsMap: Record<string, any> = {};
  (inputsRes.data || []).forEach((inp: any) => { inputsMap[inp.etapa] = inp.dados; });

  return {
    orcamento: orcRes.data,
    inputs: inputsMap,
    resultados: resultRes.data,
    pavimentos: pavRes.data || [],
    arquivos: arqRes.data || [],
    extracoes: extRes.data || [],
  };
}

// ── 3. Investigation helpers ───────────────────────────────────────

interface StageInspection {
  etapaKey: string;
  nome: string;
  inputData: Record<string, any> | null;
  resultadoData: any | null;
  missingFields: string[];
  zeroFields: string[];
  totalFields: number;
  hasData: boolean;
}

function inspectStage(etapa: string, ctx: PipelineContext): StageInspection {
  const info = ETAPAS_CONHECIMENTO[etapa];
  const inputData = ctx.inputs[etapa] || null;
  const resultadoData = ctx.resultados?.[etapa] || null;

  const missing: string[] = [];
  const zeros: string[] = [];
  let total = 0;

  if (inputData && typeof inputData === 'object') {
    for (const [k, v] of Object.entries(inputData)) {
      total++;
      if (v === null || v === undefined || v === '') missing.push(k);
      else if (v === 0) zeros.push(k);
    }
  }

  return {
    etapaKey: etapa,
    nome: info?.nome || etapa,
    inputData,
    resultadoData,
    missingFields: missing,
    zeroFields: zeros,
    totalFields: total,
    hasData: total > 0 && missing.length < total,
  };
}

function formatCurrency(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return 'R$ 0,00';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatNum(v: number | null | undefined, decimals = 2): string {
  if (v == null || isNaN(v)) return '0';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ── 4. Generate natural response ───────────────────────────────────

export async function processarMensagemAsync(
  text: string,
  isAdmin: boolean,
  orcamentoId: string | null,
  /** Pass cached context to avoid re-fetching when not needed */
  cachedCtx?: PipelineContext,
): Promise<PipelineResult> {
  const intent = classifyIntent(text);
  const sources: string[] = [];

  // Intents that don't need DB
  if (intent.type === 'saudacao') {
    if (orcamentoId && !cachedCtx) {
      const ctx = await gatherContext(orcamentoId);
      sources.push('DB');
      return {
        content: ctx.orcamento
          ? `Olá! Estou aqui para ajudar com o orçamento **${ctx.orcamento.codigo}** (${ctx.orcamento.cliente}). O que você precisa?`
          : `Olá! Não encontrei um orçamento aberto. Abra um orçamento para eu poder ajudar.`,
        actions: [],
        sources,
      };
    }
    return { content: 'Olá! Abra um orçamento e me pergunte qualquer coisa sobre os cálculos.', actions: [], sources };
  }

  if (intent.type === 'ajuda') {
    return {
      content: `Pode me perguntar naturalmente! Alguns exemplos:\n\n- "Quanto deu o radier?"\n- "Por que o reboco está zerado?"\n- "Explicar como calcula a laje"\n- "Recalcular tudo"\n- "Reimportar PDF"\n- "Adicionar pavimento"\n- "Gerar proposta"\n\nSó perguntar que eu pesquiso no sistema e respondo 👷`,
      actions: [],
      sources: [],
    };
  }

  // All other intents require an orcamento
  if (!orcamentoId) {
    return { content: 'Preciso que você abra um orçamento para eu poder consultar os dados e responder. Selecione um orçamento na lista ou crie um novo.', actions: [], sources: [] };
  }

  // Gather fresh context from DB
  const ctx = cachedCtx || await gatherContext(orcamentoId);
  sources.push('DB');

  const orc = ctx.orcamento;
  if (!orc) {
    return { content: 'Não encontrei esse orçamento no sistema. Verifique se ele ainda existe.', actions: [], sources };
  }

  // ── Handle each intent ───────────────────────────────────────────

  switch (intent.type) {
    case 'quanto_deu':
      return handleQuantoDeu(intent, ctx, isAdmin, sources);

    case 'explicar':
      return handleExplicar(intent, ctx, isAdmin, sources);

    case 'diagnosticar':
      return handleDiagnosticar(intent, ctx, isAdmin, sources);

    case 'recalcular':
      return handleRecalcular(ctx, sources);

    case 'importar':
      return { content: 'Entendi. Para reimportar, use o botão abaixo — ele vai reprocessar o PDF ativo e atualizar as medidas.', actions: [{ label: '📥 Reimportar PDF', actionId: 'reimportar_pdf' }, { label: '✏️ Modo Manual', actionId: 'modo_manual' }], sources };

    case 'adicionar':
      return handleAdicionar(intent, sources);

    case 'toggle':
      return { content: `Certo — para ${intent.actionId?.startsWith('ativar') ? 'ativar' : 'desativar'} **${intent.target}**, use o toggle na aba correspondente do orçamento.`, actions: [{ label: `⚡ ${intent.actionId?.startsWith('ativar') ? 'Ativar' : 'Desativar'} ${intent.target}`, actionId: intent.actionId || '' }], sources };

    case 'listar':
      return { content: `O simulador tem ${Object.keys(ETAPAS_CONHECIMENTO).length} etapas:\n\n${Object.values(ETAPAS_CONHECIMENTO).map(e => `• **${e.nome}**`).join('\n')}\n\nSobre qual quer saber?`, actions: [], sources };

    case 'acao':
      return handleAcao(intent, ctx, isAdmin, sources);

    default:
      // If we detected an etapa, give something useful
      if (intent.etapa && ETAPAS_CONHECIMENTO[intent.etapa]) {
        const insp = inspectStage(intent.etapa, ctx);
        if (!insp.hasData) {
          return { content: `Sobre **${insp.nome}**: ainda não encontrei dados preenchidos para essa etapa. Quer que eu importe do PDF ou prefere preencher manualmente?`, actions: [{ label: '📥 Reimportar PDF', actionId: 'reimportar_pdf' }, { label: '✏️ Manual', actionId: 'modo_manual' }], sources };
        }
        return { content: `Entendi que está perguntando sobre **${insp.nome}**. Pode ser mais específico? Por exemplo:\n- "Quanto deu ${intent.etapa}?"\n- "Por que ${intent.etapa} está zerado?"\n- "Explicar ${intent.etapa}"`, actions: [{ label: `📖 Explicar ${insp.nome}`, actionId: 'explicar_etapa', params: { etapa: intent.etapa } }], sources };
      }
      return { content: 'Não entendi completamente. Pode reformular? Exemplos: "quanto deu o radier?", "por que o reboco está zerado?", "explicar laje".', actions: [], sources };
  }
}

// ── Intent handlers ────────────────────────────────────────────────

function handleQuantoDeu(intent: Intent, ctx: PipelineContext, isAdmin: boolean, sources: string[]): PipelineResult {
  const etapa = intent.etapa;
  const res = ctx.resultados;
  const orc = ctx.orcamento;
  const actions: ChatAction[] = [];

  // Sigilo
  if (etapa === 'margens' && !isAdmin) {
    return { content: MENSAGENS_SIGILO.sigiloLucroBdi, actions: [], sources };
  }

  // Total geral
  if (!etapa || /total|geral|orçamento|orcamento/.test(intent.raw.toLowerCase())) {
    const totalPredio = res?.total_geral_predio ?? 0;
    const fundacao = res?.fundacao_total ?? 0;
    const consolidado = res?.consolidado || {};
    let resp = `No orçamento **${orc.codigo}** (${orc.cliente}), o total geral está em **${formatCurrency(totalPredio)}**.`;
    if (fundacao > 0) resp += ` A fundação contribui com ${formatCurrency(fundacao)}.`;
    if (consolidado.custo_direto_total) resp += ` O custo direto total é ${formatCurrency(consolidado.custo_direto_total)}.`;
    actions.push({ label: '🔄 Recalcular', actionId: 'recalcular_tudo' });
    return { content: resp, actions, sources };
  }

  // Etapa específica
  if (etapa && res) {
    const etapaData = res[etapa];
    if (etapa === 'radier') {
      const radier = res.radier || {};
      const custoTotal = radier.radier_custo_total ?? radier.custo_total ?? 0;
      const fundacao = res.fundacao_total ?? 0;
      let resp = `O **Radier** está com custo total de **${formatCurrency(custoTotal)}**.`;
      if (radier.radier_custo_concreto) resp += ` Concreto: ${formatCurrency(radier.radier_custo_concreto)}.`;
      if (radier.radier_custo_tela || radier.custo_tela) resp += ` Tela soldada: ${formatCurrency(radier.radier_custo_tela || radier.custo_tela)}.`;
      if (radier.radier_custo_mao_obra || radier.custo_mao_obra) resp += ` Mão de obra: ${formatCurrency(radier.radier_custo_mao_obra || radier.custo_mao_obra)}.`;
      resp += ` O total da fundação (incluindo baldrame/sapata se houver) é ${formatCurrency(fundacao)}.`;
      return { content: resp, actions: [{ label: '🔄 Recalcular', actionId: 'recalcular_tudo' }], sources };
    }

    if (etapa === 'paredes') {
      const area = res.paredes_total_area_m2 ?? 0;
      const paredesData = res.paredes || {};
      let resp = `As **Paredes** totalizam **${formatNum(area)} m²** de área.`;
      if (paredesData.custo_paredes) resp += ` Custo: ${formatCurrency(paredesData.custo_paredes)}.`;
      return { content: resp, actions: [], sources };
    }

    if (etapa === 'reboco') {
      const ext = res.reboco_total_area_externo_m2 ?? 0;
      const int = res.reboco_total_area_interno_m2 ?? 0;
      const rebocoData = res.reboco || {};
      let resp = `O **Reboco** tem ${formatNum(ext)} m² externo e ${formatNum(int)} m² interno.`;
      if (rebocoData.custo_reboco) resp += ` Custo total: ${formatCurrency(rebocoData.custo_reboco)}.`;
      return { content: resp, actions: [], sources };
    }

    if (etapa === 'laje') {
      const area = res.laje_total_area_m2 ?? 0;
      const vol = res.laje_total_volume_m3 ?? 0;
      const lajeData = res.laje || {};
      let resp = `A **Laje** tem ${formatNum(area)} m² de área e ${formatNum(vol)} m³ de volume.`;
      if (lajeData.custo_laje) resp += ` Custo: ${formatCurrency(lajeData.custo_laje)}.`;
      return { content: resp, actions: [], sources };
    }

    // Generic fallback for other etapas
    if (etapaData && typeof etapaData === 'object') {
      const custoKeys = Object.keys(etapaData).filter(k => k.includes('custo') || k.includes('total'));
      if (custoKeys.length > 0) {
        let resp = `Sobre **${ETAPAS_CONHECIMENTO[etapa]?.nome || etapa}**:\n`;
        custoKeys.slice(0, 5).forEach(k => {
          resp += `• ${k}: ${typeof etapaData[k] === 'number' ? formatCurrency(etapaData[k]) : etapaData[k]}\n`;
        });
        return { content: resp, actions: [], sources };
      }
    }

    return { content: `Não encontrei resultados calculados para **${ETAPAS_CONHECIMENTO[etapa]?.nome || etapa}** neste orçamento. Pode ser que falte preencher os dados de entrada ou recalcular.`, actions: [{ label: '🔄 Recalcular', actionId: 'recalcular_tudo' }], sources };
  }

  return { content: 'Sobre qual etapa quer saber o valor? Exemplos: "quanto deu o radier?", "quanto deu a laje?"', actions: [], sources };
}

function handleExplicar(intent: Intent, ctx: PipelineContext, isAdmin: boolean, sources: string[]): PipelineResult {
  const etapa = intent.etapa;
  if (!etapa || !ETAPAS_CONHECIMENTO[etapa]) {
    return { content: `Sobre qual etapa quer a explicação? Temos: ${Object.values(ETAPAS_CONHECIMENTO).map(e => e.nome).join(', ')}.`, actions: [], sources };
  }

  if (etapa === 'margens' && !isAdmin) {
    return { content: `Sobre o desconto comercial: você pode solicitar desconto para o cliente, e o Gestor aprova. ${MENSAGENS_SIGILO.sigiloLucroBdi}`, actions: [], sources };
  }

  const info = ETAPAS_CONHECIMENTO[etapa];
  const insp = inspectStage(etapa, ctx);
  const orc = ctx.orcamento;

  let resp = `Vamos ver o **${info.nome}** no orçamento ${orc.codigo}.\n\n`;
  resp += `${info.descricao}\n\n`;

  if (info.formula) resp += `**Fórmula:** \`${info.formula}\`\n\n`;

  // Show actual values
  if (insp.hasData && insp.inputData) {
    resp += `**Dados de entrada encontrados:**\n`;
    const entries = Object.entries(insp.inputData).filter(([, v]) => v != null && v !== '');
    entries.slice(0, 8).forEach(([k, v]) => {
      resp += `• \`${k}\`: ${typeof v === 'number' ? formatNum(v) : v}\n`;
    });
    if (insp.zeroFields.length > 0) {
      resp += `\n⚠️ Campos zerados: ${insp.zeroFields.slice(0, 5).map(f => `\`${f}\``).join(', ')}`;
    }
  } else {
    resp += `⚠️ Nenhum dado de entrada preenchido ainda para essa etapa.`;
  }

  // Show result if available
  if (insp.resultadoData) {
    const custoKeys = Object.entries(insp.resultadoData).filter(([k]) => k.includes('custo') || k.includes('total'));
    if (custoKeys.length > 0) {
      resp += `\n\n**Resultados:**\n`;
      custoKeys.slice(0, 5).forEach(([k, v]) => {
        resp += `• ${k}: ${typeof v === 'number' ? formatCurrency(v as number) : v}\n`;
      });
    }
  }

  if (info.observacoes?.length) {
    resp += `\n\n💡 ${info.observacoes[0]}`;
  }

  const actions: ChatAction[] = [{ label: '🔄 Recalcular', actionId: 'recalcular_tudo' }];
  if (!insp.hasData) actions.push({ label: '📥 Reimportar', actionId: 'reimportar_pdf' });

  return { content: resp, actions, sources };
}

function handleDiagnosticar(intent: Intent, ctx: PipelineContext, isAdmin: boolean, sources: string[]): PipelineResult {
  const etapa = intent.etapa;

  if (etapa === 'margens' && !isAdmin) {
    return { content: MENSAGENS_SIGILO.sigiloLucroBdi, actions: [], sources };
  }

  if (!etapa) {
    // General diagnostics — look for zero totals
    const res = ctx.resultados;
    const problems: string[] = [];
    if (res) {
      if ((res.paredes_total_area_m2 ?? 0) === 0) problems.push('Paredes (área 0)');
      if ((res.fundacao_total ?? 0) === 0) problems.push('Fundação (custo 0)');
      if ((res.laje_total_area_m2 ?? 0) === 0) problems.push('Laje (área 0)');
      if ((res.reboco_total_area_externo_m2 ?? 0) === 0 && (res.reboco_total_area_interno_m2 ?? 0) === 0) problems.push('Reboco (área 0)');
    }
    if (problems.length > 0) {
      return { content: `Encontrei possíveis problemas no orçamento **${ctx.orcamento.codigo}**:\n\n${problems.map(p => `⚠️ ${p}`).join('\n')}\n\nMe diga qual etapa quer investigar e eu busco os detalhes.`, actions: [{ label: '🔄 Recalcular tudo', actionId: 'recalcular_tudo' }], sources };
    }
    return { content: 'Qual etapa está com problema? Pode dizer: "por que o radier está zerado?" ou "por que reboco não calcula?"', actions: [], sources };
  }

  const insp = inspectStage(etapa, ctx);
  const info = ETAPAS_CONHECIMENTO[etapa];
  if (!info) return { content: `Não encontrei a etapa "${etapa}" no sistema.`, actions: [], sources };

  let resp = `Vou investigar o **${insp.nome}** no orçamento ${ctx.orcamento.codigo}.\n\n`;

  if (!insp.hasData) {
    resp += `❌ **Nenhum dado de entrada encontrado** — essa é a causa raiz. Sem inputs, o sistema não consegue calcular nada.\n\n`;
    resp += `**Próximo passo:** importe o PDF do projeto ou preencha os dados manualmente.`;
    return { content: resp, actions: [{ label: '📥 Reimportar PDF', actionId: 'reimportar_pdf' }, { label: '✏️ Manual', actionId: 'modo_manual' }], sources };
  }

  // Has data — check for issues
  if (insp.missingFields.length > 0) {
    resp += `Encontrei **${insp.missingFields.length} campo(s) vazio(s)**: ${insp.missingFields.slice(0, 5).map(f => `\`${f}\``).join(', ')}.\n\n`;
  }
  if (insp.zeroFields.length > 0) {
    resp += `Encontrei **${insp.zeroFields.length} campo(s) zerado(s)**: ${insp.zeroFields.slice(0, 5).map(f => `\`${f}\``).join(', ')}.\n\n`;
  }

  if (insp.missingFields.length === 0 && insp.zeroFields.length === 0) {
    resp += `✅ Todos os campos de entrada possuem valores. `;
    // Check if result is zero
    const resultadoEtapa = ctx.resultados?.[etapa];
    if (resultadoEtapa) {
      const custos = Object.entries(resultadoEtapa).filter(([k, v]) => k.includes('custo') && v === 0);
      if (custos.length > 0) {
        resp += `Porém, os custos estão zerados — verifique se os **preços no catálogo** estão configurados para essa etapa.`;
      } else {
        resp += `Os resultados parecem calculados corretamente. Tente recalcular para atualizar.`;
      }
    } else {
      resp += `Mas não encontrei resultados calculados. Tente recalcular.`;
    }
  } else {
    resp += `Esses campos vazios/zerados provavelmente estão impedindo o cálculo. `;
    // Check for common root causes
    if (etapa === 'reboco' && (insp.zeroFields.includes('paredes_area_externa_m2') || insp.zeroFields.includes('area_parede_externa_m2'))) {
      resp += `Como a área de paredes externas está 0, o reboco externo não calcula. Verifique a aba **Paredes** primeiro.`;
    } else if (etapa === 'revestimento' && insp.zeroFields.some(f => f.includes('area'))) {
      resp += `A área base está zerada — verifique se as medidas das paredes e o material estão configurados.`;
    } else {
      resp += `Reimporte do PDF ou preencha manualmente.`;
    }
  }

  const actions: ChatAction[] = [
    { label: '🔄 Recalcular', actionId: 'recalcular_tudo' },
    { label: '📥 Reimportar PDF', actionId: 'reimportar_pdf' },
  ];

  return { content: resp, actions, sources };
}

function handleRecalcular(ctx: PipelineContext, sources: string[]): PipelineResult {
  return {
    content: `Certo — para recalcular o orçamento **${ctx.orcamento.codigo}**, use o botão abaixo. O sistema vai reprocessar todos os cálculos com os dados atuais.`,
    actions: [
      { label: '🔄 Recalcular tudo', actionId: 'recalcular_tudo' },
      ...(ctx.pavimentos.length > 0 ? [{ label: '🏢 Calcular prédio', actionId: 'calcular_predio' }] : []),
    ],
    sources,
  };
}

function handleAdicionar(intent: Intent, sources: string[]): PipelineResult {
  switch (intent.actionId) {
    case 'adicionar_pavimento':
      return { content: 'Certo, vou adicionar um pavimento. Use o botão abaixo:', actions: [{ label: '🏢 Adicionar Pavimento', actionId: 'adicionar_pavimento' }], sources };
    case 'duplicar_pavimento':
      return { content: 'Para duplicar, acesse a aba Paredes e use a opção de duplicação no pavimento desejado.', actions: [], sources };
    case 'adicionar_laje':
      return { content: 'Para adicionar uma laje, use o botão abaixo:', actions: [{ label: '➕ Adicionar Laje', actionId: 'adicionar_laje' }], sources };
    default:
      return { content: 'O que quer adicionar? Diga "adicionar pavimento", "adicionar laje" ou "duplicar pavimento".', actions: [], sources };
  }
}

function handleAcao(intent: Intent, ctx: PipelineContext, isAdmin: boolean, sources: string[]): PipelineResult {
  switch (intent.actionId) {
    case 'editar_preco':
      if (!isAdmin) return { content: `🔒 Editar preços requer permissão do Gestor. Posso registrar a solicitação se quiser.`, actions: [{ label: '📩 Solicitar ao Gestor', actionId: 'solicitar_gestor' }], sources };
      return { content: 'Para editar preços, acesse a tela **Preços** no menu lateral.', actions: [], sources };

    case 'gerar_proposta':
      return { content: `Certo — para gerar a Proposta Comercial do orçamento ${ctx.orcamento.codigo}:`, actions: [{ label: '📄 Gerar Proposta', actionId: 'gerar_proposta' }], sources };

    case 'gerar_relatorio_admin':
      if (!isAdmin) return { content: `🔒 O relatório detalhado é restrito a Gestores. Posso registrar a solicitação.`, actions: [{ label: '📩 Solicitar ao Gestor', actionId: 'solicitar_gestor' }], sources };
      return { content: 'Para gerar o relatório detalhado:', actions: [{ label: '📊 Relatório Detalhado', actionId: 'gerar_relatorio_admin', adminOnly: true }], sources };

    case 'atualizar_cub':
      if (!isAdmin) return { content: '🔒 Atualizar o CUB-PA requer permissão de Gestor.', actions: [{ label: '📩 Solicitar ao Gestor', actionId: 'solicitar_gestor' }], sources };
      return { content: 'Vou atualizar o CUB-PA:', actions: [{ label: '📈 Atualizar CUB-PA', actionId: 'atualizar_cub', adminOnly: true }], sources };

    case 'ver_anexos':
      if (!isAdmin) return { content: '🔒 Visualização de anexos restrita a Gestores.', actions: [], sources };
      return { content: `O orçamento tem ${ctx.arquivos.length} arquivo(s) ativo(s). Acesse na aba Relatórios.`, actions: [{ label: '📎 Ver Anexos', actionId: 'ver_anexos', adminOnly: true }], sources };

    case 'modo_manual':
      return { content: 'Para trocar para modo manual:', actions: [{ label: '✏️ Modo Manual', actionId: 'modo_manual' }], sources };

    default:
      return { content: 'Ação não reconhecida. Me diga o que precisa em linguagem natural!', actions: [], sources };
  }
}
