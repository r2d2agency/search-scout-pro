import { Lead, SearchResult, AdminSettings, PaginationInfo } from '@/types/lead';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Helper para fazer requisições
async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
    throw new Error(error.message || `Erro ${response.status}`);
  }

  return response.json();
}

// Pesquisa SERP
export async function searchSerp(
  query: string,
  page: number = 1
): Promise<{ results: SearchResult[]; pagination: PaginationInfo }> {
  return fetchApi('/search', {
    method: 'POST',
    body: JSON.stringify({ query, page }),
  });
}

// Extrair leads dos resultados
export async function extractLeads(
  results: SearchResult[],
  searchTerm: string
): Promise<Lead[]> {
  return fetchApi('/extract-leads', {
    method: 'POST',
    body: JSON.stringify({ results, searchTerm }),
  });
}

// Verificar WhatsApp via Evolution API
export async function verifyWhatsApp(phone: string): Promise<{ valid: boolean }> {
  return fetchApi('/verify-whatsapp', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  });
}

// Buscar todos os leads salvos
export async function getLeads(
  page: number = 1,
  limit: number = 30
): Promise<{ leads: Lead[]; total: number }> {
  return fetchApi(`/leads?page=${page}&limit=${limit}`);
}

// Salvar lead
export async function saveLead(lead: Omit<Lead, 'id' | 'createdAt'>): Promise<Lead> {
  return fetchApi('/leads', {
    method: 'POST',
    body: JSON.stringify(lead),
  });
}

// Salvar múltiplos leads
export async function saveLeads(leads: Omit<Lead, 'id' | 'createdAt'>[]): Promise<Lead[]> {
  return fetchApi('/leads/bulk', {
    method: 'POST',
    body: JSON.stringify({ leads }),
  });
}

// Deletar lead
export async function deleteLead(id: string): Promise<void> {
  return fetchApi(`/leads/${id}`, {
    method: 'DELETE',
  });
}

// Exportar leads para CSV
export function exportToCSV(leads: Lead[]): void {
  const headers = ['Empresa', 'Website', 'Telefone', 'WhatsApp', 'Email', 'WhatsApp Válido', 'Fonte', 'Termo de Pesquisa', 'Data'];
  
  const rows = leads.map(lead => [
    lead.company,
    lead.website || '',
    lead.phone || '',
    lead.whatsapp || '',
    lead.email || '',
    lead.whatsappValid === null ? 'Não verificado' : lead.whatsappValid ? 'Sim' : 'Não',
    lead.source,
    lead.searchTerm,
    new Date(lead.createdAt).toLocaleDateString('pt-BR'),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

// Admin Settings
export async function getSettings(): Promise<AdminSettings> {
  return fetchApi('/settings');
}

export async function saveSettings(settings: AdminSettings): Promise<void> {
  return fetchApi('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}
