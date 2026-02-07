import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CalendarIcon, 
  Filter, 
  X, 
  Search,
  MessageCircle,
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';

export type WhatsAppStatusFilter = 'all' | 'valid' | 'invalid' | 'not_verified' | 'has_whatsapp';

export interface LeadsFiltersState {
  searchTerm: string;
  whatsappStatus: WhatsAppStatusFilter;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  searchQuery: string; // termo de pesquisa original
}

interface LeadsFiltersProps {
  filters: LeadsFiltersState;
  onFiltersChange: (filters: LeadsFiltersState) => void;
  searchTerms: string[]; // lista de termos de pesquisa únicos
}

export function LeadsFilters({ filters, onFiltersChange, searchTerms }: LeadsFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = <K extends keyof LeadsFiltersState>(
    key: K, 
    value: LeadsFiltersState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      searchTerm: '',
      whatsappStatus: 'all',
      dateFrom: undefined,
      dateTo: undefined,
      searchQuery: 'all',
    });
  };

  const activeFiltersCount = [
    filters.whatsappStatus !== 'all',
    filters.dateFrom !== undefined,
    filters.dateTo !== undefined,
    filters.searchQuery !== 'all',
  ].filter(Boolean).length;

  const whatsappStatusOptions = [
    { value: 'all', label: 'Todos', icon: MessageCircle },
    { value: 'valid', label: 'WhatsApp Válido', icon: CheckCircle2 },
    { value: 'invalid', label: 'WhatsApp Inválido', icon: XCircle },
    { value: 'not_verified', label: 'Não Verificado', icon: HelpCircle },
    { value: 'has_whatsapp', label: 'Com WhatsApp', icon: MessageCircle },
  ];

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por empresa, email..."
            value={filters.searchTerm}
            onChange={(e) => updateFilter('searchTerm', e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filter Button with Popover */}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4" align="end">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Filtros Avançados</h4>
                {activeFiltersCount > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearFilters}
                    className="h-auto py-1 px-2 text-xs"
                  >
                    Limpar todos
                  </Button>
                )}
              </div>

              {/* WhatsApp Status */}
              <div className="space-y-2">
                <Label>Status WhatsApp</Label>
                <Select
                  value={filters.whatsappStatus}
                  onValueChange={(value) => updateFilter('whatsappStatus', value as WhatsAppStatusFilter)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {whatsappStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-2">
                          <option.icon className="h-4 w-4" />
                          {option.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search Term (Original Query) */}
              <div className="space-y-2">
                <Label>Termo de Pesquisa</Label>
                <Select
                  value={filters.searchQuery}
                  onValueChange={(value) => updateFilter('searchQuery', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os termos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os termos</SelectItem>
                    {searchTerms.map((term) => (
                      <SelectItem key={term} value={term}>
                        {term}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date Range */}
              <div className="space-y-2">
                <Label>Período</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal text-xs h-9",
                          !filters.dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {filters.dateFrom ? (
                          format(filters.dateFrom, "dd/MM/yy", { locale: ptBR })
                        ) : (
                          "De"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dateFrom}
                        onSelect={(date) => updateFilter('dateFrom', date)}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal text-xs h-9",
                          !filters.dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-1 h-3 w-3" />
                        {filters.dateTo ? (
                          format(filters.dateTo, "dd/MM/yy", { locale: ptBR })
                        ) : (
                          "Até"
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dateTo}
                        onSelect={(date) => updateFilter('dateTo', date)}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active Filters Badges */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.whatsappStatus !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              {whatsappStatusOptions.find(o => o.value === filters.whatsappStatus)?.label}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter('whatsappStatus', 'all')}
              />
            </Badge>
          )}
          {filters.searchQuery !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Termo: {filters.searchQuery}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter('searchQuery', 'all')}
              />
            </Badge>
          )}
          {filters.dateFrom && (
            <Badge variant="secondary" className="gap-1">
              De: {format(filters.dateFrom, "dd/MM/yyyy", { locale: ptBR })}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter('dateFrom', undefined)}
              />
            </Badge>
          )}
          {filters.dateTo && (
            <Badge variant="secondary" className="gap-1">
              Até: {format(filters.dateTo, "dd/MM/yyyy", { locale: ptBR })}
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => updateFilter('dateTo', undefined)}
              />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
