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

// Normalizar número de WhatsApp para formato 55DDDnúmero
function normalizeWhatsApp(phone: string | null): string {
  if (!phone) return '';
  // Remove tudo que não é dígito
  let digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  // Se já começa com 55 e tem 12-13 dígitos, está ok
  if (digits.startsWith('55') && digits.length >= 12 && digits.length <= 13) {
    return digits;
  }
  // Se começa com +55, já removemos o +
  if (digits.startsWith('55') && digits.length < 12) {
    return digits;
  }
  // Se não começa com 55, adicionar
  if (!digits.startsWith('55')) {
    // Se tem 10-11 dígitos (DDD + número), adicionar 55
    if (digits.length >= 10 && digits.length <= 11) {
      digits = '55' + digits;
    }
    // Se tem 8-9 dígitos (só número sem DDD), não tem como saber o DDD
  }
  return digits;
}

// Exportar leads para XLSX com dados completos
export function exportToXLSX(leads: Lead[]): void {
  import('xlsx').then(XLSX => {
    // Preparar dados para a planilha
    const data = leads.map(lead => {
      const serpData = lead.serpData || ({} as any);
      
      return {
        'Empresa': lead.company || '',
        'Website': lead.website || '',
        'Telefone': lead.phone || '',
        'WhatsApp': normalizeWhatsApp(lead.whatsapp || lead.phone),
        'Email': lead.email || '',
        'WhatsApp Válido': lead.whatsappValid === null ? 'Não verificado' : lead.whatsappValid ? 'Sim' : 'Não',
        'Fonte': lead.source || '',
        'Termo de Pesquisa': lead.searchTerm || '',
        'Data': new Date(lead.createdAt).toLocaleDateString('pt-BR'),
        // Dados do Google Meu Negócio
        'Endereço': serpData.address || '',
        'Avaliação': serpData.rating || '',
        'Num. Avaliações': serpData.ratingCount || serpData.reviews || '',
        'Categoria': serpData.category || serpData.type || '',
        'Horário': typeof serpData.openingHours === 'object' 
          ? JSON.stringify(serpData.openingHours) 
          : serpData.openingHours || '',
        'Faixa de Preço': serpData.priceLevel || '',
        'Descrição': serpData.description || serpData.snippet || '',
        'Latitude': serpData.latitude || '',
        'Longitude': serpData.longitude || '',
        'Google Maps URL': serpData.googleMapsUrl || '',
        'Place ID': serpData.placeId || '',
        'CID': serpData.cid || ''
      };
    });

    // Criar workbook e worksheet
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Leads');

    // Ajustar largura das colunas
    const colWidths = [
      { wch: 30 }, // Empresa
      { wch: 35 }, // Website
      { wch: 15 }, // Telefone
      { wch: 15 }, // WhatsApp
      { wch: 25 }, // Email
      { wch: 15 }, // WhatsApp Válido
      { wch: 20 }, // Fonte
      { wch: 25 }, // Termo de Pesquisa
      { wch: 12 }, // Data
      { wch: 40 }, // Endereço
      { wch: 10 }, // Avaliação
      { wch: 15 }, // Num. Avaliações
      { wch: 20 }, // Categoria
      { wch: 30 }, // Horário
      { wch: 15 }, // Faixa de Preço
      { wch: 50 }, // Descrição
      { wch: 15 }, // Latitude
      { wch: 15 }, // Longitude
      { wch: 40 }, // Google Maps URL
      { wch: 25 }, // Place ID
      { wch: 20 }, // CID
    ];
    worksheet['!cols'] = colWidths;

    // Baixar arquivo
    XLSX.writeFile(workbook, `leads_${new Date().toISOString().split('T')[0]}.xlsx`);
  });
}

// Manter CSV como backup
export function exportToCSV(leads: Lead[]): void {
  const headers = [
    'Empresa', 'Website', 'Telefone', 'WhatsApp', 'Email', 'WhatsApp Válido',
    'Fonte', 'Termo de Pesquisa', 'Data', 'Endereço', 'Avaliação', 'Num. Avaliações',
    'Categoria', 'Horário', 'Faixa de Preço'
  ];
  
  const rows = leads.map(lead => {
    const serpData = lead.serpData || ({} as any);
    return [
      lead.company, lead.website || '', lead.phone || '', lead.whatsapp || '',
      lead.email || '', lead.whatsappValid === null ? 'Não verificado' : lead.whatsappValid ? 'Sim' : 'Não',
      lead.source, lead.searchTerm, new Date(lead.createdAt).toLocaleDateString('pt-BR'),
      serpData.address || '', serpData.rating || '', serpData.ratingCount || '',
      serpData.category || '', serpData.openingHours || '', serpData.priceLevel || ''
    ];
  });

  const escapeCSV = (value: any): string => {
    const str = String(value || '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    headers.map(h => escapeCSV(h)).join(','),
    ...rows.map(row => row.map(cell => escapeCSV(cell)).join(',')),
  ].join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `leads_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Exportar leads para JSON completo
export function exportToJSON(leads: Lead[]): void {
  const data = JSON.stringify(leads, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `leads_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
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
