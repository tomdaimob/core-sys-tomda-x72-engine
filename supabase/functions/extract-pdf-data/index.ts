import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, fileName } = await req.json();
    
    if (!pdfBase64) {
      throw new Error('PDF não fornecido');
    }

    console.log(`Processing PDF: ${fileName}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    // Call Lovable AI to analyze the PDF content
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em análise de plantas arquitetônicas e projetos de construção.
Analise o documento PDF fornecido e extraia as seguintes informações da planta baixa:
- Área total construída em metros quadrados
- Pé-direito (altura do piso ao teto) em metros
- Perímetro externo em metros lineares
- Comprimento total de paredes internas em metros lineares
- Área total de aberturas (portas e janelas) em metros quadrados

Retorne APENAS um JSON válido com a estrutura exata abaixo. Use valores numéricos estimados baseados em plantas típicas se não conseguir extrair valores precisos.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analise esta planta arquitetônica e extraia os dados dimensionais. Nome do arquivo: ${fileName}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extrair_dados_planta',
              description: 'Extrai dados dimensionais de uma planta arquitetônica',
              parameters: {
                type: 'object',
                properties: {
                  area_total_m2: {
                    type: 'number',
                    description: 'Área total construída em metros quadrados'
                  },
                  pe_direito_m: {
                    type: 'number',
                    description: 'Pé-direito (altura) em metros'
                  },
                  perimetro_externo_m: {
                    type: 'number',
                    description: 'Perímetro externo em metros lineares'
                  },
                  paredes_internas_m: {
                    type: 'number',
                    description: 'Comprimento total de paredes internas em metros'
                  },
                  aberturas_m2: {
                    type: 'number',
                    description: 'Área total de aberturas (portas e janelas) em m²'
                  },
                  confianca: {
                    type: 'number',
                    description: 'Nível de confiança da extração de 0 a 100'
                  },
                  observacoes: {
                    type: 'string',
                    description: 'Observações sobre a extração ou limitações encontradas'
                  }
                },
                required: ['area_total_m2', 'pe_direito_m', 'perimetro_externo_m', 'paredes_internas_m', 'aberturas_m2', 'confianca', 'observacoes']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extrair_dados_planta' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos à sua conta.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error('Erro ao processar com IA');
    }

    const aiResponse = await response.json();
    console.log('AI Response:', JSON.stringify(aiResponse));

    // Extract the tool call result
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const extractedData = JSON.parse(toolCall.function.arguments);
      console.log('Extracted data:', extractedData);
      
      return new Response(
        JSON.stringify({
          success: true,
          data: extractedData
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fallback: try to parse from content if no tool call
    const content = aiResponse.choices?.[0]?.message?.content;
    if (content) {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extractedData = JSON.parse(jsonMatch[0]);
        return new Response(
          JSON.stringify({
            success: true,
            data: extractedData
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Return default values if extraction failed
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          area_total_m2: 120,
          pe_direito_m: 2.80,
          perimetro_externo_m: 44,
          paredes_internas_m: 35,
          aberturas_m2: 18,
          confianca: 30,
          observacoes: 'Não foi possível extrair dados precisos. Valores estimados para uma residência típica.'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-pdf-data:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro ao processar PDF',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
