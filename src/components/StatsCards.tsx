import { Lead } from '@/types/lead';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Building2, 
  Globe, 
  Phone, 
  Mail, 
  MessageCircle, 
  CheckCircle2 
} from 'lucide-react';

interface StatsCardsProps {
  leads: Lead[];
}

export function StatsCards({ leads }: StatsCardsProps) {
  const stats = {
    total: leads.length,
    withWebsite: leads.filter(l => l.website).length,
    withPhone: leads.filter(l => l.phone).length,
    withEmail: leads.filter(l => l.email).length,
    withWhatsApp: leads.filter(l => l.whatsapp).length,
    validWhatsApp: leads.filter(l => l.whatsappValid === true).length,
  };

  const cards = [
    { label: 'Total de Leads', value: stats.total, icon: Building2, color: 'text-primary' },
    { label: 'Com Website', value: stats.withWebsite, icon: Globe, color: 'text-info' },
    { label: 'Com Telefone', value: stats.withPhone, icon: Phone, color: 'text-warning' },
    { label: 'Com Email', value: stats.withEmail, icon: Mail, color: 'text-primary' },
    { label: 'Com WhatsApp', value: stats.withWhatsApp, icon: MessageCircle, color: 'text-success' },
    { label: 'WhatsApp Válido', value: stats.validWhatsApp, icon: CheckCircle2, color: 'text-success' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-secondary ${card.color}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{card.value}</p>
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
