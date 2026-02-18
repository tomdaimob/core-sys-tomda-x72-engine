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
    const { pdfBase64, fileName, orcamentoId, arquivoId } = await req.json();

    if (!pdfBase64 || !orcamentoId || !arquivoId) {
      throw new Error('Parâmetros obrigatórios: pdfBase64, orcamentoId, arquivoId');
    }

    console.log(`Processing structural PDF for sapata: ${fileName}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY não configurada');

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
            content: `Você é um especialista em análise de projetos estruturais de fundação.
Analise o documento PDF fornecido e extraia dados sobre SAPATAS ISOLADAS e/ou PILARES.
Para cada tipo de sapata encontrado, extraia:
- Nome/identificação do tipo
- Quantidade de unidades
- Largura em metros
- Comprimento em metros 
- Altura em metros

Se o PDF contiver um resumo de aço, extraia também o peso total de aço (kg).
Se contiver volume total de concreto, extraia também.
Retorne APENAS via tool call.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analise este projeto estrutural e extraia os dados de sapatas/pilares. Arquivo: ${fileName}`
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
              name: 'extrair_sapatas_estrutural',
              description: 'Extrai dados de sapatas de um projeto estrutural',
              parameters: {
                type: 'object',
                properties: {
                  tipos: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        nome: { type: 'string', description: 'Nome/ID do tipo (ex: S1, S2)' },
                        quantidade: { type: 'number', description: 'Quantidade de sapatas deste tipo' },
                        largura_m: { type: 'number', description: 'Largura em metros' },
                        comprimento_m: { type: 'number', description: 'Comprimento em metros' },
                        altura_m: { type: 'number', description: 'Altura em metros' },
                      },
                      required: ['nome', 'quantidade', 'largura_m', 'comprimento_m', 'altura_m']
                    },
                    description: 'Lista de tipos de sapata encontrados'
                  },
                  volume_concreto_total_m3: { type: 'number', description: 'Volume total de concreto em m³ (se informado no PDF)' },
                  peso_aco_total_kg: { type: 'number', description: 'Peso total de aço em kg (se informado no PDF)' },
                  confianca: { type: 'number', description: 'Nível de confiança 0 a 100' },
                  observacoes: { type: 'string', description: 'Observações sobre a extração' }
                },
                required: ['tipos', 'confianca', 'observacoes']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extrair_sapatas_estrutural' } }
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

    if (!extractedData || !extractedData.tipos || extractedData.tipos.length === 0) {
      extractedData = {
        tipos: [],
        confianca: 10,
        observacoes: 'Não foi possível extrair dados de sapatas do documento.',
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
        tipo: 'SAPATA_ESTRUTURAL',
        status: extractedData.confianca >= 30 && extractedData.tipos.length > 0 ? 'concluido' : 'erro',
        payload_json: extractedData,
        confianca: extractedData.confianca,
        observacoes: extractedData.observacoes,
      })
      .select('id')
      .single();

    if (extError) {
      console.error('Error saving extraction:', extError);
    }

    return new Response(
      JSON.stringify({
        success: extractedData.tipos.length > 0,
        data: extractedData,
        extracaoId: extracao?.id || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-sapata-structural:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro ao processar PDF', success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
