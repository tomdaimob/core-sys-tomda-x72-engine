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
  material: 'MADEIRA' | 'ALUMINIO' | 'FERRO';
  origem: 'PDF' | 'MANUAL' | 'DUPLICADO';
}

interface ExtractionResult {
  doors: {
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
    detected_units: number; // Number of detected units (geminadas)
    is_geminada: boolean;
  };
}

// Generate unique ID
function generateId(): string {
  return 'item_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36).slice(-4);
}

serve(async (req) => {
  // Handle CORS
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
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'API key não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Default dimensions from admin config or use hardcoded defaults
    const defaults = defaultDimensions || {
      porta_interna_largura: 0.80,
      porta_interna_altura: 2.10,
      porta_externa_largura: 0.90,
      porta_externa_altura: 2.10,
      portao_garagem_largura: 3.00,
      portao_garagem_altura: 2.20,
      portao_pedestres_largura: 1.00,
      portao_pedestres_altura: 2.20,
    };

    console.log(`Processing PDF ${fileName} for orcamento ${orcamentoId}`);

    const systemPrompt = `Você é um especialista em leitura de projetos arquitetônicos (plantas baixas, cortes, fachadas, pranchas de esquadrias) exportados do AutoCAD.
Sua tarefa é identificar e extrair as dimensões de TODAS as PORTAS e PORTÕES do projeto, processando TODAS as páginas.

## INSTRUÇÕES CRÍTICAS - ANTI-SUBCONTAGEM:

### 1. PROCESSAMENTO COMPLETO DO PDF
- Analise TODAS as páginas: planta baixa, fachadas, cortes, pranchas de esquadrias, detalhamentos
- Liste quais páginas foram usadas para a extração
- Conte quantas aberturas aparecem em cada página

### 2. REGRAS PARA CASAS GEMINADAS / MÚLTIPLAS UNIDADES
- NÃO assuma que existe apenas uma unidade no projeto
- Procure por indicadores de múltiplas unidades:
  * Textos como "Casa 1", "Casa 2", "Unidade A/B", "Sobrado Geminado"
  * Layouts espelhados ou repetidos
  * Múltiplas entradas principais
  * Dois ou mais portões de garagem em posições simétricas
- Se detectar geminadas: DUPLIQUE as contagens para cada unidade
- Use sufixos para diferenciar: P1-A (Casa 1), P1-B (Casa 2), etc.

### 3. IDENTIFICAÇÃO DE PORTAS E PORTÕES
Identifique por:
- **Símbolos**: Arco de abertura de 90°, retângulos na parede
- **Labels/Textos**: P, PT, Porta, P1, P2, PM (pivotante), G, PG, Portão
- **Cotas**: Dimensões próximas à abertura (largura x altura)
- **Contexto**: Posição na planta (entrada, garagem, ambientes internos)

### 4. DIMENSÕES - MEDIÇÃO vs INFERÊNCIA
Para cada abertura:
- Se a cota estiver VISÍVEL: use o valor exato, marque inferred=false, confianca=0.90-0.95
- Se NÃO houver cota visível: INFERIR usando padrões, marque inferred=true, confianca=0.60-0.75

**Padrões de inferência:**
- Porta interna: ${defaults.porta_interna_largura}m x ${defaults.porta_interna_altura}m
- Porta externa/principal: ${defaults.porta_externa_largura}m x ${defaults.porta_externa_altura}m
- Portão garagem: ${defaults.portao_garagem_largura}m x ${defaults.portao_garagem_altura}m
- Portão pedestres: ${defaults.portao_pedestres_largura}m x ${defaults.portao_pedestres_altura}m

### 5. CLASSIFICAÇÃO
- Portas: INTERNA (banheiro, quarto, etc.) ou EXTERNA (entrada principal, fundos)
- Portões: geralmente externos (garagem, entrada)

### 6. FORMATO DE RESPOSTA (JSON puro, sem markdown)
{
  "doors": {
    "count": 10,
    "items": [
      {"id": "d1", "label": "P1-A", "width_m": 0.8, "height_m": 2.1, "area_m2": 1.68, "confianca": 0.95, "page_number": 1, "inferred": false, "tipo": "INTERNA"},
      {"id": "d2", "label": "P1-B", "width_m": 0.8, "height_m": 2.1, "area_m2": 1.68, "confianca": 0.70, "page_number": 1, "inferred": true, "tipo": "INTERNA"}
    ],
    "area_total_m2": 16.8,
    "counts_per_page": {"1": 5, "2": 5}
  },
  "gates": {
    "count": 2,
    "items": [
      {"id": "g1", "label": "G1-A", "width_m": 3.0, "height_m": 2.2, "area_m2": 6.6, "confianca": 0.90, "page_number": 1, "inferred": false},
      {"id": "g2", "label": "G1-B", "width_m": 3.0, "height_m": 2.2, "area_m2": 6.6, "confianca": 0.70, "page_number": 1, "inferred": true}
    ],
    "area_total_m2": 13.2,
    "counts_per_page": {"1": 2}
  },
  "source": {
    "pages_used": [1, 2, 3],
    "pages_total": 5,
    "notes": "Projeto de 2 casas geminadas identificado. Portas e portões duplicados para ambas unidades.",
    "warnings": ["Medidas de P3 e P4 inferidas por padrão", "Conferir se há mais portões na fachada posterior"],
    "detected_units": 2,
    "is_geminada": true
  }
}

### REGRAS FINAIS
- Se houver QUALQUER dúvida sobre a contagem, adicione um WARNING
- Melhor SUPERESTIMAR do que SUBESTIMAR (usuário pode remover itens depois)
- Retorne SOMENTE o JSON, sem explicações ou markdown`;

    const userPrompt = `Analise TODAS as páginas deste projeto arquitetônico (PDF) e extraia as dimensões de TODAS as PORTAS e PORTÕES.

CHECKLIST OBRIGATÓRIO:
1. Quantas páginas o documento tem?
2. É um projeto de casas geminadas ou múltiplas unidades?
3. Quantas portas você identificou no total?
4. Quantos portões você identificou no total?
5. Alguma medida foi inferida (não estava explícita)?

Se for um projeto GEMINADO ou com múltiplas unidades, DUPLIQUE as aberturas para cada unidade.

Retorne o JSON estruturado conforme especificado.`;

    // Call AI with vision
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: [
              { type: 'text', text: userPrompt },
              { 
                type: 'image_url', 
                image_url: { 
                  url: `data:application/pdf;base64,${pdfBase64}` 
                } 
              }
            ]
          }
        ],
        max_tokens: 16384, // Increased for multi-page documents
        temperature: 0.1,
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

    // Parse JSON from response
    let extractedData: ExtractionResult;
    try {
      // Try to extract JSON from the response
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

    // Validate structure
    if (!extractedData.doors || !extractedData.gates) {
      throw new Error('Estrutura de dados inválida');
    }

    // Ensure arrays and generate IDs for items
    extractedData.doors.items = (extractedData.doors.items || []).map((item, idx) => ({
      ...item,
      id: item.id || generateId(),
      area_m2: item.area_m2 || (item.width_m * item.height_m),
      confianca: item.confianca || 0.8,
      inferred: item.inferred ?? false,
      origem: 'PDF' as const,
      material: 'MADEIRA' as const, // Default material
      tipo: item.tipo || 'INTERNA',
    }));
    extractedData.doors.count = extractedData.doors.items.length;
    extractedData.doors.area_total_m2 = extractedData.doors.items.reduce((sum, item) => sum + (item.area_m2 || 0), 0);
    extractedData.doors.counts_per_page = extractedData.doors.counts_per_page || {};

    extractedData.gates.items = (extractedData.gates.items || []).map((item, idx) => ({
      ...item,
      id: item.id || generateId(),
      area_m2: item.area_m2 || (item.width_m * item.height_m),
      confianca: item.confianca || 0.8,
      inferred: item.inferred ?? false,
      origem: 'PDF' as const,
      material: 'FERRO' as const, // Default material
    }));
    extractedData.gates.count = extractedData.gates.items.length;
    extractedData.gates.area_total_m2 = extractedData.gates.items.reduce((sum, item) => sum + (item.area_m2 || 0), 0);
    extractedData.gates.counts_per_page = extractedData.gates.counts_per_page || {};

    // Ensure source
    extractedData.source = extractedData.source || {};
    extractedData.source.pages_used = extractedData.source.pages_used || [];
    extractedData.source.pages_total = extractedData.source.pages_total || extractedData.source.pages_used.length || 1;
    extractedData.source.notes = extractedData.source.notes || 'Extração automática de portas e portões';
    extractedData.source.warnings = extractedData.source.warnings || [];
    extractedData.source.detected_units = extractedData.source.detected_units || 1;
    extractedData.source.is_geminada = extractedData.source.is_geminada || false;

    // Calculate average confidence
    const allItems = [...extractedData.doors.items, ...extractedData.gates.items];
    const avgConfidence = allItems.length > 0
      ? allItems.reduce((sum, item) => sum + (item.confianca || 0.8), 0) / allItems.length
      : 0.8;

    // Add warning if low confidence or potentially undercounted
    const hasInferred = allItems.some(item => item.inferred);
    if (hasInferred && !extractedData.source.warnings.some(w => w.includes('inferidas'))) {
      extractedData.source.warnings.push('Algumas medidas foram inferidas por dimensões padrão');
    }

    // Add warning for low confidence
    if (avgConfidence < 0.75) {
      extractedData.source.warnings.push('Atenção: a importação pode não ter capturado todas as aberturas. Confira a lista e adicione manualmente se necessário.');
    }

    // Save to ia_extracoes
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // First check if exists and delete old extraction
    const checkResponse = await fetch(
      `${supabaseUrl}/rest/v1/ia_extracoes?orcamento_id=eq.${orcamentoId}&select=id,dados_brutos`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
        },
      }
    );

    if (checkResponse.ok) {
      const existingData = await checkResponse.json();
      // Find and delete old doors/gates extractions
      for (const ext of existingData) {
        if (ext.dados_brutos && 'doors' in ext.dados_brutos && 'gates' in ext.dados_brutos) {
          await fetch(`${supabaseUrl}/rest/v1/ia_extracoes?id=eq.${ext.id}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${supabaseKey}`,
              'apikey': supabaseKey,
            },
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
        arquivo_id: orcamentoId, // Use orcamento_id as placeholder for arquivo_id
        status: 'sucesso',
        dados_brutos: extractedData,
        confianca: avgConfidence,
        observacoes: `${extractedData.source.notes}. Páginas: ${extractedData.source.pages_used.join(', ')}. ${extractedData.source.is_geminada ? `Geminada detectada: ${extractedData.source.detected_units} unidades.` : ''}`,
      }),
    });

    if (!saveResponse.ok) {
      const saveError = await saveResponse.text();
      console.error('Error saving extraction:', saveError);
      // Continue anyway, just log the error
    }

    console.log(`Extraction completed: ${extractedData.doors.count} doors, ${extractedData.gates.count} gates`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extractedData,
        message: `${extractedData.doors.count} porta(s) e ${extractedData.gates.count} portão(ões) identificado(s) em ${extractedData.source.pages_used.length} página(s)${extractedData.source.is_geminada ? ` (${extractedData.source.detected_units} unidades detectadas)` : ''}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-openings-doors-gates:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
