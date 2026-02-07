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
  Cell,
} from 'recharts';
import { Hash } from 'lucide-react';

interface SearchTermData {
  term: string;
  leads: number;
  whatsapp: number;
}

interface SearchTermsChartProps {
  data: SearchTermData[];
}

const chartConfig = {
  leads: {
    label: 'Leads',
    color: 'hsl(var(--primary))',
  },
  whatsapp: {
    label: 'WhatsApp',
    color: 'hsl(var(--success))',
  },
};

const SearchTermsChart = ({ data }: SearchTermsChartProps) => {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Hash className="h-5 w-5" />
          Performance por Termo de Pesquisa
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <BarChart 
            data={data} 
            layout="vertical"
            margin={{ left: 20, right: 20 }}
          >
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis 
              type="category" 
              dataKey="term" 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={11}
              width={120}
              tickFormatter={(value) => value.length > 18 ? `${value.slice(0, 18)}...` : value}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar 
              dataKey="leads" 
              fill="hsl(var(--primary))" 
              radius={[0, 4, 4, 0]}
              name="Leads"
            />
            <Bar 
              dataKey="whatsapp" 
              fill="hsl(var(--success))" 
              radius={[0, 4, 4, 0]}
              name="WhatsApp Válido"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export default SearchTermsChart;
