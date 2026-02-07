export interface Lead {
  id: string;
  company: string;
  website: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  whatsappValid: boolean | null;
  source: string;
  searchTerm: string;
  createdAt: string;
}

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
}

export interface SerpResponse {
  organic_results: SearchResult[];
  search_metadata: {
    total_results: number;
    next_page_token?: string;
  };
}

export interface AdminSettings {
  serpApiKey: string;
  evolutionApiUrl: string;
  evolutionApiKey: string;
  evolutionInstance: string;
}

export interface PaginationInfo {
  currentPage: number;
  totalResults: number;
  hasMore: boolean;
  nextPageToken?: string;
}
