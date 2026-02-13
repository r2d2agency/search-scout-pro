import { useState, useMemo, useEffect } from 'react';
import { cnpjApi, savedSearchesApi } from '@/lib/apiClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
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
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

import { format, differenceInDays, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { SearchProgress } from '@/components/SearchProgress';

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

  // Search state
  const [searchFilters, setSearchFilters] = useState({
    razao_social: '',
    cnae: '',
    municipio: '',
    uf: '',
    situacao: '',
  });
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Saved CNPJ queries state
  const [savedQueries, setSavedQueries] = useState<any[]>([]);
  const [isSavedLoading, setIsSavedLoading] = useState(false);
  const [savedFilter, setSavedFilter] = useState('');
  const [viewingSaved, setViewingSaved] = useState<any>(null);
  const [saveName, setSaveName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

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
      // Filter only CNPJ-type saved searches
      setSavedQueries(data.filter((s: any) => s.query?.startsWith('cnpj:')));
    } catch (error: any) {
      console.error('Erro ao carregar consultas salvas:', error);
    } finally {
      setIsSavedLoading(false);
    }
  };

  // Validation: if razao_social is filled, UF is required
  const filterValidationError = useMemo(() => {
    if (searchFilters.razao_social.trim() && !searchFilters.uf) {
      return 'Ao pesquisar por Razão Social, selecione também o Estado (UF)';
    }
    return null;
  }, [searchFilters.razao_social, searchFilters.uf]);

  const dateRangeError = useMemo(() => {
    if (dateFrom && dateTo) {
      const diff = differenceInDays(dateTo, dateFrom);
      if (diff < 0) return 'Data final deve ser posterior à data inicial';
      if (diff > MAX_RANGE_DAYS) return `Intervalo máximo permitido: 1 ano (${MAX_RANGE_DAYS} dias). Atual: ${diff} dias`;
    }
    if (dateFrom && !dateTo) return 'Selecione também a data final';
    if (!dateFrom && dateTo) return 'Selecione também a data inicial';
    return null;
  }, [dateFrom, dateTo]);

  const dateRangeLabel = useMemo(() => {
    if (dateFrom && dateTo) {
      const diff = differenceInDays(dateTo, dateFrom);
      return `${diff} dias selecionados`;
    }
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

  const clearDates = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

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

  const handleSearch = async (page = 1) => {
    const hasTextFilter = Object.values(searchFilters).some(v => v.trim());
    const hasDateFilter = dateFrom && dateTo;

    if (!hasTextFilter && !hasDateFilter) {
      toast({ title: 'Informe ao menos um filtro', variant: 'destructive' });
      return;
    }

    if (filterValidationError) {
      toast({ title: 'Filtro obrigatório', description: filterValidationError, variant: 'destructive' });
      return;
    }

    if (dateRangeError) {
      toast({ title: 'Erro no período', description: dateRangeError, variant: 'destructive' });
      return;
    }

    setIsSearchLoading(true);
    try {
      const params: any = { ...searchFilters, page, limit: MAX_RESULTS };
      if (dateFrom && dateTo) {
        params.data_abertura_gte = toApiDate(dateFrom);
        params.data_abertura_lte = toApiDate(dateTo);
      }
      const data = await cnpjApi.search(params);
      const results = data.results || data.empresas || data || [];
      setSearchResults(Array.isArray(results) ? results.slice(0, MAX_RESULTS) : []);
      setTotalResults(data.total || results.length || 0);
      setSearchPage(page);
    } catch (error: any) {
      toast({ title: 'Erro na pesquisa', description: error.message, variant: 'destructive' });
    } finally {
      setIsSearchLoading(false);
    }
  };

  const handleSaveQuery = async () => {
    if (!saveName.trim()) {
      toast({ title: 'Digite um nome para salvar', variant: 'destructive' });
      return;
    }
    try {
      const queryDesc = `cnpj:${JSON.stringify({ ...searchFilters, dateFrom: dateFrom?.toISOString(), dateTo: dateTo?.toISOString() })}`;
      await savedSearchesApi.save({
        name: saveName,
        query: queryDesc,
        leads: searchResults,
      });
      toast({ title: 'Consulta salva!', description: `"${saveName}" salva com ${searchResults.length} resultados` });
      setSaveName('');
      setShowSaveDialog(false);
    } catch (error: any) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    }
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
    } catch (error: any) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
    }
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
      const data = results.map((r: any) => ({
        'CNPJ': formatCnpj(`${r.cnpj_basico || ''}${r.cnpj_ordem || ''}${r.cnpj_dv || ''}`),
        'Razão Social': r.razao_social || '',
        'Nome Fantasia': r.nome_fantasia || '',
        'UF': r.uf || '',
        'Município': r.municipio_nome || r.municipio || '',
        'Telefone': r.ddd_telefone_1 ? `(${r.ddd_telefone_1})` : '',
        'Situação': r.situacao_cadastral === '02' ? 'Ativa' : (r.situacao_cadastral || ''),
        'Data Abertura': r.data_inicio_atividade ? formatDateDisplay(r.data_inicio_atividade) : '',
        'CNAE Principal': r.cnae_fiscal_principal || '',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'CNPJ');
      XLSX.writeFile(wb, `${filename || 'cnpj_export'}.xlsx`);
    });
    toast({ title: 'Exportado com sucesso!', description: `${results.length} registros exportados` });
  };

  const handleExport = () => exportCnpjResults(searchResults, 'cnpj_pesquisa');
  const handleExportSaved = () => exportCnpjResults(filteredSavedResults, `cnpj_${viewingSaved?.name || 'salvos'}`);

  // Filtered saved queries
  const filteredSaved = useMemo(() => {
    if (!savedFilter.trim()) return savedQueries;
    const term = savedFilter.toLowerCase();
    return savedQueries.filter(q => q.name.toLowerCase().includes(term));
  }, [savedQueries, savedFilter]);

  // Filtered saved results (when viewing a saved query)
  const [savedResultFilter, setSavedResultFilter] = useState('');
  const filteredSavedResults = useMemo(() => {
    if (!viewingSaved?.leads) return [];
    if (!savedResultFilter.trim()) return viewingSaved.leads;
    const term = savedResultFilter.toLowerCase();
    return viewingSaved.leads.filter((r: any) =>
      (r.razao_social || '').toLowerCase().includes(term) ||
      (r.nome_fantasia || '').toLowerCase().includes(term) ||
      (r.municipio_nome || r.municipio || '').toLowerCase().includes(term) ||
      (r.uf || '').toLowerCase().includes(term)
    );
  }, [viewingSaved, savedResultFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight neon-text-cyan flex items-center gap-2">
          <Building2 className="h-8 w-8" />
          Consulta CNPJ
        </h1>
        <p className="text-muted-foreground">Consulte dados de empresas pela base CNPJ</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="lookup" className="flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Consultar CNPJ
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Pesquisa Avançada
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

              {isLookupLoading && (
                <SearchProgress isLoading={true} source="cnpj" />
              )}
            </CardContent>
          </Card>

          {/* Resultado da consulta */}
          {lookupResult && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="h-5 w-5" />
                    Empresa
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Razão Social" value={lookupResult.empresa?.razao_social} />
                  <InfoRow label="Nome Fantasia" value={lookupResult.estabelecimento?.nome_fantasia} />
                  <InfoRow label="Capital Social" value={lookupResult.empresa?.capital_social ? `R$ ${Number(lookupResult.empresa.capital_social).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
                  <InfoRow label="Natureza Jurídica" value={lookupResult.empresa?.natureza_descricao} />
                  {/* CNAE Principal */}
                  {lookupResult.estabelecimento?.cnae_principal && (
                    <div className="space-y-1">
                      <span className="text-sm text-muted-foreground">CNAE Principal</span>
                      <div>
                        <Badge 
                          variant="outline" 
                          className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors"
                          onClick={() => useCnaeAsFilter(lookupResult.estabelecimento.cnae_principal)}
                          title="Usar como filtro na pesquisa avançada"
                        >
                          {lookupResult.estabelecimento.cnae_principal}
                          <Search className="h-3 w-3 ml-1" />
                        </Badge>
                      </div>
                    </div>
                  )}
                  
                  {/* CNAEs Secundários */}
                  {lookupResult.estabelecimento?.cnaes_secundarios && lookupResult.estabelecimento.cnaes_secundarios.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-sm text-muted-foreground">CNAEs Secundários ({lookupResult.estabelecimento.cnaes_secundarios.length})</span>
                      <div className="flex flex-wrap gap-1.5">
                        {lookupResult.estabelecimento.cnaes_secundarios.map((cnae: any, idx: number) => {
                          const code = typeof cnae === 'string' ? cnae : cnae.codigo || cnae.code || cnae.cnae || '';
                          const desc = typeof cnae === 'object' ? (cnae.descricao || cnae.description || '') : '';
                          if (!code) return null;
                          return (
                            <Badge 
                              key={idx}
                              variant="secondary" 
                              className="cursor-pointer hover:bg-primary/20 hover:border-primary/50 border border-transparent transition-colors text-xs"
                              onClick={() => useCnaeAsFilter(code)}
                              title={desc ? `${desc} — Clique para usar como filtro` : 'Clique para usar como filtro'}
                            >
                              {code}
                              {desc && <span className="ml-1 max-w-[150px] truncate opacity-70">· {desc}</span>}
                              <Search className="h-2.5 w-2.5 ml-1 opacity-60" />
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <InfoRow label="Data de Abertura" value={lookupResult.estabelecimento?.data_inicio_atividade ? formatDateDisplay(lookupResult.estabelecimento.data_inicio_atividade) : null} />
                  <div className="pt-2">
                    <Badge variant={lookupResult.estabelecimento?.situacao_cadastral === '02' ? 'default' : 'destructive'}>
                      {lookupResult.estabelecimento?.situacao_cadastral === '02' ? 'Ativa' : `Situação: ${lookupResult.estabelecimento?.situacao_cadastral || 'N/A'}`}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <MapPin className="h-5 w-5" />
                    Endereço & Contato
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Logradouro" value={`${lookupResult.estabelecimento?.logradouro || ''}, ${lookupResult.estabelecimento?.numero || ''}`} />
                  <InfoRow label="Complemento" value={lookupResult.estabelecimento?.complemento} />
                  <InfoRow label="Bairro" value={lookupResult.estabelecimento?.bairro} />
                  <InfoRow label="Município" value={lookupResult.estabelecimento?.municipio_nome} />
                  <InfoRow label="UF" value={lookupResult.estabelecimento?.uf} />
                  <InfoRow label="CEP" value={lookupResult.estabelecimento?.cep} />
                  <Separator className="my-2" />
                  <InfoRow label="Telefone 1" value={lookupResult.estabelecimento?.ddd_telefone_1 ? `(${lookupResult.estabelecimento.ddd_telefone_1})` : null} />
                  <InfoRow label="Telefone 2" value={lookupResult.estabelecimento?.ddd_telefone_2 ? `(${lookupResult.estabelecimento.ddd_telefone_2})` : null} />
                  <InfoRow label="E-mail" value={lookupResult.estabelecimento?.email} />
                </CardContent>
              </Card>

              {lookupResult.socios && lookupResult.socios.length > 0 && (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5" />
                      Sócios ({lookupResult.socios.length})
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
                        {lookupResult.socios.map((socio: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{socio.nome_socio}</TableCell>
                            <TableCell>{socio.qualificacao_descricao}</TableCell>
                            <TableCell>{socio.data_entrada ? formatDateDisplay(socio.data_entrada) : '-'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Tab: Pesquisa Avançada */}
        <TabsContent value="search" className="space-y-4">
          <Card className="neon-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Pesquisa Avançada
              </CardTitle>
              <CardDescription>
                Busque empresas por razão social, CNAE, localização e data de abertura.
                Máximo de {MAX_RESULTS} resultados por busca.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Filtros de texto */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">Dados da Empresa</Label>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Razão Social</Label>
                    <Input
                      placeholder="Nome da empresa..."
                      value={searchFilters.razao_social}
                      onChange={(e) => setSearchFilters(f => ({ ...f, razao_social: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>CNAE</Label>
                    <Input
                      placeholder="Ex: 6201 (TI)"
                      value={searchFilters.cnae}
                      onChange={(e) => setSearchFilters(f => ({ ...f, cnae: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Município</Label>
                    <Input
                      placeholder="Ex: SAO PAULO"
                      value={searchFilters.municipio}
                      onChange={(e) => setSearchFilters(f => ({ ...f, municipio: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      UF
                      {searchFilters.razao_social.trim() && (
                        <span className="text-destructive text-xs">*obrigatório</span>
                      )}
                    </Label>
                    <Select value={searchFilters.uf || 'all'} onValueChange={(v) => setSearchFilters(f => ({ ...f, uf: v === 'all' ? '' : v }))}>
                      <SelectTrigger className={cn(filterValidationError && 'border-destructive')}>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {UF_LIST.map(uf => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Situação</Label>
                    <Select value={searchFilters.situacao || 'all'} onValueChange={(v) => setSearchFilters(f => ({ ...f, situacao: v === 'all' ? '' : v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="02">Ativa</SelectItem>
                        <SelectItem value="03">Suspensa</SelectItem>
                        <SelectItem value="04">Inapta</SelectItem>
                        <SelectItem value="08">Baixada</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Validation error */}
                {filterValidationError && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{filterValidationError}</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Filtro de Data de Abertura */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">
                  <CalendarIcon className="h-3 w-3 inline mr-1" />
                  Data de Abertura (máx. 1 ano de intervalo)
                </Label>
                
                <div className="flex flex-wrap gap-2 mb-4">
                  {DATE_PRESETS.map((preset) => (
                    <Button
                      key={preset.label}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => applyDatePreset(preset)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                  {(dateFrom || dateTo) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={clearDates}
                    >
                      Limpar datas
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">De</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn("w-[200px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}
                        >
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
                        <Button
                          variant="outline"
                          className={cn("w-[200px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}
                        >
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
                    <Badge variant="secondary" className="h-8">
                      <CalendarIcon className="h-3 w-3 mr-1" />
                      {dateRangeLabel}
                    </Badge>
                  )}
                </div>

                {dateRangeError && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{dateRangeError}</span>
                  </div>
                )}
              </div>

              <Separator />

              {/* Ações */}
              <div className="flex items-center gap-3">
                <Button 
                  onClick={() => handleSearch(1)} 
                  disabled={isSearchLoading || !!dateRangeError || !!filterValidationError} 
                  className="px-6"
                >
                  {isSearchLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                  Pesquisar
                </Button>
                {searchResults.length > 0 && (
                  <>
                    <Button variant="outline" onClick={handleExport}>
                      <Download className="h-4 w-4 mr-2" />
                      Exportar XLSX
                    </Button>
                    <Button variant="outline" onClick={() => setShowSaveDialog(true)}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Consulta
                    </Button>
                  </>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  Máx. {MAX_RESULTS} resultados por página
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Save dialog */}
          {showSaveDialog && (
            <Card className="border-primary/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <Input
                    placeholder="Nome da consulta (ex: Restaurantes SP 2024)"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveQuery()}
                    className="flex-1"
                  />
                  <Button onClick={handleSaveQuery} size="sm">
                    <Save className="h-4 w-4 mr-1" />
                    Salvar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowSaveDialog(false)}>
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress bar */}
          {isSearchLoading && (
            <SearchProgress isLoading={true} source="cnpj" />
          )}

          {/* Resultados */}
          {searchResults.length > 0 && !isSearchLoading && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Resultados
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{searchResults.length} nesta página</Badge>
                    {totalResults > 0 && <Badge variant="secondary">{totalResults} total</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Razão Social</TableHead>
                      <TableHead>Nome Fantasia</TableHead>
                      <TableHead>UF</TableHead>
                      <TableHead>Município</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Abertura</TableHead>
                      <TableHead>Situação</TableHead>
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((r: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell 
                          className="font-mono text-sm cursor-pointer hover:text-primary"
                          onClick={() => {
                            const fullCnpj = `${r.cnpj_basico || ''}${r.cnpj_ordem || ''}${r.cnpj_dv || ''}`;
                            if (fullCnpj.length === 14) {
                              setCnpj(formatCnpj(fullCnpj));
                              setActiveTab('lookup');
                              handleLookupDirect(fullCnpj);
                            }
                          }}
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
                              <Phone className="h-3 w-3 text-muted-foreground" />
                              ({r.ddd_telefone_1})
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {r.data_inicio_atividade ? formatDateDisplay(r.data_inicio_atividade) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.situacao_cadastral === '02' ? 'default' : 'secondary'} className="text-xs">
                            {r.situacao_cadastral === '02' ? 'Ativa' : r.situacao_cadastral}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Pesquisar no Google"
                            onClick={(e) => {
                              e.stopPropagation();
                              searchOnGoogle(r.nome_fantasia || r.razao_social);
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                
                {/* Paginação */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <span className="text-sm text-muted-foreground">Página {searchPage}</span>
                  <div className="flex gap-2">
                    {searchPage > 1 && (
                      <Button variant="outline" size="sm" onClick={() => handleSearch(searchPage - 1)}>
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Anterior
                      </Button>
                    )}
                    {searchResults.length >= MAX_RESULTS && (
                      <Button variant="outline" size="sm" onClick={() => handleSearch(searchPage + 1)}>
                        Próxima
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Consultas Salvas */}
        <TabsContent value="saved" className="space-y-4">
          {viewingSaved ? (
            <>
              {/* Viewing saved results */}
              <Card className="neon-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <BookmarkCheck className="h-5 w-5" />
                        {viewingSaved.name}
                      </CardTitle>
                      <CardDescription>
                        {viewingSaved.results_count} resultados · Salvo em {viewingSaved.created_at ? new Date(viewingSaved.created_at).toLocaleDateString('pt-BR') : '-'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleExportSaved} disabled={filteredSavedResults.length === 0}>
                        <Download className="h-4 w-4 mr-1" />
                        Exportar XLSX
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setViewingSaved(null); setSavedResultFilter(''); }}>
                        ← Voltar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <Input
                        placeholder="Filtrar resultados por nome, cidade, UF..."
                        value={savedResultFilter}
                        onChange={(e) => setSavedResultFilter(e.target.value)}
                      />
                    </div>
                    <Badge variant="secondary" className="h-10 px-3 flex items-center">
                      {filteredSavedResults.length} de {viewingSaved.leads?.length || 0}
                    </Badge>
                  </div>

                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>CNPJ</TableHead>
                        <TableHead>Razão Social</TableHead>
                        <TableHead>Nome Fantasia</TableHead>
                        <TableHead>UF</TableHead>
                        <TableHead>Município</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Situação</TableHead>
                        <TableHead className="w-[80px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSavedResults.map((r: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-sm">
                            {formatCnpj(`${r.cnpj_basico || ''}${r.cnpj_ordem || ''}${r.cnpj_dv || ''}`)}
                          </TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate">{r.razao_social}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{r.nome_fantasia || '-'}</TableCell>
                          <TableCell>{r.uf}</TableCell>
                          <TableCell>{r.municipio_nome || r.municipio || '-'}</TableCell>
                          <TableCell>
                            {r.ddd_telefone_1 ? (
                              <span className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                ({r.ddd_telefone_1})
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={r.situacao_cadastral === '02' ? 'default' : 'secondary'} className="text-xs">
                              {r.situacao_cadastral === '02' ? 'Ativa' : r.situacao_cadastral || '-'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              title="Pesquisar no Google"
                              onClick={() => searchOnGoogle(r.nome_fantasia || r.razao_social)}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredSavedResults.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            Nenhum resultado encontrado com esse filtro
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              {/* List of saved queries */}
              <Card className="neon-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookmarkCheck className="h-5 w-5" />
                    Consultas CNPJ Salvas
                  </CardTitle>
                  <CardDescription>Acesse resultados de consultas anteriores sem gastar novas buscas</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="Filtrar por nome..."
                    value={savedFilter}
                    onChange={(e) => setSavedFilter(e.target.value)}
                  />

                  {isSavedLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredSaved.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <BookmarkCheck className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p>Nenhuma consulta salva</p>
                      <p className="text-xs mt-1">Use a aba "Pesquisa Avançada" e clique em "Salvar Consulta"</p>
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
    </div>
  );

  async function handleLookupDirect(cleanCnpj: string) {
    setIsLookupLoading(true);
    setLookupResult(null);
    try {
      const data = await cnpjApi.lookup(cleanCnpj);
      setLookupResult(data);
    } catch (error: any) {
      toast({ title: 'Erro na consulta', description: error.message, variant: 'destructive' });
    } finally {
      setIsLookupLoading(false);
    }
  }
}

// Helper components
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
