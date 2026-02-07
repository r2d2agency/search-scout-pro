import { Lead } from '@/types/lead';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  XCircle, 
  ExternalLink, 
  MessageCircle,
  Loader2
} from 'lucide-react';

interface LeadsTableProps {
  leads: Lead[];
  onVerifyWhatsApp: (leadId: string, phone: string) => void;
  verifyingId?: string;
}

export function LeadsTable({ leads, onVerifyWhatsApp, verifyingId }: LeadsTableProps) {
  const getWhatsAppBadge = (lead: Lead) => {
    if (!lead.whatsapp) {
      return <span className="text-muted-foreground">-</span>;
    }
    
    if (lead.whatsappValid === null) {
      return (
        <div className="flex items-center gap-2">
          <span>{lead.whatsapp}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onVerifyWhatsApp(lead.id, lead.whatsapp!)}
            disabled={verifyingId === lead.id}
            className="h-6 px-2"
          >
            {verifyingId === lead.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <MessageCircle className="h-3 w-3" />
            )}
          </Button>
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-2">
        <span>{lead.whatsapp}</span>
        {lead.whatsappValid ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive" />
        )}
      </div>
    );
  };

  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Empresa</TableHead>
            <TableHead>Website</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>WhatsApp</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Fonte</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.map((lead) => (
            <TableRow key={lead.id}>
              <TableCell className="font-medium">{lead.company}</TableCell>
              <TableCell>
                {lead.website ? (
                  <a 
                    href={lead.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <span className="max-w-[200px] truncate">
                      {lead.website.replace(/^https?:\/\//, '')}
                    </span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>{lead.phone || <span className="text-muted-foreground">-</span>}</TableCell>
              <TableCell>{getWhatsAppBadge(lead)}</TableCell>
              <TableCell>
                {lead.email ? (
                  <a 
                    href={`mailto:${lead.email}`}
                    className="text-primary hover:underline"
                  >
                    {lead.email}
                  </a>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">{lead.source}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
