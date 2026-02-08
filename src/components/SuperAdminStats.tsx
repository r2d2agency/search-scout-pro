import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  Search, 
  Key, 
  TrendingUp,
  Crown,
  Shield,
  User
} from 'lucide-react';
import { usersApi } from '@/lib/apiClient';
import { toast } from '@/hooks/use-toast';

interface GlobalStats {
  month: string;
  users: { total: number; byRole: Record<string, number> };
  usage: { totalSearches: number; totalLeads: number; totalWhatsapp: number };
  serpKeys: { total: number; active: number; usage: number; limit: number };
  topUsers: Array<{
    id: string;
    name: string;
    email: string;
    planId: string;
    planName: string;
    usage: { searches: number; leads: number; whatsapp: number };
    limits: { searches: number; leads: number; whatsapp: number };
  }>;
}

const SuperAdminStats = () => {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const data = await usersApi.getGlobalStats();
      setStats(data);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar estatísticas',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Não foi possível carregar as estatísticas
        </CardContent>
      </Card>
    );
  }

  const serpKeyUsagePercent = stats.serpKeys.limit > 0 
    ? (stats.serpKeys.usage / stats.serpKeys.limit) * 100 
    : 0;

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'superadmin': return <Crown className="h-4 w-4 text-primary" />;
      case 'admin': return <Shield className="h-4 w-4 text-accent-foreground" />;
      default: return <User className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Estatísticas Globais</h2>
        <p className="text-muted-foreground">
          Visão geral do sistema - {stats.month}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.users.total}</div>
            <div className="flex gap-2 mt-2">
              {Object.entries(stats.users.byRole).map(([role, count]) => (
                <Badge key={role} variant="outline" className="text-xs">
                  {role}: {count}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pesquisas (Mês)</CardTitle>
            <Search className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.usage.totalSearches}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.usage.totalLeads} leads extraídos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">WhatsApp Verificados</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.usage.totalWhatsapp}</div>
            <p className="text-xs text-muted-foreground mt-1">
              verificações este mês
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Chaves SERP</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.serpKeys.active}/{stats.serpKeys.total}
            </div>
            <div className="mt-2">
              <div className="flex justify-between text-xs mb-1">
                <span>{stats.serpKeys.usage} / {stats.serpKeys.limit}</span>
                <span>{serpKeyUsagePercent.toFixed(0)}%</span>
              </div>
              <Progress value={serpKeyUsagePercent} className="h-2" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Uso por Usuário (Top 20)</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.topUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum uso registrado este mês
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2">Usuário</th>
                    <th className="text-left py-3 px-2">Plano</th>
                    <th className="text-center py-3 px-2">Pesquisas</th>
                    <th className="text-center py-3 px-2">Leads</th>
                    <th className="text-center py-3 px-2">WhatsApp</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topUsers.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-secondary/30">
                      <td className="py-3 px-2">
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant="outline">{user.planName || user.planId}</Badge>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-center">
                          <span className="font-medium">{user.usage.searches}</span>
                          <span className="text-muted-foreground">/{user.limits.searches}</span>
                          <Progress 
                            value={(user.usage.searches / user.limits.searches) * 100} 
                            className="h-1 mt-1"
                          />
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-center">
                          <span className="font-medium">{user.usage.leads}</span>
                          <span className="text-muted-foreground">/{user.limits.leads}</span>
                          <Progress 
                            value={(user.usage.leads / user.limits.leads) * 100} 
                            className="h-1 mt-1"
                          />
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-center">
                          <span className="font-medium">{user.usage.whatsapp}</span>
                          <span className="text-muted-foreground">/{user.limits.whatsapp}</span>
                          <Progress 
                            value={(user.usage.whatsapp / user.limits.whatsapp) * 100} 
                            className="h-1 mt-1"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminStats;
