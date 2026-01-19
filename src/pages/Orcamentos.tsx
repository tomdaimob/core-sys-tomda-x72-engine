import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Search, 
  Filter, 
  Copy, 
  Archive, 
  Trash2, 
  MoreVertical,
  FileText,
  Calendar,
  Building2
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/orcamento-calculos';
import { useToast } from '@/hooks/use-toast';

interface Orcamento {
  id: string;
  codigo: string;
  cliente: string;
  projeto: string | null;
  status: string;
  area_total_m2: number | null;
  valor_total: number | null;
  created_at: string;
  updated_at: string;
}

export default function Orcamentos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');

  useEffect(() => {
    if (user) {
      loadOrcamentos();
    }
  }, [user, statusFilter]);

  const loadOrcamentos = async () => {
    try {
      let query = supabase
        .from('orcamentos')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'todos') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setOrcamentos(data || []);
    } catch (error) {
      console.error('Error loading orcamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const duplicarOrcamento = async (orc: Orcamento) => {
    try {
      const novoCodigo = `${orc.codigo}-COPIA`;
      
      const { data, error } = await supabase
        .from('orcamentos')
        .insert({
          user_id: user?.id,
          codigo: novoCodigo,
          cliente: orc.cliente,
          projeto: orc.projeto,
          status: 'rascunho',
          area_total_m2: orc.area_total_m2,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Orçamento duplicado',
        description: `Novo código: ${novoCodigo}`,
      });

      loadOrcamentos();
    } catch (error: any) {
      toast({
        title: 'Erro ao duplicar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const arquivarOrcamento = async (id: string) => {
    try {
      const { error } = await supabase
        .from('orcamentos')
        .update({ status: 'arquivado' })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Orçamento arquivado',
      });

      loadOrcamentos();
    } catch (error: any) {
      toast({
        title: 'Erro ao arquivar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const excluirOrcamento = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este orçamento?')) return;

    try {
      const { error } = await supabase
        .from('orcamentos')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Orçamento excluído',
      });

      loadOrcamentos();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      rascunho: 'Rascunho',
      em_andamento: 'Em andamento',
      concluido: 'Concluído',
      arquivado: 'Arquivado',
    };
    return labels[status] || status;
  };

  const getStatusClass = (status: string) => {
    const classes: Record<string, string> = {
      rascunho: 'status-draft',
      em_andamento: 'status-progress',
      concluido: 'status-done',
      arquivado: 'status-archived',
    };
    return classes[status] || '';
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const filteredOrcamentos = orcamentos.filter(
    (orc) =>
      orc.codigo.toLowerCase().includes(search.toLowerCase()) ||
      orc.cliente.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Orçamentos</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie todos os seus orçamentos
            </p>
          </div>
          <Link to="/orcamentos/novo">
            <Button className="btn-primary gap-2">
              <Plus className="w-4 h-4" />
              Novo Orçamento
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="card-elevated p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou cliente..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="rascunho">Rascunho</SelectItem>
                  <SelectItem value="em_andamento">Em andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="arquivado">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Carregando...
          </div>
        ) : filteredOrcamentos.length === 0 ? (
          <div className="card-elevated p-12 text-center">
            <FileText className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Nenhum orçamento encontrado
            </h3>
            <p className="text-muted-foreground mb-6">
              {search || statusFilter !== 'todos'
                ? 'Tente ajustar os filtros de busca'
                : 'Comece criando seu primeiro orçamento'
              }
            </p>
            {!search && statusFilter === 'todos' && (
              <Link to="/orcamentos/novo">
                <Button className="btn-primary gap-2">
                  <Plus className="w-4 h-4" />
                  Criar Orçamento
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredOrcamentos.map((orc) => (
              <div 
                key={orc.id} 
                className="card-elevated p-6 hover:shadow-elevated transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <Link 
                        to={`/orcamentos/${orc.id}`}
                        className="text-lg font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        {orc.codigo}
                      </Link>
                      <p className="text-muted-foreground">{orc.cliente}</p>
                      {orc.projeto && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {orc.projeto}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className={`status-badge ${getStatusClass(orc.status)}`}>
                        {getStatusLabel(orc.status)}
                      </span>
                      <p className="text-lg font-bold text-foreground mt-2">
                        {orc.valor_total ? formatCurrency(orc.valor_total) : '-'}
                      </p>
                      {orc.area_total_m2 && (
                        <p className="text-sm text-muted-foreground">
                          {orc.area_total_m2} m²
                        </p>
                      )}
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => duplicarOrcamento(orc)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => arquivarOrcamento(orc.id)}>
                          <Archive className="w-4 h-4 mr-2" />
                          Arquivar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => excluirOrcamento(orc.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Criado: {formatDate(orc.created_at)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Atualizado: {formatDate(orc.updated_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
