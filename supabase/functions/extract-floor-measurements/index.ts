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

    // Call Lovable AI to analyze the PDF
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
            content: `Você é um especialista em análise de plantas arquitetônicas.
Analise o documento PDF fornecido e extraia as medidas deste PAVIMENTO ESPECÍFICO:
- Área total construída em metros quadrados
- Pé-direito (altura do piso ao teto) em metros
- Perímetro externo em metros lineares
- Comprimento total de paredes internas em metros lineares
- Área total de aberturas (portas e janelas) em metros quadrados

Se o PDF contiver vários pavimentos, extraia apenas as medidas do pavimento principal visível.
Retorne APENAS um JSON válido.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analise esta planta de pavimento e extraia os dados dimensionais. Arquivo: ${fileName}`
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
                  observacoes: { type: 'string', description: 'Observações sobre a extração' }
                },
                required: ['area_total_m2', 'pe_direito_m', 'perimetro_externo_m', 'paredes_internas_m', 'aberturas_m2', 'confianca', 'observacoes']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extrair_dados_pavimento' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido.' }), 
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
        area_total_m2: 120,
        pe_direito_m: 2.80,
        perimetro_externo_m: 44,
        paredes_internas_m: 35,
        aberturas_m2: 18,
        confianca: 30,
        observacoes: 'Valores estimados. Não foi possível extrair dados precisos.'
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
        status: 'sucesso',
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
