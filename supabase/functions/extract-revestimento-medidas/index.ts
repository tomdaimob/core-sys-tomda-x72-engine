import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AmbienteMedidas {
  nome: string;
  tipo: 'cozinha' | 'banheiro';
  perimetro_m: number;
  altura_total_m: number;
  altura_meia_parede_m: number;
  area_portas_m2: number;
  area_janelas_m2: number;
  area_aberturas_total_m2: number;
  confianca: number;
}

interface ExtractionResult {
  ambientes: AmbienteMedidas[];
  metadados: {
    pagina_planta?: number;
    paginas_cortes_usadas?: number[];
    observacoes: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, fileName, orcamentoId } = await req.json();
    
    if (!pdfBase64) {
      throw new Error('PDF não fornecido');
    }

    console.log(`Processing PDF for revestimento: ${fileName}, orcamento: ${orcamentoId}`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurada');
    }

    // Call AI to analyze the PDF for revestimento measurements
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
Sua tarefa é analisar o PDF fornecido (planta baixa e/ou cortes) para extrair medidas específicas de COZINHA e BANHEIROS para cálculo de revestimento cerâmico/porcelanato.

Para cada ambiente (cozinha e cada banheiro identificado), extraia:
1. Perímetro das paredes em metros (some todos os lados do ambiente)
2. Altura total das paredes em metros (preferir valor de cortes; padrão: 2.70m para banheiros, 2.50m para cozinha)
3. Altura de meia parede em metros (se identificável; padrão: 1.20m)
4. Área de portas em m² (largura × altura de cada porta)
5. Área de janelas em m² (largura × altura de cada janela)
6. Área total de aberturas em m²

IMPORTANTE:
- Identifique quantos banheiros existem (pode haver vários)
- Se não encontrar medidas exatas, use estimativas baseadas em proporções típicas
- Inclua nível de confiança (0 a 1) para cada ambiente
- Se não identificar um tipo de ambiente, não o inclua`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analise esta planta arquitetônica e extraia as medidas de COZINHA e BANHEIROS para cálculo de revestimento. Nome do arquivo: ${fileName}`
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
              name: 'extrair_medidas_revestimento',
              description: 'Extrai medidas de ambientes para cálculo de revestimento',
              parameters: {
                type: 'object',
                properties: {
                  ambientes: {
                    type: 'array',
                    description: 'Lista de ambientes identificados (cozinha e banheiros)',
                    items: {
                      type: 'object',
                      properties: {
                        nome: {
                          type: 'string',
                          description: 'Nome do ambiente (ex: Cozinha, Banheiro 1, Banheiro Suite)'
                        },
                        tipo: {
                          type: 'string',
                          enum: ['cozinha', 'banheiro'],
                          description: 'Tipo do ambiente'
                        },
                        perimetro_m: {
                          type: 'number',
                          description: 'Perímetro total das paredes em metros'
                        },
                        altura_total_m: {
                          type: 'number',
                          description: 'Altura total das paredes em metros'
                        },
                        altura_meia_parede_m: {
                          type: 'number',
                          description: 'Altura de meia parede em metros (padrão 1.20)'
                        },
                        area_portas_m2: {
                          type: 'number',
                          description: 'Área total de portas em m²'
                        },
                        area_janelas_m2: {
                          type: 'number',
                          description: 'Área total de janelas em m²'
                        },
                        area_aberturas_total_m2: {
                          type: 'number',
                          description: 'Área total de todas as aberturas em m²'
                        },
                        confianca: {
                          type: 'number',
                          description: 'Nível de confiança da extração de 0 a 1'
                        }
                      },
                      required: ['nome', 'tipo', 'perimetro_m', 'altura_total_m', 'altura_meia_parede_m', 'area_aberturas_total_m2', 'confianca']
                    }
                  },
                  metadados: {
                    type: 'object',
                    properties: {
                      pagina_planta: {
                        type: 'number',
                        description: 'Número da página com a planta baixa'
                      },
                      paginas_cortes_usadas: {
                        type: 'array',
                        items: { type: 'number' },
                        description: 'Números das páginas com cortes utilizados'
                      },
                      observacoes: {
                        type: 'string',
                        description: 'Observações sobre a extração, limitações ou inferências feitas'
                      }
                    },
                    required: ['observacoes']
                  }
                },
                required: ['ambientes', 'metadados']
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extrair_medidas_revestimento' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns segundos.', success: false }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos à sua conta.', success: false }),
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
    
    let extractedData: ExtractionResult | null = null;
    
    if (toolCall?.function?.arguments) {
      extractedData = JSON.parse(toolCall.function.arguments);
      console.log('Extracted data:', extractedData);
    }

    // Fallback: try to parse from content if no tool call
    if (!extractedData) {
      const content = aiResponse.choices?.[0]?.message?.content;
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0]);
        }
      }
    }

    // Final fallback with default values
    if (!extractedData || !extractedData.ambientes || extractedData.ambientes.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Não foi possível identificar cozinha ou banheiros na planta. Verifique se o PDF contém planta baixa legível.',
          data: null
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Save extraction to database if orcamentoId provided
    if (orcamentoId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Upsert extraction record
      const { error: dbError } = await supabase
        .from('ia_extracoes')
        .upsert({
          orcamento_id: orcamentoId,
          status: 'sucesso',
          dados_brutos: extractedData,
          confianca: extractedData.ambientes.reduce((sum, a) => sum + a.confianca, 0) / extractedData.ambientes.length * 100,
          observacoes: extractedData.metadados?.observacoes || 'Extração automática de medidas para revestimento'
        }, {
          onConflict: 'orcamento_id'
        });

      if (dbError) {
        console.error('Error saving extraction:', dbError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: extractedData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-revestimento-medidas:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Erro ao processar PDF',
        success: false 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
