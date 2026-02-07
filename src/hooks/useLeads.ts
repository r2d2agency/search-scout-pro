import { useState, useCallback } from 'react';
import { Lead, SearchResult, PaginationInfo } from '@/types/lead';
import { toast } from '@/hooks/use-toast';

// Mock data para desenvolvimento (sem backend conectado)
const mockLeads: Lead[] = [];
let mockIdCounter = 1;

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
      // Extrair informações do snippet e título
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const phoneRegex = /(?:\+55\s?)?(?:\(?\d{2}\)?[\s-]?)?\d{4,5}[\s-]?\d{4}/g;
      
      const emails = (result.snippet + ' ' + result.title).match(emailRegex);
      const phones = (result.snippet + ' ' + result.title).match(phoneRegex);
      
      // Tentar extrair nome da empresa do título
      const companyName = result.title.split(' - ')[0].split(' | ')[0].trim();
      
      return {
        id: `lead-${mockIdCounter++}`,
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
      // Simulação de busca (substituir pela API real)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock results para demonstração
      const mockResults: SearchResult[] = Array.from({ length: 30 }, (_, i) => ({
        title: `Empresa ${(page - 1) * 30 + i + 1} - ${query}`,
        link: `https://empresa${(page - 1) * 30 + i + 1}.com.br`,
        snippet: `Empresa especializada em ${query}. Contato: (11) 9${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)} - email@empresa${i + 1}.com.br`,
        position: (page - 1) * 30 + i + 1,
      }));

      const extractedLeads = extractLeadsFromResults(mockResults, query);
      
      if (page === 1) {
        setLeads(extractedLeads);
      } else {
        setLeads(prev => [...prev, ...extractedLeads]);
      }

      setPagination({
        currentPage: page,
        totalResults: page * 30 + (Math.random() > 0.3 ? 30 : 0),
        hasMore: page < 5,
      });

      toast({
        title: 'Pesquisa concluída',
        description: `${extractedLeads.length} resultados encontrados`,
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
  }, [extractLeadsFromResults]);

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
      // Simulação da verificação (substituir pela API real)
      await new Promise(resolve => setTimeout(resolve, 1000));
      const isValid = Math.random() > 0.3;
      
      setLeads(prev => prev.map(lead => 
        lead.id === leadId ? { ...lead, whatsappValid: isValid } : lead
      ));

      toast({
        title: isValid ? 'WhatsApp válido' : 'WhatsApp inválido',
        description: phone,
        variant: isValid ? 'default' : 'destructive',
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
        await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
      }
    }
  }, [leads, verifyWhatsApp]);

  const saveAllLeads = useCallback(async () => {
    try {
      // Simulação de salvar (substituir pela API real)
      await new Promise(resolve => setTimeout(resolve, 500));
      
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
