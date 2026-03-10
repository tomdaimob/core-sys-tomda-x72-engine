import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DoorGateItem {
  id: string;
  label: string;
  width_m: number;
  height_m: number;
  area_m2: number;
  confianca: number;
  page_number?: number;
  inferred: boolean;
  tipo?: 'INTERNA' | 'EXTERNA';
  material: string;
  origem: 'PDF' | 'MANUAL' | 'DUPLICADO';
}

interface ExtractionResult {
  doors: {
    count: number;
    items: DoorGateItem[];
    area_total_m2: number;
    counts_per_page: Record<number, number>;
  };
  windows: {
    count: number;
    items: DoorGateItem[];
    area_total_m2: number;
    counts_per_page: Record<number, number>;
  };
  gates: {
    count: number;
    items: DoorGateItem[];
    area_total_m2: number;
    counts_per_page: Record<number, number>;
  };
  source: {
    pages_used: number[];
    pages_total: number;
    notes: string;
    warnings: string[];
    detected_units: number;
    is_geminada: boolean;
  };
}

function generateId(): string {
  return 'item_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36).slice(-4);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, fileName, orcamentoId, defaultDimensions } = await req.json();

    if (!pdfBase64 || !orcamentoId) {
      return new Response(
        JSON.stringify({ success: false, error: 'PDF e orçamento são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'API key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const defaults = defaultDimensions || {
      porta_interna_largura: 0.80,
      porta_interna_altura: 2.10,
      porta_externa_largura: 0.90,
      porta_externa_altura: 2.10,
      portao_garagem_largura: 3.00,
      portao_garagem_altura: 2.20,
      portao_pedestres_largura: 1.00,
      portao_pedestres_altura: 2.20,
      janela_padrao_largura: 1.20,
      janela_padrao_altura: 1.20,
      janela_banheiro_largura: 0.60,
      janela_banheiro_altura: 0.60,
    };

    console.log(`Processing PDF ${fileName} for orcamento ${orcamentoId}`);

    const systemPrompt = `Você é um engenheiro / arquiteto sênior com 20+ anos de experiência em leitura técnica de projetos exportados do AutoCAD, Revit ou similares.

## OBJETIVO
Identificar e extrair dimensões de TODAS as PORTAS, JANELAS e PORTÕES em TODAS as páginas do projeto.

## METODOLOGIA — SIGA PASSO A PASSO

### Passo 1 — RECONHECIMENTO DO DOCUMENTO
Antes de extrair medidas, descreva para si mesmo:
- Quantas páginas o documento tem?
- Quais tipos de desenho estão em cada página? (planta baixa, fachada, corte, prancha de esquadrias, detalhamento)
- Qual a escala de cada página?

### Passo 2 — IDENTIFICAR ABERTURAS NA PLANTA BAIXA
Na planta baixa, identifique:
- **PORTAS** → Símbolo: arco de 90° saindo da parede (representação da folha abrindo)
  - Portas de correr: duas linhas paralelas na parede
  - Portas pivotantes: arco maior
  - Labels comuns: P, P1, P2, PT, PM, Porta
- **JANELAS** → Símbolo: duas ou três linhas paralelas DENTRO da parede, representando os trilhos
  - Janela de correr: linhas paralelas com setas de correr
  - Basculante: linha tracejada
  - Maxim-ar: traço com ângulo
  - Labels comuns: J, J1, J2, JB, JC, JAN, Janela
- **PORTÕES** → Tipicamente no muro de divisa ou fachada
  - Labels: G, PG, Portão
  - Contexto: garagem, entrada do lote, acesso social

### Passo 3 — BUSCAR TABELA/QUADRO DE ESQUADRIAS
Muitos projetos têm uma TABELA DE ESQUADRIAS (geralmente na lateral ou em prancha separada) com:
- Código (P1, J1, G1)
- Largura × Altura
- Quantidade
- Material
- Tipo (correr, abrir, pivotante, basculante)

**SE ENCONTRAR A TABELA: use-a como fonte primária — é a mais confiável.**

### Passo 4 — COTAS DE ABERTURAS
Se não houver tabela, procure cotas próximas às aberturas:
- Cotas em planta: geralmente indicam a LARGURA do vão
- Cotas em corte/fachada: indicam LARGURA e ALTURA
- Peitoril (P): altura do piso à base da janela

### Passo 5 — DIMENSÕES POR INFERÊNCIA (último recurso)
Use APENAS se não encontrar cota NEM tabela:
- Porta interna: ${defaults.porta_interna_largura}m × ${defaults.porta_interna_altura}m
- Porta externa/principal: ${defaults.porta_externa_largura}m × ${defaults.porta_externa_altura}m
- Portão garagem: ${defaults.portao_garagem_largura}m × ${defaults.portao_garagem_altura}m
- Portão pedestres: ${defaults.portao_pedestres_largura}m × ${defaults.portao_pedestres_altura}m
- Janela sala/quarto: ${defaults.janela_padrao_largura}m × ${defaults.janela_padrao_altura}m
- Janela banheiro/serviço: ${defaults.janela_banheiro_largura}m × ${defaults.janela_banheiro_altura}m

Marque inferred=true e confianca=0.60-0.75 para valores inferidos.

### Passo 6 — CASAS GEMINADAS / MÚLTIPLAS UNIDADES
Procure por:
- Textos: "Casa 1", "Unidade A/B", "Sobrado Geminado", "Espelhado"
- Layouts simétricos ou repetidos na mesma prancha
- Múltiplas entradas principais ou portões
Se detectar: informe detected_units e is_geminada=true, mas NÃO duplique automaticamente.

### Passo 7 — CONTAGEM FINAL E VALIDAÇÃO
- Conte TODAS as portas, janelas e portões
- Compare com o esperado: residência típica tem 5-15 portas, 4-10 janelas, 1-3 portões
- Se a contagem parecer BAIXA, releia o projeto
- MELHOR SUPERESTIMAR do que SUBESTIMAR

## FORMATO DE RESPOSTA
Retorne JSON puro (sem markdown, sem \`\`\`):
{
  "doors": {
    "count": N,
    "items": [
      {"id": "d1", "label": "P1", "width_m": 0.8, "height_m": 2.1, "area_m2": 1.68, "confianca": 0.95, "page_number": 1, "inferred": false, "tipo": "INTERNA"}
    ],
    "area_total_m2": N,
    "counts_per_page": {"1": N}
  },
  "windows": {
    "count": N,
    "items": [
      {"id": "w1", "label": "J1", "width_m": 1.2, "height_m": 1.2, "area_m2": 1.44, "confianca": 0.90, "page_number": 1, "inferred": false}
    ],
    "area_total_m2": N,
    "counts_per_page": {"1": N}
  },
  "gates": {
    "count": N,
    "items": [...],
    "area_total_m2": N,
    "counts_per_page": {"1": N}
  },
  "source": {
    "pages_used": [1, 2],
    "pages_total": N,
    "notes": "Descrição detalhada do que foi encontrado e como as medidas foram obtidas",
    "warnings": [],
    "detected_units": 1,
    "is_geminada": false
  }
}`;

    const userPrompt = `Analise TODAS as páginas deste projeto com máxima atenção.

ANTES DE RESPONDER, faça mentalmente:
1. Quantas PÁGINAS o documento tem? Descreva o conteúdo de cada uma.
2. Existe TABELA/QUADRO DE ESQUADRIAS? Se sim, use-a como base.
3. Quais COTAS de aberturas você consegue ler?
4. O projeto é GEMINADO ou de múltiplas unidades?
5. Faça a contagem final: X portas, Y janelas, Z portões.

Retorne o JSON estruturado.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: `data:application/pdf;base64,${pdfBase64}` } }
            ]
          }
        ],
        max_tokens: 16384,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'Limite de requisições excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'Créditos insuficientes. Adicione créditos ao workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`Erro na API de IA: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Resposta vazia da IA');
    }

    console.log('AI response received, parsing...');

    let extractedData: ExtractionResult;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in response:', content);
        throw new Error('Nenhum JSON encontrado na resposta');
      }
      extractedData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('JSON parse error:', parseError, content);
      throw new Error('Não foi possível interpretar a resposta da IA');
    }

    if (!extractedData.doors || !extractedData.gates) {
      throw new Error('Estrutura de dados inválida');
    }

    if (!extractedData.windows) {
      extractedData.windows = { count: 0, items: [], area_total_m2: 0, counts_per_page: {} };
    }

    // Normalize doors
    extractedData.doors.items = (extractedData.doors.items || []).map(item => ({
      ...item,
      id: item.id || generateId(),
      area_m2: item.area_m2 || (item.width_m * item.height_m),
      confianca: item.confianca || 0.8,
      inferred: item.inferred ?? false,
      origem: 'PDF' as const,
      material: item.material || 'MADEIRA',
      tipo: item.tipo || 'INTERNA',
    }));
    extractedData.doors.count = extractedData.doors.items.length;
    extractedData.doors.area_total_m2 = extractedData.doors.items.reduce((sum, item) => sum + (item.area_m2 || 0), 0);
    extractedData.doors.counts_per_page = extractedData.doors.counts_per_page || {};

    // Normalize windows
    extractedData.windows.items = (extractedData.windows.items || []).map(item => ({
      ...item,
      id: item.id || generateId(),
      area_m2: item.area_m2 || (item.width_m * item.height_m),
      confianca: item.confianca || 0.8,
      inferred: item.inferred ?? false,
      origem: 'PDF' as const,
      material: item.material || 'ALUMINIO',
    }));
    extractedData.windows.count = extractedData.windows.items.length;
    extractedData.windows.area_total_m2 = extractedData.windows.items.reduce((sum, item) => sum + (item.area_m2 || 0), 0);
    extractedData.windows.counts_per_page = extractedData.windows.counts_per_page || {};

    // Normalize gates
    extractedData.gates.items = (extractedData.gates.items || []).map(item => ({
      ...item,
      id: item.id || generateId(),
      area_m2: item.area_m2 || (item.width_m * item.height_m),
      confianca: item.confianca || 0.8,
      inferred: item.inferred ?? false,
      origem: 'PDF' as const,
      material: item.material || 'FERRO',
    }));
    extractedData.gates.count = extractedData.gates.items.length;
    extractedData.gates.area_total_m2 = extractedData.gates.items.reduce((sum, item) => sum + (item.area_m2 || 0), 0);
    extractedData.gates.counts_per_page = extractedData.gates.counts_per_page || {};

    // Source
    extractedData.source = extractedData.source || {} as any;
    extractedData.source.pages_used = extractedData.source.pages_used || [];
    extractedData.source.pages_total = extractedData.source.pages_total || extractedData.source.pages_used.length || 1;
    extractedData.source.notes = extractedData.source.notes || 'Extração automática de portas, janelas e portões';
    extractedData.source.warnings = extractedData.source.warnings || [];
    extractedData.source.detected_units = extractedData.source.detected_units || 1;
    extractedData.source.is_geminada = extractedData.source.is_geminada || false;

    const allItems = [...extractedData.doors.items, ...extractedData.windows.items, ...extractedData.gates.items];
    const avgConfidence = allItems.length > 0
      ? allItems.reduce((sum, item) => sum + (item.confianca || 0.8), 0) / allItems.length
      : 0.8;

    const hasInferred = allItems.some(item => item.inferred);
    if (hasInferred && !extractedData.source.warnings.some(w => w.includes('inferidas'))) {
      extractedData.source.warnings.push('Algumas medidas foram inferidas por dimensões padrão');
    }
    if (avgConfidence < 0.75) {
      extractedData.source.warnings.push('Atenção: a importação pode não ter capturado todas as aberturas. Confira a lista e adicione manualmente se necessário.');
    }

    // Save to ia_extracoes
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const checkResponse = await fetch(
      `${supabaseUrl}/rest/v1/ia_extracoes?orcamento_id=eq.${orcamentoId}&select=id,dados_brutos`,
      { method: 'GET', headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey } }
    );

    if (checkResponse.ok) {
      const existingData = await checkResponse.json();
      for (const ext of existingData) {
        if (ext.dados_brutos && 'doors' in ext.dados_brutos && 'gates' in ext.dados_brutos) {
          await fetch(`${supabaseUrl}/rest/v1/ia_extracoes?id=eq.${ext.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${supabaseKey}`, 'apikey': supabaseKey },
          });
        }
      }
    }

    const saveResponse = await fetch(`${supabaseUrl}/rest/v1/ia_extracoes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify({
        orcamento_id: orcamentoId,
        arquivo_id: orcamentoId,
        status: 'sucesso',
        dados_brutos: extractedData,
        confianca: avgConfidence,
        observacoes: `${extractedData.source.notes}. Páginas: ${extractedData.source.pages_used.join(', ')}. ${extractedData.source.is_geminada ? `Geminada: ${extractedData.source.detected_units} unidades.` : ''}`,
      }),
    });

    if (!saveResponse.ok) {
      const saveError = await saveResponse.text();
      console.error('Error saving extraction:', saveError);
    }

    console.log(`Extraction completed: ${extractedData.doors.count} doors, ${extractedData.windows.count} windows, ${extractedData.gates.count} gates`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extractedData,
        message: `${extractedData.doors.count} porta(s), ${extractedData.windows.count} janela(s) e ${extractedData.gates.count} portão(ões) identificado(s) em ${extractedData.source.pages_used.length} página(s)${extractedData.source.is_geminada ? ` (${extractedData.source.detected_units} unidades detectadas)` : ''}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-openings-doors-gates:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
