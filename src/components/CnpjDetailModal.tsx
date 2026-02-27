import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Building2, MapPin, Users, Phone, Loader2, Search } from 'lucide-react';
import { cnpjApi } from '@/lib/apiClient';
import { toast } from '@/hooks/use-toast';

interface CnpjDetailModalProps {
  cnpj: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUseCnaeAsFilter?: (cnae: string) => void;
  /** Pre-loaded data from search results to avoid re-fetching */
  preloadedData?: any;
}

function formatDateDisplay(dateStr: string) {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.slice(6, 8)}/${dateStr.slice(4, 6)}/${dateStr.slice(0, 4)}`;
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

export function CnpjDetailModal({ cnpj, open, onOpenChange, onUseCnaeAsFilter, preloadedData }: CnpjDetailModalProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenChange = (isOpen: boolean) => {
    onOpenChange(isOpen);
    if (!isOpen) {
      setData(null);
    }
  };

  // Always fetch full data via lookup to get sócios, use preloaded for instant display
  useEffect(() => {
    if (!open || !cnpj) return;
    
    // Show preloaded data immediately while fetching full details
    if (preloadedData) {
      setData(preloadedData);
    }

    // Always do lookup to get complete data (including sócios)
    setIsLoading(true);
    cnpjApi.lookup(cnpj)
      .then(result => setData(result))
      .catch((error: any) => {
        // If lookup fails but we have preloaded data, keep showing it
        if (!preloadedData) {
          toast({ title: 'Erro na consulta', description: error.message, variant: 'destructive' });
          handleOpenChange(false);
        }
      })
      .finally(() => setIsLoading(false));
  }, [open, cnpj]);

  const emp = data?.empresa || data || {};
  const est = data?.estabelecimento || data || {};
  const socios = data?.socios || data?.qsa || emp.socios || [];

  const razaoSocial = emp.razao_social || est.razao_social || '';
  const nomeFantasia = est.nome_fantasia || emp.nome_fantasia || '';
  const capitalSocial = emp.capital_social || data?.capital_social;
  const natureza = emp.natureza_descricao || emp.natureza_juridica_descricao || data?.natureza_juridica || '';
  const situacao = est.situacao_cadastral || data?.situacao_cadastral || '';
  const situacaoDesc = est.situacao_cadastral_descricao || data?.situacao_cadastral_descricao || '';
  const dataAbertura = est.data_inicio_atividade || data?.data_inicio_atividade || data?.data_abertura || '';
  const porte = emp.porte_empresa_descricao || emp.porte || data?.porte_empresa_descricao || data?.porte || '';

  const cnaePrincipal = est.cnae_fiscal_principal || est.cnae_principal || data?.cnae_fiscal_principal || '';
  const cnaePrincipalDesc = est.cnae_fiscal_principal_descricao || est.cnae_principal_descricao || data?.cnae_fiscal_principal_descricao || '';
  const cnaesSecundarios = est.cnaes_secundarios || est.cnaes_fiscais_secundarios || data?.cnaes_secundarios || [];

  const tipoLogradouro = est.tipo_logradouro || data?.tipo_logradouro || '';
  const logradouro = est.logradouro || data?.logradouro || '';
  const numero = est.numero || data?.numero || '';
  const complemento = est.complemento || data?.complemento || '';
  const bairro = est.bairro || data?.bairro || '';
  const municipio = est.municipio_nome || est.municipio || data?.municipio || '';
  const uf = est.uf || data?.uf || '';
  const cep = est.cep || data?.cep || '';

  const tel1 = est.ddd_telefone_1 || data?.ddd_telefone_1 || data?.telefone || '';
  const tel2 = est.ddd_telefone_2 || data?.ddd_telefone_2 || '';
  const email = est.email || est.correio_eletronico || data?.email || data?.correio_eletronico || '';

  const simples = data?.simples || {};

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {isLoading ? 'Carregando...' : (razaoSocial || 'Detalhes da Empresa')}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh] px-6 pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : data ? (
            <div className="space-y-4 mt-4">
              {/* Status */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={situacao === '02' || situacaoDesc?.toLowerCase() === 'ativa' ? 'default' : 'destructive'}>
                  {situacao === '02' || situacaoDesc?.toLowerCase() === 'ativa' ? 'Ativa' : situacaoDesc || `Situação: ${situacao || 'N/A'}`}
                </Badge>
                {porte && <Badge variant="secondary">{porte}</Badge>}
                {simples?.opcao_pelo_simples !== undefined && (
                  <Badge variant={simples.opcao_pelo_simples ? 'default' : 'secondary'}>
                    Simples: {simples.opcao_pelo_simples ? 'Sim' : 'Não'}
                  </Badge>
                )}
                {simples?.opcao_pelo_mei !== undefined && (
                  <Badge variant={simples.opcao_pelo_mei ? 'default' : 'secondary'}>
                    MEI: {simples.opcao_pelo_mei ? 'Sim' : 'Não'}
                  </Badge>
                )}
              </div>

              {/* Dados da Empresa */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm flex items-center gap-1"><Building2 className="h-4 w-4" /> Empresa</h3>
                  <div className="space-y-1 p-3 rounded-lg bg-muted/50">
                    <InfoRow label="Razão Social" value={razaoSocial} />
                    <InfoRow label="Nome Fantasia" value={nomeFantasia} />
                    <InfoRow label="Capital Social" value={capitalSocial ? `R$ ${Number(capitalSocial).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
                    <InfoRow label="Natureza Jurídica" value={natureza} />
                    <InfoRow label="Data de Abertura" value={dataAbertura ? formatDateDisplay(dataAbertura) : null} />
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-sm flex items-center gap-1"><MapPin className="h-4 w-4" /> Endereço & Contato</h3>
                  <div className="space-y-1 p-3 rounded-lg bg-muted/50">
                    <InfoRow label="Logradouro" value={logradouro ? `${tipoLogradouro} ${logradouro}, ${numero}`.trim() : null} />
                    <InfoRow label="Complemento" value={complemento} />
                    <InfoRow label="Bairro" value={bairro} />
                    <InfoRow label="Município/UF" value={municipio ? `${municipio} - ${uf}` : uf} />
                    <InfoRow label="CEP" value={cep} />
                    <Separator className="my-1" />
                    <InfoRow label="Telefone 1" value={tel1 ? (tel1.includes('(') ? tel1 : `(${tel1})`) : null} />
                    <InfoRow label="Telefone 2" value={tel2 ? (tel2.includes('(') ? tel2 : `(${tel2})`) : null} />
                    <InfoRow label="E-mail" value={email} />
                  </div>
                </div>
              </div>

              {/* CNAE */}
              {cnaePrincipal && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">CNAE Principal</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className="cursor-pointer hover:bg-primary/10 hover:border-primary transition-colors"
                        onClick={() => onUseCnaeAsFilter?.(cnaePrincipal)}
                      >
                        {cnaePrincipal}
                        <Search className="h-3 w-3 ml-1" />
                      </Badge>
                      {cnaePrincipalDesc && <span className="text-xs text-muted-foreground">{cnaePrincipalDesc}</span>}
                    </div>
                    {cnaesSecundarios.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">CNAEs Secundários ({cnaesSecundarios.length})</span>
                        <div className="flex flex-wrap gap-1">
                          {cnaesSecundarios.map((cnae: any, idx: number) => {
                            const code = typeof cnae === 'string' ? cnae : cnae.codigo || cnae.code || cnae.cnae || '';
                            if (!code) return null;
                            return (
                              <Badge
                                key={idx}
                                variant="secondary"
                                className="cursor-pointer hover:bg-primary/20 text-xs"
                                onClick={() => onUseCnaeAsFilter?.(code)}
                              >
                                {code}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Sócios */}
              {socios.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      Sócios ({socios.length})
                    </h3>
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Qualificação</TableHead>
                            <TableHead>Data de Entrada</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {socios.map((socio: any, i: number) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">{socio.nome_socio || socio.nome || ''}</TableCell>
                              <TableCell>{socio.qualificacao_descricao || socio.qualificacao || socio.qualificacao_socio || ''}</TableCell>
                              <TableCell>{(socio.data_entrada || socio.data_entrada_sociedade) ? formatDateDisplay(socio.data_entrada || socio.data_entrada_sociedade) : '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
