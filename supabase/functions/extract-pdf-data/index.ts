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
            content: `Você é um engenheiro civil / arquiteto sênior especializado em leitura técnica de plantas baixas, cortes e fachadas exportados do AutoCAD, Revit ou similares.

## METODOLOGIA DE LEITURA (SIGA PASSO A PASSO)

### Passo 1 — Identificar o tipo de documento
- Planta baixa? Corte? Fachada? Prancha de locação?
- Qual a ESCALA indicada? (1:50, 1:100, 1:75, etc.)
- Se houver escala gráfica, use-a para calibrar suas medições.

### Passo 2 — Localizar COTAS EXPLÍCITAS
- Procure por linhas de cota (linhas com setas e valores numéricos).
- Priorize cotas externas (perímetro) sobre cotas internas.
- COTAS são as medidas escritas nas linhas dimensionais — NÃO invente valores.

### Passo 3 — Calcular Área Total
- Some as dimensões externas para obter COMPRIMENTO e LARGURA totais.
- Área = Comprimento × Largura (para retangulares) ou some as áreas parciais.
- Se a planta tiver recortes (L, U, T), divida em retângulos e some.

### Passo 4 — Calcular Perímetro Externo
- Some TODOS os lados externos da construção.
- Não confunda com perímetro do terreno.

### Passo 5 — Paredes Internas
- Identifique as paredes internas (traços mais finos entre ambientes).
- Some os comprimentos de TODAS as paredes internas visíveis.
- Paredes internas são as que dividem os cômodos.

### Passo 6 — Aberturas
- Identifique portas (arcos de abertura) e janelas (linhas paralelas na parede).
- Estime a área total de aberturas (largura × altura de cada uma).

### Passo 7 — Pé-Direito
- Se houver corte, leia a altura entre piso acabado e laje/forro.
- Se não houver corte, use 2.80m como padrão residencial.

### Passo 8 — Validação Cruzada
- Verifique: Perímetro² / (4 × Área) deve estar entre 1.0 e 2.5 (formas comuns).
- Paredes internas geralmente = 60-120% do perímetro externo.
- Se algo parecer inconsistente, ajuste e explique nas observações.

## REGRAS CRÍTICAS
- NUNCA retorne valores inventados sem avisar — use "confianca" baixa e explique em "observacoes".
- Se não conseguir ler NENHUMA cota, diga explicitamente e retorne confianca < 40.
- Prefira ser PRECISO a ser rápido. Releia as cotas com cuidado.
- Considere que a escala pode estar em metros ou centímetros (identifique pelo contexto).`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analise esta planta arquitetônica com máxima precisão. Siga a metodologia passo a passo. Nome do arquivo: ${fileName}

IMPORTANTE: Leia TODAS as cotas visíveis antes de responder. Não estime — meça.`
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
                    description: 'Observações sobre a extração: quais cotas foram lidas, quais inferidas, escala usada, limitações'
                  },
                  escala_detectada: {
                    type: 'string',
                    description: 'Escala identificada no projeto (ex: 1:50, 1:100) ou "não identificada"'
                  },
                  dimensoes_externas: {
                    type: 'string',
                    description: 'Dimensões externas lidas (ex: "10.50m x 12.30m em L")'
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
    console.log('AI Response:', JSON.stringify(aiResponse));

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
          observacoes: 'Não foi possível extrair dados precisos do PDF. O documento pode não conter planta baixa legível ou as cotas não estão visíveis.'
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
