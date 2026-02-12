// Cliente HTTP para comunicação com o backend
// Sempre usamos mesma origem ("/api") para evitar CORS; em produção o Nginx faz proxy para o backend.
const API_BASE_URL = '/api';
// Token storage
let authToken: string | null = localStorage.getItem('auth_token');

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

export function getAuthToken() {
  return authToken;
}

// Fetch wrapper com autenticação
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token expirado ou inválido
    setAuthToken(null);
    window.location.href = '/login';
    throw new Error('Sessão expirada');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({} as any));
    const message = [error?.message, error?.details].filter(Boolean).join(': ');
    throw new Error(message || `Erro ${response.status}`);
  }

  return response.json();
}

// API Auth
export const authApi = {
  async login(email: string, password: string) {
    const data = await apiRequest<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAuthToken(data.token);
    return data;
  },

  async register(email: string, password: string, name: string) {
    const data = await apiRequest<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });
    setAuthToken(data.token);
    return data;
  },

  async me() {
    return apiRequest<any>('/auth/me');
  },

  logout() {
    setAuthToken(null);
  },
};

// API Users
export const usersApi = {
  async list() {
    return apiRequest<any[]>('/users');
  },

  async create(data: { email: string; password: string; name: string; role?: string; planId?: string }) {
    return apiRequest<any>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any) {
    return apiRequest<any>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return apiRequest<void>(`/users/${id}`, { method: 'DELETE' });
  },

  async getUsage(id: string) {
    return apiRequest<any>(`/users/${id}/usage`);
  },

  async getGlobalStats() {
    return apiRequest<{
      month: string;
      users: { total: number; byRole: Record<string, number> };
      usage: { totalSearches: number; totalLeads: number; totalWhatsapp: number };
      serpKeys: { total: number; active: number; usage: number; limit: number };
      topUsers: Array<{
        id: string;
        name: string;
        email: string;
        planId: string;
        planName: string;
        usage: { searches: number; leads: number; whatsapp: number };
        limits: { searches: number; leads: number; whatsapp: number };
      }>;
    }>('/users/stats/global');
  },
};

// API Plans
export const plansApi = {
  async list() {
    return apiRequest<any[]>('/plans');
  },

  async create(data: any) {
    return apiRequest<any>('/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: any) {
    return apiRequest<any>(`/plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return apiRequest<void>(`/plans/${id}`, { method: 'DELETE' });
  },
};

// API Leads
export const leadsApi = {
  async list(page = 1, limit = 30) {
    return apiRequest<{ leads: any[]; total: number }>(`/leads?page=${page}&limit=${limit}`);
  },

  async save(lead: any) {
    return apiRequest<any>('/leads', {
      method: 'POST',
      body: JSON.stringify(lead),
    });
  },

  async saveBulk(leads: any[]) {
    return apiRequest<any[]>('/leads/bulk', {
      method: 'POST',
      body: JSON.stringify({ leads }),
    });
  },

  async delete(id: string) {
    return apiRequest<void>(`/leads/${id}`, { method: 'DELETE' });
  },

  async checkLimit(type: 'search' | 'leads' | 'whatsapp', count = 1) {
    return apiRequest<{ allowed: boolean }>('/leads/check-limit', {
      method: 'POST',
      body: JSON.stringify({ type, count }),
    });
  },
};

// API Settings
export const settingsApi = {
  async get() {
    return apiRequest<any>('/settings');
  },

  async save(settings: any) {
    return apiRequest<void>('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },

  async getBrand() {
    return apiRequest<any>('/settings/brand');
  },

  async saveBrand(brand: any) {
    return apiRequest<void>('/settings/brand', {
      method: 'PUT',
      body: JSON.stringify(brand),
    });
  },

  // Chaves de API do usuário
  async getApiKeys() {
    return apiRequest<Record<string, {
      hasKey: boolean;
      maskedKey: string;
      isActive: boolean;
      updatedAt: string;
    }>>('/settings/api-keys');
  },

  async saveApiKey(keyType: string, apiKey: string) {
    return apiRequest<{ message: string }>(`/settings/api-keys/${keyType}`, {
      method: 'PUT',
      body: JSON.stringify({ apiKey }),
    });
  },
};

// API SERP Keys
export const serpKeysApi = {
  async list() {
    return apiRequest<any[]>('/serp-keys');
  },

  async create(data: { name: string; apiKey: string; monthlyLimit?: number }) {
    return apiRequest<any>('/serp-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: { name?: string; apiKey?: string; isActive?: boolean; monthlyLimit?: number }) {
    return apiRequest<any>(`/serp-keys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return apiRequest<void>(`/serp-keys/${id}`, { method: 'DELETE' });
  },

  async resetUsage() {
    return apiRequest<void>('/serp-keys/reset-usage', { method: 'POST' });
  },
};

// API Apify Keys (Instagram)
export const apifyKeysApi = {
  async list() {
    return apiRequest<any[]>('/apify-keys');
  },

  async create(data: { name: string; apiKey: string; monthlyLimit?: number }) {
    return apiRequest<any>('/apify-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: { name?: string; apiKey?: string; isActive?: boolean; monthlyLimit?: number }) {
    return apiRequest<any>(`/apify-keys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return apiRequest<void>(`/apify-keys/${id}`, { method: 'DELETE' });
  },

  async resetUsage() {
    return apiRequest<void>('/apify-keys/reset-usage', { method: 'POST' });
  },
};

// API Firecrawl Keys (Instagram via Firecrawl)
export const firecrawlKeysApi = {
  async list() {
    return apiRequest<any[]>('/firecrawl-keys');
  },

  async create(data: { name: string; apiKey: string; monthlyLimit?: number }) {
    return apiRequest<any>('/firecrawl-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: { name?: string; apiKey?: string; isActive?: boolean; monthlyLimit?: number }) {
    return apiRequest<any>(`/firecrawl-keys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return apiRequest<void>(`/firecrawl-keys/${id}`, { method: 'DELETE' });
  },

  async resetUsage() {
    return apiRequest<void>('/firecrawl-keys/reset-usage', { method: 'POST' });
  },
};

// API Search (usa chaves SERP globais)
export const searchApi = {
  async search(query: string, page = 1) {
    return apiRequest<{
      leads: any[];
      pagination: {
        currentPage: number;
        totalResults: number;
        hasMore: boolean;
        nextPageToken?: string;
      };
      searchMetadata: {
        searchId?: string;
        totalResults?: number;
        timeTaken?: string;
      };
    }>('/search', {
      method: 'POST',
      body: JSON.stringify({ query, page }),
    });
  },
};

// API Instagram (via Apify)
export const instagramApi = {
  async search(query: string, limit = 20) {
    return apiRequest<{
      leads: any[];
      pagination: {
        currentPage: number;
        totalResults: number;
        hasMore: boolean;
      };
      searchMetadata: {
        source: string;
        query: string;
        totalResults: number;
      };
    }>('/instagram/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit }),
    });
  },

  async getProfile(username: string) {
    return apiRequest<{
      username: string;
      fullName: string;
      biography: string;
      externalUrl: string;
      followersCount: number;
      followingCount: number;
      postsCount: number;
      isVerified: boolean;
      isBusinessAccount: boolean;
      businessCategory: string;
      profilePicUrl: string;
      email: string | null;
      phone: string | null;
    }>('/instagram/profile', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  },

  async getSuggestions(query: string) {
    return apiRequest<{
      suggestions: Array<{
        username: string;
        fullName: string;
        profilePicUrl: string;
        followersCount: number;
        isVerified: boolean;
        isBusinessAccount: boolean;
      }>;
    }>('/instagram/suggestions', {
      method: 'POST',
      body: JSON.stringify({ query }),
    });
  },
};

// API Instagram via Firecrawl (alternativa mais rápida)
export const instagramFirecrawlApi = {
  async search(query: string, limit = 20, page = 1) {
    return apiRequest<{
      leads: any[];
      pagination: {
        currentPage: number;
        totalResults: number;
        hasMore: boolean;
      };
      searchMetadata: {
        source: string;
        query: string;
        totalResults: number;
      };
    }>('/instagram-firecrawl/search', {
      method: 'POST',
      body: JSON.stringify({ query, limit, page }),
    });
  },

  async getProfile(username: string) {
    return apiRequest<{
      username: string;
      fullName: string;
      biography: string;
      externalUrl: string;
      followersCount: number;
      followingCount: number;
      postsCount: number;
      isVerified: boolean;
      isBusinessAccount: boolean;
      businessCategory: string;
      profilePicUrl: string;
      email: string | null;
      phone: string | null;
      whatsapp: string | null;
      whatsappFromLink: boolean;
    }>('/instagram-firecrawl/profile', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
  },
};

// API Saved Searches (pesquisas salvas)
export const savedSearchesApi = {
  async list() {
    return apiRequest<Array<{
      id: string;
      name: string;
      query: string;
      results_count: number;
      created_at: string;
      updated_at: string;
    }>>('/saved-searches');
  },

  async get(id: string) {
    return apiRequest<{
      id: string;
      name: string;
      query: string;
      results_count: number;
      leads: any[];
      created_at: string;
      updated_at: string;
    }>(`/saved-searches/${id}`);
  },

  async save(data: { name: string; query: string; leads: any[] }) {
    return apiRequest<any>('/saved-searches', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: { name?: string; leads?: any[] }) {
    return apiRequest<any>(`/saved-searches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string) {
    return apiRequest<void>(`/saved-searches/${id}`, { method: 'DELETE' });
  },
};
