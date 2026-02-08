export interface User {
  id: string;
  email: string;
  name: string;
  role: 'superadmin' | 'admin' | 'user';
  planId: string;
  createdAt: string;
  createdBy?: string;
  createdByName?: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string;
  monthlySearches: number;
  monthlyLeads: number;
  whatsappVerifications: number;
  price: number;
  features: string[];
  isActive: boolean;
  createdAt: string;
}

export interface UserUsage {
  userId: string;
  month: string; // YYYY-MM
  searchesUsed: number;
  leadsExtracted: number;
  whatsappVerified: number;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}
