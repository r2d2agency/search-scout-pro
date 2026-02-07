import { useAuth } from '@/contexts/AuthContext';
import { useUsage } from '@/hooks/useUsage';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Search, Users, MessageSquare, TrendingUp } from 'lucide-react';

export function UsageStats() {
  const { user } = useAuth();
  const { usage, plan, getUsagePercentage } = useUsage();
  const navigate = useNavigate();

  if (!user || !usage || !plan) return null;

  const stats = [
    {
      label: 'Pesquisas',
      used: usage.searchesUsed,
      limit: plan.monthlySearches,
      percentage: getUsagePercentage('search'),
      icon: Search,
    },
    {
      label: 'Leads Extraídos',
      used: usage.leadsExtracted,
      limit: plan.monthlyLeads,
      percentage: getUsagePercentage('leads'),
      icon: Users,
    },
    {
      label: 'Verificações WhatsApp',
      used: usage.whatsappVerified,
      limit: plan.whatsappVerifications,
      percentage: getUsagePercentage('whatsapp'),
      icon: MessageSquare,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Seu Uso</CardTitle>
            <CardDescription>
              Plano: <Badge variant="outline">{plan.name}</Badge>
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/pricing')}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Fazer Upgrade
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats.map((stat) => (
          <div key={stat.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <stat.icon className="h-4 w-4 text-muted-foreground" />
                <span>{stat.label}</span>
              </div>
              <span className="text-muted-foreground">
                {stat.used} / {stat.limit}
              </span>
            </div>
            <Progress 
              value={stat.percentage} 
              className={`h-2 ${stat.percentage >= 90 ? '[&>div]:bg-destructive' : stat.percentage >= 70 ? '[&>div]:bg-yellow-500' : ''}`}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
