import React, { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUsage } from '@/hooks/useUsage';
import { UsageStats } from '@/components/UsageStats';
import { LeadDetailModal } from '@/components/LeadDetailModal';
import { SearchProgress } from '@/components/SearchProgress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Search, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  MapPin,
  Phone,
  Star,
  Info,
  CheckSquare,
  MessageCircle,
  X,
  Trash2,
  Download,
  Save,
  FileSpreadsheet,
  FileJson,
  PhoneOff,
  FolderOpen,
  Clock,
  BookmarkPlus,
  Instagram,
  Building2,
  Users,
  Globe,
  BadgeCheck,
  Mail,
  ExternalLink
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from '@/hooks/use-toast';
import { searchApi, leadsApi, savedSearchesApi, instagramFirecrawlApi, linkedinApi } from '@/lib/apiClient';
import { exportToXLSX, exportToCSV, exportToJSON } from '@/lib/api';
import { Lead } from '@/types/lead';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SearchPage = () => {
  const { isAuthenticated } = useAuth();
  const { checkLimit, refetch: refetchUsage } = useUsage();
  
  const [query, setQuery] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  
  // Fonte de pesquisa
  const [searchSource, setSearchSource] = useState<'google' | 'instagram' | 'linkedin'>('google');
  
  // Seleção
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Filtros
  const [filterType, setFilterType] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  const [filterWhatsApp, setFilterWhatsApp] = useState('all');
  
  // Modal de detalhes
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Pesquisas salvas
  const [savedSearches, setSavedSearches] = useState<any[]>([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [savingSearch, setSavingSearch] = useState(false);

  const handleSearch = useCallback(async (page: number = 1, accumulate: boolean = false) => {
    if (!query.trim()) return;
    
    if (isAuthenticated) {
      const canSearch = await checkLimit('search');
      if (!canSearch) {
        toast({
          title: 'Limite atingido',
          description: 'Você atingiu o limite de pesquisas do seu plano',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsLoading(true);
    
    try {
      let response;
      
      if (searchSource === 'instagram') {
        // Busca no Instagram via Firecrawl (mais rápido que Apify)
        response = await instagramFirecrawlApi.search(query, 20, page);
      } else if (searchSource === 'linkedin') {
        // Busca no LinkedIn
        response = await linkedinApi.search(query, 10, page);
      } else {
        // Busca no Google (padrão)
        response = await searchApi.search(query, page);
      }
      
      // Se accumulate = true, adiciona aos leads existentes
      if (accumulate && page > 1) {
        setLeads(prev => [...prev, ...response.leads]);
      } else {
        setLeads(response.leads);
      }
      
      setCurrentPage(page);
      setTotalResults(prev => accumulate ? prev + response.leads.length : response.pagination.totalResults);
      setHasMore(response.pagination.hasMore);
      
      // Não limpar seleção ao acumular
      if (!accumulate) {
        setSelectedIds(new Set());
      }
      
      if (isAuthenticated) {
        setTimeout(() => refetchUsage(), 1000);
      }

      if (response.leads.length === 0 && page === 1) {
        let description = 'Tente outro termo de pesquisa';
        if (searchSource === 'instagram') {
          description = 'Tente um @username ou #hashtag diferente';
        } else if (searchSource === 'linkedin') {
          description = 'Tente um nome de empresa, cargo ou habilidade diferente';
        }

        toast({
          title: 'Nenhum resultado',
          description,
        });
      } else if (accumulate && response.leads.length > 0) {
        toast({
          title: `+${response.leads.length} leads carregados`,
          description: `Total: ${leads.length + response.leads.length} leads`,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        title: 'Erro na pesquisa',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [query, isAuthenticated, checkLimit, refetchUsage, leads.length, searchSource]);

  // Carregar mais resultados (acumula)
  const handleLoadMore = () => {
    if (isLoading || !hasMore) return;
    handleSearch(currentPage + 1, true);
  };

  // Nova pesquisa (reinicia)
  const handleNewSearch = () => {
    handleSearch(1, false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNewSearch();
    }
  };

  // Seleção
  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    const filteredLeads = getFilteredLeads();
    setSelectedIds(new Set(filteredLeads.map(l => l.id)));
  };

  const selectWithWhatsApp = () => {
    const filteredLeads = getFilteredLeads().filter(l => l.whatsapp);
    setSelectedIds(new Set(filteredLeads.map(l => l.id)));
  };

  const selectWithoutWhatsApp = () => {
    const filteredLeads = getFilteredLeads().filter(l => !l.whatsapp);
    setSelectedIds(new Set(filteredLeads.map(l => l.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const clearAll = () => {
    setLeads([]);
    setSelectedIds(new Set());
    setTotalResults(0);
    setCurrentPage(1);
  };

  // Filtros
  const getFilteredLeads = () => {
    return leads.filter(lead => {
      const serpData = (lead as any).serpData || {};
      
      // Filtro por tipo
      if (filterType === 'local' && serpData.type !== 'local') return false;
      if (filterType === 'organic' && serpData.type !== 'organic') return false;
      
      // Filtro por avaliação
      if (filterRating !== 'all') {
        const rating = serpData.rating || 0;
        const minRating = parseFloat(filterRating);
        if (rating < minRating) return false;
      }

      // Filtro por WhatsApp
      if (filterWhatsApp === 'with' && !lead.whatsapp) return false;
      if (filterWhatsApp === 'without' && lead.whatsapp) return false;
      
      return true;
    });
  };

  // Helpers para dados
  const leadsWithWhatsApp = leads.filter(l => l.whatsapp);
  const leadsWithoutWhatsApp = leads.filter(l => !l.whatsapp);

  // Ações de Salvar
  const saveLeads = async (leadsToSave: Lead[]) => {
    if (leadsToSave.length === 0) {
      toast({ title: 'Nenhum lead para salvar' });
      return;
    }

    try {
      await leadsApi.saveBulk(leadsToSave);
      toast({
        title: 'Leads salvos',
        description: `${leadsToSave.length} leads salvos com sucesso`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  // Ações de Exportar
  const exportLeads = (leadsToExport: Lead[], format: 'xlsx' | 'csv' | 'json') => {
    if (leadsToExport.length === 0) {
      toast({ title: 'Nenhum lead para exportar' });
      return;
    }
    
    if (format === 'xlsx') {
      exportToXLSX(leadsToExport);
    } else if (format === 'csv') {
      exportToCSV(leadsToExport);
    } else {
      exportToJSON(leadsToExport);
    }
    
    toast({
      title: 'Exportação concluída',
      description: `${leadsToExport.length} leads exportados em ${format.toUpperCase()}`,
    });
  };

  // Carregar pesquisas salvas
  const loadSavedSearches = async () => {
    if (!isAuthenticated) return;
    setLoadingSaved(true);
    try {
      const searches = await savedSearchesApi.list();
      setSavedSearches(searches);
    } catch (error) {
      console.error('Erro ao carregar pesquisas salvas:', error);
    } finally {
      setLoadingSaved(false);
    }
  };

  // Salvar pesquisa atual
  const handleSaveSearch = async () => {
    if (!searchName.trim() || leads.length === 0) {
      toast({ title: 'Informe um nome e tenha resultados para salvar' });
      return;
    }
    
    setSavingSearch(true);
    try {
      await savedSearchesApi.save({
        name: searchName,
        query,
        leads,
      });
      toast({
        title: 'Pesquisa salva',
        description: `"${searchName}" salva com ${leads.length} leads`,
      });
      setSaveDialogOpen(false);
      setSearchName('');
      loadSavedSearches();
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setSavingSearch(false);
    }
  };

  // Carregar pesquisa salva
  const loadSavedSearch = async (id: string) => {
    setIsLoading(true);
    try {
      const search = await savedSearchesApi.get(id);
      setQuery(search.query);
      setLeads(search.leads || []);
      setTotalResults(search.results_count);
      setCurrentPage(1);
      setHasMore(false);
      setSelectedIds(new Set());
      toast({
        title: 'Pesquisa carregada',
        description: `"${search.name}" com ${search.results_count} leads`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao carregar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Deletar pesquisa salva
  const deleteSavedSearch = async (id: string) => {
    try {
      await savedSearchesApi.delete(id);
      toast({ title: 'Pesquisa removida' });
      loadSavedSearches();
    } catch (error) {
      toast({
        title: 'Erro ao remover',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const filteredLeads = getFilteredLeads();
  const startIndex = 1;
  const endIndex = leads.length;

  return (
    <div className="space-y-4">
      {/* Seletor de fonte */}
      <Tabs value={searchSource} onValueChange={(v) => setSearchSource(v as 'google' | 'instagram' | 'linkedin')} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="google" className="flex items-center gap-1 text-xs md:text-sm md:gap-2">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate">Google Meu Negócio</span>
          </TabsTrigger>
          <TabsTrigger value="instagram" className="flex items-center gap-1 text-xs md:text-sm md:gap-2">
            <Instagram className="h-4 w-4 shrink-0" />
            Instagram
          </TabsTrigger>
          <TabsTrigger value="linkedin" className="flex items-center gap-1 text-xs md:text-sm md:gap-2">
            <Users className="h-4 w-4 shrink-0" />
            LinkedIn
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={searchSource === 'instagram' 
              ? "Ex: stockzero, clinicamedica"
              : "Ex: clínica médica em rio preto"
            }
            className="pl-10 h-12 text-base"
          />
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleNewSearch} 
            disabled={isLoading || !query.trim()}
            className="h-12 px-6 flex-1 sm:flex-none"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Search className="h-5 w-5 mr-2" />
                Buscar
              </>
            )}
          </Button>
          
          {/* Pesquisas Salvas */}
          {isAuthenticated && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="h-12" onClick={loadSavedSearches}>
                  <FolderOpen className="h-5 w-5 md:mr-2" />
                  <span className="hidden md:inline">Pesquisas Salvas</span>
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Pesquisas Salvas</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {loadingSaved ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : savedSearches.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhuma pesquisa salva
                  </p>
                ) : (
                  savedSearches.map((search) => (
                    <div
                      key={search.id}
                      className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                    >
                      <div className="flex-1 cursor-pointer" onClick={() => loadSavedSearch(search.id)}>
                        <p className="font-medium">{search.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {search.query} • {search.results_count} leads
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3" />
                          {new Date(search.created_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSavedSearch(search.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
        </div>
      </div>

      {/* Dica contextual */}
      <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg text-sm">
        {searchSource === 'instagram' ? (
          <>
            <Instagram className="h-4 w-4 text-primary" />
            <span>
              <strong>Busca por termo:</strong> Digite parte do nome (ex: "stockzero") e a busca retorna todos os perfis 
              similares (stockzero, stockzero.sp, stockzero_riopreto...). Links wa.me são detectados como WhatsApp.
            </span>
          </>
        ) : searchSource === 'linkedin' ? (
          <>
            <Users className="h-4 w-4 text-primary" />
            <span>
              <strong>Busca no LinkedIn:</strong> Digite cargo, empresa ou habilidade. Ex: "Diretor Comercial SP", "Programador React". O sistema busca perfis e tenta extrair contatos do snippet.
            </span>
          </>
        ) : (
          <>
            <MapPin className="h-4 w-4 text-primary" />
            <span>
              <strong>Empresas:</strong> Use localização + tipo de negócio. Ex: "Petshop Salvador", "Clínica médica São Paulo"
            </span>
          </>
        )}
      </div>

      {/* Uso */}
      {isAuthenticated && (
        <div className="max-w-sm">
          <UsageStats />
        </div>
      )}

      {/* Search Progress - Futuristic Loading */}
      <SearchProgress isLoading={isLoading} source={searchSource} />

      {leads.length > 0 && (
        <>
          {/* Controle de resultados */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="px-3 py-1">
                {leads.length} leads carregados
              </Badge>
              <Badge variant="outline" className="px-3 py-1">
                Página {currentPage}
              </Badge>
              <Button
                variant="default"
                size="sm"
                onClick={handleLoadMore}
                disabled={!hasMore || isLoading}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <ChevronRight className="h-4 w-4 mr-1" />
                )}
                Carregar +10
              </Button>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              {hasMore ? 'Clique em "Carregar +10" para mais resultados' : 'Todos os resultados carregados'}
            </div>
          </div>

          {/* Estatísticas rápidas */}
          <div className="flex gap-4 text-sm">
            <span className="text-muted-foreground">
              Total: <strong>{leads.length}</strong>
            </span>
            <span className="text-neon-cyan">
              Com WhatsApp: <strong>{leadsWithWhatsApp.length}</strong>
            </span>
            <span className="text-muted-foreground">
              Sem WhatsApp: <strong>{leadsWithoutWhatsApp.length}</strong>
            </span>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="local">Google Maps</SelectItem>
                <SelectItem value="organic">Orgânico</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterWhatsApp} onValueChange={setFilterWhatsApp}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="WhatsApp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="with">Com WhatsApp</SelectItem>
                <SelectItem value="without">Sem WhatsApp</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterRating} onValueChange={setFilterRating}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Avaliação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas avaliações</SelectItem>
                <SelectItem value="4">4+ estrelas</SelectItem>
                <SelectItem value="4.5">4.5+ estrelas</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="ghost" size="sm" onClick={() => {
              setFilterType('all');
              setFilterRating('all');
              setFilterWhatsApp('all');
            }}>
              <X className="h-4 w-4 mr-1" />
              Limpar filtros
            </Button>
          </div>

          {/* Ações de Seleção */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              <CheckSquare className="h-4 w-4 mr-1" />
              Selecionar Página
            </Button>
            <Button variant="outline" size="sm" onClick={selectWithWhatsApp}>
              <MessageCircle className="h-4 w-4 mr-1" />
              Com WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={selectWithoutWhatsApp}>
              <PhoneOff className="h-4 w-4 mr-1" />
              Sem WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={clearSelection} disabled={selectedIds.size === 0}>
              <X className="h-4 w-4 mr-1" />
              Limpar Seleção
            </Button>
            <Button variant="destructive" size="sm" onClick={clearAll}>
              <Trash2 className="h-4 w-4 mr-1" />
              Limpar Tudo
            </Button>

            <div className="flex-1" />

            <span className="text-sm font-medium">
              {selectedIds.size} selecionados
            </span>
          </div>

          <Separator />

          {/* Ações de Salvar e Exportar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Salvar Pesquisa (para reutilizar) */}
            {isAuthenticated && (
              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="secondary">
                    <BookmarkPlus className="h-4 w-4 mr-1" />
                    Salvar Pesquisa
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Salvar Pesquisa</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Nome da pesquisa</label>
                      <Input
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                        placeholder="Ex: Clínicas em São Paulo"
                        className="mt-1"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Termo: <strong>{query}</strong> • {leads.length} leads
                    </p>
                    <Button
                      onClick={handleSaveSearch}
                      disabled={savingSearch || !searchName.trim()}
                      className="w-full"
                    >
                      {savingSearch ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Salvar Leads no Banco */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Save className="h-4 w-4 mr-1" />
                  Salvar Leads
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => saveLeads(leads)}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Salvar Tudo ({leads.length})
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => saveLeads(leads.filter(l => selectedIds.has(l.id)))}
                  disabled={selectedIds.size === 0}
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Salvar Selecionados ({selectedIds.size})
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => saveLeads(leadsWithWhatsApp)}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Salvar com WhatsApp ({leadsWithWhatsApp.length})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => saveLeads(leadsWithoutWhatsApp)}>
                  <PhoneOff className="h-4 w-4 mr-2" />
                  Salvar sem WhatsApp ({leadsWithoutWhatsApp.length})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Exportar XLSX (Principal) */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <FileSpreadsheet className="h-4 w-4 mr-1" />
                  XLSX
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => exportLeads(leads, 'xlsx')}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Exportar Tudo ({leads.length})
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => exportLeads(leads.filter(l => selectedIds.has(l.id)), 'xlsx')}
                  disabled={selectedIds.size === 0}
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Exportar Selecionados ({selectedIds.size})
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportLeads(leadsWithWhatsApp, 'xlsx')}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Com WhatsApp ({leadsWithWhatsApp.length})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportLeads(leadsWithoutWhatsApp, 'xlsx')}>
                  <PhoneOff className="h-4 w-4 mr-2" />
                  Sem WhatsApp ({leadsWithoutWhatsApp.length})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Exportar JSON */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <FileJson className="h-4 w-4 mr-1" />
                  JSON
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => exportLeads(leads, 'json')}>
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Exportar Tudo ({leads.length})
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => exportLeads(leads.filter(l => selectedIds.has(l.id)), 'json')}
                  disabled={selectedIds.size === 0}
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Exportar Selecionados ({selectedIds.size})
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportLeads(leadsWithWhatsApp, 'json')}>
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Com WhatsApp ({leadsWithWhatsApp.length})
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportLeads(leadsWithoutWhatsApp, 'json')}>
                  <PhoneOff className="h-4 w-4 mr-2" />
                  Sem WhatsApp ({leadsWithoutWhatsApp.length})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Lista de resultados */}
          <div className="space-y-2">
            {filteredLeads.map((lead) => {
              const serpData = (lead as any).serpData || {};
              const isSelected = selectedIds.has(lead.id);
              const isInstagram = serpData.type === 'instagram';
              const isLinkedin = serpData.type === 'linkedin';
              
              return (
                <Card 
                  key={lead.id} 
                  className={`p-4 transition-colors ${isSelected ? 'border-primary bg-primary/5' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(lead.id)}
                      className="mt-1"
                    />

                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">
                          {lead.company}
                        </span>
                        {isInstagram && serpData.username && (
                          <span className="text-sm text-muted-foreground">
                            @{serpData.username}
                          </span>
                        )}
                        {isLinkedin && (
                          <>
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              LinkedIn
                            </span>
                            {serpData.location && (
                              <span className="text-sm text-muted-foreground flex items-center gap-1 border-l pl-2 ml-1 border-border/50">
                                <MapPin className="h-3 w-3" />
                                {serpData.location}
                              </span>
                            )}
                          </>
                        )}
                        {serpData.isVerified && (
                          <BadgeCheck className="h-4 w-4 text-primary" />
                        )}
                        {lead.whatsapp && (
                          <Badge variant="default" className="bg-success hover:bg-success/90 text-xs">
                            WhatsApp
                          </Badge>
                        )}
                        {lead.email && (
                          <Badge variant="secondary" className="text-xs">
                            Email
                          </Badge>
                        )}
                      </div>

                      {/* Cargo e Empresa (LinkedIn) */}
                      {isLinkedin && (serpData.jobTitle || serpData.companyName) && (
                        <div className="text-sm text-foreground/90 flex items-center gap-1 flex-wrap -mt-1">
                          {serpData.jobTitle && <span className="font-medium">{serpData.jobTitle}</span>}
                          {serpData.jobTitle && serpData.companyName && <span className="text-muted-foreground mx-1">•</span>}
                          {serpData.companyName && <span className="text-muted-foreground">{serpData.companyName}</span>}
                        </div>
                      )}

                      {/* Bio do Instagram ou Snippet do LinkedIn */}
                      {((isInstagram && serpData.biography) || (isLinkedin && serpData.snippet)) && (
                        <div className="text-sm text-muted-foreground">
                          <p className="line-clamp-2">{isInstagram ? serpData.biography : serpData.snippet}</p>
                        </div>
                      )}

                      {/* Dados de contato extraídos da bio */}
                      {(isInstagram || isLinkedin) && (lead.phone || lead.email || lead.website || lead.whatsapp || serpData.profileUrl) && (
                        <div className="flex flex-wrap gap-2 mt-1">
                          {/* LinkedIn Profile Link */}
                          {isLinkedin && serpData.profileUrl && (
                            <a 
                              href={serpData.profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 bg-[#0077b5]/10 text-[#0077b5] rounded text-xs hover:bg-[#0077b5]/20 font-medium"
                            >
                              <Users className="h-3 w-3" />
                              Ver Perfil
                            </a>
                          )}
                          {/* WhatsApp confirmado (de link wa.me) */}
                          {lead.whatsapp && (
                            <a 
                              href={`https://wa.me/${lead.whatsapp}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 bg-success/20 text-success rounded text-xs hover:bg-success/30 font-medium"
                            >
                              <MessageCircle className="h-3 w-3" />
                              {lead.whatsappValid ? '✓ WhatsApp' : 'WhatsApp'}
                              <span className="opacity-75">{lead.whatsapp}</span>
                            </a>
                          )}
                          {/* Telefone (diferente do WhatsApp) */}
                          {lead.phone && lead.phone !== lead.whatsapp && (
                            <a 
                              href={`tel:${lead.phone}`}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs hover:bg-muted/80"
                            >
                              <Phone className="h-3 w-3" />
                              {lead.phone}
                            </a>
                          )}
                          {lead.email && (
                            <a 
                              href={`mailto:${lead.email}`}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs hover:bg-muted/80"
                            >
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </a>
                          )}
                          {lead.website && (
                            <a 
                              href={lead.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs hover:bg-muted/80"
                            >
                              <Globe className="h-3 w-3" />
                              Site
                            </a>
                          )}
                        </div>
                      )}
                      
                      {/* Links extras extraídos */}
                      {isInstagram && serpData.extractedLinks && serpData.extractedLinks.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {serpData.extractedLinks.slice(0, 3).map((link: any, idx: number) => (
                            <a
                              key={idx}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted/50 rounded text-xs hover:bg-muted text-muted-foreground"
                            >
                              <ExternalLink className="h-2.5 w-2.5" />
                              {link.type === 'whatsapp' ? 'WhatsApp' :
                               link.type === 'linktree' ? 'Linktree' :
                               link.type === 'youtube' ? 'YouTube' :
                               link.type === 'tiktok' ? 'TikTok' :
                               link.type === 'facebook' ? 'Facebook' :
                               'Link'}
                            </a>
                          ))}
                        </div>
                      )}

                      {/* Endereço (Google) */}
                      {!isInstagram && !isLinkedin && serpData.address && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{serpData.address}</span>
                        </div>
                      )}

                      {/* Telefone (Google) */}
                      {!isInstagram && !isLinkedin && lead.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span>{lead.phone}</span>
                          {lead.whatsapp && (
                            <a 
                              href={`https://wa.me/55${lead.whatsapp}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-success hover:text-success/80"
                            >
                              <MessageCircle className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* Email (Google) */}
                      {!isInstagram && !isLinkedin && lead.email && (
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                            {lead.email}
                          </a>
                        </div>
                      )}

                      {/* Website (Google) */}
                      {!isInstagram && !isLinkedin && lead.website && (
                        <div className="flex items-center gap-1 text-sm">
                          <Globe className="h-3 w-3 text-muted-foreground" />
                          <a 
                            href={lead.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline truncate max-w-[250px]"
                          >
                            {lead.website}
                          </a>
                        </div>
                      )}

                      {/* Botões de ação */}
                      <div className="flex items-center gap-2 pt-1">
                        {((isInstagram && serpData.username) || (isLinkedin && (lead as any).link)) && (
                          <a
                            href={isInstagram ? `https://instagram.com/${serpData.username}` : (lead as any).link}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-3 text-xs"
                            >
                              {isInstagram ? <Instagram className="h-3 w-3 mr-1" /> : <Users className="h-3 w-3 mr-1" />}
                              Ver Perfil
                            </Button>
                          </a>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setSelectedLead(lead);
                            setModalOpen(true);
                          }}
                        >
                          <Info className="h-3 w-3 mr-1" />
                          Detalhes
                        </Button>
                      </div>
                    </div>

                    {/* Lado direito */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {/* Seguidores (Instagram) */}
                      {isInstagram && serpData.followersCount != null && (
                        <div className="flex items-center gap-1 text-sm">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            {serpData.followersCount >= 1000 
                              ? `${(serpData.followersCount / 1000).toFixed(1)}K`
                              : serpData.followersCount
                            }
                          </span>
                        </div>
                      )}

                      {/* Rating (Google) */}
                      {!isInstagram && !isLinkedin && serpData.rating && (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                          <span className="font-medium">{serpData.rating}</span>
                          {serpData.reviews && (
                            <span className="text-sm text-muted-foreground">
                              ({serpData.reviews})
                            </span>
                          )}
                        </div>
                      )}

                      {/* Categoria */}
                      <Badge variant="outline" className="text-xs">
                        {isInstagram 
                          ? (serpData.businessCategory || 'Instagram')
                          : isLinkedin 
                            ? 'LinkedIn' 
                            : (serpData.businessType || serpData.type || 'Outros')
                        }
                      </Badge>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Carregar mais no final */}
          {hasMore && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="default"
                size="lg"
                onClick={handleLoadMore}
                disabled={isLoading}
                className="px-8"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                ) : (
                  <ChevronRight className="h-5 w-5 mr-2" />
                )}
                Carregar mais 10 resultados
              </Button>
            </div>
          )}
        </>
      )}

      {/* Modal de detalhes */}
      <LeadDetailModal
        lead={selectedLead}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </div>
  );
};

export default SearchPage;
