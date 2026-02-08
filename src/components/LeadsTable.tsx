import { useState } from 'react';
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
  Loader2,
  Trash2,
  Eye
} from 'lucide-react';
import { LeadDetailModal } from './LeadDetailModal';

interface LeadsTableProps {
  leads: Lead[];
  onVerifyWhatsApp: (leadId: string, phone: string) => void;
  verifyingId?: string;
  onDelete?: (leadId: string) => void;
}

export function LeadsTable({ leads, onVerifyWhatsApp, verifyingId, onDelete }: LeadsTableProps) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const openDetail = (lead: Lead) => {
    setSelectedLead(lead);
    setModalOpen(true);
  };

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
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive" />
        )}
      </div>
    );
  };

  return (
    <>
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
              <TableHead className="w-[100px]">Ações</TableHead>
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
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openDetail(lead)}
                      className="h-6 w-6 p-0"
                      title="Ver detalhes"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    {onDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(lead.id)}
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <LeadDetailModal 
        lead={selectedLead} 
        open={modalOpen} 
        onOpenChange={setModalOpen} 
      />
    </>
  );
}
