import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, fileName, orcamentoId, pavimentoId, arquivoId } = await req.json();

    if (!pdfBase64 || !orcamentoId || !pavimentoId || !arquivoId) {
      throw new Error('Parâmetros obrigatórios: pdfBase64, orcamentoId, pavimentoId, arquivoId');
    }

    console.log(`Processing PDF for floor: ${pavimentoId}, file: ${fileName}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

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
            content: `Você é um engenheiro civil sênior. Extraia as medidas TOTAIS DO PROJETO INTEIRO para este pavimento.

## REGRA PRINCIPAL — SOMAR TODAS AS UNIDADES
Se o projeto contém CASAS GEMINADAS, UNIDADES REPETIDAS ou MÚLTIPLAS CASAS:
- **SOME** as medidas de TODAS as unidades para obter o TOTAL DO PROJETO.
- Exemplo: casa geminada com 2 casas iguais de perímetro 40m cada → perímetro total = 80m.
- Exemplo: 2 casas de 86m² cada → área total = 173m².
- Informe quantas unidades foram somadas no campo "quantidade_unidades".

## PRIORIDADES DE LEITURA
1. **QUADRO DE ÁREAS**: Se existir, USE os valores e SOME todas as unidades.
2. **COTAS EXPLÍCITAS**: Linhas dimensionais com setas e números (metros ou centímetros).
3. **ESCALA**: Procure "ESC.", "1:" para calibrar medições.

## O QUE EXTRAIR (TOTAL DO PROJETO para este pavimento)
- **Área total**: Soma da área de TODAS as unidades
- **Perímetro externo**: Soma do perímetro de TODAS as unidades
- **Paredes internas**: Soma dos comprimentos de paredes internas de TODAS as unidades
- **Aberturas**: Soma das áreas de portas e janelas de TODAS as unidades
- **Pé-direito**: Do corte ou 2.80m padrão
- **Quantidade de unidades**: Quantas casas/unidades foram somadas (ex: geminada = 2, isolada = 1)

## VALIDAÇÃO (por unidade individual, antes de somar)
- Perímetro² / (4 × Área) entre 1.0 e 2.5
- Paredes internas ≈ 60-120% do perímetro externo

## REGRAS
- NUNCA invente valores — confiança baixa se estimar
- Sem cotas legíveis → confiança < 40
- Seja DETERMINÍSTICO: mesma planta = mesmos valores
- SEMPRE retorne o TOTAL somado, nunca valores de apenas uma unidade`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Extraia as medidas TOTAIS deste pavimento. Se houver casas geminadas ou múltiplas unidades, SOME todas as medidas.

Se existir "Quadro de Áreas", use os valores dele e SOME todas as unidades. Arquivo: ${fileName}`
              },
              {
                type: 'image_url',
                image_url: { url: `data:application/pdf;base64,${pdfBase64}` }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extrair_dados_pavimento',
              description: 'Extrai dados dimensionais TOTAIS de um pavimento (todas as unidades somadas)',
              parameters: {
                type: 'object',
                properties: {
                  area_total_m2: { type: 'number', description: 'Área total construída SOMADA de todas as unidades em m²' },
                  pe_direito_m: { type: 'number', description: 'Pé-direito em metros' },
                  perimetro_externo_m: { type: 'number', description: 'Perímetro externo TOTAL somado de todas as unidades em metros lineares' },
                  paredes_internas_m: { type: 'number', description: 'Comprimento TOTAL paredes internas somado de todas as unidades em metros' },
                  aberturas_m2: { type: 'number', description: 'Área TOTAL de aberturas somada de todas as unidades em m²' },
                  confianca: { type: 'number', description: 'Nível de confiança 0 a 100' },
                  observacoes: { type: 'string', description: 'Detalhes: cotas lidas, quantas unidades somadas, escala, limitações' },
                  escala_detectada: { type: 'string', description: 'Escala detectada ou "não identificada"' },
                  ambientes_identificados: { type: 'number', description: 'Quantidade total de ambientes/cômodos em todas as unidades' },
                  quantidade_unidades: { type: 'number', description: 'Quantidade de unidades/casas somadas (ex: geminada = 2, isolada = 1). Default 1.' }
                },
                required: ['area_total_m2', 'pe_direito_m', 'perimetro_externo_m', 'paredes_internas_m', 'aberturas_m2', 'confianca', 'observacoes'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extrair_dados_pavimento' } },
        temperature: 0,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido.' }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes.' }), 
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      throw new Error('Erro ao processar com IA');
    }

    const aiResponse = await response.json();
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    
    let extractedData: any = null;

    if (toolCall?.function?.arguments) {
      extractedData = JSON.parse(toolCall.function.arguments);
    } else {
      const content = aiResponse.choices?.[0]?.message?.content;
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) extractedData = JSON.parse(jsonMatch[0]);
      }
    }

    if (!extractedData) {
      extractedData = {
        area_total_m2: 0,
        pe_direito_m: 2.80,
        perimetro_externo_m: 0,
        paredes_internas_m: 0,
        aberturas_m2: 0,
        confianca: 10,
        observacoes: 'Não foi possível extrair dados precisos. O PDF pode não conter planta baixa legível.'
      };
    }

    console.log('Extracted data (TOTAL):', extractedData);

    // Save extraction to ia_extracoes
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const { data: extracao, error: extError } = await supabaseAdmin
      .from('ia_extracoes')
      .insert({
        arquivo_id: arquivoId,
        orcamento_id: orcamentoId,
        pavimento_id: pavimentoId,
        tipo: 'MEDIDAS_PAVIMENTO',
        status: 'concluido',
        area_total_m2: extractedData.area_total_m2,
        pe_direito_m: extractedData.pe_direito_m,
        perimetro_externo_m: extractedData.perimetro_externo_m,
        paredes_internas_m: extractedData.paredes_internas_m,
        aberturas_m2: extractedData.aberturas_m2,
        confianca: extractedData.confianca,
        observacoes: extractedData.observacoes,
        payload_json: extractedData,
      })
      .select('id')
      .single();

    if (extError) {
      console.error('Error saving extraction:', extError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData,
        extracaoId: extracao?.id || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-floor-measurements:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro ao processar PDF', success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
