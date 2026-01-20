import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Users, Shield, User, Loader2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  company: string | null;
  is_admin: boolean | null;
  created_at: string;
  updated_at: string;
}

export default function Usuarios() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleToggleAdmin = async (profile: Profile) => {
    setUpdating(profile.id);
    try {
      const newIsAdmin = !profile.is_admin;
      const { error } = await supabase
        .from('profiles')
        .update({ is_admin: newIsAdmin })
        .eq('id', profile.id);

      if (error) throw error;

      setProfiles(prev => 
        prev.map(p => p.id === profile.id ? { ...p, is_admin: newIsAdmin } : p)
      );

      toast.success(
        newIsAdmin 
          ? `${profile.full_name || 'Usuário'} agora é Administrador` 
          : `${profile.full_name || 'Usuário'} agora é Vendedor`
      );
    } catch (error) {
      console.error('Erro ao atualizar permissão:', error);
      toast.error('Erro ao atualizar permissão');
    } finally {
      setUpdating(null);
    }
  };

  const adminCount = profiles.filter(p => p.is_admin).length;
  const vendedorCount = profiles.filter(p => !p.is_admin).length;

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Users className="w-8 h-8 text-primary" />
              Usuários e Permissões
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie os perfis de acesso dos usuários
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={fetchProfiles}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{profiles.length}</p>
                  <p className="text-sm text-muted-foreground">Total de Usuários</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <Shield className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{adminCount}</p>
                  <p className="text-sm text-muted-foreground">Administradores</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-500/10">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{vendedorCount}</p>
                  <p className="text-sm text-muted-foreground">Vendedores</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Usuários</CardTitle>
            <CardDescription>
              Altere o perfil de acesso clicando no switch para cada usuário
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : profiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum usuário cadastrado
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Cadastro</TableHead>
                    <TableHead className="text-right">Administrador</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">
                        {profile.full_name || 'Sem nome'}
                      </TableCell>
                      <TableCell>
                        {profile.company || '-'}
                      </TableCell>
                      <TableCell>
                        {profile.is_admin ? (
                          <Badge variant="default" className="gap-1">
                            <Shield className="w-3 h-3" />
                            Administrador
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="gap-1">
                            <User className="w-3 h-3" />
                            Vendedor
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(profile.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {updating === profile.id && (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          )}
                          <Switch
                            checked={profile.is_admin || false}
                            onCheckedChange={() => handleToggleAdmin(profile)}
                            disabled={updating !== null}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
