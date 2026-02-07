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
      <Card className="relative overflow-hidden group hover:neon-glow-cyan transition-all duration-500">
        <div className="absolute inset-0 bg-gradient-to-br from-neon-cyan/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardContent className="p-6 relative">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Pesquisas</p>
              <p className="text-3xl font-bold text-primary">{stats.totalSearches.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-full bg-primary/20 neon-glow-cyan">
              <Search className="h-6 w-6 text-primary" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-sm text-success">
            <TrendingUp className="h-4 w-4" />
            <span>+12.5% esta semana</span>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden group hover:neon-glow-green transition-all duration-500">
        <div className="absolute inset-0 bg-gradient-to-br from-neon-green/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardContent className="p-6 relative">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Leads Extraídos</p>
              <p className="text-3xl font-bold text-success">{stats.totalLeads.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-full bg-success/20 neon-glow-green">
              <Users className="h-6 w-6 text-success" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-sm text-success">
            <TrendingUp className="h-4 w-4" />
            <span>+8.3% esta semana</span>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden group hover:shadow-[0_0_30px_hsl(200_100%_55%/0.3)] transition-all duration-500">
        <div className="absolute inset-0 bg-gradient-to-br from-neon-blue/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardContent className="p-6 relative">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">WhatsApp Válidos</p>
              <p className="text-3xl font-bold text-info">{stats.validWhatsApp.toLocaleString()}</p>
            </div>
            <div className="p-3 rounded-full bg-info/20 shadow-[0_0_15px_hsl(200_100%_55%/0.4)]">
              <CheckCircle2 className="h-6 w-6 text-info" />
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span>44.5% dos leads</span>
          </div>
        </CardContent>
      </Card>

      <Card className="relative overflow-hidden group hover:shadow-[0_0_30px_hsl(45_100%_55%/0.3)] transition-all duration-500">
        <div className="absolute inset-0 bg-gradient-to-br from-neon-yellow/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <CardContent className="p-6 relative">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Taxa Conversão</p>
              <p className="text-3xl font-bold text-warning">{stats.conversionRate}%</p>
            </div>
            <div className="p-3 rounded-full bg-warning/20 shadow-[0_0_15px_hsl(45_100%_55%/0.4)]">
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
