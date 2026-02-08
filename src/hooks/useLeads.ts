import { useState, useCallback } from 'react';
import { Lead, SearchResult, PaginationInfo } from '@/types/lead';
import { toast } from '@/hooks/use-toast';
import { leadsApi } from '@/lib/apiClient';

let idCounter = 1;

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalResults: 0,
    hasMore: false,
  });

  const extractLeadsFromResults = useCallback((results: SearchResult[], searchTerm: string): Lead[] => {
    return results.map((result) => {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const phoneRegex = /(?:\+55\s?)?(?:\(?\d{2}\)?[\s-]?)?\d{4,5}[\s-]?\d{4}/g;
      
      const emails = (result.snippet + ' ' + result.title).match(emailRegex);
      const phones = (result.snippet + ' ' + result.title).match(phoneRegex);
      
      const companyName = result.title.split(' - ')[0].split(' | ')[0].trim();
      
      return {
        id: `lead-${idCounter++}`,
        company: companyName,
        website: result.link,
        phone: phones?.[0] || null,
        whatsapp: phones?.[0] || null,
        email: emails?.[0] || null,
        whatsappValid: null,
        source: 'Google',
        searchTerm,
        createdAt: new Date().toISOString(),
      };
    });
  }, []);

  const search = useCallback(async (query: string, page: number = 1) => {
    setIsLoading(true);
    
    try {
      // TODO: Integrar com SERP API real quando configurada
      // Por enquanto, mostra mensagem que precisa configurar
      toast({
        title: 'SERP API não configurada',
        description: 'Configure a SERP API nas configurações do admin para realizar pesquisas reais.',
        variant: 'destructive',
      });
      
      // Limpar resultados anteriores se for nova pesquisa
      if (page === 1) {
        setLeads([]);
      }
      
      setPagination({
        currentPage: page,
        totalResults: 0,
        hasMore: false,
      });
    } catch (error) {
      toast({
        title: 'Erro na pesquisa',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
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
