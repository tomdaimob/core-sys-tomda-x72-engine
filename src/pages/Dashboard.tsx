import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  FileText, 
  TrendingUp, 
  DollarSign, 
  Clock, 
  Plus,
  ArrowUpRight,
  Calendar
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/orcamento-calculos';

interface DashboardStats {
  total: number;
  rascunho: number;
  emAndamento: number;
  concluido: number;
  valorTotal: number;
}

interface RecentOrcamento {
  id: string;
  codigo: string;
  cliente: string;
  status: string;
  valor_total: number | null;
  created_at: string;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    rascunho: 0,
    emAndamento: 0,
    concluido: 0,
    valorTotal: 0,
  });
  const [recentes, setRecentes] = useState<RecentOrcamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user]);

  const loadDashboardData = async () => {
    try {
      // Load all budgets for stats
      const { data: orcamentos } = await supabase
        .from('orcamentos')
        .select('status, valor_total');

      if (orcamentos) {
        const total = orcamentos.length;
        const rascunho = orcamentos.filter(o => o.status === 'rascunho').length;
        const emAndamento = orcamentos.filter(o => o.status === 'em_andamento').length;
        const concluido = orcamentos.filter(o => o.status === 'concluido').length;
        const valorTotal = orcamentos.reduce((sum, o) => sum + (o.valor_total || 0), 0);

        setStats({ total, rascunho, emAndamento, concluido, valorTotal });
      }

      // Load recent budgets
      const { data: recentData } = await supabase
        .from('orcamentos')
        .select('id, codigo, cliente, status, valor_total, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentData) {
        setRecentes(recentData);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
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
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
    });
  };

  return (
    <MainLayout>
      <div className="animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Visão geral dos seus orçamentos
            </p>
          </div>
          <Link to="/orcamentos/novo">
            <Button className="btn-primary gap-2">
              <Plus className="w-4 h-4" />
              Novo Orçamento
            </Button>
          </Link>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="kpi-card">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FileText className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
                Total
              </span>
            </div>
            <div className="mt-4">
              <div className="kpi-value">{stats.total}</div>
              <div className="kpi-label">Orçamentos</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-yellow-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full">
                Pendentes
              </span>
            </div>
            <div className="mt-4">
              <div className="kpi-value">{stats.rascunho + stats.emAndamento}</div>
              <div className="kpi-label">Em progresso</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded-full">
                Finalizados
              </span>
            </div>
            <div className="mt-4">
              <div className="kpi-value">{stats.concluido}</div>
              <div className="kpi-label">Concluídos</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-primary" />
              </div>
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full">
                Faturamento
              </span>
            </div>
            <div className="mt-4">
              <div className="kpi-value text-2xl">{formatCurrency(stats.valorTotal)}</div>
              <div className="kpi-label">Valor total</div>
            </div>
          </div>
        </div>

        {/* Recent Budgets */}
        <div className="card-elevated p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">
              Orçamentos Recentes
            </h2>
            <Link 
              to="/orcamentos"
              className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
            >
              Ver todos
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando...
            </div>
          ) : recentes.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Nenhum orçamento ainda
              </h3>
              <p className="text-muted-foreground mb-6">
                Comece criando seu primeiro orçamento
              </p>
              <Link to="/orcamentos/novo">
                <Button className="btn-primary gap-2">
                  <Plus className="w-4 h-4" />
                  Criar Orçamento
                </Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-3 rounded-l-lg">Código</th>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Valor</th>
                    <th className="px-4 py-3 rounded-r-lg">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {recentes.map((orc) => (
                    <tr key={orc.id} className="table-row">
                      <td className="px-4 py-4">
                        <Link 
                          to={`/orcamentos/${orc.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {orc.codigo}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-foreground">
                        {orc.cliente}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`status-badge ${getStatusClass(orc.status)}`}>
                          {getStatusLabel(orc.status)}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-medium text-foreground">
                        {orc.valor_total ? formatCurrency(orc.valor_total) : '-'}
                      </td>
                      <td className="px-4 py-4 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {formatDate(orc.created_at)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
