import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { type ChatMessage, type ChatAction } from '@/lib/mr-obras-chat';
import { processarMensagemAsync, type ChatHistoryMessage } from '@/lib/mr-obras-pipeline';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';

interface MrObrasChatProps {
  orcamentoId: string | null;
  inputs: Record<string, any>;
  resultados: any;
  orcamento: any;
  onAction?: (actionId: string, params?: Record<string, any>) => void;
}

interface EnhancedMessage extends ChatMessage {
  sources?: string[];
}

function makeWelcome(orcamento: any): EnhancedMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    content: orcamento
      ? `Olá! Estou conectado ao orçamento **${orcamento.codigo}** (${orcamento.cliente}). Pode me perguntar qualquer coisa — eu consulto o banco de dados antes de responder 👷`
      : 'Olá! Abra um orçamento para que eu possa consultar os dados e te ajudar.',
    timestamp: new Date(),
    sources: [],
  };
}

export function MrObrasChat({ orcamentoId, inputs, resultados, orcamento, onAction }: MrObrasChatProps) {
  const { isAdmin } = useAuth();
  const [messages, setMessages] = useState<EnhancedMessage[]>([makeWelcome(orcamento)]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevOrcIdRef = useRef<string | null>(null);

  // Reset chat when orcamentoId changes
  useEffect(() => {
    if (prevOrcIdRef.current !== orcamentoId) {
      prevOrcIdRef.current = orcamentoId;
      setMessages([makeWelcome(orcamento)]);
    }
  }, [orcamentoId, orcamento]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Build history for AI context
  const buildHistory = useCallback((): ChatHistoryMessage[] => {
    return messages
      .filter(m => m.id !== 'welcome')
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));
  }, [messages]);

  const sendToAgent = useCallback(async (text: string) => {
    setIsTyping(true);
    try {
      const history = buildHistory();
      const result = await processarMensagemAsync(text, isAdmin, orcamentoId, history);
      const assistantMsg: EnhancedMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: result.content,
        actions: result.actions.length > 0 ? result.actions : undefined,
        timestamp: new Date(),
        sources: result.sources,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Ops, tive um problema ao consultar o sistema: ${err.message || 'erro desconhecido'}. Tente novamente.`,
        timestamp: new Date(),
        sources: ['Erro'],
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [isAdmin, orcamentoId, buildHistory]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    const userMsg: EnhancedMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    await sendToAgent(text);
  };

  const handleActionClick = async (actionId: string, params?: Record<string, any>) => {
    if (actionId === 'explicar_etapa' && params?.etapa) {
      const text = `explicar ${params.etapa}`;
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() }]);
      await sendToAgent(text);
    } else if (actionId === 'diagnosticar_geral') {
      const text = 'o que está com problema no orçamento?';
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() }]);
      await sendToAgent(text);
    } else {
      onAction?.(actionId, params);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-3" ref={scrollRef as any}>
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:mb-1 [&_h2]:text-sm [&_h2]:font-bold [&_h3]:text-xs [&_h3]:font-semibold [&_ul]:my-1 [&_li]:my-0">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
                {msg.actions && msg.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {msg.actions
                      .filter((a: ChatAction) => !a.adminOnly || isAdmin)
                      .map((action: ChatAction, idx: number) => (
                        <Button
                          key={`${action.actionId}-${idx}`}
                          size="sm"
                          variant="secondary"
                          className="text-xs h-7"
                          onClick={() => handleActionClick(action.actionId, action.params)}
                        >
                          {action.label}
                        </Button>
                      ))}
                  </div>
                )}
                {msg.role === 'assistant' && msg.sources && msg.sources.length > 0 && (
                  <div className="flex gap-1 mt-1.5">
                    {msg.sources.map((s, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">
                        {s}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-muted text-foreground rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-muted-foreground text-xs">Consultando o sistema…</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte ao Mr. Obras..."
          className="text-sm"
          disabled={isTyping}
        />
        <Button size="icon" onClick={handleSend} disabled={!input.trim() || isTyping}>
          {isTyping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
