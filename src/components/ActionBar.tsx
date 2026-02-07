import { Button } from '@/components/ui/button';
import { 
  Download, 
  Save, 
  Trash2, 
  CheckCircle2, 
  Loader2,
  LayoutGrid,
  Table2
} from 'lucide-react';
import { Lead } from '@/types/lead';
import { exportToCSV } from '@/lib/api';

interface ActionBarProps {
  leads: Lead[];
  onSaveAll: () => void;
  onVerifyAll: () => void;
  onClear: () => void;
  viewMode: 'cards' | 'table';
  onViewModeChange: (mode: 'cards' | 'table') => void;
  isLoading: boolean;
}

export function ActionBar({ 
  leads, 
  onSaveAll, 
  onVerifyAll, 
  onClear, 
  viewMode,
  onViewModeChange,
  isLoading 
}: ActionBarProps) {
  const unverifiedCount = leads.filter(l => l.whatsapp && l.whatsappValid === null).length;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1 p-1 bg-secondary rounded-lg">
        <Button
          variant={viewMode === 'cards' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onViewModeChange('cards')}
          className="h-8"
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          variant={viewMode === 'table' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => onViewModeChange('table')}
          className="h-8"
        >
          <Table2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1" />

      {unverifiedCount > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={onVerifyAll}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-2 h-4 w-4" />
          )}
          Verificar Todos ({unverifiedCount})
        </Button>
      )}

      <Button
        variant="outline"
        size="sm"
        onClick={() => exportToCSV(leads)}
        disabled={leads.length === 0}
      >
        <Download className="mr-2 h-4 w-4" />
        Exportar CSV
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onSaveAll}
        disabled={leads.length === 0 || isLoading}
      >
        <Save className="mr-2 h-4 w-4" />
        Salvar
      </Button>

      <Button
        variant="destructive"
        size="sm"
        onClick={onClear}
        disabled={leads.length === 0}
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Limpar
      </Button>
    </div>
  );
}
