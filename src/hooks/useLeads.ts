import { useState, useCallback } from 'react';
import { Lead, PaginationInfo } from '@/types/lead';
import { toast } from '@/hooks/use-toast';
import { leadsApi, searchApi } from '@/lib/apiClient';

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalResults: 0,
    hasMore: false,
  });

  const search = useCallback(async (query: string, page: number = 1) => {
    setIsLoading(true);
    
    try {
      const response = await searchApi.search(query, page);
      
      // Se for nova pesquisa (página 1), substituir leads
      // Se for paginação, adicionar aos existentes
      if (page === 1) {
        setLeads(response.leads);
      } else {
        setLeads(prev => [...prev, ...response.leads]);
      }
      
      setPagination(response.pagination);

      if (response.leads.length > 0) {
        toast({
          title: 'Pesquisa concluída',
          description: `${response.leads.length} resultados encontrados`,
        });
      } else {
        toast({
          title: 'Nenhum resultado',
          description: 'Tente outro termo de pesquisa',
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      
      // Verificar se é erro de limite ou chave
      if (message.includes('Limite')) {
        toast({
          title: 'Limite atingido',
          description: message,
          variant: 'destructive',
        });
      } else if (message.includes('chave')) {
        toast({
          title: 'SERP API não configurada',
          description: 'Nenhuma chave SERP disponível. Contate o administrador.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Erro na pesquisa',
          description: message,
          variant: 'destructive',
        });
      }

      // Limpar se for nova pesquisa com erro
      if (page === 1) {
        setLeads([]);
        setPagination({
          currentPage: 1,
          totalResults: 0,
          hasMore: false,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMore = useCallback(async (query: string) => {
    if (pagination.hasMore && !isLoading) {
      await search(query, pagination.currentPage + 1);
    }
  }, [pagination, isLoading, search]);

  const verifyWhatsApp = useCallback(async (leadId: string, phone: string) => {
    setLeads(prev => prev.map(lead => 
      lead.id === leadId ? { ...lead, whatsappValid: null } : lead
    ));

    try {
      // TODO: Integrar com Evolution API real quando configurada
      toast({
        title: 'Evolution API não configurada',
        description: 'Configure a Evolution API nas configurações do admin.',
        variant: 'destructive',
      });
    } catch (error) {
      toast({
        title: 'Erro na verificação',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  }, []);

  const verifyAllWhatsApp = useCallback(async () => {
    const leadsWithPhone = leads.filter(lead => lead.phone && lead.whatsappValid === null);
    
    for (const lead of leadsWithPhone) {
      if (lead.phone) {
        await verifyWhatsApp(lead.id, lead.phone);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }, [leads, verifyWhatsApp]);

  const saveAllLeads = useCallback(async () => {
    try {
      await leadsApi.saveBulk(leads);
      
      toast({
        title: 'Leads salvos',
        description: `${leads.length} leads salvos com sucesso`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  }, [leads]);

  const clearLeads = useCallback(() => {
    setLeads([]);
    setPagination({
      currentPage: 1,
      totalResults: 0,
      hasMore: false,
    });
  }, []);

  return {
    leads,
    isLoading,
    pagination,
    search,
    loadMore,
    verifyWhatsApp,
    verifyAllWhatsApp,
    saveAllLeads,
    clearLeads,
  };
}
