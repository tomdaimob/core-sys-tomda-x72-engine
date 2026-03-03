import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history, orcamentoId, isAdmin } = await req.json();

    if (!message) throw new Error('Mensagem não fornecida');

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

    // ── Gather DB context if orcamentoId provided ──
    let dbContext = '';
    if (orcamentoId) {
      const authHeader = req.headers.get('Authorization');
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader || '' } } }
      );

      const [orcRes, inputsRes, resultRes, pavRes, arqRes, extRes] = await Promise.all([
        supabase.from('orcamentos').select('id,codigo,cliente,status,area_total_m2,valor_total,desconto_percent,discount_status,cliente_tipo,cliente_documento,cliente_responsavel').eq('id', orcamentoId).single(),
        supabase.from('orcamento_inputs').select('etapa,dados').eq('orcamento_id', orcamentoId),
        supabase.from('orcamento_resultados').select('*').eq('orcamento_id', orcamentoId).single(),
        supabase.from('orcamento_pavimentos').select('id,nome,ordem,multiplicador,status,tipo,includes_fundacao,includes_laje,includes_reboco,includes_revestimento,includes_portas,includes_portoes').eq('orcamento_id', orcamentoId).order('ordem'),
        supabase.from('arquivos').select('id,nome,tipo,ativo,version').eq('orcamento_id', orcamentoId).eq('ativo', true),
        supabase.from('ia_extracoes').select('id,tipo,status,confianca,observacoes,created_at').eq('orcamento_id', orcamentoId).order('created_at', { ascending: false }).limit(5),
      ]);

      const orc = orcRes.data;
      const inputs = inputsRes.data || [];
      const resultados = resultRes.data;
      const pavimentos = pavRes.data || [];
      const arquivos = arqRes.data || [];
      const extracoes = extRes.data || [];

      // Build context string
      dbContext = `\n\n=== DADOS DO ORÇAMENTO ATUAL (consulta real no banco) ===\n`;

      if (orc) {
        dbContext += `Orçamento: ${orc.codigo} | Cliente: ${orc.cliente} | Status: ${orc.status}\n`;
        if (orc.valor_total) dbContext += `Valor total: R$ ${Number(orc.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
        if (orc.area_total_m2) dbContext += `Área total: ${orc.area_total_m2} m²\n`;
        if (orc.discount_status && orc.discount_status !== 'DISPENSADO') dbContext += `Status desconto: ${orc.discount_status}\n`;
      } else {
        dbContext += `Orçamento não encontrado.\n`;
      }

      if (inputs.length > 0) {
        dbContext += `\n--- INPUTS POR ETAPA ---\n`;
        for (const inp of inputs) {
          const dados = inp.dados as Record<string, unknown>;
          if (dados && typeof dados === 'object') {
            const entries = Object.entries(dados).filter(([, v]) => v != null && v !== '' && v !== 0);
            const zeros = Object.entries(dados).filter(([, v]) => v === 0 || v === null || v === undefined || v === '');
            dbContext += `[${inp.etapa}] ${entries.length} campos preenchidos, ${zeros.length} zerados/vazios\n`;
            entries.slice(0, 8).forEach(([k, v]) => { dbContext += `  ${k}: ${v}\n`; });
            if (zeros.length > 0) dbContext += `  Campos zerados: ${zeros.slice(0, 6).map(([k]) => k).join(', ')}\n`;
          }
        }
      } else {
        dbContext += `\nNenhum input salvo nas etapas.\n`;
      }

      if (resultados) {
        dbContext += `\n--- RESULTADOS CALCULADOS ---\n`;
        const campos: [string, unknown][] = [
          ['paredes_total_area_m2', resultados.paredes_total_area_m2],
          ['reboco_total_area_externo_m2', resultados.reboco_total_area_externo_m2],
          ['reboco_total_area_interno_m2', resultados.reboco_total_area_interno_m2],
          ['revestimento_total_area_m2', resultados.revestimento_total_area_m2],
          ['laje_total_area_m2', resultados.laje_total_area_m2],
          ['laje_total_volume_m3', resultados.laje_total_volume_m3],
          ['fundacao_total', resultados.fundacao_total],
          ['total_geral_predio', resultados.total_geral_predio],
        ];
        for (const [k, v] of campos) {
          dbContext += `  ${k}: ${v ?? 0}\n`;
        }
        // Add breakdown JSONs if they have custo data
        for (const key of ['paredes', 'radier', 'laje', 'reboco', 'acabamentos', 'revestimento', 'consolidado'] as const) {
          const obj = resultados[key];
          if (obj && typeof obj === 'object' && Object.keys(obj).length > 0) {
            const custoEntries = Object.entries(obj).filter(([k]) => k.includes('custo') || k.includes('total') || k.includes('area') || k.includes('volume'));
            if (custoEntries.length > 0) {
              dbContext += `  [${key}]: ${custoEntries.map(([k, v]) => `${k}=${v}`).join(', ')}\n`;
            }
          }
        }
      } else {
        dbContext += `\nNenhum resultado calculado.\n`;
      }

      if (pavimentos.length > 0) {
        dbContext += `\n--- PAVIMENTOS (${pavimentos.length}) ---\n`;
        for (const p of pavimentos) {
          dbContext += `  ${p.nome} (${p.tipo}, status: ${p.status}, mult: ${p.multiplicador}) fundação:${p.includes_fundacao} laje:${p.includes_laje} reboco:${p.includes_reboco}\n`;
        }
      }

      if (arquivos.length > 0) {
        dbContext += `\n--- ARQUIVOS ATIVOS ---\n`;
        for (const a of arquivos) { dbContext += `  ${a.nome} (${a.tipo}, v${a.version})\n`; }
      } else {
        dbContext += `\nNenhum arquivo ativo (PDF/imagens).\n`;
      }

      if (extracoes.length > 0) {
        dbContext += `\n--- ÚLTIMAS EXTRAÇÕES IA ---\n`;
        for (const e of extracoes) { dbContext += `  tipo:${e.tipo} status:${e.status} confiança:${e.confianca} ${e.observacoes || ''}\n`; }
      }

      // Add admin-only data
      if (isAdmin && orc) {
        dbContext += `\n--- DADOS ADMIN ---\n`;
        dbContext += `  lucro_percent: (dados protegidos, disponível apenas para o admin)\n`;
        dbContext += `  bdi_percent: (dados protegidos, disponível apenas para o admin)\n`;
      }
    }

    // ── Build system prompt ──
    const sigiloRule = isAdmin
      ? 'Você pode mencionar valores de Lucro e BDI normalmente.'
      : 'REGRA ABSOLUTA: Nunca revele Lucro (%), BDI (%) ou Margem real. Se perguntarem, diga que essa informação é restrita ao Gestor. Redirecione para "desconto comercial" que pode ser solicitado ao Gestor.';

    const systemPrompt = `Você é o Mr. Obras Assistente 🏗️ — um assistente técnico de orçamento de construção civil (sistema ICF).

PERSONALIDADE:
- Tom profissional e objetivo, como um parceiro de obra experiente
- Respostas curtas e diretas (2-6 frases), sem listas enormes
- Use linguagem natural ("Entendi...", "Vamos ver...", "Encontrei aqui...")
- Cite evidências do sistema: "No seu orçamento, o reboco ficou 0 porque..."
- Se faltarem dados, diga EXATAMENTE o que falta e como resolver

REGRAS:
- ${sigiloRule}
- Se não houver orçamento aberto, peça para abrir um
- Se não conseguir responder, faça UMA pergunta curta para entender
- Nunca invente valores — use apenas os dados do banco abaixo
- Se um resultado está zerado, investigue os inputs e diga a causa provável
- Quando sugerir ações, mencione o nome da ação entre colchetes: [recalcular_tudo], [reimportar_pdf], [modo_manual], [adicionar_pavimento], [gerar_proposta], [atualizar_cub], [solicitar_gestor]
- Use formatação markdown simples (negrito, listas curtas)

ETAPAS DO SIMULADOR: paredes, reboco, revestimento, radier, baldrame, sapata, laje, acabamentos, portas_portoes, margens

DEPENDÊNCIAS ENTRE ETAPAS:
- Reboco depende de Paredes (se paredes=0, reboco será 0)
- Revestimento depende de medidas de paredes/ambientes
- Radier é independente (precisa de área, espessura, fck)
- Laje precisa de área e espessura
- Acabamentos e portas são independentes
- Se custo de uma etapa é 0 mas inputs existem, provavelmente o catálogo de preços está zerado

Perfil do usuário: ${isAdmin ? 'Administrador/Gestor (acesso completo)' : 'Vendedor (sem acesso a Lucro/BDI/catálogo de preços)'}
${dbContext}`;

    // ── Build messages array ──
    const messages: Array<{role: string, content: string}> = [
      { role: 'system', content: systemPrompt },
    ];

    // Add conversation history (last 10 messages)
    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    // Add current message
    messages.push({ role: 'user', content: message });

    console.log(`Mr. Obras chat: orcamento=${orcamentoId}, isAdmin=${isAdmin}, historyLen=${history?.length || 0}`);

    // ── Call AI ──
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: 0.4,
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI error:', errText);
      throw new Error(`Erro ao consultar IA: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || 'Desculpe, não consegui processar sua pergunta. Tente novamente.';

    // ── Extract suggested actions from brackets [action_id] ──
    const actionMatches = content.match(/\[([a-z_]+)\]/g) || [];
    const actionMap: Record<string, { label: string; adminOnly?: boolean }> = {
      recalcular_tudo: { label: '🔄 Recalcular tudo' },
      reimportar_pdf: { label: '📥 Reimportar PDF' },
      modo_manual: { label: '✏️ Modo Manual' },
      adicionar_pavimento: { label: '🏢 Adicionar Pavimento' },
      adicionar_laje: { label: '➕ Adicionar Laje' },
      gerar_proposta: { label: '📄 Gerar Proposta' },
      gerar_relatorio_admin: { label: '📊 Relatório Detalhado', adminOnly: true },
      atualizar_cub: { label: '📈 Atualizar CUB-PA', adminOnly: true },
      solicitar_gestor: { label: '📩 Solicitar ao Gestor' },
      calcular_predio: { label: '🏢 Calcular Prédio' },
      ver_anexos: { label: '📎 Ver Anexos', adminOnly: true },
    };

    const actions: Array<{ label: string; actionId: string; adminOnly?: boolean }> = [];
    const seenActions = new Set<string>();
    for (const match of actionMatches) {
      const id = match.replace(/[\[\]]/g, '');
      if (actionMap[id] && !seenActions.has(id)) {
        seenActions.add(id);
        actions.push({ ...actionMap[id], actionId: id });
      }
    }

    // Clean brackets from content for display
    const cleanContent = content.replace(/\[([a-z_]+)\]/g, '').replace(/\s{2,}/g, ' ').trim();

    return new Response(JSON.stringify({
      content: cleanContent,
      actions,
      sources: orcamentoId ? ['DB', 'IA'] : ['IA'],
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('Mr. Obras chat error:', err);
    return new Response(JSON.stringify({
      content: `Ops, tive um problema: ${err.message || 'erro desconhecido'}. Tente novamente.`,
      actions: [],
      sources: ['Erro'],
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  }
});
