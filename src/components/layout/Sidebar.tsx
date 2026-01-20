import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  FileText, 
  Plus, 
  Settings, 
  LogOut,
  Building2,
  DollarSign,
  Users,
  Shield,
  User
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface MenuItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  adminOnly?: boolean;
}

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: FileText, label: 'Orçamentos', path: '/orcamentos' },
  { icon: Plus, label: 'Novo Orçamento', path: '/orcamentos/novo' },
  { icon: DollarSign, label: 'Preços', path: '/precos', adminOnly: true },
  { icon: Users, label: 'Usuários', path: '/usuarios', adminOnly: true },
  { icon: Settings, label: 'Configurações', path: '/configuracoes' },
];

export function Sidebar() {
  const location = useLocation();
  const { signOut, user, isAdmin } = useAuth();

  // Filter menu items based on user role
  const visibleMenuItems = menuItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-sidebar flex flex-col z-50">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Building2 className="w-6 h-6 text-sidebar-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-foreground leading-tight">
              ICF TECNOLOGIA
            </h1>
            <p className="text-xs text-sidebar-foreground/70">
              Simulador Orçamentário
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {visibleMenuItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'sidebar-item',
                isActive && 'active'
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="mb-3 px-4 space-y-2">
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <Badge variant="default" className="bg-sidebar-primary text-sidebar-primary-foreground text-xs gap-1">
                <Shield className="w-3 h-3" />
                Administrador
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs gap-1">
                <User className="w-3 h-3" />
                Vendedor
              </Badge>
            )}
          </div>
          <p className="text-xs text-sidebar-foreground/60 truncate">
            {user?.email}
          </p>
        </div>
        <button
          onClick={signOut}
          className="sidebar-item w-full text-sidebar-foreground/80 hover:text-sidebar-foreground"
        >
          <LogOut className="w-5 h-5" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
