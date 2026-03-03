import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AuditEntry {
  id: string;
  orcamento_id: string | null;
  user_id: string;
  user_role: string;
  action: string;
  entity: string | null;
  before_json: any;
  after_json: any;
  message: string | null;
  created_at: string;
}

export default function Auditoria() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);
  const PAGE_SIZE = 25;

  useEffect(() => {
    fetchLogs();
  }, [page, search]);

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (search.trim()) {
      query = query.or(`action.ilike.%${search}%,message.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (!error && data) {
      setLogs(data as AuditEntry[]);
    }
    setLoading(false);
  };

  const roleBadge = (role: string) => (
    <Badge variant={role === 'ADMIN' ? 'default' : 'secondary'} className="text-xs">
      {role}
    </Badge>
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Auditoria</h1>
            <p className="text-sm text-muted-foreground">Histórico de ações do sistema</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por ação ou mensagem..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">Data/Hora</TableHead>
                      <TableHead className="w-[90px]">Perfil</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead className="w-[80px]">Detalhe</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{roleBadge(log.user_role)}</TableCell>
                        <TableCell className="font-mono text-xs">{log.action}</TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[250px]">
                          {log.message || '—'}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between mt-4">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                  </Button>
                  <span className="text-xs text-muted-foreground">Página {page + 1}</span>
                  <Button variant="outline" size="sm" disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>
                    Próxima <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhe da Auditoria</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <ScrollArea className="flex-1">
              <div className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Ação:</span> <span className="font-mono">{selectedLog.action}</span></div>
                  <div><span className="text-muted-foreground">Perfil:</span> {roleBadge(selectedLog.user_role)}</div>
                  <div><span className="text-muted-foreground">Data:</span> {format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</div>
                  <div><span className="text-muted-foreground">Entidade:</span> {selectedLog.entity || '—'}</div>
                </div>
                {selectedLog.message && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Mensagem</h4>
                    <p className="text-sm text-muted-foreground">{selectedLog.message}</p>
                  </div>
                )}
                {selectedLog.before_json && Object.keys(selectedLog.before_json).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Antes (before)</h4>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">{JSON.stringify(selectedLog.before_json, null, 2)}</pre>
                  </div>
                )}
                {selectedLog.after_json && Object.keys(selectedLog.after_json).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Depois (after)</h4>
                    <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">{JSON.stringify(selectedLog.after_json, null, 2)}</pre>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
