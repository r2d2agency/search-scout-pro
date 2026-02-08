// Cliente HTTP para comunicação com o backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
    const error = await response.json().catch(() => ({ message: 'Erro desconhecido' }));
    throw new Error(error.message || `Erro ${response.status}`);
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
