import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { cnpjApi, savedSearchesApi, enrichApi } from '@/lib/apiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Search, 
  Loader2, 
  Building2, 
  MapPin, 
  Users,
  FileText,
  Hash,
  CalendarIcon,
  Download,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Phone,
  ExternalLink,
  Save,
  BookmarkCheck,
  Trash2,
  SearchIcon,
  Database,
  CheckSquare,
  XSquare,
  Plus,
  Zap,
  MessageCircle,
  Globe,
  Check,
  ChevronsUpDown,
  Type,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

import { format, differenceInDays, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SearchProgress } from '@/components/SearchProgress';
import { Progress } from '@/components/ui/progress';
import { CnpjDetailModal } from '@/components/CnpjDetailModal';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

const UF_LIST = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
];

const MAX_RANGE_DAYS = 366;
const MAX_RESULTS = 100;

const DATE_PRESETS = [
  { label: 'Últimos 7 dias', getValue: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { label: 'Últimos 30 dias', getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: 'Últimos 90 dias', getValue: () => ({ from: subDays(new Date(), 90), to: new Date() }) },
  { label: 'Últimos 6 meses', getValue: () => ({ from: subMonths(new Date(), 6), to: new Date() }) },
  { label: 'Último ano', getValue: () => ({ from: subDays(new Date(), 365), to: new Date() }) },
  { label: 'Mês atual', getValue: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: 'Mês passado', getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
];

function toApiDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export default function CnpjPage() {
  const [activeTab, setActiveTab] = useState('lookup');
  
  // Lookup state
  const [cnpj, setCnpj] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [isLookupLoading, setIsLookupLoading] = useState(false);

  // Search state (CNAE-based, no razao_social)
  const [searchFilters, setSearchFilters] = useState({
    cnae: '',
    municipio: '',
    uf: '',
    situacao: '',
    enquadramento: '',
  });
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [accumulatedResults, setAccumulatedResults] = useState<any[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchPage, setSearchPage] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [selectedSearchIds, setSelectedSearchIds] = useState<Set<string>>(new Set());

  // Name search state (razao_social tab)
  const [nameSearchFilters, setNameSearchFilters] = useState({
    razao_social: '',
    municipio: '',
    uf: '',
    situacao: '',
  });
  const [nameResults, setNameResults] = useState<any[]>([]);
  const [isNameSearchLoading, setIsNameSearchLoading] = useState(false);
  const [nameSearchPage, setNameSearchPage] = useState(0);
  const [nameTotalResults, setNameTotalResults] = useState(0);
  const [selectedNameIds, setSelectedNameIds] = useState<Set<string>>(new Set());
  const [nameMunicipios, setNameMunicipios] = useState<string[]>([]);
  const [isNameMunicipiosLoading, setIsNameMunicipiosLoading] = useState(false);
  const [nameMunicipioOpen, setNameMunicipioOpen] = useState(false);

  // Saved CNPJ queries state
  const [savedQueries, setSavedQueries] = useState<any[]>([]);
  const [isSavedLoading, setIsSavedLoading] = useState(false);
  const [savedFilter, setSavedFilter] = useState('');
  const [viewingSaved, setViewingSaved] = useState<any>(null);
  const [saveName, setSaveName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showNameSaveDialog, setShowNameSaveDialog] = useState(false);
  const [namesSaveName, setNamesSaveName] = useState('');

  // Saved results filters
  const [savedResultFilter, setSavedResultFilter] = useState('');
  const [savedCnaeFilter, setSavedCnaeFilter] = useState('');
  const [savedUfFilter, setSavedUfFilter] = useState('');
  const [savedCepFilter, setSavedCepFilter] = useState('');
  const [savedDateFrom, setSavedDateFrom] = useState<Date | undefined>(undefined);
  const [savedDateTo, setSavedDateTo] = useState<Date | undefined>(undefined);
  const [savedSearchTermFilter, setSavedSearchTermFilter] = useState('');
  const [savedRegimeFilter, setSavedRegimeFilter] = useState('');
  const [selectedSavedIds, setSelectedSavedIds] = useState<Set<string>>(new Set());

  // Detail modal state
  const [detailCnpj, setDetailCnpj] = useState<string | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailPreloadedData, setDetailPreloadedData] = useState<any>(null);

  // Municipality autocomplete
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [isMunicipiosLoading, setIsMunicipiosLoading] = useState(false);
  const [municipioOpen, setMunicipioOpen] = useState(false);

  // Fetch municipalities from IBGE API when UF changes (CNAE search)
  useEffect(() => {
    if (!searchFilters.uf) {
      setMunicipios([]);
      setSearchFilters(f => ({ ...f, municipio: '' }));
      return;
    }
    setIsMunicipiosLoading(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${searchFilters.uf}/municipios?orderBy=nome`)
      .then(res => res.json())
      .then((data: any[]) => setMunicipios(data.map((m: any) => m.nome)))
      .catch(() => setMunicipios([]))
      .finally(() => setIsMunicipiosLoading(false));
  }, [searchFilters.uf]);

  // Fetch municipalities for name search tab
  useEffect(() => {
    if (!nameSearchFilters.uf) {
      setNameMunicipios([]);
      setNameSearchFilters(f => ({ ...f, municipio: '' }));
      return;
    }
    setIsNameMunicipiosLoading(true);
    fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${nameSearchFilters.uf}/municipios?orderBy=nome`)
      .then(res => res.json())
      .then((data: any[]) => setNameMunicipios(data.map((m: any) => m.nome)))
      .catch(() => setNameMunicipios([]))
      .finally(() => setIsNameMunicipiosLoading(false));
  }, [nameSearchFilters.uf]);

  // Enrich state
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0 });
  const [enrichResults, setEnrichResults] = useState<Map<string, any>>(new Map());

  const resultsRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  // Load saved queries when tab changes
  useEffect(() => {
    if (activeTab === 'saved') {
      loadSavedQueries();
    }
  }, [activeTab]);

  const loadSavedQueries = async () => {
    setIsSavedLoading(true);
    try {
      const data = await savedSearchesApi.list();
      setSavedQueries(data.filter((s: any) => s.query?.startsWith('cnpj:')));
    } catch (error: any) {
      console.error('Erro ao carregar consultas salvas:', error);
    } finally {
      setIsSavedLoading(false);
    }
  };

  const getResultKey = (r: any, idx?: number) => {
    const cnpjKey = `${r.cnpj_basico || ''}${r.cnpj_ordem || ''}${r.cnpj_dv || ''}`;
    return cnpjKey || `row-${idx}`;
  };

  // Open detail modal with preloaded row data (instant)
  const [detailEnrichData, setDetailEnrichData] = useState<any>(null);
  const openDetailModal = (row: any) => {
    const composedCnpj = `${row.cnpj_basico || ''}${row.cnpj_ordem || ''}${row.cnpj_dv || ''}`;
    const fullCnpj = (row.cnpj || composedCnpj || '').toString().replace(/\D/g, '');
    if (!fullCnpj || fullCnpj.length < 8) {
      console.warn('openDetailModal: CNPJ inválido', fullCnpj, row);
      return;
    }
    setDetailCnpj(fullCnpj.padStart(14, '0'));
    setDetailPreloadedData(row);
    const ed = enrichResults.get(fullCnpj) || enrichResults.get(fullCnpj.padStart(14, '0')) || (row.googleName || row.enrich_google_name ? row : null);
    setDetailEnrichData(ed);
    setDetailModalOpen(true);
  };

  // Validation for CNAE search
  const filterValidationError = useMemo(() => {
    if (!searchFilters.uf) return 'Selecione o Estado (UF) — campo obrigatório';
    if (!searchFilters.municipio.trim()) return 'Informe o Município — campo obrigatório';
    if (!searchFilters.cnae.trim()) return 'Informe o CNAE — campo obrigatório';
    return null;
  }, [searchFilters.uf, searchFilters.municipio, searchFilters.cnae]);

  // Validation for name search - only UF is required
  const nameValidationError = useMemo(() => {
    if (!nameSearchFilters.uf) return 'Selecione o Estado (UF) — campo obrigatório';
    if (!nameSearchFilters.razao_social.trim()) return 'Informe a Razão Social — campo obrigatório';
    return null;
  }, [nameSearchFilters.uf, nameSearchFilters.razao_social]);

  const dateRangeError = useMemo(() => {
    if (dateFrom && dateTo) {
      const diff = differenceInDays(dateTo, dateFrom);
      if (diff < 0) return 'Data final deve ser posterior à data inicial';
      if (diff > MAX_RANGE_DAYS) return `Intervalo máximo permitido: 1 ano (${MAX_RANGE_DAYS} dias). Atual: ${diff} dias`;
    }
    if (dateFrom && !dateTo) return 'Selecione também a data final';
    if (!dateFrom && dateTo) return 'Selecione também a data inicial';
    if (!dateFrom && !dateTo) return 'Data de abertura é obrigatória para pesquisa por CNAE';
    return null;
  }, [dateFrom, dateTo]);

  const dateRangeLabel = useMemo(() => {
    if (dateFrom && dateTo) return `${differenceInDays(dateTo, dateFrom)} dias selecionados`;
    return null;
  }, [dateFrom, dateTo]);

  const formatCnpj = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCnpj(formatCnpj(e.target.value));
  };

  const applyDatePreset = (preset: typeof DATE_PRESETS[0]) => {
    const { from, to } = preset.getValue();
    setDateFrom(from);
    setDateTo(to);
  };

  const clearDates = () => { setDateFrom(undefined); setDateTo(undefined); };

  const handleLookup = async () => {
    const clean = cnpj.replace(/\D/g, '');
    if (clean.length !== 14) {
      toast({ title: 'CNPJ inválido', description: 'Digite um CNPJ com 14 dígitos', variant: 'destructive' });
      return;
    }
    setIsLookupLoading(true);
    setLookupResult(null);
    try {
      const data = await cnpjApi.lookup(clean);
      setLookupResult(data);
    } catch (error: any) {
      toast({ title: 'Erro na consulta', description: error.message, variant: 'destructive' });
    } finally {
      setIsLookupLoading(false);
    }
  };

  // CNAE-based search
  const handleSearch = async (page = 1, isNewSearch = false) => {
    if (filterValidationError) {
      toast({ title: 'Filtro obrigatório', description: filterValidationError, variant: 'destructive' });
      return;
    }
    if (dateRangeError) {
      toast({ title: 'Erro no período', description: dateRangeError, variant: 'destructive' });
      return;
    }
    if (isNewSearch) {
      setAccumulatedResults([]);
      setSelectedSearchIds(new Set());
      setSearchPage(0);
      setTotalResults(0);
    }
    setIsSearchLoading(true);
    setTimeout(() => progressRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    try {
      const { enquadramento, ...apiFilters } = searchFilters;
      const params: any = { ...apiFilters, page, limit: MAX_RESULTS };
      if (dateFrom && dateTo) {
        params.data_abertura_gte = toApiDate(dateFrom);
        params.data_abertura_lte = toApiDate(dateTo);
      }
      console.log('CNPJ search sending params:', JSON.stringify(params));
      const data = await cnpjApi.search(params);
      let results = extractResults(data);
      // Client-side enquadramento filter
      if (enquadramento) {
        results = results.filter((r: any) => {
          const simplesOpcao = (r.opcao_simples || r.opcao_pelo_simples || '').toString().toLowerCase();
          const isMei = (r.opcao_mei || r.opcao_pelo_mei || '').toString().toLowerCase();
          if (enquadramento === 'simples') return simplesOpcao === 's' || simplesOpcao === 'sim' || simplesOpcao === 'true';
          if (enquadramento === 'mei') return isMei === 's' || isMei === 'sim' || isMei === 'true';
          if (enquadramento === 'normal') return (simplesOpcao !== 's' && simplesOpcao !== 'sim' && simplesOpcao !== 'true') && (isMei !== 's' && isMei !== 'sim' && isMei !== 'true');
          return true;
        });
      }
      const newResults = results.slice(0, MAX_RESULTS);
      const total = data?.total || data?.count || data?.total_count || data?.totalResults || data?.pagination?.total || results.length;
      setTotalResults(total);
      setAccumulatedResults(prev => {
        const existingKeys = new Set(prev.map((r: any, i: number) => getResultKey(r, i)));
        const unique = newResults.filter((r: any, i: number) => !existingKeys.has(getResultKey(r, i)));
        return [...prev, ...unique];
      });
      setSearchPage(page);
      if (page === 1 && total === 0) {
        toast({ title: 'Nenhum resultado', description: 'Tente outro município, ampliar período ou buscar por Razão Social.' });
      }
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    } catch (error: any) {
      toast({ title: 'Erro na pesquisa', description: error.message, variant: 'destructive' });
    } finally {
      setIsSearchLoading(false);
    }
  };

  // Name-based search
  const handleNameSearch = async (page = 1, isNewSearch = false) => {
    if (nameValidationError) {
      toast({ title: 'Filtro obrigatório', description: nameValidationError, variant: 'destructive' });
      return;
    }
    if (isNewSearch) {
      setNameResults([]);
      setSelectedNameIds(new Set());
      setNameSearchPage(0);
      setNameTotalResults(0);
    }
    setIsNameSearchLoading(true);
    try {
      const params: any = { razao_social: nameSearchFilters.razao_social, uf: nameSearchFilters.uf, page, limit: MAX_RESULTS };
      if (nameSearchFilters.municipio.trim()) params.municipio = nameSearchFilters.municipio;
      if (nameSearchFilters.situacao) params.situacao = nameSearchFilters.situacao;
      console.log('CNPJ name search sending params:', JSON.stringify(params));
      const data = await cnpjApi.search(params);
      const results = extractResults(data);
      const newResults = results.slice(0, MAX_RESULTS);
      const total = data?.total || data?.count || data?.total_count || results.length;
      setNameTotalResults(total);
      setNameResults(prev => {
        const existingKeys = new Set(prev.map((r: any, i: number) => getResultKey(r, i)));
        const unique = newResults.filter((r: any, i: number) => !existingKeys.has(getResultKey(r, i)));
        return [...prev, ...unique];
      });
      setNameSearchPage(page);
      if (page === 1 && total === 0) {
        toast({ title: 'Nenhum resultado', description: 'Tente usar apenas parte do nome da empresa e manter apenas UF.' });
      }
    } catch (error: any) {
      toast({ title: 'Erro na pesquisa', description: error.message, variant: 'destructive' });
    } finally {
      setIsNameSearchLoading(false);
    }
  };

  function extractResults(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (data?.results && Array.isArray(data.results)) return data.results;
    if (data?.empresas && Array.isArray(data.empresas)) return data.empresas;
    if (data?.data && Array.isArray(data.data)) return data.data;
    if (data?.estabelecimentos && Array.isArray(data.estabelecimentos)) return data.estabelecimentos;
    if (data?.items && Array.isArray(data.items)) return data.items;
    return [];
  }

  // Save query helper - includes search term in metadata
  const handleSaveQuery = async (results: any[], selectedIds: Set<string>, name: string, searchTermDesc: string) => {
    if (!name.trim()) {
      toast({ title: 'Digite um nome para salvar', variant: 'destructive' });
      return;
    }
    const leadsToSave = selectedIds.size > 0
      ? results.filter((_, i) => selectedIds.has(getResultKey(results[i], i)))
      : results;
    if (leadsToSave.length === 0) {
      toast({ title: 'Nenhum resultado para salvar', variant: 'destructive' });
      return;
    }
    try {
      await savedSearchesApi.save({
        name,
        query: `cnpj:${searchTermDesc}`,
        leads: leadsToSave,
      });
      toast({ title: 'Consulta salva!', description: `"${name}" salva com ${leadsToSave.length} resultados` });
      return true;
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
      return false;
    }
  };

  const handleSaveCnaeSearch = async () => {
    const desc = JSON.stringify({ cnae: searchFilters.cnae, uf: searchFilters.uf, municipio: searchFilters.municipio, dateFrom: dateFrom?.toISOString(), dateTo: dateTo?.toISOString() });
    const ok = await handleSaveQuery(accumulatedResults, selectedSearchIds, saveName, desc);
    if (ok) { setSaveName(''); setShowSaveDialog(false); }
  };

  const handleSaveNameSearch = async () => {
    const desc = JSON.stringify({ razao_social: nameSearchFilters.razao_social, uf: nameSearchFilters.uf, municipio: nameSearchFilters.municipio });
    const ok = await handleSaveQuery(nameResults, selectedNameIds, namesSaveName, desc);
    if (ok) { setNamesSaveName(''); setShowNameSaveDialog(false); }
  };

  const handleDeleteSaved = async (id: string) => {
    try {
      await savedSearchesApi.delete(id);
      setSavedQueries(prev => prev.filter(q => q.id !== id));
      if (viewingSaved?.id === id) setViewingSaved(null);
      toast({ title: 'Consulta removida' });
    } catch (error: any) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    }
  };

  const handleViewSaved = async (id: string) => {
    try {
      const data = await savedSearchesApi.get(id);
      const leads = typeof data.leads === 'string' ? JSON.parse(data.leads) : data.leads;
      setViewingSaved({ ...data, leads });
      setSelectedSavedIds(new Set());
      clearSavedFilters();
    } catch (error: any) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
    }
  };

  const clearSavedFilters = () => {
    setSavedResultFilter('');
    setSavedCnaeFilter('');
    setSavedUfFilter('');
    setSavedCepFilter('');
    setSavedDateFrom(undefined);
    setSavedDateTo(undefined);
    setSavedSearchTermFilter('');
    setSavedRegimeFilter('');
  };

  const searchOnGoogle = (nomeFantasia: string) => {
    if (!nomeFantasia) return;
    window.open(`https://www.google.com/search?q=${encodeURIComponent(nomeFantasia)}`, '_blank');
  };

  const useCnaeAsFilter = (cnaeCode: string) => {
    const code = cnaeCode.replace(/[.\-/]/g, '').substring(0, 7);
    setSearchFilters(f => ({ ...f, cnae: code }));
    setActiveTab('search');
    toast({ title: 'CNAE aplicado', description: `CNAE ${code} preenchido na pesquisa avançada` });
  };

  const exportCnpjResults = (results: any[], filename?: string) => {
    if (results.length === 0) return;
    import('xlsx').then(XLSX => {
      const data = results.map((r: any) => {
        const socios = Array.isArray(r.socios) ? r.socios.map((s: any) => 
          `${s.nome || s.nome_socio || ''} (${s.qualificacao || s.qualificacao_socio || ''})`
        ).join('; ') : (r.socios || '');
        const tel1 = r.ddd_telefone_1 ? `(${r.ddd_telefone_1})` : '';
        const cnpjKey = `${r.cnpj_basico || ''}${r.cnpj_ordem || ''}${r.cnpj_dv || ''}`;
        const ed = enrichResults.get(cnpjKey);
        return {
          'CNPJ': formatCnpj(cnpjKey),
          'Razão Social': r.razao_social || '',
          'Nome Fantasia': r.nome_fantasia || '',
          'Situação': r.situacao_cadastral === '02' ? 'Ativa' : (r.situacao_cadastral_descricao || r.situacao_cadastral || ''),
          'Data Abertura': r.data_inicio_atividade ? formatDateDisplay(r.data_inicio_atividade) : '',
          'Capital Social': r.capital_social ? `R$ ${Number(r.capital_social).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '',
          'Natureza Jurídica': r.natureza_juridica_descricao || r.natureza_juridica || '',
          'Porte': r.porte_empresa_descricao || r.porte || '',
          'CNAE Principal': r.cnae_fiscal_principal || '',
          'CNAE Descrição': r.cnae_fiscal_principal_descricao || '',
          'Logradouro': [r.tipo_logradouro, r.logradouro].filter(Boolean).join(' ') || '',
          'Número': r.numero || '',
          'Bairro': r.bairro || '',
          'CEP': r.cep || '',
          'Município': r.municipio_nome || r.municipio || '',
          'UF': r.uf || '',
          'Telefone 1': tel1,
          'Email': r.email || r.correio_eletronico || '',
          'Sócios': socios,
          'Simples Nacional': r.opcao_pelo_simples === true || r.opcao_pelo_simples === 'S' ? 'Sim' : 'Não',
          'MEI': r.opcao_pelo_mei === true || r.opcao_pelo_mei === 'S' ? 'Sim' : 'Não',
          'Google - Nome': ed?.googleName || '',
          'Google - Telefone': ed?.phoneFormatted || '',
          'Google - WhatsApp': ed?.whatsappValid === true ? 'Sim' : ed?.whatsappValid === false ? 'Não' : '',
          'Google - Website': ed?.website || '',
        };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const colWidths = Object.keys(data[0] || {}).map(key => ({
        wch: Math.max(key.length, ...data.map(row => String((row as any)[key] || '').length).slice(0, 50)) + 2
      }));
      ws['!cols'] = colWidths;
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'CNPJ');
      XLSX.writeFile(wb, `${filename || 'cnpj_export'}.xlsx`);
    });
    toast({ title: 'Exportado com sucesso!', description: `${results.length} registros exportados` });
  };

  const handleExport = () => {
    const toExport = selectedSearchIds.size > 0
      ? accumulatedResults.filter((r, i) => selectedSearchIds.has(getResultKey(r, i)))
      : accumulatedResults;
    exportCnpjResults(toExport, 'cnpj_pesquisa');
  };

  const handleExportSaved = () => {
    const toExport = selectedSavedIds.size > 0
      ? filteredSavedResults.filter((r: any, i: number) => selectedSavedIds.has(getResultKey(r, i)))
      : filteredSavedResults;
    exportCnpjResults(toExport, `cnpj_${viewingSaved?.name || 'salvos'}`);
  };

  const handleDeleteSelectedFromSaved = async () => {
    if (!viewingSaved || selectedSavedIds.size === 0) return;
    const remaining = viewingSaved.leads.filter((r: any, i: number) => !selectedSavedIds.has(getResultKey(r, i)));
    try {
      await savedSearchesApi.update(viewingSaved.id, { leads: remaining });
      setViewingSaved({ ...viewingSaved, leads: remaining, results_count: remaining.length });
      setSelectedSavedIds(new Set());
      toast({ title: `${selectedSavedIds.size} registros removidos` });
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    }
  };

  const handleEnrich = useCallback(async (leads: any[], checkWhatsapp = true) => {
    if (leads.length === 0) {
      toast({ title: 'Nenhum lead para enriquecer', variant: 'destructive' });
      return;
    }
    setIsEnriching(true);
    setEnrichProgress({ current: 0, total: leads.length });
    try {
      const BATCH_SIZE = 10;
      const allResults = new Map(enrichResults);
      for (let i = 0; i < leads.length; i += BATCH_SIZE) {
        const batch = leads.slice(i, i + BATCH_SIZE);
        const response = await enrichApi.enrich(batch, checkWhatsapp);
        response.results.forEach((r: any) => allResults.set(r.cnpj, r));
        setEnrichResults(new Map(allResults));
        setEnrichProgress({ current: Math.min(i + BATCH_SIZE, leads.length), total: leads.length });
      }
      const enrichedCount = Array.from(allResults.values()).filter(r => r.enriched).length;
      const withPhone = Array.from(allResults.values()).filter(r => r.phone).length;
      const withWhatsapp = Array.from(allResults.values()).filter(r => r.whatsappValid === true).length;
      toast({
        title: 'Enriquecimento concluído!',
        description: `${enrichedCount} encontrados no Google · ${withPhone} com telefone · ${withWhatsapp} com WhatsApp`,
      });
    } catch (error: any) {
      toast({ title: 'Erro no enriquecimento', description: error.message, variant: 'destructive' });
    } finally {
      setIsEnriching(false);
    }
  }, [enrichResults]);

  const handleEnrichSearch = () => {
    const toEnrich = selectedSearchIds.size > 0
      ? accumulatedResults.filter((r, i) => selectedSearchIds.has(getResultKey(r, i)))
      : accumulatedResults;
    handleEnrich(toEnrich);
  };

  const handleEnrichSaved = () => {
    const toEnrich = selectedSavedIds.size > 0
      ? filteredSavedResults.filter((r: any, i: number) => selectedSavedIds.has(getResultKey(r, i)))
      : filteredSavedResults;
    handleEnrich(toEnrich);
  };

  const getEnrichData = (r: any) => {
    const cnpj = `${r.cnpj_basico || ''}${r.cnpj_ordem || ''}${r.cnpj_dv || ''}`;
    return enrichResults.get(cnpj);
  };

  // Selection helpers
  const toggleSearchSelection = (key: string) => {
    setSelectedSearchIds(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };
  const toggleAllSearch = () => {
    if (selectedSearchIds.size === accumulatedResults.length) setSelectedSearchIds(new Set());
    else setSelectedSearchIds(new Set(accumulatedResults.map((r, i) => getResultKey(r, i))));
  };
  const toggleNameSelection = (key: string) => {
    setSelectedNameIds(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };
  const toggleAllName = () => {
    if (selectedNameIds.size === nameResults.length) setSelectedNameIds(new Set());
    else setSelectedNameIds(new Set(nameResults.map((r, i) => getResultKey(r, i))));
  };
  const toggleSavedSelection = (key: string) => {
    setSelectedSavedIds(prev => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  };
  const toggleAllSaved = () => {
    if (selectedSavedIds.size === filteredSavedResults.length) setSelectedSavedIds(new Set());
    else setSelectedSavedIds(new Set(filteredSavedResults.map((r: any, i: number) => getResultKey(r, i))));
  };

  const filteredSaved = useMemo(() => {
    if (!savedFilter.trim()) return savedQueries;
    const term = savedFilter.toLowerCase();
    return savedQueries.filter(q => q.name.toLowerCase().includes(term));
  }, [savedQueries, savedFilter]);

  // Extract search term from saved query for display
  const getSearchTermFromQuery = (query: string) => {
    try {
      const json = query.replace('cnpj:', '');
      const parsed = JSON.parse(json);
      if (parsed.razao_social) return `Nome: ${parsed.razao_social}`;
      if (parsed.cnae) return `CNAE: ${parsed.cnae} · ${parsed.uf} · ${parsed.municipio}`;
      return parsed.municipio ? `${parsed.uf} · ${parsed.municipio}` : '';
    } catch { return ''; }
  };

  // Available search terms from saved queries for filter dropdown
  const savedAvailableSearchTerms = useMemo(() => {
    const terms = new Set<string>();
    savedQueries.forEach(q => {
      const term = getSearchTermFromQuery(q.query);
      if (term) terms.add(term);
    });
    return Array.from(terms).sort();
  }, [savedQueries]);

  // Filtered saved results
  const filteredSavedResults = useMemo(() => {
    if (!viewingSaved?.leads) return [];
    let results = viewingSaved.leads;
    
    if (savedResultFilter.trim()) {
      const term = savedResultFilter.toLowerCase();
      results = results.filter((r: any) =>
        (r.razao_social || '').toLowerCase().includes(term) ||
        (r.nome_fantasia || '').toLowerCase().includes(term)
      );
    }
    if (savedCnaeFilter.trim()) {
      const cnae = savedCnaeFilter.trim();
      results = results.filter((r: any) => (r.cnae_fiscal_principal || '').includes(cnae));
    }
    if (savedUfFilter && savedUfFilter !== 'all') {
      results = results.filter((r: any) => r.uf === savedUfFilter);
    }
    if (savedCepFilter.trim()) {
      const cep = savedCepFilter.replace(/\D/g, '');
      results = results.filter((r: any) => (r.cep || '').startsWith(cep));
    }
    if (savedDateFrom) {
      const fromStr = format(savedDateFrom, 'yyyyMMdd');
      results = results.filter((r: any) => (r.data_inicio_atividade || '') >= fromStr);
    }
    if (savedDateTo) {
      const toStr = format(savedDateTo, 'yyyyMMdd');
      results = results.filter((r: any) => (r.data_inicio_atividade || '') <= toStr);
    }
    // Regime tributário filter
    if (savedRegimeFilter && savedRegimeFilter !== 'all') {
      if (savedRegimeFilter === 'simples') {
        results = results.filter((r: any) => r.opcao_pelo_simples === true || r.opcao_pelo_simples === 'S');
      } else if (savedRegimeFilter === 'mei') {
        results = results.filter((r: any) => r.opcao_pelo_mei === true || r.opcao_pelo_mei === 'S');
      } else if (savedRegimeFilter === 'normal') {
        results = results.filter((r: any) => 
          (r.opcao_pelo_simples !== true && r.opcao_pelo_simples !== 'S') &&
          (r.opcao_pelo_mei !== true && r.opcao_pelo_mei !== 'S')
        );
      }
    }
    return results;
  }, [viewingSaved, savedResultFilter, savedCnaeFilter, savedUfFilter, savedCepFilter, savedDateFrom, savedDateTo, savedRegimeFilter]);

  const savedAvailableUfs = useMemo(() => {
    if (!viewingSaved?.leads) return [];
    const ufs = new Set(viewingSaved.leads.map((r: any) => r.uf).filter(Boolean));
    return Array.from(ufs).sort() as string[];
  }, [viewingSaved]);

  // Available regimes in current saved data
  const savedAvailableRegimes = useMemo(() => {
    if (!viewingSaved?.leads) return [];
    const regimes: string[] = [];
    const leads = viewingSaved.leads;
    const hasSimples = leads.some((r: any) => r.opcao_pelo_simples === true || r.opcao_pelo_simples === 'S');
    const hasMei = leads.some((r: any) => r.opcao_pelo_mei === true || r.opcao_pelo_mei === 'S');
    const hasNormal = leads.some((r: any) => 
      (r.opcao_pelo_simples !== true && r.opcao_pelo_simples !== 'S') &&
      (r.opcao_pelo_mei !== true && r.opcao_pelo_mei !== 'S')
    );
    if (hasSimples) regimes.push('simples');
    if (hasMei) regimes.push('mei');
    if (hasNormal) regimes.push('normal');
    return regimes;
  }, [viewingSaved]);

  const totalPages = Math.max(1, Math.ceil(totalResults / MAX_RESULTS));
  const hasMorePages = searchPage < totalPages && totalResults > 0;
  const nameTotalPages = Math.max(1, Math.ceil(nameTotalResults / MAX_RESULTS));
  const nameHasMorePages = nameSearchPage < nameTotalPages && nameTotalResults > 0;

  // Shared results table component
  const renderResultsTable = (
    results: any[], 
    selectedIds: Set<string>, 
    toggleSelection: (key: string) => void, 
    toggleAll: () => void
  ) => (
    <div className="overflow-x-auto"><Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px]">
            <Checkbox checked={selectedIds.size === results.length && results.length > 0} onCheckedChange={toggleAll} />
          </TableHead>
          <TableHead>CNPJ</TableHead>
          <TableHead>Razão Social</TableHead>
          <TableHead>Nome Fantasia</TableHead>
          <TableHead>UF</TableHead>
          <TableHead>Município</TableHead>
          <TableHead>Telefone</TableHead>
          <TableHead>Abertura</TableHead>
          <TableHead>Situação</TableHead>
          {enrichResults.size > 0 && (
            <>
              <TableHead>Google Nome</TableHead>
              <TableHead>Google Tel</TableHead>
              <TableHead>WhatsApp</TableHead>
            </>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {results.map((r: any, i: number) => {
          const key = getResultKey(r, i);
          const ed = enrichResults.size > 0 ? getEnrichData(r) : null;
          return (
            <TableRow key={key} className={cn(selectedIds.has(key) && 'bg-primary/5')}>
              <TableCell>
                <Checkbox checked={selectedIds.has(key)} onCheckedChange={() => toggleSelection(key)} />
              </TableCell>
              <TableCell 
                className="font-mono text-sm cursor-pointer hover:text-primary"
                onClick={() => openDetailModal(r)}
              >
                {formatCnpj(`${r.cnpj_basico || ''}${r.cnpj_ordem || ''}${r.cnpj_dv || ''}`)}
              </TableCell>
              <TableCell className="font-medium max-w-[200px] truncate">{r.razao_social}</TableCell>
              <TableCell className="max-w-[150px] truncate">{r.nome_fantasia || '-'}</TableCell>
              <TableCell>{r.uf}</TableCell>
              <TableCell>{r.municipio_nome || r.municipio || '-'}</TableCell>
              <TableCell>
                {r.ddd_telefone_1 ? (
                  <span className="flex items-center gap-1 text-sm">
                    <Phone className="h-3 w-3 text-muted-foreground" />({r.ddd_telefone_1})
                  </span>
                ) : <span className="text-muted-foreground text-xs">-</span>}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {r.data_inicio_atividade ? formatDateDisplay(r.data_inicio_atividade) : '-'}
              </TableCell>
              <TableCell>
                <Badge variant={r.situacao_cadastral === '02' ? 'default' : 'secondary'} className="text-xs">
                  {r.situacao_cadastral === '02' ? 'Ativa' : r.situacao_cadastral}
                </Badge>
              </TableCell>
              {enrichResults.size > 0 && (() => {
                return (
                  <>
                    <TableCell className="max-w-[150px] truncate text-sm">
                      {ed?.skipped ? <span className="text-muted-foreground text-xs italic">Sem nome fantasia</span> 
                        : ed?.googleName ? <span className="text-primary">{ed.googleName}</span> 
                        : ed ? <span className="text-muted-foreground text-xs">Não encontrado</span> : '-'}
                    </TableCell>
                    <TableCell className="text-sm">{ed?.skipped ? '-' : ed?.phoneFormatted || '-'}</TableCell>
                    <TableCell>
                      {ed?.skipped ? '-' : ed?.whatsappValid === true ? (
                        <Badge variant="default" className="text-xs bg-green-600"><MessageCircle className="h-3 w-3 mr-1" />Sim</Badge>
                      ) : ed?.whatsappValid === false ? (
                        <Badge variant="secondary" className="text-xs">Não</Badge>
                      ) : '-'}
                    </TableCell>
                  </>
                );
              })()}
            </TableRow>
          );
        })}
      </TableBody>
    </Table></div>
  );

  return (
    <div className="space-y-6 min-w-0 w-full overflow-x-hidden">
      <div>
        <h1 className="text-3xl font-bold tracking-tight neon-text-cyan flex items-center gap-2">
          <Building2 className="h-8 w-8" />
          Consulta CNPJ
        </h1>
        <p className="text-muted-foreground">Consulte dados de empresas pela base CNPJ</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="lookup" className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Consultar CNPJ
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Pesquisa por CNAE
          </TabsTrigger>
          <TabsTrigger value="name" className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            Pesquisa por Nome
          </TabsTrigger>
          <TabsTrigger value="saved" className="flex items-center gap-2">
            <BookmarkCheck className="h-4 w-4" />
            Salvos
          </TabsTrigger>
        </TabsList>

        {/* Tab: Consulta por CNPJ */}
        <TabsContent value="lookup" className="space-y-4">
          <Card className="neon-border">
            <CardHeader>
              <CardTitle>Consulta por CNPJ</CardTitle>
              <CardDescription>Digite o CNPJ para consultar dados completos da empresa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Input
                    placeholder="00.000.000/0001-00"
                    value={cnpj}
                    onChange={handleCnpjChange}
                    onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                    className="h-12 text-lg font-mono"
                    maxLength={18}
                  />
                </div>
                <Button onClick={handleLookup} disabled={isLookupLoading} className="h-12 px-6">
                  {isLookupLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5 mr-2" />}
                  Consultar
                </Button>
              </div>
              {isLookupLoading && <SearchProgress isLoading={true} source="cnpj" />}
            </CardContent>
          </Card>

          {lookupResult && (() => {
            const emp = lookupResult.empresa || lookupResult;
            const est = lookupResult.estabelecimento || lookupResult;
            const socios = lookupResult.socios || lookupResult.qsa || emp.socios || [];
            const razaoSocial = emp.razao_social || est.razao_social || lookupResult.razao_social || '';
            const nomeFantasia = est.nome_fantasia || emp.nome_fantasia || lookupResult.nome_fantasia || '';
            const capitalSocial = emp.capital_social || lookupResult.capital_social;
            const natureza = emp.natureza_descricao || emp.natureza_juridica_descricao || lookupResult.natureza_juridica || '';
            const situacao = est.situacao_cadastral || lookupResult.situacao_cadastral || '';
            const situacaoDesc = est.situacao_cadastral_descricao || lookupResult.situacao_cadastral_descricao || '';
            const dataAbertura = est.data_inicio_atividade || lookupResult.data_inicio_atividade || lookupResult.data_abertura || '';
            const cnaePrincipal = est.cnae_fiscal_principal || est.cnae_principal || lookupResult.cnae_fiscal_principal || '';
            const cnaePrincipalDesc = est.cnae_fiscal_principal_descricao || est.cnae_principal_descricao || lookupResult.cnae_fiscal_principal_descricao || '';
            const cnaesSecundarios = est.cnaes_secundarios || est.cnaes_fiscais_secundarios || lookupResult.cnaes_secundarios || [];
            const tipoLogradouro = est.tipo_logradouro || lookupResult.tipo_logradouro || '';
            const logradouro = est.logradouro || lookupResult.logradouro || '';
            const numero = est.numero || lookupResult.numero || '';
            const complemento = est.complemento || lookupResult.complemento || '';
            const bairro = est.bairro || lookupResult.bairro || '';
            const municipio = est.municipio_nome || est.municipio || lookupResult.municipio || '';
            const uf = est.uf || lookupResult.uf || '';
            const cep = est.cep || lookupResult.cep || '';
            const tel1 = est.ddd_telefone_1 || lookupResult.ddd_telefone_1 || lookupResult.telefone || '';
            const tel2 = est.ddd_telefone_2 || lookupResult.ddd_telefone_2 || '';
            const email = est.email || est.correio_eletronico || lookupResult.email || lookupResult.correio_eletronico || '';
            const porte = emp.porte_empresa_descricao || emp.porte || lookupResult.porte_empresa_descricao || lookupResult.porte || '';
            const simples = lookupResult.simples || {};

            return (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="h-5 w-5" /> Empresa
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Razão Social" value={razaoSocial} />
                  <InfoRow label="Nome Fantasia" value={nomeFantasia} />
                  <InfoRow label="Capital Social" value={capitalSocial ? `R$ ${Number(capitalSocial).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
                  <InfoRow label="Natureza Jurídica" value={natureza} />
                  <InfoRow label="Porte" value={porte} />
                  {cnaePrincipal && (
                    <div className="space-y-1">
                      <span className="text-sm text-muted-foreground">CNAE Principal</span>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors"
                          onClick={() => useCnaeAsFilter(cnaePrincipal)} title="Usar como filtro">
                          {cnaePrincipal}<Search className="h-3 w-3 ml-1" />
                        </Badge>
                        {cnaePrincipalDesc && <span className="text-xs text-muted-foreground">{cnaePrincipalDesc}</span>}
                      </div>
                    </div>
                  )}
                  {cnaesSecundarios?.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">CNAEs Secundários ({cnaesSecundarios.length})</span>
                      <div className="flex flex-wrap gap-1.5">
                        {cnaesSecundarios.map((cnae: any, idx: number) => {
                          const code = typeof cnae === 'string' ? cnae : cnae.codigo || cnae.code || cnae.cnae || '';
                          if (!code) return null;
                          return (
                            <Badge key={idx} variant="secondary" className="cursor-pointer hover:bg-primary/20 text-xs"
                              onClick={() => useCnaeAsFilter(code)}>
                              {code}<Search className="h-2.5 w-2.5 ml-1 opacity-60" />
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <InfoRow label="Data de Abertura" value={dataAbertura ? formatDateDisplay(dataAbertura) : null} />
                  {(simples.opcao_pelo_simples !== undefined || simples.opcao_pelo_mei !== undefined) && (
                    <div className="flex gap-2 flex-wrap">
                      {simples.opcao_pelo_simples !== undefined && (
                        <Badge variant={simples.opcao_pelo_simples ? 'default' : 'secondary'}>Simples: {simples.opcao_pelo_simples ? 'Sim' : 'Não'}</Badge>
                      )}
                      {simples.opcao_pelo_mei !== undefined && (
                        <Badge variant={simples.opcao_pelo_mei ? 'default' : 'secondary'}>MEI: {simples.opcao_pelo_mei ? 'Sim' : 'Não'}</Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MapPin className="h-5 w-5" /> Endereço & Contato
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Logradouro" value={logradouro ? `${tipoLogradouro} ${logradouro}, ${numero}`.trim() : null} />
                  <InfoRow label="Complemento" value={complemento} />
                  <InfoRow label="Bairro" value={bairro} />
                  <InfoRow label="Município/UF" value={municipio ? `${municipio} - ${uf}` : uf} />
                  <InfoRow label="CEP" value={cep} />
                  <Separator />
                  <InfoRow label="Telefone 1" value={tel1} />
                  <InfoRow label="Telefone 2" value={tel2} />
                  <InfoRow label="E-mail" value={email} />
                </CardContent>
              </Card>
              {socios.length > 0 && (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5" /> Quadro Societário ({socios.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Qualificação</TableHead>
                          <TableHead>Data de Entrada</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {socios.map((s: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{s.nome_socio || s.nome || ''}</TableCell>
                            <TableCell>{s.qualificacao_descricao || s.qualificacao_socio || s.qualificacao || ''}</TableCell>
                            <TableCell>{(s.data_entrada_sociedade || s.data_entrada) ? formatDateDisplay(s.data_entrada_sociedade || s.data_entrada) : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
            );
          })()}
        </TabsContent>

        {/* Tab: Pesquisa por CNAE */}
        <TabsContent value="search" className="space-y-4">
          <Card className="neon-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Pesquisa por CNAE
              </CardTitle>
              <CardDescription>
                Busque empresas por código CNAE e localização. Data de abertura obrigatória.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">Dados da Empresa</Label>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>CNAE <span className="text-destructive">*</span></Label>
                    <Input placeholder="Ex: 6201 (TI)" value={searchFilters.cnae}
                      onChange={(e) => setSearchFilters(f => ({ ...f, cnae: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>UF <span className="text-destructive">*</span></Label>
                    <Select value={searchFilters.uf || 'all'} onValueChange={(v) => setSearchFilters(f => ({ ...f, uf: v === 'all' ? '' : v, municipio: '' }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Município <span className="text-destructive">*</span></Label>
                    <Popover open={municipioOpen} onOpenChange={setMunicipioOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" aria-expanded={municipioOpen}
                          className={cn("w-full justify-between font-normal", !searchFilters.municipio && "text-muted-foreground")}
                          disabled={!searchFilters.uf || isMunicipiosLoading}>
                          {isMunicipiosLoading ? "Carregando..." : searchFilters.municipio || "Selecione o município"}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[200px] p-0 z-50" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar município..." />
                          <CommandList>
                            <CommandEmpty>Nenhum município encontrado.</CommandEmpty>
                            <CommandGroup className="max-h-[250px] overflow-y-auto">
                              {municipios.map((mun) => (
                                <CommandItem key={mun} value={mun}
                                  onSelect={() => { setSearchFilters(f => ({ ...f, municipio: mun })); setMunicipioOpen(false); }}>
                                  <Check className={cn("mr-2 h-4 w-4", searchFilters.municipio.toLowerCase() === mun.toLowerCase() ? "opacity-100" : "opacity-0")} />
                                  {mun}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Situação</Label>
                    <Select value={searchFilters.situacao || 'all'} onValueChange={(v) => setSearchFilters(f => ({ ...f, situacao: v === 'all' ? '' : v }))}>
                      <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="02">Ativa</SelectItem>
                        <SelectItem value="03">Suspensa</SelectItem>
                        <SelectItem value="04">Inapta</SelectItem>
                        <SelectItem value="08">Baixada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Enquadramento</Label>
                    <Select value={searchFilters.enquadramento || 'all'} onValueChange={(v) => setSearchFilters(f => ({ ...f, enquadramento: v === 'all' ? '' : v }))}>
                      <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="simples">Simples Nacional</SelectItem>
                        <SelectItem value="mei">MEI</SelectItem>
                        <SelectItem value="normal">Lucro Presumido / Real</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {filterValidationError && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" /><span>{filterValidationError}</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Data de Abertura */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">
                  <CalendarIcon className="h-3 w-3 inline mr-1" />
                  Data de Abertura <span className="text-destructive font-normal normal-case">* obrigatória (máx. 1 ano)</span>
                </Label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {DATE_PRESETS.map((preset) => (
                    <Button key={preset.label} variant="outline" size="sm" className="h-7 text-xs" onClick={() => applyDatePreset(preset)}>
                      {preset.label}
                    </Button>
                  ))}
                  {(dateFrom || dateTo) && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={clearDates}>Limpar datas</Button>
                  )}
                </div>
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">De</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Data inicial"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} disabled={(date) => date > new Date()} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Até</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-[200px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Data final"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={dateTo} onSelect={setDateTo} disabled={(date) => date > new Date()} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                      </PopoverContent>
                    </Popover>
                  </div>
                  {dateRangeLabel && !dateRangeError && (
                    <Badge variant="secondary" className="h-8"><CalendarIcon className="h-3 w-3 mr-1" />{dateRangeLabel}</Badge>
                  )}
                </div>
                {dateRangeError && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" /><span>{dateRangeError}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="flex items-center gap-3 flex-wrap">
                <Button onClick={() => handleSearch(1, true)} disabled={isSearchLoading || !!dateRangeError || !!filterValidationError} className="px-6">
                  {isSearchLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                  Nova Pesquisa
                </Button>
                {accumulatedResults.length > 0 && (
                  <>
                    <Button variant="outline" onClick={handleExport}>
                      <Download className="h-4 w-4 mr-2" />Exportar {selectedSearchIds.size > 0 ? `(${selectedSearchIds.size})` : `(${accumulatedResults.length})`}
                    </Button>
                    <Button variant="outline" onClick={() => setShowSaveDialog(true)}>
                      <Save className="h-4 w-4 mr-2" />Salvar {selectedSearchIds.size > 0 ? `(${selectedSearchIds.size})` : `(${accumulatedResults.length})`}
                    </Button>
                  </>
                )}
                <span className="text-xs text-muted-foreground ml-auto">Máx. {MAX_RESULTS} resultados por página</span>
              </div>
            </CardContent>
          </Card>

          {showSaveDialog && (
            <Card className="border-primary/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Input placeholder="Nome da consulta (ex: Restaurantes SP 2024)" value={saveName}
                    onChange={(e) => setSaveName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveCnaeSearch()} className="flex-1" />
                  <Button onClick={handleSaveCnaeSearch} size="sm">
                    <Save className="h-4 w-4 mr-1" />Salvar {selectedSearchIds.size > 0 ? `${selectedSearchIds.size} selecionados` : `${accumulatedResults.length} resultados`}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowSaveDialog(false)}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div ref={progressRef}>
            {isSearchLoading && <SearchProgress isLoading={true} source="cnpj" />}
          </div>

          {accumulatedResults.length > 0 && (
            <Card ref={resultsRef} className="min-w-0">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Resultados</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{accumulatedResults.length} carregados ({searchPage} pág.)</Badge>
                    {totalResults > 0 && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/30 text-sm px-3 py-1">
                        <Database className="h-3.5 w-3.5 mr-1.5" />{totalResults.toLocaleString('pt-BR')} na Receita Federal
                      </Badge>
                    )}
                    {selectedSearchIds.size > 0 && (
                      <Badge variant="default" className="text-sm px-3 py-1"><CheckSquare className="h-3.5 w-3.5 mr-1.5" />{selectedSearchIds.size} selecionados</Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <Button variant="ghost" size="sm" onClick={toggleAllSearch} className="text-xs">
                    {selectedSearchIds.size === accumulatedResults.length ? <><XSquare className="h-3.5 w-3.5 mr-1" /> Desmarcar todos</> : <><CheckSquare className="h-3.5 w-3.5 mr-1" /> Selecionar todos</>}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleEnrichSearch} disabled={isEnriching || accumulatedResults.length === 0} className="text-xs gap-1">
                    {isEnriching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                    Enriquecer {selectedSearchIds.size > 0 ? `(${selectedSearchIds.size})` : 'Todos'}
                  </Button>
                </div>
                {isEnriching && (
                  <div className="mb-3 space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Enriquecendo leads via Google Maps...</span>
                      <span>{enrichProgress.current} / {enrichProgress.total}</span>
                    </div>
                    <Progress value={(enrichProgress.current / enrichProgress.total) * 100} className="h-2" />
                  </div>
                )}
                {renderResultsTable(accumulatedResults, selectedSearchIds, toggleSearchSelection, toggleAllSearch)}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">
                    {accumulatedResults.length} de {totalResults.toLocaleString('pt-BR')} carregados (pág. {searchPage} de {totalPages})
                  </span>
                  {hasMorePages && (
                    <Button onClick={() => handleSearch(searchPage + 1)} disabled={isSearchLoading} className="gap-2">
                      {isSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Carregar Página {searchPage + 1} (+{MAX_RESULTS})
                    </Button>
                  )}
                  {!hasMorePages && searchPage > 0 && <Badge variant="secondary">Todos carregados</Badge>}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Pesquisa por Nome */}
        <TabsContent value="name" className="space-y-4">
          <Card className="neon-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5" />
                Pesquisa por Razão Social
              </CardTitle>
              <CardDescription>
                Busque todas as empresas que contêm ou começam com o nome informado.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Razão Social <span className="text-destructive">*</span></Label>
                  <Input placeholder="Nome da empresa..." value={nameSearchFilters.razao_social}
                    onChange={(e) => setNameSearchFilters(f => ({ ...f, razao_social: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleNameSearch(1, true)}
                    className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label>UF <span className="text-destructive">*</span></Label>
                  <Select value={nameSearchFilters.uf || 'all'} onValueChange={(v) => setNameSearchFilters(f => ({ ...f, uf: v === 'all' ? '' : v, municipio: '' }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Município <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                  <Popover open={nameMunicipioOpen} onOpenChange={setNameMunicipioOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox"
                        className={cn("w-full justify-between font-normal", !nameSearchFilters.municipio && "text-muted-foreground")}
                        disabled={!nameSearchFilters.uf || isNameMunicipiosLoading}>
                        {isNameMunicipiosLoading ? "Carregando..." : nameSearchFilters.municipio || "Selecione"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[200px] p-0 z-50" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar município..." />
                        <CommandList>
                          <CommandEmpty>Nenhum município encontrado.</CommandEmpty>
                          <CommandGroup className="max-h-[250px] overflow-y-auto">
                            {nameMunicipios.map((mun) => (
                              <CommandItem key={mun} value={mun}
                                onSelect={() => { setNameSearchFilters(f => ({ ...f, municipio: mun })); setNameMunicipioOpen(false); }}>
                                <Check className={cn("mr-2 h-4 w-4", nameSearchFilters.municipio.toLowerCase() === mun.toLowerCase() ? "opacity-100" : "opacity-0")} />
                                {mun}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {nameValidationError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" /><span>{nameValidationError}</span>
                </div>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <Button onClick={() => handleNameSearch(1, true)} disabled={isNameSearchLoading || !!nameValidationError} className="px-6">
                  {isNameSearchLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                  Pesquisar
                </Button>
                {nameResults.length > 0 && (
                  <>
                    <Button variant="outline" onClick={() => {
                      const toExport = selectedNameIds.size > 0 ? nameResults.filter((r, i) => selectedNameIds.has(getResultKey(r, i))) : nameResults;
                      exportCnpjResults(toExport, 'cnpj_nome');
                    }}>
                      <Download className="h-4 w-4 mr-2" />Exportar {selectedNameIds.size > 0 ? `(${selectedNameIds.size})` : `(${nameResults.length})`}
                    </Button>
                    <Button variant="outline" onClick={() => setShowNameSaveDialog(true)}>
                      <Save className="h-4 w-4 mr-2" />Salvar
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {showNameSaveDialog && (
            <Card className="border-primary/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Input placeholder="Nome da consulta" value={namesSaveName}
                    onChange={(e) => setNamesSaveName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSaveNameSearch()} className="flex-1" />
                  <Button onClick={handleSaveNameSearch} size="sm"><Save className="h-4 w-4 mr-1" />Salvar</Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowNameSaveDialog(false)}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isNameSearchLoading && <SearchProgress isLoading={true} source="cnpj" />}

          {nameResults.length > 0 && (
            <Card className="min-w-0">
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />Resultados por Nome</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline">{nameResults.length} carregados</Badge>
                    {nameTotalResults > 0 && (
                      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/30 text-sm px-3 py-1">
                        <Database className="h-3.5 w-3.5 mr-1.5" />{nameTotalResults.toLocaleString('pt-BR')} encontradas
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <Button variant="ghost" size="sm" onClick={toggleAllName} className="text-xs">
                    {selectedNameIds.size === nameResults.length ? <><XSquare className="h-3.5 w-3.5 mr-1" /> Desmarcar</> : <><CheckSquare className="h-3.5 w-3.5 mr-1" /> Selecionar todos</>}
                  </Button>
                </div>
                {renderResultsTable(nameResults, selectedNameIds, toggleNameSelection, toggleAllName)}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">{nameResults.length} de {nameTotalResults.toLocaleString('pt-BR')}</span>
                  {nameHasMorePages && (
                    <Button onClick={() => handleNameSearch(nameSearchPage + 1)} disabled={isNameSearchLoading} className="gap-2">
                      {isNameSearchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Carregar mais (+{MAX_RESULTS})
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Consultas Salvas */}
        <TabsContent value="saved" className="space-y-4">
          {viewingSaved ? (
            <>
              <Card className="neon-border">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <BookmarkCheck className="h-5 w-5" />{viewingSaved.name}
                      </CardTitle>
                      <CardDescription>
                        {viewingSaved.leads?.length || 0} resultados · Salvo em {viewingSaved.created_at ? new Date(viewingSaved.created_at).toLocaleDateString('pt-BR') : '-'}
                        {viewingSaved.query && (
                          <span className="ml-2 text-primary">{getSearchTermFromQuery(viewingSaved.query)}</span>
                        )}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={handleEnrichSaved} disabled={isEnriching || filteredSavedResults.length === 0}>
                        {isEnriching ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
                        Enriquecer {selectedSavedIds.size > 0 ? `(${selectedSavedIds.size})` : 'Todos'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExportSaved} disabled={filteredSavedResults.length === 0}>
                        <Download className="h-4 w-4 mr-1" />Exportar {selectedSavedIds.size > 0 ? `(${selectedSavedIds.size})` : `(${filteredSavedResults.length})`}
                      </Button>
                      {selectedSavedIds.size > 0 && (
                        <Button variant="destructive" size="sm" onClick={handleDeleteSelectedFromSaved}>
                          <Trash2 className="h-4 w-4 mr-1" />Apagar {selectedSavedIds.size}
                        </Button>
                      )}
                      <Button variant="outline" size="sm" onClick={() => { setViewingSaved(null); clearSavedFilters(); setSelectedSavedIds(new Set()); }}>
                        ← Voltar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Filters - now with regime and more columns */}
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
                    <div className="space-y-1">
                      <Label className="text-xs">Nome / Razão Social</Label>
                      <Input placeholder="Filtrar por nome..." value={savedResultFilter} onChange={(e) => setSavedResultFilter(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">CNAE</Label>
                      <Input placeholder="Ex: 4712100" value={savedCnaeFilter} onChange={(e) => setSavedCnaeFilter(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Estado (UF)</Label>
                      <Select value={savedUfFilter || 'all'} onValueChange={(v) => setSavedUfFilter(v === 'all' ? '' : v)}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {savedAvailableUfs.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">CEP (início)</Label>
                      <Input placeholder="Ex: 01000" value={savedCepFilter} onChange={(e) => setSavedCepFilter(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Enquadramento</Label>
                      <Select value={savedRegimeFilter || 'all'} onValueChange={setSavedRegimeFilter}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {savedAvailableRegimes.includes('simples') && <SelectItem value="simples">Simples Nacional</SelectItem>}
                          {savedAvailableRegimes.includes('mei') && <SelectItem value="mei">MEI</SelectItem>}
                          {savedAvailableRegimes.includes('normal') && <SelectItem value="normal">Lucro Presumido / Real</SelectItem>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Abertura de</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal text-xs", !savedDateFrom && "text-muted-foreground")}>
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {savedDateFrom ? format(savedDateFrom, "dd/MM/yy") : "De"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={savedDateFrom} onSelect={setSavedDateFrom} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Abertura até</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className={cn("w-full h-9 justify-start text-left font-normal text-xs", !savedDateTo && "text-muted-foreground")}>
                            <CalendarIcon className="mr-1 h-3 w-3" />
                            {savedDateTo ? format(savedDateTo, "dd/MM/yy") : "Até"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={savedDateTo} onSelect={setSavedDateTo} initialFocus className="p-3 pointer-events-auto" locale={ptBR} />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="h-8 px-3">{filteredSavedResults.length} de {viewingSaved.leads?.length || 0} resultados</Badge>
                    {(savedResultFilter || savedCnaeFilter || savedUfFilter || savedCepFilter || savedDateFrom || savedDateTo || savedRegimeFilter) && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={clearSavedFilters}>Limpar filtros</Button>
                    )}
                    {selectedSavedIds.size > 0 && (
                      <Badge variant="default" className="h-8 px-3"><CheckSquare className="h-3.5 w-3.5 mr-1" />{selectedSavedIds.size} selecionados</Badge>
                    )}
                  </div>

                  {isEnriching && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Enriquecendo...</span><span>{enrichProgress.current} / {enrichProgress.total}</span>
                      </div>
                      <Progress value={(enrichProgress.current / enrichProgress.total) * 100} className="h-2" />
                    </div>
                  )}

                  {renderResultsTable(filteredSavedResults, selectedSavedIds, toggleSavedSelection, toggleAllSaved)}
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card className="neon-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><BookmarkCheck className="h-5 w-5" />Consultas CNPJ Salvas</CardTitle>
                  <CardDescription>Acesse resultados de consultas anteriores sem gastar novas buscas</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input placeholder="Filtrar por nome..." value={savedFilter} onChange={(e) => setSavedFilter(e.target.value)} />
                  {isSavedLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : filteredSaved.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <BookmarkCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p>Nenhuma consulta salva</p>
                      <p className="text-xs mt-1">Use as abas de pesquisa e clique em "Salvar"</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredSaved.map((q: any) => (
                        <div key={q.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                          <div className="flex-1 cursor-pointer" onClick={() => handleViewSaved(q.id)}>
                            <p className="font-medium">{q.name}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              <span>{q.results_count} resultados</span>
                              <span>·</span>
                              <span>{q.created_at ? new Date(q.created_at).toLocaleDateString('pt-BR') : '-'}</span>
                              {q.query && (
                                <>
                                  <span>·</span>
                                  <span className="text-primary">{getSearchTermFromQuery(q.query)}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewSaved(q.id)}>
                              <SearchIcon className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteSaved(q.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      <CnpjDetailModal
        cnpj={detailCnpj}
        open={detailModalOpen}
        onOpenChange={(open) => {
          setDetailModalOpen(open);
          if (!open) { setDetailPreloadedData(null); setDetailEnrichData(null); }
        }}
        preloadedData={detailPreloadedData}
        enrichData={detailEnrichData}
        onUseCnaeAsFilter={(cnae) => {
          const code = cnae.replace(/[.\-/]/g, '').substring(0, 7);
          setSearchFilters(f => ({ ...f, cnae: code }));
          setActiveTab('search');
          setDetailModalOpen(false);
          toast({ title: 'CNAE aplicado', description: `CNAE ${code} preenchido na pesquisa por CNAE` });
        }}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value.trim() === '' || value.trim() === ',') return null;
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function formatDateDisplay(dateStr: string) {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.slice(6, 8)}/${dateStr.slice(4, 6)}/${dateStr.slice(0, 4)}`;
}
