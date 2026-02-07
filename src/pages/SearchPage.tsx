import { useState, useCallback } from 'react';
import { useLeads } from '@/hooks/useLeads';
import { SearchBar } from '@/components/SearchBar';
import { StatsCards } from '@/components/StatsCards';
import { ActionBar } from '@/components/ActionBar';
import { LeadCard } from '@/components/LeadCard';
import { LeadsTable } from '@/components/LeadsTable';
import { Button } from '@/components/ui/button';
import { Loader2, ChevronDown } from 'lucide-react';

const SearchPage = () => {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [currentQuery, setCurrentQuery] = useState('');
  const [verifyingId, setVerifyingId] = useState<string>();
  
  const {
    leads,
    isLoading,
    pagination,
    search,
    loadMore,
    verifyWhatsApp,
    verifyAllWhatsApp,
    saveAllLeads,
    clearLeads,
  } = useLeads();

  const handleSearch = useCallback((query: string) => {
    setCurrentQuery(query);
    search(query);
  }, [search]);

  const handleVerifyWhatsApp = useCallback(async (leadId: string, phone: string) => {
    setVerifyingId(leadId);
    await verifyWhatsApp(leadId, phone);
    setVerifyingId(undefined);
  }, [verifyWhatsApp]);

  const handleLoadMore = useCallback(() => {
    if (currentQuery) {
      loadMore(currentQuery);
    }
  }, [currentQuery, loadMore]);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Extrator de Leads</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Digite um termo de pesquisa para extrair informações de empresas do Google
        </p>
        <div className="flex justify-center">
          <SearchBar onSearch={handleSearch} isLoading={isLoading} />
        </div>
      </div>

      {leads.length > 0 && (
        <>
          <StatsCards leads={leads} />
          
          <ActionBar
            leads={leads}
            onSaveAll={saveAllLeads}
            onVerifyAll={verifyAllWhatsApp}
            onClear={clearLeads}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            isLoading={isLoading}
          />

          {viewMode === 'table' ? (
            <LeadsTable 
              leads={leads} 
              onVerifyWhatsApp={handleVerifyWhatsApp}
              verifyingId={verifyingId}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {leads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  onVerifyWhatsApp={handleVerifyWhatsApp}
                  isVerifying={verifyingId === lead.id}
                />
              ))}
            </div>
          )}

          {pagination.hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                size="lg"
                onClick={handleLoadMore}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ChevronDown className="mr-2 h-4 w-4" />
                )}
                Carregar mais resultados
              </Button>
            </div>
          )}

          <p className="text-center text-sm text-muted-foreground">
            Exibindo {leads.length} de {pagination.totalResults} resultados
          </p>
        </>
      )}
    </div>
  );
};

export default SearchPage;
