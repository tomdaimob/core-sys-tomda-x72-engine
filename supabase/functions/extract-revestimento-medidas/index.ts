import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXTRACAO_TIPO = 'REVESTIMENTO_MEDIDAS';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pdfBase64, fileName, orcamentoId, arquivoId } = await req.json();

    if (!pdfBase64) throw new Error('PDF não fornecido');
    if (!arquivoId) throw new Error('arquivo_id não fornecido');

    console.log(`Processing PDF for revestimento: ${fileName}, orcamento: ${orcamentoId}, arquivo: ${arquivoId}`);

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
            content: `Você é um engenheiro civil / arquiteto sênior especializado em levantamento de quantitativos para revestimento cerâmico/porcelanato.

## OBJETIVO
Extrair medidas de COZINHA e BANHEIROS para cálculo de área de revestimento (piso + parede).

## METODOLOGIA — PASSO A PASSO

### 1. IDENTIFICAR AMBIENTES MOLHADOS
Na planta baixa, localize:
- **Cozinha** (COZ, Coz., Cozinha) — geralmente próxima à área de serviço
- **Banheiros** (WC, BWC, Ban., Banheiro, Lavabo, Suite) — podem haver vários
- **Área de Serviço** (A.S., Serv., Lavanderia) — se presente

### 2. MEDIR PERÍMETRO DE CADA AMBIENTE
Para cada ambiente molhado:
- Leia as COTAS internas (dimensões do cômodo)
- Se o cômodo é retangular: perímetro = 2 × (largura + comprimento)
- Se irregular: some todos os lados
- Use cotas do projeto, NÃO estime se houver valores visíveis

### 3. ALTURA DAS PAREDES
- Procure em CORTES a altura piso-a-piso ou piso-laje
- Padrões se não encontrar:
  - Banheiro: 2.70m (altura total), 1.50m (meia parede para azulejo)
  - Cozinha: 2.60m (altura total), 1.50m (meia parede)
  - Lavabo: 2.70m (altura total), 1.20m (meia parede)

### 4. ABERTURAS NOS AMBIENTES
Para cada ambiente, calcule:
- Área de portas: largura × altura de cada porta no ambiente
- Área de janelas: largura × altura de cada janela no ambiente
- Total de aberturas = portas + janelas

### 5. VALIDAÇÃO
- Perímetro de banheiro típico: 5-12m
- Perímetro de cozinha típico: 10-20m
- Se o perímetro for muito grande ou pequeno, revise as cotas

## REGRAS
- LEIA as cotas — não invente
- Se não encontrar um tipo de ambiente, NÃO o inclua
- Confiança alta (>0.85) apenas se as cotas estão claras
- Informe nas observações como cada medida foi obtida`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analise esta planta e extraia as medidas de COZINHA e BANHEIROS para revestimento.

ANTES DE RESPONDER:
1. Quantos ambientes molhados você identifica?
2. Quais cotas de cada ambiente você consegue ler?
3. Existe corte mostrando a altura das paredes?

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
                        nome: { type: 'string', description: 'Nome do ambiente (ex: Cozinha, Banheiro 1, Banheiro Suite)' },
                        tipo: { type: 'string', enum: ['cozinha', 'banheiro'], description: 'Tipo do ambiente' },
                        perimetro_m: { type: 'number', description: 'Perímetro total das paredes em metros' },
                        largura_m: { type: 'number', description: 'Largura do ambiente em metros (se retangular)' },
                        comprimento_m: { type: 'number', description: 'Comprimento do ambiente em metros (se retangular)' },
                        altura_total_m: { type: 'number', description: 'Altura total das paredes em metros' },
                        altura_meia_parede_m: { type: 'number', description: 'Altura de meia parede em metros' },
                        area_portas_m2: { type: 'number', description: 'Área total de portas em m²' },
                        area_janelas_m2: { type: 'number', description: 'Área total de janelas em m²' },
                        area_aberturas_total_m2: { type: 'number', description: 'Área total de todas as aberturas em m²' },
                        confianca: { type: 'number', description: 'Nível de confiança 0 a 1' },
                        fonte_medidas: { type: 'string', description: 'Como as medidas foram obtidas (cotas lidas, inferidas, tabela)' }
                      },
                      required: ['nome', 'tipo', 'perimetro_m', 'altura_total_m', 'altura_meia_parede_m', 'area_aberturas_total_m2', 'confianca']
                    }
                  },
                  metadados: {
                    type: 'object',
                    properties: {
                      pagina_planta: { type: 'number', description: 'Número da página com a planta baixa' },
                      paginas_cortes_usadas: { type: 'array', items: { type: 'number' }, description: 'Páginas com cortes usados' },
                      observacoes: { type: 'string', description: 'Detalhes sobre a extração e como as medidas foram obtidas' }
                    },
                    required: ['observacoes']
                  }
                },
                required: ['ambientes', 'metadados'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extrair_medidas_revestimento' } },
        temperature: 0,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Limite de requisições excedido.', success: false }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Créditos insuficientes.', success: false }),
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
    }

    if (!extractedData) {
      const content = aiResponse.choices?.[0]?.message?.content;
      if (content) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) extractedData = JSON.parse(jsonMatch[0]);
      }
    }

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

    // Save extraction
    if (orcamentoId && arquivoId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const confiancaMedia = extractedData.ambientes.reduce((sum: number, a: any) => sum + a.confianca, 0) / extractedData.ambientes.length;

      const { error: dbError } = await supabase
        .from('ia_extracoes')
        .insert({
          orcamento_id: orcamentoId,
          arquivo_id: arquivoId,
          tipo: EXTRACAO_TIPO,
          status: 'sucesso',
          dados_brutos: extractedData,
          payload_json: extractedData,
          confianca: confiancaMedia * 100,
          observacoes: extractedData.metadados?.observacoes || 'Extração automática de medidas para revestimento'
        });

      if (dbError) console.error('Error saving extraction:', dbError);
    }

    return new Response(
      JSON.stringify({ success: true, data: extractedData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in extract-revestimento-medidas:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro ao processar PDF', success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
