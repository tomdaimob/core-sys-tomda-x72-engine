import { Clock, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ApprovalBadgeProps {
  status: 'PENDENTE' | 'APROVADA' | 'NEGADA' | null | undefined;
  unreadCount?: number;
  compact?: boolean;
}

export function ApprovalBadge({ status, unreadCount = 0, compact = false }: ApprovalBadgeProps) {
  if (!status) return null;

  const getContent = () => {
    switch (status) {
      case 'PENDENTE':
        return {
          icon: <Clock className={compact ? 'w-3 h-3' : 'w-4 h-4'} />,
          text: 'Pendente',
          className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
        };
      case 'APROVADA':
        return {
          icon: <CheckCircle2 className={compact ? 'w-3 h-3' : 'w-4 h-4'} />,
          text: 'Aprovada',
          className: 'bg-green-500/10 text-green-600 border-green-500/30',
        };
      case 'NEGADA':
        return {
          icon: <XCircle className={compact ? 'w-3 h-3' : 'w-4 h-4'} />,
          text: 'Negada',
          className: 'bg-red-500/10 text-red-600 border-red-500/30',
        };
      default:
        return null;
    }
  };

  const content = getContent();
  if (!content) return null;

  return (
    <div className="flex items-center gap-2">
      <Badge 
        variant="outline" 
        className={`${content.className} ${compact ? 'text-xs px-2 py-0.5' : 'px-3 py-1'}`}
      >
        {content.icon}
        {!compact && <span className="ml-1">{content.text}</span>}
      </Badge>
      
      {unreadCount > 0 && (
        <Badge className="bg-primary text-primary-foreground px-2 py-0.5 text-xs">
          <MessageSquare className="w-3 h-3 mr-1" />
          {unreadCount}
        </Badge>
      )}
    </div>
  );
}
