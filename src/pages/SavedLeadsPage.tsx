import { useState, useEffect } from 'react';
import { Lead } from '@/types/lead';
import { LeadsTable } from '@/components/LeadsTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { exportToCSV } from '@/lib/api';
import { Download, Search, Trash2, RefreshCw } from 'lucide-react';

const SavedLeadsPage = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Mock: carregar leads salvos do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('saved_leads');
    if (saved) {
      try {
        setLeads(JSON.parse(saved));
      } catch {
        console.error('Erro ao carregar leads');
      }
    }
  }, []);

  const filteredLeads = leads.filter(lead => 
    lead.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.searchTerm.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRefresh = async () => {
    setIsLoading(true);
    // TODO: Implementar refresh do banco
    await new Promise(resolve => setTimeout(resolve, 500));
    setIsLoading(false);
  };

  const handleClearAll = () => {
    if (confirm('Tem certeza que deseja excluir todos os leads salvos?')) {
      setLeads([]);
      localStorage.removeItem('saved_leads');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leads Salvos</h1>
        <p className="text-muted-foreground">
          Gerencie todos os leads extraídos e salvos
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por empresa, termo ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button 
            variant="outline" 
            onClick={() => exportToCSV(filteredLeads)}
            disabled={filteredLeads.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>

          <Button 
            variant="destructive" 
            onClick={handleClearAll}
            disabled={leads.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Limpar Tudo
          </Button>
        </div>
      </div>

      {filteredLeads.length > 0 ? (
        <>
          <LeadsTable 
            leads={filteredLeads} 
            onVerifyWhatsApp={() => {}}
          />
          <p className="text-center text-sm text-muted-foreground">
            {filteredLeads.length} lead(s) encontrado(s)
          </p>
        </>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {leads.length === 0 
              ? 'Nenhum lead salvo ainda. Faça uma pesquisa para começar!'
              : 'Nenhum lead encontrado com os filtros aplicados.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default SavedLeadsPage;
