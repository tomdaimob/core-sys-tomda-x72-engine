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
            content: `Você é um engenheiro civil sênior. Extraia medidas de UMA ÚNICA UNIDADE habitacional (pavimento específico).

## REGRA PRINCIPAL
Se o projeto contém CASAS GEMINADAS ou UNIDADES REPETIDAS, extraia os dados de **UMA ÚNICA UNIDADE** (a primeira/Casa 1). NÃO some todas as unidades.

## PRIORIDADES DE LEITURA
1. **QUADRO DE ÁREAS**: Se existir, USE os valores diretamente — é a fonte mais confiável.
2. **COTAS EXPLÍCITAS**: Linhas dimensionais com setas e números (metros ou centímetros).
3. **ESCALA**: Procure "ESC.", "1:" para calibrar medições.

## O QUE EXTRAIR (para 1 unidade, 1 pavimento)
- **Área total**: Do quadro de áreas OU comprimento × largura da unidade
- **Perímetro externo**: Soma dos lados externos DA UNIDADE
- **Paredes internas**: Comprimentos das paredes que dividem cômodos DENTRO da unidade
- **Aberturas**: Áreas de portas e janelas DA UNIDADE
- **Pé-direito**: Do corte ou 2.80m padrão

## VALIDAÇÃO
- Perímetro² / (4 × Área) entre 1.0 e 2.5
- Paredes internas ≈ 60-120% do perímetro externo

## REGRAS
- NUNCA invente valores — confiança baixa se estimar
- Sem cotas legíveis → confiança < 40
- Seja DETERMINÍSTICO: mesma planta = mesmos valores`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analise este projeto para o pavimento específico. Siga a metodologia passo a passo.

CHECKLIST:
1. Qual a escala do projeto?
2. Quais cotas você consegue ler?
3. Qual a geometria da planta (retangular, L, U)?
4. Quantos ambientes internos existem?

Arquivo: ${fileName}`
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
              description: 'Extrai dados dimensionais de um pavimento',
              parameters: {
                type: 'object',
                properties: {
                  area_total_m2: { type: 'number', description: 'Área total construída em m²' },
                  pe_direito_m: { type: 'number', description: 'Pé-direito em metros' },
                  perimetro_externo_m: { type: 'number', description: 'Perímetro externo em metros lineares' },
                  paredes_internas_m: { type: 'number', description: 'Comprimento total paredes internas em metros' },
                  aberturas_m2: { type: 'number', description: 'Área total de aberturas em m²' },
                  confianca: { type: 'number', description: 'Nível de confiança 0 a 100' },
                  observacoes: { type: 'string', description: 'Detalhes: cotas lidas, escala, limitações, cálculos feitos' },
                  escala_detectada: { type: 'string', description: 'Escala detectada ou "não identificada"' },
                  ambientes_identificados: { type: 'number', description: 'Quantidade de ambientes/cômodos internos identificados' }
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
