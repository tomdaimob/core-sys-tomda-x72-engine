import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: `Você é um engenheiro civil sênior. Extraia as medidas TOTAIS DO PROJETO INTEIRO.

## REGRA PRINCIPAL — SOMAR TODAS AS UNIDADES
Se o projeto contém CASAS GEMINADAS, UNIDADES REPETIDAS ou MÚLTIPLAS CASAS:
- **SOME** as medidas de TODAS as unidades para obter o TOTAL DO PROJETO.
- Exemplo: casa geminada com 2 casas iguais de perímetro 40m cada → perímetro total = 80m.
- Exemplo: 2 casas de 86m² cada → área total = 173m².
- Informe quantas unidades foram somadas no campo "quantidade_unidades".

## PRIORIDADES DE LEITURA
1. **QUADRO DE ÁREAS**: Se existir, USE os valores. Para o total, SOME todas as unidades.
2. **COTAS EXPLÍCITAS**: Linhas com setas e números. Em metros (3.50) ou centímetros (350).
3. **ESCALA**: Procure "ESC.", "1:" para calibrar.

## O QUE EXTRAIR (TOTAL DO PROJETO)
- **Área total**: Soma da área de TODAS as unidades
- **Perímetro externo**: Soma do perímetro de TODAS as unidades
- **Paredes internas**: Soma do comprimento de paredes internas de TODAS as unidades
- **Aberturas**: Soma das áreas de portas e janelas de TODAS as unidades (largura × altura)
- **Pé-direito**: Do corte (se existir) ou 2.80m padrão
- **Quantidade de unidades**: Quantas casas/unidades existem no projeto (ex: geminada = 2, isolada = 1)

## VALIDAÇÃO
- Para CADA unidade: Perímetro² / (4 × Área) deve estar entre 1.0 e 2.5
- Paredes internas por unidade ≈ 60-120% do perímetro externo por unidade
- Se inconsistente, CORRIJA e explique

## REGRAS CRÍTICAS
- NUNCA invente valores — use confiança baixa se estimar
- Se não ler cotas, retorne confiança < 40
- Seja DETERMINÍSTICO: mesma planta = mesmos valores sempre
- SEMPRE retorne o TOTAL somado, nunca valores de apenas uma unidade`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extraia as medidas TOTAIS deste projeto. Se houver casas geminadas ou múltiplas unidades, SOME todas as medidas para obter o total do projeto inteiro.

Se existir "Quadro de Áreas", use os valores dele e SOME todas as unidades. Arquivo: ${fileName}`
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
              description: 'Extrai dados dimensionais TOTAIS de um projeto arquitetônico (todas as unidades somadas)',
              parameters: {
                type: 'object',
                properties: {
                  area_total_m2: {
                    type: 'number',
                    description: 'Área total construída SOMADA de todas as unidades em m²'
                  },
                  pe_direito_m: {
                    type: 'number',
                    description: 'Pé-direito (altura) em metros'
                  },
                  perimetro_externo_m: {
                    type: 'number',
                    description: 'Perímetro externo TOTAL somado de todas as unidades em metros lineares'
                  },
                  paredes_internas_m: {
                    type: 'number',
                    description: 'Comprimento TOTAL de paredes internas somado de todas as unidades em metros'
                  },
                  aberturas_m2: {
                    type: 'number',
                    description: 'Área TOTAL de aberturas (portas e janelas) somada de todas as unidades em m²'
                  },
                  confianca: {
                    type: 'number',
                    description: 'Nível de confiança da extração de 0 a 100'
                  },
                  observacoes: {
                    type: 'string',
                    description: 'Observações sobre a extração: quais cotas foram lidas, quantas unidades somadas, escala usada, limitações'
                  },
                  escala_detectada: {
                    type: 'string',
                    description: 'Escala identificada no projeto (ex: 1:50, 1:100) ou "não identificada"'
                  },
                  dimensoes_externas: {
                    type: 'string',
                    description: 'Dimensões externas de uma unidade (ex: "10.50m x 12.30m")'
                  },
                  quantidade_unidades: {
                    type: 'number',
                    description: 'Quantidade de unidades/casas no projeto que foram somadas (ex: geminada = 2, isolada = 1). Default 1.'
                  }
                },
                required: ['area_total_m2', 'pe_direito_m', 'perimetro_externo_m', 'paredes_internas_m', 'aberturas_m2', 'confianca', 'observacoes'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extrair_dados_planta' } },
        temperature: 0,
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
    console.log('AI Response received');

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

    const content = aiResponse.choices?.[0]?.message?.content;
    if (content) {
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

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          area_total_m2: 0,
          pe_direito_m: 2.80,
          perimetro_externo_m: 0,
          paredes_internas_m: 0,
          aberturas_m2: 0,
          confianca: 10,
          observacoes: 'Não foi possível extrair dados precisos do PDF.'
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
