import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from '@/components/ui/chart';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from 'recharts';
import { ResponsiveContainer } from 'recharts';
import { 
  TrendingUp, 
  Search, 
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import { DateRange } from 'react-day-picker';
import DashboardFilters from '@/components/DashboardFilters';
import StatsCards from '@/components/dashboard/StatsCards';
import SearchTermsChart from '@/components/dashboard/SearchTermsChart';
import SuperAdminStats from '@/components/SuperAdminStats';
import { useAuth } from '@/contexts/AuthContext';

// Dados zerados - substituir por dados reais do backend
const weeklySearches: { day: string; searches: number; leads: number }[] = [];

const monthlyTrend: { month: string; total: number }[] = [];

const leadSources = [
  { name: 'Com WhatsApp', value: 0, color: 'hsl(var(--success))' },
  { name: 'Com Email', value: 0, color: 'hsl(var(--primary))' },
  { name: 'Com Telefone', value: 0, color: 'hsl(var(--warning))' },
  { name: 'Só Website', value: 0, color: 'hsl(var(--muted))' },
];

const whatsappStatus = [
  { name: 'WhatsApp Válido', value: 0, color: 'hsl(var(--success))' },
  { name: 'Sem WhatsApp', value: 0, color: 'hsl(var(--destructive))' },
  { name: 'Não Verificado', value: 0, color: 'hsl(var(--muted))' },
];

const searchTermsPerformance: { term: string; leads: number; whatsapp: number }[] = [];

const recentSearches: { term: string; count: number; date: string }[] = [];

const chartConfig = {
  searches: {
    label: 'Pesquisas',
    color: 'hsl(var(--primary))',
  },
  leads: {
    label: 'Leads',
    color: 'hsl(var(--success))',
  },
  total: {
    label: 'Total',
    color: 'hsl(var(--primary))',
  },
};

const DashboardPage = () => {
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [period, setPeriod] = useState<string>('all');

  const stats = useMemo(() => ({
    totalSearches: 0,
    totalLeads: 0,
    validWhatsApp: 0,
    conversionRate: 0,
  }), []);

  const isSuperAdmin = user?.role === 'superadmin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral do volume de pesquisas e leads extraídos
          </p>
        </div>
        <DashboardFilters
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          period={period}
          onPeriodChange={setPeriod}
        />
      </div>

      {/* Super Admin Stats */}
      {isSuperAdmin && <SuperAdminStats />}

      {/* Stats Overview */}
      <StatsCards stats={stats} />

      {/* Performance by Search Term */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SearchTermsChart data={searchTermsPerformance} />

        {/* Monthly Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Tendência Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="month" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area 
                  type="monotone"
                  dataKey="total" 
                  stroke="hsl(var(--primary))" 
                  fillOpacity={1}
                  fill="url(#colorTotal)"
                  name="Total"
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Searches Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Pesquisas da Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={weeklySearches}>
                <XAxis 
                  dataKey="day" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar 
                  dataKey="searches" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                  name="Pesquisas"
                />
                <Bar 
                  dataKey="leads" 
                  fill="hsl(var(--success))" 
                  radius={[4, 4, 0, 0]}
                  name="Leads"
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Recent Searches Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Pesquisas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentSearches.map((search, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                >
                  <div>
                    <p className="font-medium text-sm">{search.term}</p>
                    <p className="text-xs text-muted-foreground">{search.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{search.count}</p>
                    <p className="text-xs text-muted-foreground">leads</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row - Pie Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie Chart - Lead Sources */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leadSources}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {leadSources.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {leadSources.map((source) => (
                <div key={source.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: source.color }}
                  />
                  <span className="text-xs text-muted-foreground">
                    {source.name} ({source.value}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart - WhatsApp Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Status WhatsApp
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={whatsappStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {whatsappStatus.map((entry, index) => (
                      <Cell key={`cell-whats-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {whatsappStatus.map((status) => (
                <div key={status.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: status.color }}
                    />
                    <span className="text-xs text-muted-foreground">
                      {status.name}
                    </span>
                  </div>
                  <span className="text-sm font-medium">{status.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
