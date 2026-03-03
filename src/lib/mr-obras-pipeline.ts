// Mr. Obras — Pipeline conversacional: classify → gather → analyze → respond
import { supabase } from '@/integrations/supabase/client';
import { ETAPAS_CONHECIMENTO, MENSAGENS_SIGILO } from './mr-obras-knowledge';
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
  sources: string[];
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

  if (/quanto (deu|custou|ficou)|qual o (valor|total|custo)|valor do|total do|custo do|quanto está|quanto esta/.test(lower))
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

export async function gatherContext(orcamentoId: string): Promise<PipelineContext> {
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

/** Detect global issues across all stages */
function detectGlobalIssues(ctx: PipelineContext): string[] {
  const issues: string[] = [];
  const res = ctx.resultados;

  if (!res) {
    issues.push('Nenhum resultado calculado ainda — o orçamento precisa ser calculado.');
    return issues;
  }

  if ((res.paredes_total_area_m2 ?? 0) === 0) issues.push('**Paredes**: área total 0 m²');
  if ((res.fundacao_total ?? 0) === 0) issues.push('**Fundação**: custo total R$ 0');
  if ((res.laje_total_area_m2 ?? 0) === 0) issues.push('**Laje**: área 0 m²');
  if ((res.reboco_total_area_externo_m2 ?? 0) === 0 && (res.reboco_total_area_interno_m2 ?? 0) === 0)
    issues.push('**Reboco**: áreas externo e interno ambos 0 m²');

  if (ctx.arquivos.length === 0) issues.push('**Sem arquivo ativo** — nenhum PDF ou imagem enviado');

  const pendingPavs = ctx.pavimentos.filter(p => p.status === 'PENDENTE' || p.status === 'AGUARDANDO_CONFIRMACAO');
  if (pendingPavs.length > 0)
    issues.push(`**${pendingPavs.length} pavimento(s)** pendente(s) de confirmação`);

  return issues;
}

function fmt$(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return 'R$ 0,00';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtN(v: number | null | undefined, d = 2): string {
  if (v == null || isNaN(v)) return '0';
  return v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ── 4. Main pipeline ───────────────────────────────────────────────

export async function processarMensagemAsync(
  text: string,
  isAdmin: boolean,
  orcamentoId: string | null,
): Promise<PipelineResult> {
  const intent = classifyIntent(text);

  // ── Intents that DON'T need DB ──
  if (intent.type === 'saudacao') {
    if (!orcamentoId) return ok('Olá! Abra um orçamento para que eu possa consultar os dados e te ajudar.');
    const ctx = await gatherContext(orcamentoId);
    if (!ctx.orcamento) return ok('Olá! Não encontrei o orçamento aberto. Selecione um na lista.');
    const issues = detectGlobalIssues(ctx);
    let msg = `Olá! Estou olhando o orçamento **${ctx.orcamento.codigo}** (${ctx.orcamento.cliente}).`;
    if (issues.length > 0) {
      msg += ` Já vi que tem ${issues.length} ponto(s) que precisam de atenção — me pergunte sobre qualquer um.`;
    } else {
      msg += ' Tudo parece em ordem. Pode perguntar o que quiser!';
    }
    return { content: msg, actions: [], sources: ['DB'] };
  }

  if (intent.type === 'ajuda') {
    return ok(`Pode me perguntar naturalmente! Exemplos:\n\n- "Quanto deu o radier?"\n- "Por que o reboco está zerado?"\n- "Explicar como calcula a laje"\n- "Recalcular tudo"\n- "Reimportar PDF"\n- "Adicionar pavimento"\n- "Gerar proposta"\n\nEu consulto o sistema e respondo com os dados reais 👷`);
  }

  // ── All other intents require orcamento + DB query ──
  if (!orcamentoId) return ok('Preciso que você abra um orçamento primeiro. Selecione um na lista ou crie um novo.');

  const ctx = await gatherContext(orcamentoId);
  if (!ctx.orcamento) return ok('Não encontrei esse orçamento. Verifique se ele ainda existe.');

  const orc = ctx.orcamento;
  const src: string[] = ['DB'];

  switch (intent.type) {
    case 'quanto_deu': return handleQuantoDeu(intent, ctx, isAdmin, src);
    case 'explicar': return handleExplicar(intent, ctx, isAdmin, src);
    case 'diagnosticar': return handleDiagnosticar(intent, ctx, isAdmin, src);
    case 'recalcular': return handleRecalcular(ctx, src);
    case 'importar': return handleImportar(ctx, src);
    case 'adicionar': return handleAdicionar(intent, ctx, src);
    case 'toggle': return handleToggle(intent, ctx, src);
    case 'listar': return handleListar(ctx, src);
    case 'acao': return handleAcao(intent, ctx, isAdmin, src);
    default: return handleDesconhecido(intent, ctx, src);
  }
}

// ── Helpers ─────────────────────────────────────────────────────────

function ok(content: string, actions: ChatAction[] = [], sources: string[] = []): PipelineResult {
  return { content, actions, sources };
}

// ── QUANTO DEU ─────────────────────────────────────────────────────

function handleQuantoDeu(intent: Intent, ctx: PipelineContext, isAdmin: boolean, src: string[]): PipelineResult {
  const etapa = intent.etapa;
  const res = ctx.resultados;
  const orc = ctx.orcamento;

  if (etapa === 'margens' && !isAdmin) return ok(MENSAGENS_SIGILO.sigiloLucroBdi, [], src);

  // Total geral
  if (!etapa || /total|geral|orçamento|orcamento/.test(intent.raw.toLowerCase())) {
    if (!res) return ok(`O orçamento **${orc.codigo}** ainda não foi calculado. Quer que eu recalcule?`, [{ label: '🔄 Recalcular tudo', actionId: 'recalcular_tudo' }], src);

    const total = res.total_geral_predio ?? 0;
    const consolidado = res.consolidado || {};
    const fundacao = res.fundacao_total ?? 0;

    let msg = `No orçamento **${orc.codigo}**, o total geral está em **${fmt$(total)}**.`;
    if (consolidado.custo_direto_total) msg += ` Custo direto: ${fmt$(consolidado.custo_direto_total)}.`;
    if (fundacao > 0) msg += ` Fundação: ${fmt$(fundacao)}.`;

    const issues = detectGlobalIssues(ctx);
    if (issues.length > 0) msg += `\n\n⚠️ Atenção: ${issues[0]}.`;

    return { content: msg, actions: [{ label: '🔄 Recalcular', actionId: 'recalcular_tudo' }], sources: src };
  }

  // Etapa específica
  if (!res) return ok(`Ainda não há resultados calculados. Preciso que calcule primeiro.`, [{ label: '🔄 Recalcular', actionId: 'recalcular_tudo' }], src);

  const info = ETAPAS_CONHECIMENTO[etapa!];
  const nome = info?.nome || etapa;

  if (etapa === 'radier') {
    const r = res.radier || {};
    const total = r.radier_custo_total ?? r.custo_total ?? 0;
    let msg = `O **Radier** está em **${fmt$(total)}**.`;
    if (r.radier_custo_concreto) msg += ` Concreto: ${fmt$(r.radier_custo_concreto)}.`;
    if (r.radier_custo_tela || r.custo_tela) msg += ` Tela: ${fmt$(r.radier_custo_tela || r.custo_tela)}.`;
    if (r.radier_custo_mao_obra || r.custo_mao_obra) msg += ` MO: ${fmt$(r.radier_custo_mao_obra || r.custo_mao_obra)}.`;
    if (total === 0) msg += '\n\n⚠️ Total zerado — provavelmente faltam dados de entrada. Quer que eu investigue?';
    return { content: msg, actions: total === 0 ? [{ label: '🔍 Investigar', actionId: 'explicar_etapa', params: { etapa: 'radier' } }] : [], sources: src };
  }

  if (etapa === 'paredes') {
    const area = res.paredes_total_area_m2 ?? 0;
    const p = res.paredes || {};
    let msg = `As **Paredes** totalizam **${fmtN(area)} m²**.`;
    if (p.custo_paredes) msg += ` Custo: ${fmt$(p.custo_paredes)}.`;
    if (area === 0) msg += '\n\n⚠️ Área zerada. Verifique se as medidas foram importadas ou preenchidas.';
    return { content: msg, actions: area === 0 ? [{ label: '📥 Reimportar', actionId: 'reimportar_pdf' }] : [], sources: src };
  }

  if (etapa === 'reboco') {
    const ext = res.reboco_total_area_externo_m2 ?? 0;
    const int = res.reboco_total_area_interno_m2 ?? 0;
    const rb = res.reboco || {};
    let msg = `O **Reboco** tem ${fmtN(ext)} m² externo e ${fmtN(int)} m² interno.`;
    if (rb.custo_reboco) msg += ` Custo: ${fmt$(rb.custo_reboco)}.`;
    if (ext === 0 && int === 0) {
      msg += '\n\n⚠️ Ambos zerados. ';
      const paredesArea = res.paredes_total_area_m2 ?? 0;
      if (paredesArea === 0) msg += 'A causa é que a **área de paredes** também está 0 — resolva as paredes primeiro.';
      else msg += 'Verifique se os dados de reboco foram preenchidos.';
    }
    return { content: msg, actions: [], sources: src };
  }

  if (etapa === 'laje') {
    const area = res.laje_total_area_m2 ?? 0;
    const vol = res.laje_total_volume_m3 ?? 0;
    const l = res.laje || {};
    let msg = `A **Laje** tem ${fmtN(area)} m² e ${fmtN(vol)} m³.`;
    if (l.custo_laje) msg += ` Custo: ${fmt$(l.custo_laje)}.`;
    return { content: msg, actions: [], sources: src };
  }

  // Generic for other stages
  const etapaRes = res[etapa!];
  if (etapaRes && typeof etapaRes === 'object') {
    const custoEntries = Object.entries(etapaRes).filter(([k]) => k.includes('custo') || k.includes('total'));
    if (custoEntries.length > 0) {
      let msg = `Sobre **${nome}**:\n`;
      custoEntries.slice(0, 5).forEach(([k, v]) => {
        msg += `• ${k}: ${typeof v === 'number' ? fmt$(v as number) : v}\n`;
      });
      return { content: msg, actions: [], sources: src };
    }
  }

  return ok(`Não encontrei resultados para **${nome}**. Pode ser que falte preencher dados ou recalcular.`, [{ label: '🔄 Recalcular', actionId: 'recalcular_tudo' }], src);
}

// ── EXPLICAR ───────────────────────────────────────────────────────

function handleExplicar(intent: Intent, ctx: PipelineContext, isAdmin: boolean, src: string[]): PipelineResult {
  const etapa = intent.etapa;
  if (!etapa || !ETAPAS_CONHECIMENTO[etapa]) {
    return ok(`Sobre qual etapa? Temos: ${Object.values(ETAPAS_CONHECIMENTO).map(e => e.nome).join(', ')}.`, [], src);
  }

  if (etapa === 'margens' && !isAdmin)
    return ok(`Sobre o desconto comercial: você pode solicitar desconto para o cliente, e o Gestor aprova. ${MENSAGENS_SIGILO.sigiloLucroBdi}`, [], src);

  const info = ETAPAS_CONHECIMENTO[etapa];
  const insp = inspectStage(etapa, ctx);
  const orc = ctx.orcamento;

  let msg = `Entendi, vou explicar o **${info.nome}** no orçamento ${orc.codigo}.\n\n`;
  msg += `${info.descricao}\n\n`;

  if (info.formula) msg += `**Fórmula:** \`${info.formula}\`\n\n`;

  if (insp.hasData && insp.inputData) {
    msg += `**Dados atuais no sistema:**\n`;
    const entries = Object.entries(insp.inputData).filter(([, v]) => v != null && v !== '');
    entries.slice(0, 8).forEach(([k, v]) => {
      msg += `• \`${k}\`: ${typeof v === 'number' ? fmtN(v) : v}\n`;
    });
    if (insp.zeroFields.length > 0) {
      msg += `\n⚠️ Campos zerados: ${insp.zeroFields.slice(0, 5).map(f => `\`${f}\``).join(', ')} — podem afetar o resultado.`;
    }
    src.push('Manual');
  } else {
    msg += `⚠️ **Nenhum dado de entrada preenchido** para essa etapa. Sem inputs, não há cálculo.`;
  }

  if (insp.resultadoData) {
    const custoEntries = Object.entries(insp.resultadoData).filter(([k]) => k.includes('custo') || k.includes('total') || k.includes('area'));
    if (custoEntries.length > 0) {
      msg += `\n\n**Resultados atuais:**\n`;
      custoEntries.slice(0, 5).forEach(([k, v]) => {
        msg += `• ${k}: ${typeof v === 'number' ? (k.includes('custo') || k.includes('total') ? fmt$(v as number) : fmtN(v as number)) : v}\n`;
      });
    }
  }

  if (info.observacoes?.length) msg += `\n\n💡 ${info.observacoes[0]}`;

  const actions: ChatAction[] = [{ label: '🔄 Recalcular', actionId: 'recalcular_tudo' }];
  if (!insp.hasData) actions.push({ label: '📥 Reimportar PDF', actionId: 'reimportar_pdf' }, { label: '✏️ Preencher manual', actionId: 'modo_manual' });

  return { content: msg, actions, sources: src };
}

// ── DIAGNOSTICAR ───────────────────────────────────────────────────

function handleDiagnosticar(intent: Intent, ctx: PipelineContext, isAdmin: boolean, src: string[]): PipelineResult {
  const etapa = intent.etapa;

  if (etapa === 'margens' && !isAdmin) return ok(MENSAGENS_SIGILO.sigiloLucroBdi, [], src);

  // Diagnóstico geral (sem etapa específica)
  if (!etapa) {
    const issues = detectGlobalIssues(ctx);
    if (issues.length > 0) {
      let msg = `Encontrei **${issues.length} problema(s)** no orçamento **${ctx.orcamento.codigo}**:\n\n`;
      issues.forEach(i => { msg += `⚠️ ${i}\n`; });
      msg += `\nMe diga qual quer investigar — ex: "por que o radier está zerado?"`;
      return { content: msg, actions: [{ label: '🔄 Recalcular tudo', actionId: 'recalcular_tudo' }], sources: src };
    }
    return ok(`Dei uma olhada geral no orçamento **${ctx.orcamento.codigo}** e não encontrei problemas evidentes. Todos os totais têm valores. Qual etapa está te preocupando?`, [], src);
  }

  // Diagnóstico de etapa específica
  const insp = inspectStage(etapa, ctx);
  const info = ETAPAS_CONHECIMENTO[etapa];
  if (!info) return ok(`Não encontrei a etapa "${etapa}" no sistema.`, [], src);

  let msg = `Vou investigar o **${insp.nome}** no orçamento ${ctx.orcamento.codigo}.\n\n`;

  // Sem dados de entrada
  if (!insp.hasData) {
    msg += `❌ **Causa raiz encontrada:** nenhum dado de entrada preenchido para essa etapa. Sem inputs, o cálculo fica zerado.\n\n`;

    // Check if there's a file but no extraction
    if (ctx.arquivos.length === 0) {
      msg += `Além disso, **não há arquivo ativo** (PDF/imagens) — envie o projeto primeiro.`;
      return { content: msg, actions: [{ label: '📤 Enviar PDF/Imagens', actionId: 'reimportar_pdf' }], sources: src };
    }

    // Has file but no data — extraction may have failed
    const relevantExtractions = ctx.extracoes.filter(e => e.status === 'sucesso');
    if (relevantExtractions.length === 0) {
      msg += `Existe arquivo enviado, mas a **extração não foi concluída**. Tente reimportar.`;
      return { content: msg, actions: [{ label: '📥 Reimportar PDF', actionId: 'reimportar_pdf' }, { label: '✏️ Preencher manual', actionId: 'modo_manual' }], sources: src };
    }

    msg += `Há arquivo e extrações, mas os dados não foram aplicados nesta etapa. Confirme as medidas ou preencha manualmente.`;
    return { content: msg, actions: [{ label: '✏️ Preencher manual', actionId: 'modo_manual' }, { label: '📥 Reimportar', actionId: 'reimportar_pdf' }], sources: src };
  }

  // Tem dados — investigar campos problemáticos
  const problemCount = insp.missingFields.length + insp.zeroFields.length;

  if (problemCount > 0) {
    if (insp.missingFields.length > 0)
      msg += `Encontrei **${insp.missingFields.length} campo(s) vazio(s)**: ${insp.missingFields.slice(0, 5).map(f => `\`${f}\``).join(', ')}.\n`;
    if (insp.zeroFields.length > 0)
      msg += `Encontrei **${insp.zeroFields.length} campo(s) zerado(s)**: ${insp.zeroFields.slice(0, 5).map(f => `\`${f}\``).join(', ')}.\n`;

    msg += `\n`;

    // Root cause analysis for common dependencies
    if (etapa === 'reboco') {
      const paredesArea = ctx.resultados?.paredes_total_area_m2 ?? 0;
      if (paredesArea === 0) {
        msg += `🔗 **Causa raiz:** a área de **Paredes** está 0 m². O reboco depende das paredes — resolva as paredes primeiro.`;
        return { content: msg, actions: [{ label: '🔍 Investigar Paredes', actionId: 'explicar_etapa', params: { etapa: 'paredes' } }], sources: src };
      }
    }

    if (etapa === 'revestimento' && insp.zeroFields.some(f => f.includes('area'))) {
      msg += `🔗 A área base está zerada — verifique se as medidas de paredes e o material estão configurados.`;
    }

    msg += `\nEsses campos provavelmente estão impedindo o resultado. Reimporte ou preencha manualmente.`;
  } else {
    // Todos os inputs ok — verificar se resultado é zero
    msg += `✅ Todos os campos de entrada têm valores.\n\n`;
    const etapaRes = ctx.resultados?.[etapa];
    if (etapaRes) {
      const zeroResults = Object.entries(etapaRes).filter(([k, v]) => (k.includes('custo') || k.includes('total')) && v === 0);
      if (zeroResults.length > 0) {
        msg += `Porém, os **custos estão zerados** mesmo com inputs preenchidos. Isso geralmente indica que os **preços no catálogo** estão em R$ 0 para os itens dessa etapa. Peça ao Gestor para verificar os preços.`;
      } else {
        msg += `Os resultados também parecem calculados. Tente recalcular para garantir que está atualizado.`;
      }
    } else {
      msg += `Mas **não há resultado calculado**. Execute um recálculo.`;
    }
  }

  return { content: msg, actions: [{ label: '🔄 Recalcular', actionId: 'recalcular_tudo' }, { label: '📥 Reimportar', actionId: 'reimportar_pdf' }], sources: src };
}

// ── RECALCULAR ─────────────────────────────────────────────────────

function handleRecalcular(ctx: PipelineContext, src: string[]): PipelineResult {
  const actions: ChatAction[] = [{ label: '🔄 Recalcular tudo', actionId: 'recalcular_tudo' }];
  if (ctx.pavimentos.length > 0) actions.push({ label: '🏢 Calcular prédio', actionId: 'calcular_predio' });

  return { content: `Certo, vou preparar o recálculo do orçamento **${ctx.orcamento.codigo}**. Use o botão abaixo — os dados atuais serão reprocessados.`, actions, sources: src };
}

// ── IMPORTAR ───────────────────────────────────────────────────────

function handleImportar(ctx: PipelineContext, src: string[]): PipelineResult {
  const actions: ChatAction[] = [{ label: '📥 Reimportar PDF', actionId: 'reimportar_pdf' }, { label: '✏️ Modo Manual', actionId: 'modo_manual' }];

  if (ctx.arquivos.length === 0) {
    return { content: `Não encontrei arquivo ativo neste orçamento. Primeiro **envie um PDF ou imagens** do projeto, depois posso reimportar as medidas.`, actions: [{ label: '📤 Enviar PDF/Imagens', actionId: 'reimportar_pdf' }], sources: src };
  }

  const lastFile = ctx.arquivos[0];
  return { content: `Encontrei o arquivo **${lastFile.nome}** ativo. Para reimportar, use o botão abaixo — o sistema vai reprocessar as medidas.`, actions, sources: src };
}

// ── ADICIONAR ──────────────────────────────────────────────────────

function handleAdicionar(intent: Intent, ctx: PipelineContext, src: string[]): PipelineResult {
  switch (intent.actionId) {
    case 'adicionar_pavimento': {
      const qtd = ctx.pavimentos.length;
      return { content: `O orçamento tem ${qtd} pavimento(s). Para adicionar mais um, use o botão abaixo.`, actions: [{ label: '🏢 Adicionar Pavimento', actionId: 'adicionar_pavimento' }], sources: src };
    }
    case 'duplicar_pavimento':
      return ok('Para duplicar, acesse a aba Paredes e use a opção de duplicação no pavimento desejado.', [], src);
    case 'adicionar_laje':
      return { content: 'Certo, para adicionar uma laje:', actions: [{ label: '➕ Adicionar Laje', actionId: 'adicionar_laje' }], sources: src };
    default:
      return ok('O que quer adicionar? Pode dizer "adicionar pavimento", "adicionar laje" ou "duplicar pavimento".', [], src);
  }
}

// ── TOGGLE ──────────────────────────────────────────────────────────

function handleToggle(intent: Intent, ctx: PipelineContext, src: string[]): PipelineResult {
  const acao = intent.actionId?.startsWith('ativar') ? 'ativar' : 'desativar';
  const target = intent.target || 'item';
  return { content: `Entendi, para ${acao} **${target}** use o controle na aba correspondente do orçamento.`, actions: [{ label: `⚡ ${acao === 'ativar' ? 'Ativar' : 'Desativar'} ${target}`, actionId: intent.actionId || '' }], sources: src };
}

// ── LISTAR ──────────────────────────────────────────────────────────

function handleListar(ctx: PipelineContext, src: string[]): PipelineResult {
  const etapas = Object.values(ETAPAS_CONHECIMENTO);
  return ok(`O simulador tem **${etapas.length} etapas**:\n\n${etapas.map(e => `• **${e.nome}**`).join('\n')}\n\nSobre qual quer saber? Me pergunte naturalmente.`, [], src);
}

// ── ACAO ────────────────────────────────────────────────────────────

function handleAcao(intent: Intent, ctx: PipelineContext, isAdmin: boolean, src: string[]): PipelineResult {
  switch (intent.actionId) {
    case 'editar_preco':
      if (!isAdmin) return ok('🔒 Editar preços requer permissão do Gestor. Posso registrar a solicitação.', [{ label: '📩 Solicitar ao Gestor', actionId: 'solicitar_gestor' }], src);
      return ok('Para editar preços, acesse a tela **Preços** no menu lateral.', [], src);

    case 'gerar_proposta':
      return { content: `Certo, para gerar a Proposta Comercial do orçamento ${ctx.orcamento.codigo}:`, actions: [{ label: '📄 Gerar Proposta', actionId: 'gerar_proposta' }], sources: src };

    case 'gerar_relatorio_admin':
      if (!isAdmin) return ok('🔒 O relatório detalhado é restrito a Gestores. Posso registrar a solicitação.', [{ label: '📩 Solicitar ao Gestor', actionId: 'solicitar_gestor' }], src);
      return { content: 'Para gerar o relatório detalhado:', actions: [{ label: '📊 Relatório Detalhado', actionId: 'gerar_relatorio_admin', adminOnly: true }], sources: src };

    case 'atualizar_cub':
      if (!isAdmin) return ok('🔒 Atualizar o CUB-PA requer permissão de Gestor.', [{ label: '📩 Solicitar ao Gestor', actionId: 'solicitar_gestor' }], src);
      return { content: 'Vou preparar a atualização do CUB-PA:', actions: [{ label: '📈 Atualizar CUB-PA', actionId: 'atualizar_cub', adminOnly: true }], sources: src };

    case 'ver_anexos':
      if (!isAdmin) return ok('🔒 Visualização de anexos restrita a Gestores.', [], src);
      return { content: `O orçamento tem **${ctx.arquivos.length} arquivo(s) ativo(s)**. Acesse na aba Relatórios.`, actions: [{ label: '📎 Ver Anexos', actionId: 'ver_anexos', adminOnly: true }], sources: src };

    case 'modo_manual':
      return { content: 'Para trocar para modo manual:', actions: [{ label: '✏️ Modo Manual', actionId: 'modo_manual' }], sources: src };

    default:
      return ok('Ação não reconhecida. Me diga o que precisa em linguagem natural!', [], src);
  }
}

// ── DESCONHECIDO (smart fallback) ──────────────────────────────────

function handleDesconhecido(intent: Intent, ctx: PipelineContext, src: string[]): PipelineResult {
  // If we detected a stage, give contextual response
  if (intent.etapa && ETAPAS_CONHECIMENTO[intent.etapa]) {
    const insp = inspectStage(intent.etapa, ctx);

    if (!insp.hasData) {
      return { content: `Sobre **${insp.nome}**: ainda não há dados preenchidos. Quer enviar o PDF ou preencher manualmente?`, actions: [{ label: '📥 Reimportar PDF', actionId: 'reimportar_pdf' }, { label: '✏️ Preencher manual', actionId: 'modo_manual' }], sources: src };
    }

    // Has data — ask what they want
    return {
      content: `Entendi que está perguntando sobre **${insp.nome}**. O que posso fazer?\n\n• Explicar o cálculo\n• Mostrar o valor atual\n• Investigar se tem erro`,
      actions: [
        { label: '📖 Explicar', actionId: 'explicar_etapa', params: { etapa: intent.etapa } },
        { label: '🔍 Investigar', actionId: 'explicar_etapa', params: { etapa: intent.etapa } },
        { label: '🔄 Recalcular', actionId: 'recalcular_tudo' },
      ],
      sources: src,
    };
  }

  // No stage detected — ask one clarifying question with buttons
  return {
    content: `Não entendi completamente. Você quer que eu **explique algum cálculo** ou **investigue um problema**?`,
    actions: [
      { label: '📖 Explicar etapa', actionId: 'explicar_etapa', params: {} },
      { label: '🔍 Diagnosticar problemas', actionId: 'diagnosticar_geral' },
      { label: '🔄 Recalcular tudo', actionId: 'recalcular_tudo' },
    ],
    sources: src,
  };
}
