import { Lead } from '@/types/lead';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Globe, 
  Phone, 
  Mail, 
  MessageCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink
} from 'lucide-react';

interface LeadCardProps {
  lead: Lead;
  onVerifyWhatsApp: (leadId: string, phone: string) => void;
  isVerifying?: boolean;
}

export function LeadCard({ lead, onVerifyWhatsApp, isVerifying }: LeadCardProps) {
  const getWhatsAppStatus = () => {
    if (lead.whatsappValid === null) {
      return (
        <Badge variant="secondary" className="text-xs">
          Não verificado
        </Badge>
      );
    }
    if (lead.whatsappValid) {
      return (
        <Badge className="bg-success text-success-foreground text-xs">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Válido
        </Badge>
      );
    }
    return (
      <Badge variant="destructive" className="text-xs">
        <XCircle className="mr-1 h-3 w-3" />
        Inválido
      </Badge>
    );
  };

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-primary shrink-0" />
              <h3 className="font-semibold truncate">{lead.company}</h3>
            </div>
            
            <div className="space-y-1.5 text-sm text-muted-foreground">
              {lead.website && (
                <a 
                  href={lead.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{lead.website.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              )}
              
              {lead.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{lead.phone}</span>
                </div>
              )}
              
              {lead.email && (
                <a 
                  href={`mailto:${lead.email}`}
                  className="flex items-center gap-2 hover:text-primary transition-colors"
                >
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </a>
              )}
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2 shrink-0">
            {lead.whatsapp && (
              <>
                {getWhatsAppStatus()}
                {lead.whatsappValid === null && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onVerifyWhatsApp(lead.id, lead.whatsapp!)}
                    disabled={isVerifying}
                    className="text-xs"
                  >
                    {isVerifying ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <MessageCircle className="mr-1 h-3 w-3" />
                        Verificar
                      </>
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
