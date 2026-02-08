import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUsage } from '@/hooks/useUsage';
import { UsageStats } from '@/components/UsageStats';
import { LeadDetailModal } from '@/components/LeadDetailModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
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
  FileJson
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from '@/hooks/use-toast';
import { searchApi, leadsApi } from '@/lib/apiClient';
import { exportToCSV, exportToJSON } from '@/lib/api';
import { Lead } from '@/types/lead';

const ITEMS_PER_PAGE = 30;

const SearchPage = () => {
  const { isAuthenticated } = useAuth();
  const { checkLimit, refetch: refetchUsage } = useUsage();
  
  const [query, setQuery] = useState('');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  
  // Seleção
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Filtros
  const [filterType, setFilterType] = useState('all');
  const [filterRating, setFilterRating] = useState('all');
  
  // Modal de detalhes
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleSearch = useCallback(async (page: number = 1) => {
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
    setCurrentQuery(query);
    
    try {
      const response = await searchApi.search(query, page);
      
      setLeads(response.leads);
      setCurrentPage(page);
      setTotalResults(response.pagination.totalResults);
      setHasMore(response.pagination.hasMore);
      setSelectedIds(new Set());
      
      if (isAuthenticated) {
        setTimeout(() => refetchUsage(), 1000);
      }

      if (response.leads.length === 0) {
        toast({
          title: 'Nenhum resultado',
          description: 'Tente outro termo de pesquisa',
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
  }, [query, isAuthenticated, checkLimit, refetchUsage]);

  const handlePageChange = (page: number) => {
    if (page < 1 || isLoading) return;
    handleSearch(page);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch(1);
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
      
      return true;
    });
  };

  // Ações
  const saveSelected = async () => {
    const selected = leads.filter(l => selectedIds.has(l.id));
    if (selected.length === 0) return;

    try {
      await leadsApi.saveBulk(selected);
      toast({
        title: 'Leads salvos',
        description: `${selected.length} leads salvos com sucesso`,
      });
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const exportSelected = (format: 'csv' | 'json') => {
    const selected = leads.filter(l => selectedIds.has(l.id));
    if (selected.length === 0) {
      toast({ title: 'Selecione leads para exportar' });
      return;
    }
    
    if (format === 'csv') {
      exportToCSV(selected);
    } else {
      exportToJSON(selected);
    }
  };

  const filteredLeads = getFilteredLeads();
  const startIndex = 1;
  const endIndex = leads.length;

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="clinica medica em rio preto"
            className="pl-10 h-12 text-base"
          />
        </div>
        <Button 
          onClick={() => handleSearch(1)} 
          disabled={isLoading || !query.trim()}
          className="h-12 px-6"
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
      </div>

      {/* Dica */}
      <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg text-sm">
        <MapPin className="h-4 w-4 text-primary" />
        <span>
          <strong>Empresas:</strong> Use localização + tipo de negócio. Ex: "Petshop Salvador", "Clínica médica São Paulo"
        </span>
      </div>

      {/* Uso */}
      {isAuthenticated && (
        <div className="max-w-sm">
          <UsageStats />
        </div>
      )}

      {leads.length > 0 && (
        <>
          {/* Paginação superior */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
              <Badge variant="secondary" className="px-3 py-1">
                Página {currentPage}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={!hasMore || isLoading}
              >
                Próxima
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              Mostrando {startIndex}-{endIndex} de {totalResults}+ resultados disponíveis
            </div>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="local">Google Maps</SelectItem>
                <SelectItem value="organic">Orgânico</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterRating} onValueChange={setFilterRating}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todas as avaliações" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as avaliações</SelectItem>
                <SelectItem value="4">4+ estrelas</SelectItem>
                <SelectItem value="4.5">4.5+ estrelas</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="ghost" size="sm" onClick={() => {
              setFilterType('all');
              setFilterRating('all');
            }}>
              <X className="h-4 w-4 mr-1" />
              Limpar
            </Button>
          </div>

          {/* Ações em lote */}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>
              <CheckSquare className="h-4 w-4 mr-1" />
              Selecionar Página
            </Button>
            <Button variant="outline" size="sm" onClick={selectWithWhatsApp}>
              <MessageCircle className="h-4 w-4 mr-1" />
              Selecionar WhatsApp
            </Button>
            <Button variant="outline" size="sm" onClick={clearSelection} disabled={selectedIds.size === 0}>
              <X className="h-4 w-4 mr-1" />
              Limpar Página
            </Button>
            <Button variant="destructive" size="sm" onClick={clearAll}>
              <Trash2 className="h-4 w-4 mr-1" />
              Limpar Tudo
            </Button>

            <div className="flex-1" />

            <span className="text-sm text-muted-foreground">
              {selectedIds.size} selecionados (total)
            </span>
          </div>

          {/* Ações com selecionados */}
          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              <Button size="sm" onClick={saveSelected}>
                <Save className="h-4 w-4 mr-1" />
                Salvar Selecionados
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-1" />
                    Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => exportSelected('csv')}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => exportSelected('json')}>
                    <FileJson className="h-4 w-4 mr-2" />
                    JSON Completo
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Lista de resultados */}
          <div className="space-y-2">
            {filteredLeads.map((lead) => {
              const serpData = (lead as any).serpData || {};
              const isSelected = selectedIds.has(lead.id);
              
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
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">
                          {lead.company}
                        </span>
                        {lead.whatsapp && (
                          <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-xs">
                            WhatsApp
                          </Badge>
                        )}
                      </div>

                      {/* Endereço */}
                      {serpData.address && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{serpData.address}</span>
                        </div>
                      )}

                      {/* Telefone */}
                      {lead.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span>{lead.phone}</span>
                          {lead.whatsapp && (
                            <a 
                              href={`https://wa.me/55${lead.whatsapp}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-500 hover:text-emerald-400"
                            >
                              <MessageCircle className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      )}

                      {/* Botão de detalhes */}
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

                    {/* Lado direito */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {/* Rating */}
                      {serpData.rating && (
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
                        {serpData.businessType || serpData.type || 'Outros'}
                      </Badge>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          {/* Paginação inferior */}
          <div className="flex items-center justify-center gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || isLoading}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <Badge variant="secondary" className="px-4 py-2">
              Página {currentPage}
            </Badge>
            <Button
              variant="outline"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!hasMore || isLoading}
            >
              Próxima
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
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
