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
  LineChart, 
  Line,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';
import { 
  TrendingUp, 
  Search, 
  Users, 
  CheckCircle2, 
  Calendar,
  Activity
} from 'lucide-react';

// Mock data - substituir por dados reais do backend
const weeklySearches = [
  { day: 'Seg', searches: 45, leads: 32 },
  { day: 'Ter', searches: 52, leads: 41 },
  { day: 'Qua', searches: 38, leads: 28 },
  { day: 'Qui', searches: 65, leads: 55 },
  { day: 'Sex', searches: 78, leads: 62 },
  { day: 'Sáb', searches: 25, leads: 18 },
  { day: 'Dom', searches: 12, leads: 8 },
];

const monthlyTrend = [
  { month: 'Jan', total: 320 },
  { month: 'Fev', total: 450 },
  { month: 'Mar', total: 380 },
  { month: 'Abr', total: 520 },
  { month: 'Mai', total: 680 },
  { month: 'Jun', total: 750 },
];

const leadSources = [
  { name: 'Com WhatsApp', value: 45, color: 'hsl(var(--success))' },
  { name: 'Com Email', value: 30, color: 'hsl(var(--primary))' },
  { name: 'Com Telefone', value: 20, color: 'hsl(var(--warning))' },
  { name: 'Só Website', value: 5, color: 'hsl(var(--muted))' },
];

const recentSearches = [
  { term: 'restaurantes são paulo', count: 156, date: '2025-02-07' },
  { term: 'clínicas odontológicas', count: 89, date: '2025-02-07' },
  { term: 'advocacia trabalhista', count: 67, date: '2025-02-06' },
  { term: 'contabilidade empresarial', count: 45, date: '2025-02-06' },
  { term: 'pet shop delivery', count: 34, date: '2025-02-05' },
];

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
  const stats = {
    totalSearches: 2847,
    totalLeads: 1923,
    validWhatsApp: 856,
    conversionRate: 67.5,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Visão geral do volume de pesquisas e leads extraídos
        </p>
      </div>

      {/* Stats Overview */}
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

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Chart - Lead Sources */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={leadSources}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
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
            <div className="grid grid-cols-2 gap-2 mt-4">
              {leadSources.map((source) => (
                <div key={source.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: source.color }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {source.name} ({source.value}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Searches Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Pesquisas Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSearches.map((search, index) => (
                <div 
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                >
                  <div>
                    <p className="font-medium">{search.term}</p>
                    <p className="text-sm text-muted-foreground">{search.date}</p>
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
    </div>
  );
};

export default DashboardPage;
