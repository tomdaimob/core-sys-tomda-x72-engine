import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DoorGateItem {
  label: string;
  width_m: number;
  height_m: number;
  area_m2: number;
  confianca: number;
}

interface ExtractionResult {
  doors: {
    count: number;
    items: DoorGateItem[];
    area_total_m2: number;
  };
  gates: {
    count: number;
    items: DoorGateItem[];
    area_total_m2: number;
  };
  source: {
    pages_used: number[];
    notes: string;
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, fileName, orcamentoId } = await req.json();

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

    console.log(`Processing PDF ${fileName} for orcamento ${orcamentoId}`);

    const systemPrompt = `Você é um especialista em leitura de projetos arquitetônicos (plantas baixas, cortes e fachadas) exportados do AutoCAD.
Sua tarefa é identificar e extrair as dimensões de PORTAS e PORTÕES do projeto.

INSTRUÇÕES:
1. Analise a planta baixa e identifique todas as aberturas de portas e portões
2. Para cada abertura, extraia:
   - Label/código (P1, P2, G1, etc.)
   - Largura em metros
   - Altura em metros (prefira buscar nos cortes; se não encontrar, use 2.10m para portas e 2.20m para portões)
   - Calcule a área (largura × altura)
3. Diferencie PORTAS (doors) de PORTÕES (gates):
   - Portas: aberturas internas e de entrada (geralmente até 1.20m de largura)
   - Portões: acessos de garagem, portões externos (geralmente acima de 2.00m de largura)
4. Retorne SOMENTE um JSON válido, sem texto adicional

FORMATO DE RESPOSTA (JSON puro):
{
  "doors": {
    "count": 5,
    "items": [
      {"label": "P1", "width_m": 0.8, "height_m": 2.1, "area_m2": 1.68, "confianca": 0.95}
    ],
    "area_total_m2": 12.5
  },
  "gates": {
    "count": 2,
    "items": [
      {"label": "G1", "width_m": 3.0, "height_m": 2.2, "area_m2": 6.6, "confianca": 0.90}
    ],
    "area_total_m2": 13.2
  },
  "source": {
    "pages_used": [1, 2],
    "notes": "Alturas extraídas do corte AA"
  }
}

Se não conseguir identificar portas ou portões, retorne arrays vazios com count 0 e area_total_m2 0.`;

    const userPrompt = `Analise este projeto arquitetônico (PDF) e extraia as dimensões de todas as PORTAS e PORTÕES.
Retorne o JSON estruturado conforme especificado.`;

    // Call AI with vision
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
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
        max_tokens: 4096,
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

    console.log('AI response:', content);

    // Parse JSON from response
    let extractedData: ExtractionResult;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Nenhum JSON encontrado na resposta');
      }
      extractedData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      throw new Error('Não foi possível interpretar a resposta da IA');
    }

    // Validate structure
    if (!extractedData.doors || !extractedData.gates) {
      throw new Error('Estrutura de dados inválida');
    }

    // Ensure arrays and totals
    extractedData.doors.items = extractedData.doors.items || [];
    extractedData.doors.count = extractedData.doors.items.length;
    extractedData.doors.area_total_m2 = extractedData.doors.items.reduce((sum, item) => sum + (item.area_m2 || 0), 0);

    extractedData.gates.items = extractedData.gates.items || [];
    extractedData.gates.count = extractedData.gates.items.length;
    extractedData.gates.area_total_m2 = extractedData.gates.items.reduce((sum, item) => sum + (item.area_m2 || 0), 0);

    // Save to ia_extracoes
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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
        status: 'sucesso',
        dados_brutos: extractedData,
        confianca: Math.min(
          ...extractedData.doors.items.map(i => i.confianca || 0.8),
          ...extractedData.gates.items.map(i => i.confianca || 0.8),
          0.85
        ),
        observacoes: extractedData.source?.notes || 'Extração automática de portas e portões',
      }),
    });

    if (!saveResponse.ok) {
      const saveError = await saveResponse.text();
      console.error('Error saving extraction:', saveError);
      // Continue anyway, just log the error
    }

    console.log('Extraction completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extractedData,
        message: `${extractedData.doors.count} porta(s) e ${extractedData.gates.count} portão(ões) identificado(s)`
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
