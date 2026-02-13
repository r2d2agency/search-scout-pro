import { useState, useMemo } from 'react';
import { cnpjApi } from '@/lib/apiClient';
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
  Filter
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { exportToXLSX } from '@/lib/api';
import { format, differenceInDays, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const UF_LIST = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
];

const MAX_RANGE_DAYS = 366;
const MAX_RESULTS = 100;

// Atalhos de período
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
  return format(date, 'yyyyMMdd');
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

  // Validação do range de datas
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

  // Format CNPJ
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

  const handleExport = () => {
    if (searchResults.length === 0) return;
    const formatted = searchResults.map((r: any, idx: number) => ({
      id: String(idx),
      company: r.razao_social || '',
      website: null,
      phone: null,
      whatsapp: null,
      email: null,
      whatsappValid: null,
      source: 'CNPJ',
      searchTerm: `${r.cnpj_basico || ''}`,
      bio: `${r.nome_fantasia || ''} - ${r.uf || ''} ${r.municipio_nome || ''}`,
      createdAt: new Date().toISOString(),
    }));
    exportToXLSX(formatted as any);
    toast({ title: 'Exportado com sucesso!' });
  };

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
                  <InfoRow label="CNAE Principal" value={lookupResult.estabelecimento?.cnae_principal} />
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
                    Endereço
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <InfoRow label="Logradouro" value={`${lookupResult.estabelecimento?.logradouro || ''}, ${lookupResult.estabelecimento?.numero || ''}`} />
                  <InfoRow label="Complemento" value={lookupResult.estabelecimento?.complemento} />
                  <InfoRow label="Bairro" value={lookupResult.estabelecimento?.bairro} />
                  <InfoRow label="Município" value={lookupResult.estabelecimento?.municipio_nome} />
                  <InfoRow label="UF" value={lookupResult.estabelecimento?.uf} />
                  <InfoRow label="CEP" value={lookupResult.estabelecimento?.cep} />
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
                    <Label>UF</Label>
                    <Select value={searchFilters.uf || 'all'} onValueChange={(v) => setSearchFilters(f => ({ ...f, uf: v === 'all' ? '' : v }))}>
                      <SelectTrigger>
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
              </div>

              <Separator />

              {/* Filtro de Data de Abertura */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">
                  <CalendarIcon className="h-3 w-3 inline mr-1" />
                  Data de Abertura (máx. 1 ano de intervalo)
                </Label>
                
                {/* Atalhos de período */}
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

                {/* Date pickers */}
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">De</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-[200px] justify-start text-left font-normal",
                            !dateFrom && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateFrom ? format(dateFrom, "dd/MM/yyyy", { locale: ptBR }) : "Data inicial"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateFrom}
                          onSelect={setDateFrom}
                          disabled={(date) => date > new Date()}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm">Até</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-[200px] justify-start text-left font-normal",
                            !dateTo && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateTo ? format(dateTo, "dd/MM/yyyy", { locale: ptBR }) : "Data final"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateTo}
                          onSelect={setDateTo}
                          disabled={(date) => date > new Date()}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Info do range */}
                  {dateRangeLabel && !dateRangeError && (
                    <Badge variant="secondary" className="h-8">
                      <CalendarIcon className="h-3 w-3 mr-1" />
                      {dateRangeLabel}
                    </Badge>
                  )}
                </div>

                {/* Erro de validação */}
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
                  disabled={isSearchLoading || !!dateRangeError} 
                  className="px-6"
                >
                  {isSearchLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                  Pesquisar
                </Button>
                {searchResults.length > 0 && (
                  <Button variant="outline" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar XLSX
                  </Button>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  Máx. {MAX_RESULTS} resultados por página
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Resultados */}
          {searchResults.length > 0 && (
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
                      <TableHead>Abertura</TableHead>
                      <TableHead>Situação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {searchResults.map((r: any, i: number) => (
                      <TableRow key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                        const fullCnpj = `${r.cnpj_basico || ''}${r.cnpj_ordem || ''}${r.cnpj_dv || ''}`;
                        if (fullCnpj.length === 14) {
                          setCnpj(formatCnpj(fullCnpj));
                          setActiveTab('lookup');
                          handleLookupDirect(fullCnpj);
                        }
                      }}>
                        <TableCell className="font-mono text-sm">
                          {formatCnpj(`${r.cnpj_basico || ''}${r.cnpj_ordem || ''}${r.cnpj_dv || ''}`)}
                        </TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{r.razao_social}</TableCell>
                        <TableCell className="max-w-[150px] truncate">{r.nome_fantasia || '-'}</TableCell>
                        <TableCell>{r.uf}</TableCell>
                        <TableCell>{r.municipio_nome || r.municipio || '-'}</TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {r.data_inicio_atividade ? formatDateDisplay(r.data_inicio_atividade) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={r.situacao_cadastral === '02' ? 'default' : 'secondary'} className="text-xs">
                            {r.situacao_cadastral === '02' ? 'Ativa' : r.situacao_cadastral}
                          </Badge>
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
