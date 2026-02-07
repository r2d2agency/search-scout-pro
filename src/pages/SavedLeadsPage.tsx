import { useState, useEffect, useMemo } from 'react';
import { Lead } from '@/types/lead';
import { LeadsTable } from '@/components/LeadsTable';
import { LeadsFilters, LeadsFiltersState, WhatsAppStatusFilter } from '@/components/LeadsFilters';
import { Button } from '@/components/ui/button';
import { exportToCSV } from '@/lib/api';
import { Download, Trash2, RefreshCw } from 'lucide-react';

const SavedLeadsPage = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filters, setFilters] = useState<LeadsFiltersState>({
    searchTerm: '',
    whatsappStatus: 'all',
    dateFrom: undefined,
    dateTo: undefined,
    searchQuery: 'all',
  });

  // Mock: carregar leads salvos do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('saved_leads');
    if (saved) {
      try {
        setLeads(JSON.parse(saved));
      } catch {
        console.error('Erro ao carregar leads');
      }
    }
  }, []);

  // Extrair termos de pesquisa únicos
  const uniqueSearchTerms = useMemo(() => {
    const terms = new Set(leads.map(lead => lead.searchTerm));
    return Array.from(terms).filter(Boolean).sort();
  }, [leads]);

  // Aplicar filtros
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // Filtro de texto (empresa, email)
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch = 
          lead.company.toLowerCase().includes(searchLower) ||
          lead.email?.toLowerCase().includes(searchLower) ||
          lead.phone?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Filtro de status WhatsApp
      if (filters.whatsappStatus !== 'all') {
        switch (filters.whatsappStatus as WhatsAppStatusFilter) {
          case 'valid':
            if (lead.whatsappValid !== true) return false;
            break;
          case 'invalid':
            if (lead.whatsappValid !== false) return false;
            break;
          case 'not_verified':
            if (lead.whatsappValid !== null) return false;
            break;
          case 'has_whatsapp':
            if (!lead.whatsapp) return false;
            break;
        }
      }

      // Filtro de termo de pesquisa original
      if (filters.searchQuery !== 'all') {
        if (lead.searchTerm !== filters.searchQuery) return false;
      }

      // Filtro de data
      if (filters.dateFrom || filters.dateTo) {
        const leadDate = new Date(lead.createdAt);
        
        if (filters.dateFrom) {
          const fromDate = new Date(filters.dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (leadDate < fromDate) return false;
        }
        
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (leadDate > toDate) return false;
        }
      }

      return true;
    });
  }, [leads, filters]);

  const handleRefresh = async () => {
    setIsLoading(true);
    // TODO: Implementar refresh do banco
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsLoading(false);
  };

  const handleClearAll = () => {
    if (confirm('Tem certeza que deseja excluir todos os leads salvos?')) {
      setLeads([]);
      localStorage.removeItem('saved_leads');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leads Salvos</h1>
          <p className="text-muted-foreground">
            Gerencie todos os leads extraídos e salvos
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button 
            variant="outline" 
            onClick={() => exportToCSV(filteredLeads)}
            disabled={filteredLeads.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>

          <Button 
            variant="destructive" 
            onClick={handleClearAll}
            disabled={leads.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Limpar Tudo
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <LeadsFilters
        filters={filters}
        onFiltersChange={setFilters}
        searchTerms={uniqueSearchTerms}
      />

      {filteredLeads.length > 0 ? (
        <>
          <LeadsTable 
            leads={filteredLeads} 
            onVerifyWhatsApp={() => {}}
          />
          <p className="text-center text-sm text-muted-foreground">
            {filteredLeads.length} de {leads.length} lead(s) 
            {filteredLeads.length !== leads.length && ' (filtrado)'}
          </p>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {leads.length === 0 
              ? 'Nenhum lead salvo ainda. Faça uma pesquisa para começar!'
              : 'Nenhum lead encontrado com os filtros aplicados.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default SavedLeadsPage;
