import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Lead } from '@/types/lead';
import { LeadsTable } from '@/components/LeadsTable';
import { LeadsFilters, LeadsFiltersState, WhatsAppStatusFilter } from '@/components/LeadsFilters';
import { Button } from '@/components/ui/button';
import { exportToXLSX } from '@/lib/api';
import { leadsApi } from '@/lib/apiClient';
import { Download, Trash2, RefreshCw, ChevronLeft, ChevronRight, Loader2, Map, Table } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Lazy load do mapa para melhor performance
const LeadsMap = lazy(() => import('@/components/LeadsMap').then(m => ({ default: m.LeadsMap })));

const LEADS_PER_PAGE = 30;

const SavedLeadsPage = () => {
  const { isAuthenticated } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [filters, setFilters] = useState<LeadsFiltersState>({
    searchTerm: '',
    whatsappStatus: 'all',
    dateFrom: undefined,
    dateTo: undefined,
    searchQuery: 'all',
  });

  const totalPages = Math.ceil(totalLeads / LEADS_PER_PAGE);

  // Carregar leads do banco
  const loadLeads = useCallback(async (page: number = 1) => {
    if (!isAuthenticated) {
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await leadsApi.list(page, LEADS_PER_PAGE, filters);
      setLeads(response.leads || []);
      setTotalLeads(response.total || 0);
      setCurrentPage(page);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
      toast({
        title: 'Erro ao carregar leads',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, filters]);

  // Debounce para evitar muitas chamadas ao digitar
  useEffect(() => {
    const timer = setTimeout(() => {
      loadLeads(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [loadLeads]);

  // Extrair termos de pesquisa únicos (apenas da página atual por enquanto)
  const uniqueSearchTerms = useMemo(() => {
    const terms = new Set(leads.map(lead => lead.searchTerm));
    return Array.from(terms).filter(Boolean).sort();
  }, [leads]);

  // Leads já vêm filtrados do backend
  const filteredLeads = leads;

  const handleRefresh = () => {
    loadLeads(currentPage);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Buscar todos os leads que correspondem aos filtros atuais
      const response = await leadsApi.list(1, 0, { ...filters, all: true });
      
      if (!response.leads || response.leads.length === 0) {
        toast({
          title: 'Nenhum lead para exportar',
          description: 'Tente ajustar os filtros.',
          variant: 'destructive',
        });
        return;
      }

      exportToXLSX(response.leads);
      toast({
        title: 'Exportação concluída',
        description: `${response.leads.length} leads exportados com sucesso.`,
      });
    } catch (error) {
      toast({
        title: 'Erro na exportação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    try {
      await leadsApi.delete(leadId);
      setLeads(prev => prev.filter(l => l.id !== leadId));
      setTotalLeads(prev => prev - 1);
      toast({
        title: 'Lead excluído',
        description: 'Lead removido com sucesso',
      });
    } catch (error) {
      toast({
        title: 'Erro ao excluir',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Tem certeza que deseja excluir todos os leads salvos?')) return;
    
    try {
      // Deletar todos os leads visíveis
      for (const lead of leads) {
        await leadsApi.delete(lead.id);
      }
      setLeads([]);
      setTotalLeads(0);
      toast({
        title: 'Leads excluídos',
        description: 'Todos os leads foram removidos',
      });
    } catch (error) {
      toast({
        title: 'Erro ao limpar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      loadLeads(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      loadLeads(currentPage + 1);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          Faça login para ver seus leads salvos.
        </p>
      </div>
    );
  }

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
            onClick={() => exportToXLSX(filteredLeads)}
            disabled={filteredLeads.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar XLSX
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

      <LeadsFilters
        filters={filters}
        onFiltersChange={setFilters}
        searchTerms={uniqueSearchTerms}
      />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredLeads.length > 0 ? (
        <Tabs defaultValue="table" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="table" className="flex items-center gap-2">
              <Table className="h-4 w-4" />
              Tabela
            </TabsTrigger>
            <TabsTrigger value="map" className="flex items-center gap-2">
              <Map className="h-4 w-4" />
              Mapa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="table">
            <LeadsTable 
              leads={filteredLeads} 
              onVerifyWhatsApp={() => {}}
              onDelete={handleDeleteLead}
            />
          </TabsContent>

          <TabsContent value="map">
            <Suspense fallback={
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            }>
              <LeadsMap leads={filteredLeads} />
            </Suspense>
          </TabsContent>
          
          {/* Paginação */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              Exibindo {(currentPage - 1) * LEADS_PER_PAGE + 1}-
              {Math.min(currentPage * LEADS_PER_PAGE, totalLeads)} de {totalLeads} leads
              {filteredLeads.length !== leads.length && ` (${filteredLeads.length} filtrado)`}
            </p>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrevPage}
                disabled={currentPage <= 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              
              <span className="flex items-center px-3 text-sm text-muted-foreground">
                Página {currentPage} de {totalPages || 1}
              </span>
              
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleNextPage}
                disabled={currentPage >= totalPages || isLoading}
              >
                Próxima
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </Tabs>
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
