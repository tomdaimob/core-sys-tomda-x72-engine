// Mr. Obras — Auditoria de ações
import { supabase } from '@/integrations/supabase/client';

export interface AuditEntry {
  orcamento_id: string;
  user_id: string;
  user_role: 'ADMIN' | 'VENDEDOR';
  action: string;
  entity?: string;
  before_json?: Record<string, unknown>;
  after_json?: Record<string, unknown>;
  message?: string;
}

export async function registrarAuditoria(entry: AuditEntry): Promise<boolean> {
  const { error } = await supabase.from('audit_log' as any).insert({
    orcamento_id: entry.orcamento_id,
    user_id: entry.user_id,
    user_role: entry.user_role,
    action: entry.action,
    entity: entry.entity || null,
    before_json: entry.before_json || {},
    after_json: entry.after_json || {},
    message: entry.message || null,
  });

  if (error) {
    console.error('[MrObras Audit] Erro ao registrar:', error.message);
    return false;
  }
  return true;
}

export async function buscarAuditoria(orcamentoId: string, limit = 50) {
  const { data, error } = await supabase
    .from('audit_log' as any)
    .select('*')
    .eq('orcamento_id', orcamentoId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[MrObras Audit] Erro ao buscar:', error.message);
    return [];
  }
  return data || [];
}
