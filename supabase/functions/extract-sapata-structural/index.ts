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
        model: 'google/gemini-2.5-pro',
        messages: [
          {
            role: 'system',
            content: `Você é um engenheiro estrutural sênior especializado em projetos de fundação.

## OBJETIVO
Analisar o projeto estrutural e extrair dados sobre SAPATAS ISOLADAS e/ou PILARES.

## METODOLOGIA — PASSO A PASSO

### 1. IDENTIFICAR TIPO DE DOCUMENTO
- Planta de locação de pilares?
- Detalhamento de sapatas?
- Planta de formas?
- Resumo de aço/concreto?

### 2. LOCALIZAR TABELA DE SAPATAS
Projetos estruturais geralmente têm uma tabela/quadro com:
- Tipo da sapata (S1, S2, S3...)
- Quantidade de cada tipo
- Dimensões: Largura × Comprimento × Altura
- Armadura (diâmetro e espaçamento)

**SE ENCONTRAR A TABELA: use-a — é a fonte mais confiável.**

### 3. SE NÃO HOUVER TABELA
Analise os detalhamentos individuais:
- Procure cotas nos desenhos de sapata em planta e corte
- Identifique: largura (A), comprimento (B), altura (H)
- Conte a quantidade de cada tipo pela planta de locação

### 4. RESUMOS DE MATERIAIS
Se o projeto tiver:
- **Resumo de concreto**: extraia o volume total (m³) por elemento
- **Resumo de aço**: extraia o peso total (kg) por diâmetro
- Estes dados servem para validação cruzada

### 5. VALIDAÇÃO
- Sapatas típicas residenciais: 0.40m a 1.50m de lado
- Altura típica: 0.20m a 0.50m
- Quantidade típica: 4 a 20 sapatas por residência
- Se algo parecer fora do padrão, avise nas observações

## REGRAS
- LEIA as cotas — não invente dimensões
- Se não conseguir ler, diga explicitamente
- Confiança alta apenas se tabela foi encontrada ou cotas são claras`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analise este projeto estrutural e extraia os dados de sapatas/pilares.

ANTES DE RESPONDER:
1. O documento tem tabela/quadro de sapatas?
2. Quantos tipos de sapata você identifica?
3. Quais cotas são visíveis?
4. Existe resumo de concreto ou aço?

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
                        fonte: { type: 'string', description: 'Como a medida foi obtida: tabela, cota, inferida' }
                      },
                      required: ['nome', 'quantidade', 'largura_m', 'comprimento_m', 'altura_m']
                    },
                    description: 'Lista de tipos de sapata encontrados'
                  },
                  volume_concreto_total_m3: { type: 'number', description: 'Volume total de concreto em m³ (se informado)' },
                  peso_aco_total_kg: { type: 'number', description: 'Peso total de aço em kg (se informado)' },
                  confianca: { type: 'number', description: 'Nível de confiança 0 a 100' },
                  observacoes: { type: 'string', description: 'Detalhes: fonte dos dados, cotas lidas, limitações' }
                },
                required: ['tipos', 'confianca', 'observacoes'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extrair_sapatas_estrutural' } },
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

    if (!extractedData || !extractedData.tipos || extractedData.tipos.length === 0) {
      extractedData = {
        tipos: [],
        confianca: 10,
        observacoes: 'Não foi possível extrair dados de sapatas do documento. O PDF pode não conter projeto estrutural de fundação.',
      };
    }

    // Save extraction
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

    if (extError) console.error('Error saving extraction:', extError);

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
