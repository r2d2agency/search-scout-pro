import { Lead } from '@/types/lead';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Building2, 
  Globe, 
  Phone, 
  Mail, 
  MessageCircle, 
  MapPin, 
  Star,
  Clock,
  ExternalLink,
  Copy,
  CheckCircle2,
  XCircle,
  Download
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface LeadDetailModalProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LeadDetailModal({ lead, open, onOpenChange }: LeadDetailModalProps) {
  if (!lead) return null;

  const serpData = (lead as any).serpData || {};

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  const exportLead = () => {
    const data = JSON.stringify(lead, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lead-${lead.company.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {lead.company}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6">
            {/* Informações principais */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Website */}
              {lead.website && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Globe className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">Website</p>
                    <a 
                      href={lead.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1 truncate"
                    >
                      {lead.website.replace(/^https?:\/\//, '')}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => copyToClipboard(lead.website!, 'Website')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Telefone */}
              {lead.phone && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Phone className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="text-sm font-medium">{lead.phone}</p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => copyToClipboard(lead.phone!, 'Telefone')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* WhatsApp */}
              {lead.whatsapp && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <MessageCircle className="h-5 w-5 text-emerald-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">WhatsApp</p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{lead.whatsapp}</p>
                      {lead.whatsappValid === true && (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      )}
                      {lead.whatsappValid === false && (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => window.open(`https://wa.me/55${lead.whatsapp}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Email */}
              {lead.email && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <Mail className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Email</p>
                    <a href={`mailto:${lead.email}`} className="text-sm text-primary hover:underline">
                      {lead.email}
                    </a>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => copyToClipboard(lead.email!, 'Email')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Dados do Google Maps */}
            {serpData.type === 'local' && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3 flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Dados do Google Maps
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {serpData.address && (
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Endereço</p>
                        <p className="text-sm">{serpData.address}</p>
                      </div>
                    )}
                    
                    {serpData.rating && (
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Avaliação</p>
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                          <span className="text-sm font-medium">{serpData.rating}</span>
                          {serpData.reviews && (
                            <span className="text-sm text-muted-foreground">
                              ({serpData.reviews} avaliações)
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {serpData.type && (
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Categoria</p>
                        <p className="text-sm">{serpData.type}</p>
                      </div>
                    )}

                    {serpData.hours && (
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Horário
                        </p>
                        <p className="text-sm">{serpData.hours}</p>
                      </div>
                    )}

                    {serpData.priceLevel && (
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-sm text-muted-foreground">Faixa de preço</p>
                        <p className="text-sm">{serpData.priceLevel}</p>
                      </div>
                    )}

                    {serpData.description && (
                      <div className="p-3 rounded-lg bg-muted/50 col-span-full">
                        <p className="text-sm text-muted-foreground">Descrição</p>
                        <p className="text-sm">{serpData.description}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Dados da SERP orgânica */}
            {serpData.type === 'organic' && serpData.snippet && (
              <>
                <Separator />
                <div>
                  <h3 className="font-semibold mb-3">Descrição da Pesquisa</h3>
                  <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/50">
                    {serpData.snippet}
                  </p>
                </div>
              </>
            )}

            {/* Metadados */}
            <Separator />
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{lead.source}</Badge>
              {serpData.position && (
                <Badge variant="outline">Posição #{serpData.position}</Badge>
              )}
              <Badge variant="outline">
                Pesquisa: {lead.searchTerm}
              </Badge>
              <Badge variant="outline">
                {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
              </Badge>
            </div>

            {/* Ações */}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" size="sm" onClick={exportLead}>
                <Download className="h-4 w-4 mr-2" />
                Exportar JSON
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
