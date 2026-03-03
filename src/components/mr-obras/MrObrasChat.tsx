import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { type ChatMessage, processarMensagem } from '@/lib/mr-obras-chat';
import { useAuth } from '@/contexts/AuthContext';
import ReactMarkdown from 'react-markdown';

interface MrObrasChatProps {
  orcamentoId: string | null;
  inputs: Record<string, any>;
  resultados: any;
  orcamento: any;
  onAction?: (actionId: string, params?: Record<string, any>) => void;
}

export function MrObrasChat({ orcamentoId, inputs, resultados, orcamento, onAction }: MrObrasChatProps) {
  const { isAdmin } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Olá! Sou o **Mr. Obras Assistente** 🏗️\n\n${orcamento ? `Orçamento: **${orcamento.codigo}** — ${orcamento.cliente}` : 'Nenhum orçamento aberto.'}\n\nComo posso ajudar?`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    const assistantMsg = processarMensagem(text, isAdmin, inputs, resultados, orcamento);

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setInput('');
  };

  const handleActionClick = (actionId: string, params?: Record<string, any>) => {
    if (actionId === 'explicar_etapa' && params?.etapa) {
      const text = `explicar ${params.etapa}`;
      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: new Date() };
      const assistantMsg = processarMensagem(text, isAdmin, inputs, resultados, orcamento);
      setMessages(prev => [...prev, userMsg, assistantMsg]);
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
                      .filter(a => !a.adminOnly || isAdmin)
                      .map((action) => (
                        <Button
                          key={action.actionId}
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
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-3 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Pergunte ao Mr. Obras..."
          className="text-sm"
        />
        <Button size="icon" onClick={handleSend} disabled={!input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
