// Mr. Obras — Pipeline: chama edge function com IA + contexto do DB
import { supabase } from '@/integrations/supabase/client';
import type { ChatAction } from './mr-obras-chat';

export interface PipelineResult {
  content: string;
  actions: ChatAction[];
  sources: string[];
}

export interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function processarMensagemAsync(
  text: string,
  isAdmin: boolean,
  orcamentoId: string | null,
  history: ChatHistoryMessage[] = [],
): Promise<PipelineResult> {
  const { data, error } = await supabase.functions.invoke('mr-obras-chat', {
    body: {
      message: text,
      history,
      orcamentoId,
      isAdmin,
    },
  });

  if (error) {
    console.error('Edge function error:', error);
    return {
      content: `Ops, tive um problema ao consultar o sistema: ${error.message || 'erro desconhecido'}. Tente novamente.`,
      actions: [],
      sources: ['Erro'],
    };
  }

  return {
    content: data?.content || 'Não consegui processar. Tente novamente.',
    actions: data?.actions || [],
    sources: data?.sources || [],
  };
}
