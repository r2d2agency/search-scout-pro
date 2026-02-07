import { Card, CardContent } from '@/components/ui/card';
import { 
  TrendingUp, 
  Search, 
  Users, 
  CheckCircle2, 
  Activity 
} from 'lucide-react';

interface StatsCardsProps {
  stats: {
    totalSearches: number;
    totalLeads: number;
    validWhatsApp: number;
    conversionRate: number;
  };
}

const StatsCards = ({ stats }: StatsCardsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Pesquisas</p>
              <p className="text-3xl font-bold">{stats.totalSearches.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-full bg-primary/10">
              <Search className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-sm text-success">
            <TrendingUp className="h-4 w-4" />
            <span>+12.5% esta semana</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Leads Extraídos</p>
              <p className="text-3xl font-bold">{stats.totalLeads.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-full bg-success/10">
              <Users className="h-6 w-6 text-success" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-sm text-success">
            <TrendingUp className="h-4 w-4" />
            <span>+8.3% esta semana</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">WhatsApp Válidos</p>
              <p className="text-3xl font-bold">{stats.validWhatsApp.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-full bg-info/10">
              <CheckCircle2 className="h-6 w-6 text-info" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span>44.5% dos leads</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Taxa Conversão</p>
              <p className="text-3xl font-bold">{stats.conversionRate}%</p>
            </div>
            <div className="p-3 rounded-full bg-warning/10">
              <TrendingUp className="h-6 w-6 text-warning" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-sm text-success">
            <TrendingUp className="h-4 w-4" />
            <span>+2.1% esta semana</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsCards;
